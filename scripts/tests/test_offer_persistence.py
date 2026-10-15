"""Exercise persistence with temporary Git repositories and local bare remotes."""

from contextlib import redirect_stdout
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch


HELPER = Path(__file__).resolve().parents[1] / "persist-reconciled-offers.py"
spec = importlib.util.spec_from_file_location("offer_persistence", HELPER)
persistence = importlib.util.module_from_spec(spec)
spec.loader.exec_module(persistence)

OFFER = "src/data/seo/blog-auto.json"
RUN_ID = "2026-10-15T12-00-00Z-123e4567-e89b-12d3-a456-426614174000"
BACKUP_ID = "offers-20261015-1234"
OLD_OFFER = b'{"offers":[{"id":20019,"available":true}]}\n'
NEW_OFFER = b'{"offers":[{"id":20019,"available":false}]}\n'


class OfferPersistenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="netcar-offer-persistence-test-")
        self.base = Path(self.temp.name).resolve()
        self.root = self.base / "source"
        self.root.mkdir()
        self.remote = self.base / "remote.git"
        self.environment = patch.dict(os.environ, {
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_TERMINAL_PROMPT": "0",
            "GIT_ALLOW_PROTOCOL": "file",
            "NETCAR_SITE_LOCK_TOKEN": "test-owned-lock-token",
            "PYTHONDONTWRITEBYTECODE": "1",
        })
        self.environment.start()
        self.git("init", "--initial-branch=main")
        self.configure(self.root)
        self.git("init", "--bare", "--initial-branch=main", str(self.remote))
        (self.root / ".gitignore").write_text(".devops/\ndist/\n")
        (self.root / OFFER).parent.mkdir(parents=True)
        (self.root / OFFER).write_bytes(OLD_OFFER)
        (self.root / "notes.txt").write_text("original unrelated content\n")
        self.git("add", ".")
        self.git("commit", "-m", "test baseline")
        self.git("remote", "add", "origin", str(self.remote))
        self.git("push", "-u", "origin", "main")
        self.before = self.git("rev-parse", "HEAD")
        dist = self.root / "dist"
        dist.mkdir()
        self.git("init", "--initial-branch=main", cwd=dist)
        self.configure(dist)
        (dist / "index.html").write_text("<html>deployed test artifact</html>\n")
        self.git("add", ".", cwd=dist)
        self.git("commit", "-m", "test deployed dist", cwd=dist)
        self.dist = self.git("rev-parse", "HEAD", cwd=dist)
        self.state = self.root / ".devops/offer-reconciliation"
        (self.state / "runs").mkdir(parents=True)
        lock = self.root / ".devops/site-publish.lock"
        lock.mkdir()
        (lock / "token").write_text("test-owned-lock-token\n")
        self.pending_path = self.state / "pending-push.json"
        self.report_path = self.state / "runs" / f"{RUN_ID}.json"

    def tearDown(self):
        self.environment.stop()
        self.temp.cleanup()

    def configure(self, root):
        self.git("config", "user.name", "Netcar Test", cwd=root)
        self.git("config", "user.email", "test@example.invalid", cwd=root)
        self.git("config", "commit.gpgsign", "false", cwd=root)
        self.git("config", "core.hooksPath", os.devnull, cwd=root)

    def git(self, *args, cwd=None):
        result = subprocess.run(["git", *args], cwd=cwd or self.root, input=None,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        return result.stdout.decode().strip()

    def make_ready(self, changed=True):
        paths = [OFFER] if changed else []
        pending = {"runId": RUN_ID, "backupId": BACKUP_ID, "changedFiles": paths,
                   "sourceBefore": self.before, "dist": self.dist, "state": "ready"}
        report = {"runId": RUN_ID, "backupId": BACKUP_ID, "sourceBefore": self.before,
                  "dist": self.dist, "status": "awaiting_host_persistence",
                  "deployedAt": "2026-10-15T12:00:00Z"}
        self.pending_path.write_text(json.dumps(pending))
        self.report_path.write_text(json.dumps(report))
        if changed:
            (self.root / OFFER).write_bytes(NEW_OFFER)
            backup = self.state / "backups" / BACKUP_ID
            backup.mkdir(parents=True)
            manifest = {"files": [{"path": OFFER, "afterSha256": hashlib.sha256(NEW_OFFER).hexdigest()}]}
            (backup / "manifest.json").write_text(json.dumps(manifest))

    def run_persist(self):
        output = io.StringIO()
        with redirect_stdout(output):
            report = persistence.persist(self.root)
        return report, json.loads(output.getvalue())

    def read_report(self):
        return json.loads(self.report_path.read_text())

    def test_ready_commits_and_pushes_only_offers_then_clears_pending(self):
        self.make_ready()
        unrelated = "user's unrelated pending change\n"
        (self.root / "notes.txt").write_text(unrelated)
        report, output = self.run_persist()
        after = self.git("rev-parse", "HEAD")
        self.assertNotEqual(after, self.before)
        self.assertEqual(self.git("rev-list", "--count", f"{self.before}..HEAD"), "1")
        self.assertEqual(self.git("diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"), OFFER)
        self.assertEqual(self.git("rev-parse", "refs/heads/main", cwd=self.remote), after)
        self.assertEqual(self.git("show", "HEAD:notes.txt"), "original unrelated content")
        self.assertEqual((self.root / "notes.txt").read_text(), unrelated)
        self.assertEqual(self.git("diff", "--cached", "--name-only"), "")
        self.assertFalse(self.pending_path.exists())
        self.assertEqual((report["status"], report["phase"]), ("succeeded", "persisted_on_host"))
        self.assertEqual(output["sourceBefore"], self.before)
        self.assertEqual(output["sourceAfter"], after)
        self.assertEqual(output["runId"], RUN_ID)
        deployed = json.loads((self.root / ".devops/last-deploy.json").read_text())
        self.assertEqual(deployed["distHash"], self.dist)
        self.assertEqual(deployed["offerDataCommit"], after)
        self.assertEqual(deployed["builtRepoHash"], self.before)

    def test_unrelated_staged_change_aborts_and_preserves_index(self):
        self.make_ready()
        (self.root / "notes.txt").write_text("staged user change\n")
        self.git("add", "notes.txt")
        index_before = self.git("write-tree")
        with self.assertRaisesRegex(RuntimeError, "^staged_changes_present$"):
            self.run_persist()
        self.assertEqual(self.git("write-tree"), index_before)
        self.assertEqual(self.git("rev-parse", "HEAD"), self.before)
        self.assertEqual((self.root / OFFER).read_bytes(), NEW_OFFER)
        self.assertTrue(self.pending_path.exists())
        self.assertEqual(self.read_report()["status"], "needs_persistence_review")
        self.assertEqual(self.read_report()["error"], "staged_changes_present")

    def test_changed_offer_hash_aborts_without_staging_or_commit(self):
        self.make_ready()
        subsequent = NEW_OFFER + b"\n"
        (self.root / OFFER).write_bytes(subsequent)
        with self.assertRaisesRegex(RuntimeError, "^offer_files_changed_after_reconciliation$"):
            self.run_persist()
        self.assertEqual(self.git("rev-parse", "HEAD"), self.before)
        self.assertEqual(self.git("diff", "--cached", "--name-only"), "")
        self.assertEqual((self.root / OFFER).read_bytes(), subsequent)
        self.assertEqual(self.git("rev-parse", "refs/heads/main", cwd=self.remote), self.before)
        self.assertTrue(self.pending_path.exists())

    def test_failed_push_keeps_committed_state_and_retry_pushes_same_commit(self):
        self.make_ready()
        self.git("remote", "set-url", "origin", str(self.base / "missing-local-remote.git"))
        with self.assertRaisesRegex(RuntimeError, "^offer_persistence_failed$"):
            self.run_persist()
        pending = json.loads(self.pending_path.read_text())
        committed = self.git("rev-parse", "HEAD")
        self.assertEqual(pending["state"], "committed")
        self.assertEqual(pending["sourceAfter"], committed)
        self.assertNotEqual(committed, self.before)
        self.assertEqual(self.git("rev-parse", "refs/heads/main", cwd=self.remote), self.before)
        self.assertEqual(self.read_report()["status"], "needs_persistence_review")
        self.git("remote", "set-url", "origin", str(self.remote))
        report, output = self.run_persist()
        self.assertEqual(self.git("rev-parse", "HEAD"), committed)
        self.assertEqual(self.git("rev-list", "--count", f"{self.before}..HEAD"), "1")
        self.assertEqual(self.git("rev-parse", "refs/heads/main", cwd=self.remote), committed)
        self.assertEqual(output["sourceAfter"], committed)
        self.assertFalse(self.pending_path.exists())
        self.assertEqual(report["status"], "succeeded")
        self.assertNotIn("error", report)

    def test_no_changed_files_records_success_without_commit_or_push(self):
        self.make_ready(changed=False)
        self.git("remote", "set-url", "origin", str(self.base / "missing-local-remote.git"))
        report, output = self.run_persist()
        self.assertEqual(self.git("rev-parse", "HEAD"), self.before)
        self.assertEqual(self.git("rev-list", "--count", f"{self.before}..HEAD"), "0")
        self.assertEqual(output["sourceAfter"], self.before)
        self.assertEqual(report["status"], "succeeded")
        self.assertFalse(self.pending_path.exists())
        self.assertTrue((self.root / ".devops/last-deploy.json").exists())

    def test_lock_token_must_match_owned_lock(self):
        self.make_ready()
        with patch.dict(os.environ, {"NETCAR_SITE_LOCK_TOKEN": "another-owner"}):
            with self.assertRaisesRegex(RuntimeError, "^site_publish_lock_required$"):
                self.run_persist()
        self.assertEqual(self.git("rev-parse", "HEAD"), self.before)
        self.assertTrue(self.pending_path.exists())


if __name__ == "__main__":
    unittest.main()
