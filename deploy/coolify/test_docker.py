"""Real Docker/PostgreSQL release-gate tests. Uses only disposable named resources."""

import json
import os
import secrets
import shutil
import subprocess
import time
from pathlib import Path
import sys
import tempfile

# Run as root on a disposable Docker-capable test host (CI uses sudo).
assert os.geteuid() == 0, "Run this isolated Docker test with sudo"
root = Path(tempfile.mkdtemp(prefix="nelcota-gate-check-"))
source = Path(__file__).resolve().parent
client = root / "client"
client.mkdir(mode=0o755)
shutil.copyfile(source / "start.sh", client / "start.sh")
(client / "start.sh").chmod(0o755)
network = "nelcota-gate-check-" + secrets.token_hex(4)
db = network + "-postgres"
app = network + "-app"
sha = "a" * 40
badsha = "b" * 40
image = sys.argv[1]
containers = []
gate = None
results = {}
password = secrets.token_hex(24)
env = dict(os.environ, POSTGRES_PASSWORD=password)


def run(args, **kw):
    return subprocess.run(
        args, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kw
    ).stdout


def sql(query, database="nelcota_test"):
    return (
        run(
            [
                "docker",
                "exec",
                "-i",
                db,
                "psql",
                "-U",
                "postgres",
                "-d",
                database,
                "-At",
                "-v",
                "ON_ERROR_STOP=1",
            ],
            input=query.encode(),
        )
        .decode()
        .strip()
    )


def stop_gate():
    global gate
    if gate is not None:
        gate.terminate()
        gate.wait(timeout=10)
        gate = None


def start_gate(database="nelcota_test"):
    global gate
    stop_gate()
    (client / "gate.sock").unlink(missing_ok=True)
    config = {
        "application_uuid": app,
        "database_container": db,
        "database": database,
        "network": network,
        "backup_directory": str(root / "backups"),
        "socket": str(client / "gate.sock"),
        "socket_gid": 1001,
        "migrator_database_url": f"postgresql://nelcota_migrator:{password}@{db}:5432/nelcota_test",
    }
    p = root / "config.json"
    p.write_text(json.dumps(config))
    p.chmod(0o600)
    gate = subprocess.Popen(
        ["python3", str(source / "gate.py"), str(p)],
        stdout=(root / "service.log").open("ab"),
        stderr=subprocess.STDOUT,
    )
    for _ in range(30):
        if (client / "gate.sock").exists():
            time.sleep(0.15)
            return
        time.sleep(0.1)
    raise RuntimeError("Test gate did not start")


def candidate(name, commit=sha, expected=True):
    tag = app + ":" + commit
    cid = (
        run(
            [
                "docker",
                "run",
                "-d",
                "--name",
                name,
                "--network",
                network,
                "--restart",
                "no",
                "--label",
                "coolify.applicationUuid=" + app,
                "--label",
                "coolify.pullRequestId=0",
                "-e",
                "SOURCE_COMMIT=" + commit,
                "-v",
                str(client) + ":/run/nelcota-deploy:ro",
                "--entrypoint",
                "/run/nelcota-deploy/start.sh",
                tag,
                "sh",
                "-c",
                "touch /tmp/application-started; sleep 300",
            ]
        )
        .decode()
        .strip()
    )
    containers.append(name)
    for _ in range(480):
        state = json.loads(run(["docker", "inspect", name]))[0]["State"]
        started = (
            subprocess.run(
                ["docker", "exec", name, "test", "-f", "/tmp/application-started"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            ).returncode
            == 0
        )
        if started:
            assert expected, "Application started after a failed gate"
            return cid
        if not state["Running"]:
            assert not expected, "Gate rejected a valid release"
            assert state["ExitCode"] != 0
            return cid
        time.sleep(0.25)
    raise RuntimeError("Candidate did not finish its gate")


try:
    run(["docker", "network", "create", network])
    run(["docker", "tag", image, app + ":" + sha])
    run(
        [
            "docker",
            "run",
            "-d",
            "--name",
            db,
            "--network",
            network,
            "--tmpfs",
            "/var/lib/postgresql:rw,size=512m",
            "-e",
            "POSTGRES_PASSWORD",
            "-e",
            "POSTGRES_DB=nelcota_test",
            "postgres:18.6-alpine",
        ],
        env=env,
    )
    for _ in range(240):
        if (
            subprocess.run(
                [
                    "docker",
                    "exec",
                    db,
                    "pg_isready",
                    "-h",
                    "127.0.0.1",
                    "-U",
                    "postgres",
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            ).returncode
            == 0
        ):
            break
        time.sleep(0.25)
    sql(
        f"CREATE ROLE nelcota_migrator LOGIN PASSWORD '{password}'; CREATE ROLE nelcota_app; CREATE ROLE nelcota_readonly; ALTER SCHEMA public OWNER TO nelcota_migrator; GRANT CREATE ON DATABASE nelcota_test TO nelcota_migrator; CREATE TABLE backup_probe(value text); INSERT INTO backup_probe VALUES ('release-gate-fixture');"
    )
    # Build a release with a pending migration that must roll back.
    bad = root / "bad"
    bad.mkdir()
    run(["docker", "create", "--name", network + "-copy", image])
    containers.append(network + "-copy")
    run(["docker", "cp", network + "-copy:/app/drizzle", str(bad)])
    start_gate()
    good = candidate(network + "-success")
    results["success_starts_app"] = True
    expected = len(
        json.loads((bad / "drizzle/meta/_journal.json").read_text())["entries"]
    )
    assert sql("SELECT count(*) FROM drizzle.__drizzle_migrations") == str(expected)
    results["exact_release_migrations"] = True
    journal = bad / "drizzle/meta/_journal.json"
    data = json.loads(journal.read_text())
    last = data["entries"][-1]
    data["entries"].append(
        {
            "idx": len(data["entries"]),
            "version": last["version"],
            "when": last["when"] + 1,
            "tag": "9999_gate_failure",
            "breakpoints": True,
        }
    )
    journal.write_text(json.dumps(data))
    (bad / "drizzle/9999_gate_failure.sql").write_text(
        "CREATE TABLE gate_should_roll_back(id integer);\n--> statement-breakpoint\nSELECT missing_gate_column FROM nonexistent_gate_table;\n"
    )
    (bad / "Dockerfile").write_text("FROM " + image + "\nCOPY drizzle /app/drizzle\n")
    run(["docker", "build", "-q", "-t", app + ":" + badsha, str(bad)])
    failed = candidate(network + "-bad-sql", badsha, False)
    results["invalid_migration_blocks_app"] = True
    assert sql("SELECT to_regclass('gate_should_roll_back') IS NULL") == "t"
    results["failed_migration_rolls_back"] = True
    assert sql("SELECT count(*) FROM drizzle.__drizzle_migrations") == str(expected)
    receipt = json.loads(
        (root / "backups" / ("deploy-" + failed + ".json")).read_text()
    )
    assert receipt["status"] == "failed" and receipt["stage"] == "migration"
    backup = Path(receipt["backup"])
    assert backup.exists()
    sql("CREATE DATABASE gate_restore WITH TEMPLATE template0;", database="postgres")
    with backup.open("rb") as stream:
        subprocess.run(
            [
                "docker",
                "exec",
                "-i",
                db,
                "pg_restore",
                "-U",
                "postgres",
                "-d",
                "gate_restore",
                "--exit-on-error",
            ],
            stdin=stream,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
        )
    assert (
        sql("SELECT value FROM backup_probe", database="gate_restore")
        == "release-gate-fixture"
    )
    assert sql(
        "SELECT count(*) FROM drizzle.__drizzle_migrations", database="gate_restore"
    ) == str(expected)
    results["backup_restores_data_and_schema"] = True
    start_gate("missing_database_for_failure_test")
    failed_backup = candidate(network + "-bad-backup", expected=False)
    results["backup_failure_blocks_app"] = True
    receipt = json.loads(
        (root / "backups" / ("deploy-" + failed_backup + ".json")).read_text()
    )
    assert receipt["stage"] == "backup"
    stop_gate()
    (client / "gate.sock").unlink(missing_ok=True)
    candidate(network + "-offline", expected=False)
    results["gate_outage_blocks_app"] = True
    start_gate()
    candidate(network + "-recovered")
    results["new_deploy_succeeds_after_fix"] = True
    print(json.dumps(results))
finally:
    stop_gate()
    for name in containers + [db]:
        subprocess.run(
            ["docker", "rm", "-f", name],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    subprocess.run(
        ["docker", "network", "rm", network],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for tag in [app + ":" + sha, app + ":" + badsha]:
        subprocess.run(
            ["docker", "image", "rm", tag],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    shutil.rmtree(root)
