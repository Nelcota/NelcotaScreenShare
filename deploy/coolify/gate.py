"""Host-only release gate. The application gets a scoped socket, never Docker or DDL credentials."""

from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import socketserver
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler


class GateError(Exception):
    """Safe message that may be returned to the application and deployment logs."""


def command(args, *, env=None, stdin=None, stdout=None, input_file=None, timeout=90):
    if stdout is None:
        stdout = subprocess.PIPE
    return subprocess.run(
        args,
        env=env,
        input=stdin,
        stdin=input_file,
        stdout=stdout,
        stderr=subprocess.PIPE,
        timeout=timeout,
        check=True,
    ).stdout


def inspect(identifier):
    return json.loads(command(["docker", "inspect", identifier]))[0]


def sync_directory(path):
    descriptor = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def save_json(path, value):
    with path.open("x", encoding="utf-8") as stream:
        os.chmod(path, 0o600)
        json.dump(value, stream, indent=2)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    sync_directory(path.parent)


class Gate:
    def __init__(self, config):
        self.config = config
        self.lock = threading.Lock()
        self.backups = Path(config["backup_directory"])
        self.backups.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(self.backups, 0o700)

    def validate(self, request):
        container = request.get("container", "")
        commit = request.get("commit", "")
        if not isinstance(container, str) or not re.fullmatch(
            r"[a-f0-9]{12,64}", container
        ):
            raise GateError("Invalid container ID")
        if not isinstance(commit, str) or not re.fullmatch(r"[a-f0-9]{40}", commit):
            raise GateError("Invalid release commit")
        current = inspect(container)
        config = current["Config"]
        labels = config.get("Labels") or {}
        environment = dict(item.split("=", 1) for item in config["Env"] if "=" in item)
        if (
            not current["State"]["Running"]
            or labels.get("coolify.applicationUuid") != self.config["application_uuid"]
            or labels.get("coolify.pullRequestId") != "0"
            or config["Image"] != f'{self.config["application_uuid"]}:{commit}'
            or environment.get("SOURCE_COMMIT") != commit
            or self.config["network"] not in current["NetworkSettings"]["Networks"]
        ):
            raise GateError("Container does not match an authorized production release")
        return current

    def run(self, request):
        if not self.lock.acquire(timeout=5):
            raise GateError("Another release is being migrated; retry the deployment")
        try:
            return self.run_locked(request)
        finally:
            self.lock.release()

    def run_locked(self, request):
        current = self.validate(request)
        container = current["Id"]
        receipt = self.backups / f"deploy-{container}.json"
        if receipt.exists():
            previous = json.loads(receipt.read_text())
            if previous["status"] != "success":
                raise GateError(
                    "This container failed its release gate; create a new deployment"
                )
            return previous

        record = {
            "container": container,
            "commit": request["commit"],
            "image": current["Config"]["Image"],
            "image_id": current["Image"],
            "status": "failed",
            "stage": "backup",
            "started_at": datetime.now(timezone.utc).isoformat(),
        }
        job = f"nelcota-migrate-{container[:12]}"
        try:
            self.backup(container, record)
            record["stage"] = "migration"
            environment = dict(
                os.environ, MIGRATOR_DATABASE_URL=self.config["migrator_database_url"]
            )
            # Use the immutable image ID captured from the new container, not a mutable tag.
            command(
                [
                    "docker",
                    "run",
                    "--rm",
                    "--name",
                    job,
                    "--network",
                    self.config["network"],
                    "--read-only",
                    "--cap-drop",
                    "ALL",
                    "--security-opt",
                    "no-new-privileges",
                    "--pids-limit",
                    "128",
                    "--memory",
                    "256m",
                    "--cpus",
                    "0.5",
                    "-e",
                    "MIGRATOR_DATABASE_URL",
                    current["Image"],
                    "node",
                    "migrate.mjs",
                ],
                env=environment,
                timeout=90,
            )
            record["status"] = "success"
            record["stage"] = "complete"
        except Exception as error:
            record["error_type"] = type(error).__name__
            failure_log = self.backups / f"failure-{container}.log"
            with failure_log.open("xb") as stream:
                os.chmod(failure_log, 0o600)
                stream.write(getattr(error, "stderr", None) or str(error).encode())
            record["failure_log"] = str(failure_log)
            # Raw database/subprocess errors may contain credentials or data. Keep logs safe.
            raise GateError(
                f'Release blocked: {record["stage"]} failed; backup and receipt retained'
            ) from None
        finally:
            if record["stage"] == "migration":
                try:
                    command(["docker", "rm", "-f", job], timeout=10)
                except Exception:
                    pass
            record["finished_at"] = datetime.now(timezone.utc).isoformat()
            save_json(receipt, record)
            print(
                json.dumps(
                    {
                        "container": container[:12],
                        "commit": request["commit"],
                        "status": record["status"],
                        "stage": record["stage"],
                    }
                ),
                flush=True,
            )
        return record

    def backup(self, container, record):
        database = inspect(self.config["database_container"])
        values = dict(
            item.split("=", 1) for item in database["Config"]["Env"] if "=" in item
        )
        environment = dict(os.environ, PGPASSWORD=values["POSTGRES_PASSWORD"])
        arguments = ["docker", "exec", "-e", "PGPASSWORD", database["Id"]]
        connection = ["-h", "127.0.0.1", "-U", values.get("POSTGRES_USER", "postgres")]
        backup = self.backups / f"before-{container}.dump"
        partial = backup.with_suffix(".partial")
        with partial.open("xb") as stream:
            os.chmod(partial, 0o600)
            command(
                arguments
                + [
                    "pg_dump",
                    *connection,
                    "-d",
                    self.config["database"],
                    "--format=custom",
                ],
                env=environment,
                stdout=stream,
            )
            stream.flush()
            os.fsync(stream.fileno())
        if partial.stat().st_size == 0:
            raise GateError("Empty database backup")
        with partial.open("rb") as stream:
            command(
                ["docker", "exec", "-i", database["Id"], "pg_restore", "--list"],
                input_file=stream,
            )
        partial.rename(backup)
        sync_directory(self.backups)
        record["backup"] = str(backup)
        with backup.open("rb") as stream:
            record["backup_sha256"] = hashlib.file_digest(stream, "sha256").hexdigest()


class UnixServer(socketserver.ThreadingMixIn, socketserver.UnixStreamServer):
    daemon_threads = True


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_POST(self):
        status = 500
        response = {"error": "Release gate failed"}
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if self.path != "/run" or not 0 < length <= 256:
                raise GateError("Invalid request")
            self.connection.settimeout(10)
            request = json.loads(self.rfile.read(length))
            result = self.server.gate.run(request)
            status = 200
            response = {"status": "success", "commit": result["commit"]}
        except GateError as error:
            response = {"error": str(error)}
        except Exception:
            pass
        body = (json.dumps(response) + "\n").encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    os.umask(0o077)
    config = json.loads(Path(sys.argv[1]).read_text())
    gate = Gate(config)
    socket = Path(config["socket"])
    socket.unlink(missing_ok=True)
    with UnixServer(str(socket), Handler) as server:
        os.chown(socket, 0, config.get("socket_gid", 1001))
        os.chmod(socket, 0o660)
        server.gate = gate
        server.serve_forever()


if __name__ == "__main__":
    main()
