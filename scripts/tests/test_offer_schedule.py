"""No real crontab, system timezone, or /opt path is modified by these tests."""

from contextlib import redirect_stderr, redirect_stdout
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch


HELPER = Path(__file__).resolve().parents[1] / "offer_schedule.py"
spec = importlib.util.spec_from_file_location("offer_schedule", HELPER)
schedule = importlib.util.module_from_spec(spec)
spec.loader.exec_module(schedule)

OTHER = b"# untouched secret-like test value=TEST-ONLY\nMAILTO=ops@example.invalid\n3 4 * * * /opt/other/job.sh\n\n"
ORIGINAL = OTHER + schedule.OLD_LINE + b"\n# non-UTF8 comment: \xff\n"
INSTALLED = ORIGINAL.replace(schedule.OLD_LINE, schedule.NEW_LINE)


class ReconciliationTests(unittest.TestCase):
    def test_changes_only_exact_schedule_and_preserves_every_other_byte(self):
        result, changed = schedule.reconciliation(ORIGINAL)
        self.assertTrue(changed)
        self.assertEqual(result, INSTALLED)

    def test_second_execution_has_no_changes(self):
        self.assertEqual(schedule.reconciliation(INSTALLED), (INSTALLED, False))

    def test_missing_and_duplicate_jobs_are_rejected(self):
        for current in (OTHER, ORIGINAL + schedule.OLD_LINE + b"\n", ORIGINAL + schedule.NEW_LINE + b"\n", INSTALLED + schedule.NEW_LINE + b"\n"):
            with self.subTest(current=current), self.assertRaises(schedule.ScheduleError):
                schedule.reconciliation(current)

    def test_variants_and_carriage_return_are_rejected(self):
        for line in (b" " + schedule.OLD_LINE, schedule.OLD_LINE + b"\r", schedule.OLD_LINE.replace(b"0 6", b"0 8"), schedule.OLD_LINE.replace(b"/opt/netcar-site-react", b"/opt/another-site"), schedule.OLD_LINE + b" # manual"):
            with self.subTest(line=line), self.assertRaises(schedule.ScheduleError):
                schedule.reconciliation(OTHER + line + b"\n")

    def test_commented_job_is_preserved_and_not_counted(self):
        before = b" # " + schedule.OLD_LINE + b"\n" + ORIGINAL
        after, changed = schedule.reconciliation(before)
        self.assertTrue(changed)
        self.assertEqual(after, b" # " + schedule.OLD_LINE + b"\n" + INSTALLED)

    def test_absent_final_newline_is_preserved(self):
        self.assertEqual(schedule.reconciliation(schedule.OLD_LINE), (schedule.NEW_LINE, True))

    def test_conflicting_preceding_cron_timezone_is_rejected(self):
        for directive in (b"CRON_TZ=UTC\n", b' CRON_TZ = "UTC"\n', b"CRON_TZ=''\n"):
            with self.subTest(directive=directive), self.assertRaises(schedule.ScheduleError):
                schedule.reconciliation(directive + ORIGINAL)

    def test_matching_timezone_and_later_other_project_timezone_are_preserved(self):
        before = b'CRON_TZ="America/Sao_Paulo"\n' + ORIGINAL + b"CRON_TZ=UTC\n2 4 * * * /opt/other/utc.sh\n"
        self.assertEqual(schedule.reconciliation(before)[0], before.replace(schedule.OLD_LINE, schedule.NEW_LINE))


class TimezoneTests(unittest.TestCase):
    def verify(self, local=b"valid-zone", expected=b"valid-zone", timezone_text="America/Sao_Paulo\n", exists=True):
        reads = []
        def read_bytes(path):
            reads.append(str(path))
            return {"/etc/localtime": local, "/usr/share/zoneinfo/America/Sao_Paulo": expected}[str(path)]
        with patch.object(schedule.platform, "system", return_value="Linux"), patch.object(Path, "read_bytes", read_bytes), patch.object(Path, "exists", return_value=exists), patch.object(Path, "read_text", return_value=timezone_text):
            schedule.verify_timezone()
        self.assertEqual(reads, ["/etc/localtime", "/usr/share/zoneinfo/America/Sao_Paulo"])

    def test_checks_actual_localtime_and_timezone_file(self):
        self.verify()

    def test_matching_localtime_works_without_optional_timezone_file(self):
        self.verify(exists=False)

    def test_localtime_mismatch_empty_and_timezone_conflict_are_rejected(self):
        for kwargs in ({"local": b"UTC"}, {"local": b"", "expected": b""}, {"timezone_text": "Etc/UTC\n"}):
            with self.subTest(kwargs=kwargs), self.assertRaises(schedule.ScheduleError):
                self.verify(**kwargs)

    def test_non_linux_and_non_root_are_rejected(self):
        with patch.object(schedule.platform, "system", return_value="Darwin"), self.assertRaises(schedule.ScheduleError):
            schedule.verify_timezone()
        with patch.object(schedule.os, "geteuid", return_value=501), self.assertRaises(schedule.ScheduleError):
            schedule.require_root()


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="netcar-offer-schedule-test-")
        self.root = Path(self.temp.name).resolve()
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.state = self.root / "mock-crontab"
        self.state.write_bytes(ORIGINAL)
        self.log = self.root / "calls.jsonl"
        self.backups = self.root / "private" / "offer-schedule"
        mock = self.bin / "crontab"
        mock.write_text('''#!/usr/bin/env python3
import json, os, pathlib, sys
state = pathlib.Path(os.environ["MOCK_CRONTAB_STATE"])
with pathlib.Path(os.environ["MOCK_CRONTAB_LOG"]).open("a") as log:
    log.write(json.dumps(sys.argv[1:]) + "\\n")
if sys.argv[1:] not in (["-u", "root", "-l"], ["-u", "root", "-"]):
    sys.exit(90)
if os.environ.get("MOCK_CRONTAB_FAIL"):
    sys.stderr.write("TEST-SECRET-MUST-NOT-APPEAR")
    sys.exit(3)
if sys.argv[-1] == "-l":
    sys.stdout.buffer.write(state.read_bytes())
else:
    data = sys.stdin.buffer.read()
    state.write_bytes(data + (b"# concurrent edit\\n" if os.environ.get("MOCK_CRONTAB_TAMPER") else b""))
''')
        mock.chmod(0o700)
        self.patches = [
            patch.object(schedule, "BACKUP_ROOT", self.backups),
            patch.object(schedule, "require_root"),
            patch.object(schedule, "verify_timezone"),
            patch.dict(os.environ, {"PATH": str(self.bin) + os.pathsep + os.environ["PATH"], "MOCK_CRONTAB_STATE": str(self.state), "MOCK_CRONTAB_LOG": str(self.log)}),
        ]
        for item in self.patches:
            item.start()

    def tearDown(self):
        for item in reversed(self.patches):
            item.stop()
        self.temp.cleanup()

    def invoke(self, *args):
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            code = schedule.main(list(args))
        text = out.getvalue() if code == 0 else err.getvalue()
        self.assertNotIn("TEST-SECRET", text)
        self.assertNotIn("MAILTO", text)
        self.assertNotIn("ops@example.invalid", text)
        return code, json.loads(text)

    def calls(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()]

    def test_default_dry_run_does_not_write_crontab_or_backups(self):
        code, result = self.invoke()
        self.assertEqual(code, 0)
        self.assertEqual(result["action"], "would_install")
        self.assertEqual(self.state.read_bytes(), ORIGINAL)
        self.assertFalse(self.backups.exists())
        self.assertEqual(self.calls(), [["-u", "root", "-l"]])

    def test_apply_private_backup_and_second_run_idempotence(self):
        code, result = self.invoke("--apply")
        self.assertEqual((code, result["action"]), (0, "installed"))
        self.assertEqual(self.state.read_bytes(), INSTALLED)
        backup = Path(result["backup"])
        self.assertEqual((backup / "before.crontab").read_bytes(), ORIGINAL)
        self.assertEqual((backup / "installed.crontab").read_bytes(), INSTALLED)
        for directory in (self.backups.parent, self.backups, backup):
            self.assertEqual(stat.S_IMODE(directory.stat().st_mode), 0o700)
        for entry in list(backup.iterdir()) + [self.backups / ".lock"]:
            self.assertEqual(stat.S_IMODE(entry.stat().st_mode), 0o600)
        code, result = self.invoke("--apply")
        self.assertEqual((code, result["action"]), (0, "unchanged"))
        self.assertEqual(len([p for p in self.backups.iterdir() if p.is_dir()]), 1)
        self.assertEqual(self.calls().count(["-u", "root", "-"]), 1)

    def test_restore_defaults_to_dry_run_then_restores_exact_bytes(self):
        _, installed = self.invoke("--apply")
        code, result = self.invoke("--restore", installed["backup"])
        self.assertEqual((code, result["action"]), (0, "would_restore"))
        self.assertEqual(self.state.read_bytes(), INSTALLED)
        code, result = self.invoke("--apply", "--restore", installed["backup"])
        self.assertEqual((code, result["action"]), (0, "restored"))
        self.assertEqual(self.state.read_bytes(), ORIGINAL)

    def test_restore_refuses_to_overwrite_later_changes(self):
        _, result = self.invoke("--apply")
        later = INSTALLED + b"5 5 * * * /opt/other/new-job.sh\n"
        self.state.write_bytes(later)
        code, failure = self.invoke("--apply", "--restore", result["backup"])
        self.assertEqual(code, 1)
        self.assertIn("installed SHA256", failure["error"])
        self.assertEqual(self.state.read_bytes(), later)

    def test_restore_rejects_tampered_backup(self):
        _, result = self.invoke("--apply")
        (Path(result["backup"]) / "before.crontab").write_bytes(b"# changed\n")
        code, failure = self.invoke("--apply", "--restore", result["backup"])
        self.assertEqual(code, 1)
        self.assertIn("integrity", failure["error"])
        self.assertEqual(self.state.read_bytes(), INSTALLED)

    def test_preparation_race_does_not_install(self):
        original_save = schedule.save_backup
        later = ORIGINAL + b"# later change\n"
        def change_during_save(*args):
            backup = original_save(*args)
            self.state.write_bytes(later)
            return backup
        with patch.object(schedule, "save_backup", side_effect=change_during_save):
            code, result = self.invoke("--apply")
        self.assertEqual(code, 1)
        self.assertIn("changed during preparation", result["error"])
        self.assertEqual(self.state.read_bytes(), later)
        self.assertNotIn(["-u", "root", "-"], self.calls())

    def test_post_install_difference_is_reported_without_clobbering(self):
        with patch.dict(os.environ, {"MOCK_CRONTAB_TAMPER": "1"}):
            code, result = self.invoke("--apply")
        self.assertEqual(code, 1)
        self.assertIn("Post-install verification", result["error"])
        self.assertEqual(self.state.read_bytes(), INSTALLED + b"# concurrent edit\n")
        self.assertEqual(self.calls().count(["-u", "root", "-"]), 1)

    def test_crontab_failure_never_falls_back_to_empty(self):
        with patch.dict(os.environ, {"MOCK_CRONTAB_FAIL": "1"}):
            code, result = self.invoke("--apply")
        self.assertEqual(code, 1)
        self.assertIn("no empty-crontab fallback", result["error"])
        self.assertEqual(self.state.read_bytes(), ORIGINAL)
        self.assertNotIn(["-u", "root", "-"], self.calls())

    def test_concurrent_installer_is_rejected(self):
        with schedule.mutation_lock():
            code, result = self.invoke("--apply")
        self.assertEqual(code, 1)
        self.assertIn("Another schedule", result["error"])
        self.assertFalse(self.log.exists())

    def test_insecure_existing_backup_permissions_are_rejected_not_changed(self):
        self.backups.mkdir(parents=True)
        self.backups.chmod(0o755)
        code, result = self.invoke("--apply")
        self.assertEqual(code, 1)
        self.assertIn("access settings were not changed", result["error"])
        self.assertEqual(stat.S_IMODE(self.backups.stat().st_mode), 0o755)
        self.assertFalse(self.log.exists())


if __name__ == "__main__":
    unittest.main()
