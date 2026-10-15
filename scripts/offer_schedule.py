#!/usr/bin/env python3
"""Replace only the existing Netcar schedule; never install a second job."""

import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import stat
import subprocess
import sys
import uuid


TIMEZONE = "America/Sao_Paulo"
OLD_LINE = b"0 6 * * 1 /opt/netcar-site-react/scripts/weekly-persist.sh >> /var/log/netcar-weekly.log 2>&1"
NEW_LINE = b"0 7 * * 1,3,5 /opt/netcar-site-react/scripts/weekly-persist.sh >> /var/log/netcar-weekly.log 2>&1"
BACKUP_ROOT = Path("/opt/netcar-deploy-backups/offer-schedule")


class ScheduleError(Exception):
    pass


def digest(content):
    return hashlib.sha256(content).hexdigest()


def require_root():
    if os.geteuid() != 0:
        raise ScheduleError("Run as root to inspect or change the existing root crontab.")


def verify_timezone():
    """Read the system configuration, ignoring shell TZ and command output."""
    if platform.system() != "Linux":
        raise ScheduleError("The schedule installer requires the existing Linux VPS.")
    try:
        local = Path("/etc/localtime").read_bytes()
        expected = Path("/usr/share/zoneinfo", TIMEZONE).read_bytes()
        if not local or local != expected:
            raise ScheduleError(f"/etc/localtime does not match {TIMEZONE}.")
        timezone_file = Path("/etc/timezone")
        if timezone_file.exists() and timezone_file.read_text().strip() != TIMEZONE:
            raise ScheduleError(f"/etc/timezone conflicts with {TIMEZONE}.")
    except (OSError, UnicodeError) as exc:
        raise ScheduleError("Cannot verify the system timezone files.") from exc


def reconciliation(current):
    """Retain every byte except the one exact, unambiguous schedule line."""
    lines = current.splitlines(keepends=True)
    candidates = []
    for index, line in enumerate(lines):
        active = line.lstrip()
        if not active.startswith(b"#") and b"weekly-persist.sh" in active:
            candidates.append(index)
    if len(candidates) != 1:
        raise ScheduleError("Expected exactly one existing weekly-persist.sh job; found missing or duplicate entries.")
    index = candidates[0]
    content = lines[index][:-1] if lines[index].endswith(b"\n") else lines[index]
    if content not in (OLD_LINE, NEW_LINE):
        raise ScheduleError("Existing weekly-persist.sh entry is an ambiguous variant; refusing to change it.")
    # CRON_TZ changes below this job apply only to later jobs and stay untouched.
    for line in lines[:index]:
        if line.lstrip().startswith(b"#"):
            continue
        match = re.match(rb"\s*CRON_TZ\s*=\s*(.*?)\s*$", line)
        if match:
            value = match.group(1)
            if len(value) >= 2 and value[:1] == value[-1:] and value[:1] in (b"'", b'"'):
                value = value[1:-1]
            if value != TIMEZONE.encode():
                raise ScheduleError("A preceding CRON_TZ directive conflicts with the required schedule timezone.")
    if content == NEW_LINE:
        return current, False
    lines[index] = NEW_LINE + (b"\n" if lines[index].endswith(b"\n") else b"")
    return b"".join(lines), True


def crontab(args, content=None):
    try:
        result = subprocess.run(
            ["crontab", "-u", "root", *args], input=content,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False, timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ScheduleError("Cannot execute crontab safely.") from exc
    if result.returncode:
        # Never print stderr or crontab contents: other jobs may contain secrets.
        raise ScheduleError(f"crontab operation failed (exit {result.returncode}); no empty-crontab fallback is permitted.")
    return result.stdout


def read_crontab():
    return crontab(["-l"])


def write_crontab(content):
    crontab(["-"], content)


def check_private(path, directory=False):
    info = path.lstat()
    expected = 0o700 if directory else 0o600
    correct_type = stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode)
    if not correct_type or info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) != expected:
        raise ScheduleError("Backup storage must be root-owned, with directories 0700 and files 0600; access settings were not changed.")


def prepare_storage():
    # Do not change permissions of existing directories or follow symlinked storage.
    if BACKUP_ROOT.resolve() != BACKUP_ROOT.absolute():
        raise ScheduleError("Symlinked backup storage is not permitted.")
    if not BACKUP_ROOT.parent.exists():
        BACKUP_ROOT.parent.mkdir(mode=0o700)
    if not BACKUP_ROOT.exists():
        BACKUP_ROOT.mkdir(mode=0o700)
    check_private(BACKUP_ROOT, directory=True)


@contextmanager
def mutation_lock():
    prepare_storage()
    lock_path = BACKUP_ROOT / ".lock"
    fd = os.open(lock_path, os.O_WRONLY | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        check_private(lock_path)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise ScheduleError("Another schedule installation or restore is running.") from exc
        yield
    finally:
        os.close(fd)


def private_write(path, content):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "wb") as target:
        target.write(content)
        target.flush()
        os.fsync(target.fileno())
    check_private(path)


def save_backup(before, installed):
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    directory = BACKUP_ROOT / f"{stamp}-{uuid.uuid4().hex[:12]}"
    directory.mkdir(mode=0o700)
    check_private(directory, directory=True)
    private_write(directory / "before.crontab", before)
    private_write(directory / "installed.crontab", installed)
    metadata = {
        "version": 1, "timezone": TIMEZONE,
        "before_sha256": digest(before), "installed_sha256": digest(installed),
    }
    private_write(directory / "metadata.json", (json.dumps(metadata, sort_keys=True) + "\n").encode())
    directory_fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(directory_fd)
    finally:
        os.close(directory_fd)
    return directory


def load_backup(value):
    directory = Path(value).absolute()
    if directory.resolve() != directory or directory.parent != BACKUP_ROOT:
        raise ScheduleError("Restore requires one original backup directory inside the private offer-schedule storage.")
    check_private(BACKUP_ROOT, directory=True)
    check_private(directory, directory=True)
    for name in ("before.crontab", "installed.crontab", "metadata.json"):
        check_private(directory / name)
    try:
        metadata = json.loads((directory / "metadata.json").read_bytes())
        before = (directory / "before.crontab").read_bytes()
        installed = (directory / "installed.crontab").read_bytes()
    except (OSError, ValueError) as exc:
        raise ScheduleError("Cannot read a valid schedule backup.") from exc
    if (not isinstance(metadata, dict) or metadata.get("version") != 1
            or metadata.get("timezone") != TIMEZONE
            or metadata.get("before_sha256") != digest(before)
            or metadata.get("installed_sha256") != digest(installed)):
        raise ScheduleError("Backup integrity validation failed.")
    expected, changed = reconciliation(before)
    if not changed or expected != installed:
        raise ScheduleError("Backup contains changes beyond the authorized schedule replacement.")
    return before, installed


def install(apply=False):
    before = read_crontab()
    installed, changed = reconciliation(before)
    result = {
        "action": "would_install" if changed else "unchanged", "timezone": TIMEZONE,
        "schedule": NEW_LINE.decode(), "before_sha256": digest(before),
        "installed_sha256": digest(installed),
    }
    if apply and changed:
        backup = save_backup(before, installed)
        result["backup"] = str(backup)
        if read_crontab() != before:
            raise ScheduleError(f"Crontab changed during preparation; nothing installed. Backup: {backup}")
        write_crontab(installed)
        if read_crontab() != installed:
            raise ScheduleError(f"Post-install verification differs; refusing automatic overwrite. Review backup: {backup}")
        result["action"] = "installed"
    return result


def restore(value, apply=False):
    before, installed = load_backup(value)
    current = read_crontab()
    if digest(current) != digest(installed):
        raise ScheduleError("Current crontab does not match the saved installed SHA256; restore refused to preserve later changes.")
    if apply:
        if read_crontab() != current:
            raise ScheduleError("Crontab changed during restore preparation; nothing restored.")
        write_crontab(before)
        if read_crontab() != before:
            raise ScheduleError("Post-restore verification differs; refusing further automatic overwrites.")
    return {
        "action": "restored" if apply else "would_restore", "timezone": TIMEZONE,
        "backup": str(Path(value).absolute()), "restored_sha256": digest(before),
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true", help="Install the verified change (default is dry-run).")
    mode.add_argument("--dry-run", action="store_true", help="Verify and describe the change without writing.")
    parser.add_argument("--restore", metavar="BACKUP", help="Restore a saved backup only if its installed SHA256 still matches; requires --apply to write.")
    args = parser.parse_args(argv)
    try:
        require_root()
        verify_timezone()
        operation = lambda: restore(args.restore, args.apply) if args.restore else install(args.apply)
        if args.apply:
            with mutation_lock():
                result = operation()
        else:
            result = operation()
        print(json.dumps(result, sort_keys=True))
        return 0
    except (ScheduleError, OSError) as exc:
        # OSError text could contain unrelated content; keep generic failures private.
        message = str(exc) if isinstance(exc, ScheduleError) else "Schedule storage operation failed; crontab state must be verified before retrying."
        print(json.dumps({"action": "refused", "error": message}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
