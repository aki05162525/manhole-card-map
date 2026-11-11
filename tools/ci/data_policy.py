"""Reject new execution code and fetched originals in data; inspect Git, never file contents."""
import argparse
from pathlib import PurePosixPath
import subprocess

from event_base import event_base

CODE_EXTENSIONS = {'.py', '.sh', '.bash', '.zsh', '.go', '.ipynb', '.ts',
                   '.tsx', '.jsx', '.mjs', '.cjs', '.rb', '.pl', '.php', '.r',
                   '.ps1', '.bat', '.cmd', '.c', '.cpp', '.rs', '.java'}
# Fetched originals stay in the ignored data/work/; the ledger tables keep their records.
# Only the GKP list inputs and terms copies are tracked; data/user-answers/ holds text only.
ORIGINAL_DIRS = ('data/raw/', 'data/terms/')
ORIGINAL_EXTENSIONS = {'.html', '.htm', '.xhtml', '.xml', '.pdf', '.png', '.jpg', '.jpeg',
                       '.gif', '.webp', '.svg', '.tif', '.tiff', '.bmp', '.pbf', '.mvt',
                       '.pmtiles', '.gz', '.zip', '.raw', '.bin', '.doc', '.docx', '.xls',
                       '.xlsx', '.csv', '.js', '.css'}


def kind(path):
    suffix = PurePosixPath(path).suffix.lower()
    if suffix in CODE_EXTENSIONS:
        return 'code'
    if path.startswith('data/evidence/') or (
            suffix in ORIGINAL_EXTENSIONS and not path.startswith(ORIGINAL_DIRS)):
        return 'original'
    return None


def violations(staged=False, base=None, cwd='.'):
    # No rename detection: rename/copy destinations become additions, including
    # copies whose unchanged source would otherwise escape copy detection.
    args = ['git', 'diff', '--no-renames', '--diff-filter=A', '--name-only', '-z']
    if staged:
        args += ['--cached']
    else:
        if not base:
            raise ValueError('comparison base is required')
        base = subprocess.check_output(
            ['git', 'rev-parse', '--verify', '--end-of-options', base + '^{commit}'],
            cwd=cwd).decode().strip()
        args += [base, 'HEAD']
    args += ['--', 'data/']
    raw = subprocess.check_output(args, cwd=cwd)
    paths = [p.decode('utf-8', errors='surrogateescape') for p in raw.split(b'\0') if p]
    return [(kind(p), p) for p in paths if kind(p)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--staged', action='store_true')
    group.add_argument('--base')
    group.add_argument('--ci', action='store_true')
    args = parser.parse_args()
    base = args.base
    if args.ci:
        try:
            base = event_base()
        except ValueError as error:
            parser.error(str(error))
    try:
        rejected = violations(args.staged, base)
    except (subprocess.CalledProcessError, ValueError) as error:
        parser.exit(1, f'data policy: {error}\n')
    messages = {
        'code': 'Place new execution code in tools/:',
        'original': 'Keep fetched originals in data/work/ (ignored by Git) and record them in the ledger tables:',
    }
    report = []
    for name, title in messages.items():
        paths = [p for k, p in rejected if k == name]
        if paths:
            report += [title, *paths]
    if report:
        parser.exit(1, '\n'.join(report) + '\n')


if __name__ == '__main__':
    main()
