"""Failure injection for the host gate and the container entrypoint (no production access)."""

import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "gate", Path(__file__).with_name("gate.py")
)
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)
COMMIT = "a" * 40
CONTAINER = "b" * 64
IMAGE = "sha256:" + "c" * 64
CURRENT = {
    "Id": CONTAINER,
    "Image": IMAGE,
    "State": {"Running": True},
    "Config": {
        "Image": "test-app:" + COMMIT,
        "Env": ["SOURCE_COMMIT=" + COMMIT],
        "Labels": {"coolify.applicationUuid": "test-app", "coolify.pullRequestId": "0"},
    },
    "NetworkSettings": {"Networks": {"test-network": {}}},
}
DATABASE = {"Id": "database-id", "Config": {"Env": ["POSTGRES_PASSWORD=private"]}}


class GateTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.config = {
            "application_uuid": "test-app",
            "database_container": "database",
            "database": "test",
            "network": "test-network",
            "backup_directory": str(self.root / "backups"),
            "migrator_database_url": "postgres://migrator:private@database/test",
        }
        self.service = gate.Gate(self.config)
        self.request = {"container": CONTAINER[:12], "commit": COMMIT}
        self.calls = []
        self.failure = None
        self.inspect = patch.object(
            gate, "inspect", side_effect=self.inspect_container
        ).start()
        patch.object(gate, "command", side_effect=self.command).start()
        self.addCleanup(patch.stopall)

    def inspect_container(self, identifier):
        if identifier == "database":
            return DATABASE
        return copy.deepcopy(CURRENT)

    def command(self, args, **kwargs):
        self.calls.append((args, kwargs))
        if self.failure and self.failure in args:
            raise RuntimeError("sensitive connection secret")
        if "pg_dump" in args:
            kwargs["stdout"].write(b"PGDMP-test-backup")
        return b"validated"

    def test_backup_precedes_migration_of_immutable_release_image(self):
        result = self.service.run(self.request)
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["image_id"], IMAGE)
        commands = [args for args, _ in self.calls]
        dump = next(i for i, args in enumerate(commands) if "pg_dump" in args)
        verify = next(i for i, args in enumerate(commands) if "pg_restore" in args)
        migrate = next(i for i, args in enumerate(commands) if "run" in args)
        self.assertLess(dump, verify)
        self.assertLess(verify, migrate)
        self.assertIn(IMAGE, commands[migrate])
        self.assertNotIn(
            self.config["migrator_database_url"], " ".join(commands[migrate])
        )
        self.assertEqual(Path(result["backup"]).stat().st_mode & 0o777, 0o600)
        self.assertEqual(len(result["backup_sha256"]), 64)

    def test_successful_container_restart_reuses_receipt(self):
        self.service.run(self.request)
        self.service.run(self.request)
        self.assertEqual(sum("run" in args for args, _ in self.calls), 1)

    def assert_failure_blocks_migration(self, failure):
        self.failure = failure
        with self.assertRaisesRegex(gate.GateError, "backup failed"):
            self.service.run(self.request)
        self.assertFalse(any("run" in args for args, _ in self.calls))

    def test_dump_failure_blocks_release(self):
        self.assert_failure_blocks_migration("pg_dump")

    def test_invalid_backup_blocks_release(self):
        self.assert_failure_blocks_migration("pg_restore")

    def test_migration_failure_retains_backup_and_blocks_retries(self):
        self.failure = "run"
        with self.assertRaisesRegex(gate.GateError, "migration failed"):
            self.service.run(self.request)
        receipt = json.loads(
            next(self.service.backups.glob("deploy-*.json")).read_text()
        )
        self.assertEqual(receipt["status"], "failed")
        self.assertTrue(Path(receipt["backup"]).is_file())
        self.assertNotIn("sensitive", json.dumps(receipt))
        with self.assertRaisesRegex(gate.GateError, "create a new deployment"):
            self.service.run(self.request)
        self.assertEqual(sum("run" in args for args, _ in self.calls), 1)

    def test_other_app_preview_and_commit_mismatch_are_rejected(self):
        for key, value in [
            ("coolify.applicationUuid", "other"),
            ("coolify.pullRequestId", "1"),
        ]:
            candidate = copy.deepcopy(CURRENT)
            candidate["Config"]["Labels"][key] = value
            with patch.object(gate, "inspect", return_value=candidate):
                with self.assertRaises(gate.GateError):
                    self.service.run(self.request)
        with self.assertRaises(gate.GateError):
            self.service.run({**self.request, "commit": "d" * 40})
        self.assertFalse(self.calls)

    def test_invalid_identifiers_are_rejected_before_docker(self):
        for request in [
            {"container": "--privileged", "commit": COMMIT},
            {"container": CONTAINER, "commit": "main"},
        ]:
            with self.assertRaises(gate.GateError):
                self.service.run(request)
        self.inspect.assert_not_called()

    def test_concurrent_migrations_are_blocked(self):
        class BusyLock:
            def acquire(self, **_):
                return False

        self.service.lock = BusyLock()
        with self.assertRaisesRegex(gate.GateError, "Another release"):
            self.service.run(self.request)
        self.assertFalse(self.calls)

    def test_entrypoint_starts_app_only_after_success(self):
        curl = self.root / "curl"
        curl.write_text('#!/bin/sh\nexit "$FAKE_CURL_STATUS"\n')
        curl.chmod(0o700)
        marker = self.root / "application-started"
        environment = dict(
            os.environ,
            PATH=f"{self.root}:" + os.environ["PATH"],
            SOURCE_COMMIT=COMMIT,
            HOSTNAME=CONTAINER[:12],
        )
        for status in ["22", "7", "28", "0"]:
            result = subprocess.run(
                ["sh", str(Path(__file__).with_name("start.sh")), "touch", str(marker)],
                env=dict(environment, FAKE_CURL_STATUS=status),
                capture_output=True,
            )
            self.assertEqual(marker.exists(), status == "0")
            self.assertEqual(result.returncode == 0, status == "0")


if __name__ == "__main__":
    unittest.main()
