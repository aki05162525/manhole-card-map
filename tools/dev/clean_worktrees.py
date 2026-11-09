#!/usr/bin/env python3
"""List, and with --apply remove, merged worktrees and local branches that hold no unique work.

A branch is merged when its tip is an ancestor of origin/main (main if there is
no origin/main), or when GitHub squash-merged it: either merging it into main
(git merge-tree) leaves main's tree unchanged, or its combined diff from the
merge base has the same patch-id as a commit on main. Run `git fetch --prune`
first; the script does not fetch. The main worktree, the current worktree,
detached, locked or missing worktrees, worktrees with uncommitted or untracked
changes, and worktrees whose branch has no commits of its own yet are kept.
Branches without a worktree are removed when merged or when their tip is
already on main.
"""
import argparse
from dataclasses import dataclass
import os
from pathlib import Path
import subprocess
import sys

# Repository-locating variables from a hook would point every command elsewhere.
LOCATING = {'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR', 'GIT_PREFIX',
            'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES'}
ENV = {k: v for k, v in os.environ.items() if k not in LOCATING}
DIFF = ['--no-color', '--no-ext-diff', '--no-textconv', '--no-renames', '--binary']


@dataclass
class Item:
    path: Path | None
    branch: str | None
    remove: bool
    reason: str
    squash: bool = False


def command(repo, *args):
    return ['git', '--literal-pathspecs', '-C', str(repo), *args]


def git(repo, *args, check=True):
    result = subprocess.run(command(repo, *args), env=ENV, capture_output=True,
                            text=True, errors='surrogateescape')
    if check and result.returncode:
        raise SystemExit(f'git {" ".join(args)} failed: {result.stderr.strip()}')
    return result


def out(repo, *args):
    return git(repo, *args).stdout.strip()


def worktrees(repo):
    entries, entry = [], {}
    for line in git(repo, 'worktree', 'list', '--porcelain').stdout.splitlines() + ['']:
        if not line:
            if entry:
                entries.append(entry)
            entry = {}
            continue
        key, _, value = line.partition(' ')
        entry[key] = value
    return entries


def base_ref(repo):
    for ref in ('refs/remotes/origin/main', 'refs/heads/main'):
        if git(repo, 'rev-parse', '--verify', '--quiet', ref, check=False).returncode == 0:
            return ref
    raise SystemExit('Neither origin/main nor main exists.')


def patch_ids(repo, *args):
    """patch-ids of `git <args>` output, piped as bytes: diffs need not be UTF-8."""
    producer = subprocess.Popen(command(repo, *args), env=ENV, stdout=subprocess.PIPE)
    ids = subprocess.run(command(repo, 'patch-id', '--stable'), env=ENV, stdin=producer.stdout,
                         capture_output=True, check=True).stdout
    producer.stdout.close()
    if producer.wait():
        raise SystemExit(f'git {" ".join(args)} failed')
    return {line.split()[0] for line in ids.splitlines() if line}


def squash_merged(repo, tip, base, merge_base):
    """Return why the branch's net change is already on base, or None."""
    changed = git(repo, 'diff', '--name-only', '-z', '--no-renames', merge_base, tip).stdout
    changed = [p for p in changed.split('\0') if p]
    if not changed:
        return None  # No net change: nothing proves it was merged rather than abandoned.
    # Merging the branch into main yields main's own tree when main already holds
    # its change, even if main edited neighbouring lines (needs Git 2.38+).
    merge = git(repo, 'merge-tree', '--write-tree', base, tip, check=False)
    if merge.returncode == 0 and merge.stdout.split()[0] == out(repo, 'rev-parse', f'{base}^{{tree}}'):
        return 'squash-merged (merging it into main changes nothing)'
    # Main may have changed the same lines again after the squash; the squash commit
    # itself still carries the branch's patch. Limit the log to the branch's files.
    paths = ['--', *changed] if len(changed) <= 500 else []
    branch_patch = patch_ids(repo, 'diff', *DIFF, merge_base, tip)
    landed = patch_ids(repo, 'log', '-p', *DIFF, '--no-merges', '--format=commit %H',
                       f'{merge_base}..{base}', *paths)
    if branch_patch & landed:
        return 'squash-merged (same patch-id as a commit on main)'
    return None


def merged(repo, branch, base, first_parent):
    """(merged, reason, squash) for a local branch against base; None when it has no commits."""
    tip = out(repo, 'rev-parse', f'refs/heads/{branch}')
    if tip in first_parent:
        return None, 'no commits of its own (tip is on main)', False
    if git(repo, 'merge-base', '--is-ancestor', tip, base, check=False).returncode == 0:
        return True, f'merged into {base.removeprefix("refs/remotes/")}', False
    merge_base = git(repo, 'merge-base', tip, base, check=False).stdout.strip()
    reason = merge_base and squash_merged(repo, tip, base, merge_base)
    if reason:
        return True, reason, True
    return False, 'not merged', False


def plan(repo):
    repo = Path(repo)
    current = Path(out(repo, 'rev-parse', '--show-toplevel')).resolve()
    base = base_ref(repo)
    base_branch = base.rsplit('/', 1)[-1]
    first_parent = set(out(repo, 'rev-list', '--first-parent', base).split())
    items, checked_out = [], set()
    for index, entry in enumerate(worktrees(repo)):
        path = Path(entry['worktree'])
        branch = entry.get('branch', '').removeprefix('refs/heads/') or None
        checked_out.add(branch)
        if index == 0 or 'bare' in entry:
            items.append(Item(path, branch, False, 'main worktree'))
        elif path.resolve() == current:
            items.append(Item(path, branch, False, 'current worktree'))
        elif branch is None:
            items.append(Item(path, None, False, 'detached HEAD'))
        elif 'locked' in entry:
            items.append(Item(path, branch, False, 'locked'))
        elif 'prunable' in entry or not path.is_dir():
            items.append(Item(path, branch, False, 'directory missing (see git worktree prune)'))
        elif branch == base_branch:
            items.append(Item(path, branch, False, 'base branch'))
        else:
            ok, reason, squash = merged(repo, branch, base, first_parent)
            # A worktree just created from main looks merged; keep it for whoever started it.
            ok = bool(ok)
            status = out(path, 'status', '--porcelain', '--untracked-files=all')
            if ok and status:
                ok, reason = False, f'{reason}, but has uncommitted or untracked changes'
            items.append(Item(path, branch, ok, reason, squash))
    for ref in out(repo, 'for-each-ref', '--format=%(refname)', 'refs/heads').splitlines():
        branch = ref.removeprefix('refs/heads/')
        if branch in checked_out or branch == base_branch:
            continue
        # Without a worktree, a branch whose tip is already on main holds nothing to lose.
        ok, reason, squash = merged(repo, branch, base, first_parent)
        items.append(Item(None, branch, ok is not False, reason, squash))
    return items


def delete_branch(repo, item):
    if not item.squash and git(repo, 'branch', '-d', item.branch, check=False).returncode == 0:
        return
    # -d compares with HEAD or the upstream, not origin/main; the explicit check above decided.
    git(repo, 'branch', '-D', item.branch)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('-C', dest='repo', default='.', help='repository or worktree (default: cwd)')
    parser.add_argument('--apply', action='store_true', help='remove the listed targets')
    args = parser.parse_args(argv)
    repo = Path(args.repo)
    items = plan(repo)
    for item in items:
        label = 'remove' if item.remove else 'keep'
        where = str(item.path) if item.path else '(no worktree)'
        print(f'{label:6} {where} [{item.branch or "-"}] {item.reason}')
        if args.apply and item.remove:
            if item.path:
                git(repo, 'worktree', 'remove', str(item.path))  # Refuses if it became dirty.
            delete_branch(repo, item)
    if not args.apply and any(item.remove for item in items):
        print('Dry run. Re-run with --apply to remove the targets.', file=sys.stderr)


if __name__ == '__main__':
    main()
