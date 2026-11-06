#!/usr/bin/env python3
"""Regenerate public data using only saved repository inputs; never fetch sources."""
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
AS_OF = '2026-11-06'
REVIEW_LIST = 'data/evidence/national/list-source/gkp-20261105.html'


def main():
    with tempfile.TemporaryDirectory(prefix='manhole-build-') as temporary:
        ledger = str(Path(temporary) / 'national-assembled.json')
        subprocess.run(['python3', '-B', 'tools/national/assemble.py', '--out', ledger], cwd=ROOT, check=True)
        subprocess.run(['go', 'run', './cmd/builddata', '-places', ledger,
                        '-review-list', REVIEW_LIST, '-as-of', AS_OF], cwd=ROOT, check=True)


if __name__ == '__main__':
    main()
