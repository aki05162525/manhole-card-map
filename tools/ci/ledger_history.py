"""Reject rewriting past location decisions, and name or address changes without a new decision.

Compares the ledger row files of a base commit with HEAD (or the index); reads Git, not the database.
"""
import argparse
import json
import subprocess

from event_base import event_base

ROWS = 'data/db'
TABLES = ('facility', 'location_decision', 'building_group_member')


def git(cwd, *args):
    return subprocess.check_output(['git', *args], cwd=cwd)


def read_rows(revision, cwd='.'):
    """Rows of TABLES at a revision ('' is the index, None is no commit); a missing file has no rows."""
    rows = {}
    for table in TABLES:
        rows[table] = []
        if revision is None:
            continue
        name = f'{revision}:{ROWS}/{table}.jsonl'
        found = subprocess.run(['git', 'rev-parse', '--verify', '--quiet', name], cwd=cwd, capture_output=True)
        if found.returncode == 0:
            text = git(cwd, 'cat-file', 'blob', found.stdout.decode().strip()).decode('utf-8')
            rows[table] = [json.loads(line) for line in text.splitlines()]
    return rows


def errors(base, head):
    """Past decisions stay as they are; a changed name or address of a located facility needs a new decision.

    Only columns that both sides have are compared, so adding or dropping a column is a schema change.
    A building group shares the check: every located member needs a new decision.
    """
    messages = []
    decisions = {(r['facility_id'], r['seq']): r for r in head['location_decision']}
    past = set()
    for row in base['location_decision']:
        key = (row['facility_id'], row['seq'])
        past.add(key)
        now = decisions.get(key)
        if now is None:
            messages.append(f'location_decision {key}: removed; keep past decisions and add a new one')
            continue
        changed = sorted(c for c in row.keys() & now.keys() if row[c] != now[c])
        if changed:
            messages.append(f'location_decision {key}: changed {", ".join(changed)}; '
                            'keep past decisions and add a new one')
    added = {f for f, seq in decisions if (f, seq) not in past}
    current = {}
    for (f, _), row in sorted(decisions.items()):
        current[f] = row
    located = {f for f, row in current.items() if row['action'] != 'withdraw'}

    before = {r['id']: (r['name'], r['address']) for r in base['facility']}
    changed = {r['id'] for r in head['facility']
               if before.get(r['id'], (r['name'], r['address'])) != (r['name'], r['address'])}
    cause = {f: None for f in changed}
    groups = {}
    for member in head['building_group_member']:
        groups.setdefault(member['group_id'], set()).add(member['facility_id'])
    for group, members in sorted(groups.items()):
        for trigger in sorted(members & changed):
            for f in members:
                cause.setdefault(f, (trigger, group))
    for f in sorted(cause):
        if f not in located or f in added:
            continue
        if cause[f] is None:
            reason = 'name or address changed'
        else:
            reason = f'{cause[f][0]} in building group {cause[f][1]} changed name or address'
        messages.append(f'facility {f}: {reason}; add a location decision (reaffirm, correct or withdraw)')
    return messages


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--staged', action='store_true', help='compare HEAD with the index')
    group.add_argument('--base', help='compare the merge base of BASE and HEAD with HEAD')
    group.add_argument('--ci', action='store_true')
    args = parser.parse_args()
    base = args.base
    if args.ci:
        try:
            base = event_base()
        except ValueError as error:
            parser.error(str(error))
    try:
        if args.staged:
            head_commit = subprocess.run(['git', 'rev-parse', '--verify', '--quiet', 'HEAD^{commit}'],
                                         capture_output=True).stdout.decode().strip() or None
            old, new = read_rows(head_commit), read_rows('')
        else:
            old = read_rows(git('.', 'merge-base', base, 'HEAD').decode().strip())
            new = read_rows('HEAD')
    except (subprocess.CalledProcessError, ValueError) as error:
        parser.exit(1, f'ledger history: {error}\n')
    messages = errors(old, new)
    if messages:
        parser.exit(1, '\n'.join(messages) + '\n')


if __name__ == '__main__':
    main()
