#!/usr/bin/env python3
"""Regenerate public and internal data using only saved repository inputs; never fetch sources."""
import argparse
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
AS_OF = '2026-11-06'
REVIEW_LIST = 'data/raw/gkp-list-20261105.html'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--update-card-ids', action='store_true',
                        help='add new generated card IDs to data/card-ids.json for review')
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='manhole-build-') as temporary:
        ledger = str(Path(temporary) / 'ledger.json')
        subprocess.run(['python3', '-B', 'tools/db/ledgerdb.py', 'export-ledger', '--out', ledger], cwd=ROOT, check=True)
        subprocess.run(['go', 'run', './cmd/builddata', '-places', ledger,
                        '-out', 'web/public/data', '-internal-out', 'data/work/internal-data',
                        '-review-list', REVIEW_LIST, '-as-of', AS_OF]
                       + (['-update-card-ids'] if args.update_card_ids else []), cwd=ROOT, check=True)


if __name__ == '__main__':
    main()
