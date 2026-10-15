#!/usr/bin/env python3
"""Persist only the reviewed offer bytes on the existing cron host (GitHub access)."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from datetime import datetime, timezone


def private_json(path, value):
    with os.fdopen(os.open(path, os.O_CREAT | os.O_TRUNC | os.O_WRONLY, 0o600), 'w') as handle:
        json.dump(value, handle, indent=2)
        handle.write('\n')


def persist(root):
    # Called only by the existing wrapper while it owns the cross-container lock.
    lock_token = os.environ.get('NETCAR_SITE_LOCK_TOKEN')
    if not lock_token or (root / '.devops/site-publish.lock/token').read_text().strip() != lock_token:
        raise RuntimeError('site_publish_lock_required')
    state_dir = root / '.devops/offer-reconciliation'
    pending_path = state_dir / 'pending-push.json'
    pending = json.loads(pending_path.read_text())
    run_id = pending.get('runId', '')
    if not re.fullmatch(r'[0-9TZ-]+-[0-9a-f-]{36}', run_id):
        raise RuntimeError('invalid_offer_run_id')
    paths = pending.get('changedFiles')
    if not isinstance(paths, list) or len(set(paths)) != len(paths) or any(
        not isinstance(path, str) or not re.fullmatch(r'src/data/seo/(?:[a-zA-Z0-9_-]+/)*[a-zA-Z0-9_.-]+\.json', path)
        for path in paths
    ):
        raise RuntimeError('unexpected_reconciliation_path')
    report_path = state_dir / 'runs' / f'{run_id}.json'
    report = json.loads(report_path.read_text())
    if report.get('sourceBefore') != pending.get('sourceBefore') or report.get('dist') != pending.get('dist'):
        raise RuntimeError('offer_run_evidence_mismatch')
    log_path = state_dir / 'runs' / f'{run_id}.log'
    with os.fdopen(os.open(log_path, os.O_CREAT | os.O_APPEND | os.O_WRONLY, 0o600), 'ab') as log:
        def git(*args, cwd=root):
            result = subprocess.run(['git', *args], cwd=cwd, stdin=subprocess.DEVNULL,
                                    stdout=subprocess.PIPE, stderr=log, check=True)
            return result.stdout.decode().strip()

        try:
            if git('branch', '--show-current') not in ('master', 'main'):
                raise RuntimeError('scheduled_reconciliation_requires_default_branch')
            if git('diff', '--cached', '--name-only'):
                raise RuntimeError('staged_changes_present')
            expected_head = pending.get('sourceAfter') if pending.get('state') == 'committed' else pending['sourceBefore']
            if git('rev-parse', 'HEAD') != expected_head:
                raise RuntimeError('source_changed_before_persistence')
            if git('rev-parse', 'HEAD', cwd=root / 'dist') != pending['dist']:
                raise RuntimeError('dist_changed_before_persistence')
            if paths:
                backup_id = pending.get('backupId', '')
                if not re.fullmatch(r'[a-zA-Z0-9_-]+', backup_id):
                    raise RuntimeError('invalid_offer_backup_id')
                manifest = json.loads((state_dir / 'backups' / backup_id / 'manifest.json').read_text())
                if sorted(file['path'] for file in manifest['files']) != sorted(paths):
                    raise RuntimeError('offer_manifest_mismatch')
                for file in manifest['files']:
                    actual_hash = hashlib.sha256((root / file['path']).read_bytes()).hexdigest()
                    if actual_hash != file['afterSha256']:
                        raise RuntimeError('offer_files_changed_after_reconciliation')
            if pending.get('state') == 'ready':
                actual_paths = sorted(filter(None, git('diff', '--name-only', '-z', '--', 'src/data/seo').split('\0')))
                if actual_paths != sorted(paths):
                    raise RuntimeError('offer_files_changed_after_reconciliation')
                if paths:
                    git('commit', '--only', '-m', 'chore(offers): reconcile available offers', '--', *paths)
                pending['sourceAfter'] = git('rev-parse', 'HEAD')
                pending['state'] = 'committed'
                private_json(pending_path, pending)
            elif pending.get('state') != 'committed':
                raise RuntimeError('invalid_offer_persistence_state')
            if paths:
                # Uses the host's existing Git remote and SSH credentials unchanged.
                git('push')
            report['sourceAfter'] = pending['sourceAfter']
            report['status'] = 'succeeded'
            report['phase'] = 'persisted_on_host'
            report['finishedAt'] = datetime.now(timezone.utc).isoformat()
            report.pop('error', None)
            private_json(report_path, report)
            source_before = pending['sourceBefore']
            source_after = pending['sourceAfter']
            private_json(root / '.devops/last-deploy.json', {
                'kind': 'offer-reconciliation', 'distHash': pending['dist'], 'distShortHash': pending['dist'][:7],
                'builtRepoHash': source_before, 'builtRepoShortHash': source_before[:7], 'sourceHash': source_before,
                'repoHash': source_after, 'repoShortHash': source_after[:7], 'offerDataCommit': source_after,
                'offerRunId': run_id, 'at': report['deployedAt'],
            })
            pending_path.unlink()
            print(json.dumps({'runId': run_id, 'status': 'succeeded', 'sourceBefore': source_before,
                              'sourceAfter': source_after, 'dist': pending['dist']}))
            return report
        except Exception as error:
            code = str(error) if re.fullmatch('[a-z][a-z0-9_]+', str(error)) else 'offer_persistence_failed'
            report.update(status='needs_persistence_review', error=code, productionMayHaveChanged=True)
            private_json(report_path, report)
            raise RuntimeError(code) from None


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', required=True)
    parser.parse_args()
    try:
        persist(Path(__file__).resolve().parent.parent)
    except Exception as error:
        code = str(error) if re.fullmatch('[a-z][a-z0-9_]+', str(error)) else 'offer_persistence_failed'
        print(json.dumps({'error': code}), file=sys.stderr)
        sys.exit(1)
