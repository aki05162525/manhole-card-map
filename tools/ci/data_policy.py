"""Reject new authored execution code in data; inspect Git, never file contents."""
import argparse
import json
import os
from pathlib import PurePosixPath, Path
import subprocess

# Tracked data contains 259 Python, 3 Go and one authored check-maps.ts.
# HTML/SVG and JavaScript can be fetched originals; leave those formats allowed.
CODE_EXTENSIONS = {'.py', '.sh', '.bash', '.zsh', '.go', '.ipynb', '.ts',
                   '.tsx', '.jsx', '.mjs', '.cjs', '.rb', '.pl', '.php', '.r',
                   '.ps1', '.bat', '.cmd', '.c', '.cpp', '.rs', '.java'}


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
    return [p for p in paths if PurePosixPath(p).suffix.lower() in CODE_EXTENSIONS]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--staged', action='store_true')
    group.add_argument('--base')
    group.add_argument('--ci', action='store_true')
    args = parser.parse_args()
    base = args.base
    if args.ci:
        event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
        name = os.environ['GITHUB_EVENT_NAME']
        if name == 'workflow_dispatch':
            base = 'HEAD'
        else:
            base = (event['pull_request']['base']['sha'] if name == 'pull_request'
                    else event.get('before'))
            if not base or set(base) == {'0'}:
                parser.error('comparison base unavailable')
    try:
        rejected = violations(args.staged, base)
    except (subprocess.CalledProcessError, ValueError) as error:
        parser.exit(1, f'data policy: {error}\n')
    if rejected:
        parser.exit(1, 'Place new execution code in tools/:\n' + '\n'.join(rejected) + '\n')


if __name__ == '__main__':
    main()
