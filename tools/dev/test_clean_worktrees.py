import contextlib
import importlib.util
import io
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('clean_worktrees', Path(__file__).with_name('clean_worktrees.py'))
clean = importlib.util.module_from_spec(spec)
spec.loader.exec_module(clean)

# Hook environments carry GIT_DIR; never let it reach the temporary repositories.
CLEAN_ENV = {k: v for k, v in os.environ.items() if not k.startswith('GIT_')}
IDENTITY = ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false']


class CleanWorktreesTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.repo = self.root / 'clone'
        self.git(self.root, 'init', '--bare', '-b', 'main', 'origin.git')
        self.git(self.root, 'clone', 'origin.git', 'clone')
        self.commit(self.repo, 'base.txt', 'base\n')
        self.git(self.repo, 'push', 'origin', 'HEAD:main')

    def git(self, cwd, *args):
        return subprocess.run(['git', *map(str, args)], cwd=cwd, env=CLEAN_ENV, check=True,
                              capture_output=True, text=True).stdout.strip()

    def commit(self, cwd, name, body):
        (cwd / name).write_text(body)
        self.git(cwd, 'add', name)
        self.git(cwd, *IDENTITY, 'commit', '-m', name)

    def worktree(self, branch, name=None):
        path = self.root / (name or branch)
        self.git(self.repo, 'worktree', 'add', '-b', branch, path, 'main')
        return path

    def merge(self, branch, squash=False):
        if squash:
            self.git(self.repo, *IDENTITY, 'merge', '--squash', branch)
            self.git(self.repo, *IDENTITY, 'commit', '-m', f'squash {branch}')
        else:
            self.git(self.repo, *IDENTITY, 'merge', '--no-ff', '-m', f'merge {branch}', branch)
        self.git(self.repo, 'push', 'origin', 'main')

    def plan(self):
        self.git(self.repo, 'fetch', 'origin')
        return {item.branch or item.path.name: item for item in clean.plan(self.repo)}

    def test_merged_clean_worktree_is_removed(self):
        path = self.worktree('merged')
        self.commit(path, 'merged.txt', 'merged\n')
        self.merge('merged')
        item = self.plan()['merged']
        self.assertTrue(item.remove, item.reason)
        self.assertFalse(item.squash)
        from_inside = {i.branch: i for i in clean.plan(path)}['merged']
        self.assertEqual((from_inside.remove, from_inside.reason), (False, 'current worktree'))

    def test_squash_merged_clean_worktree_is_removed_after_main_moves(self):
        path = self.worktree('squashed')
        self.commit(path, 'one.txt', 'one\n')
        self.commit(path, 'two.txt', 'two\n')
        self.merge('squashed', squash=True)
        self.commit(self.repo, 'later.txt', 'later\n')
        self.git(self.repo, 'push', 'origin', 'main')
        item = self.plan()['squashed']
        self.assertTrue(item.remove, item.reason)
        self.assertTrue(item.squash)

    def test_squash_merge_after_main_edits_neighbouring_lines(self):
        self.commit(self.repo, 'base.txt', 'a\nb\nc\n')
        self.git(self.repo, 'push', 'origin', 'main')
        path = self.worktree('nearby')
        self.commit(path, 'base.txt', 'a\nb\nC\n')
        self.commit(self.repo, 'base.txt', 'A\nb\nc\n')
        self.merge('nearby', squash=True)
        item = self.plan()['nearby']
        self.assertEqual((item.remove, item.reason), (True, 'squash-merged (merging it into main changes nothing)'))

    def test_squash_merge_found_by_patch_id_after_main_edits_same_line(self):
        path = self.worktree('rewritten')
        self.commit(path, 'base.txt', 'branch\n')
        self.merge('rewritten', squash=True)
        self.commit(self.repo, 'base.txt', 'later\n')
        self.git(self.repo, 'push', 'origin', 'main')
        item = self.plan()['rewritten']
        self.assertEqual((item.remove, item.reason), (True, 'squash-merged (same patch-id as a commit on main)'))

    def test_uncommitted_or_untracked_changes_keep_worktree(self):
        for name, dirty in [('modified', 'base.txt'), ('untracked', 'new.txt')]:
            path = self.worktree(name)
            self.commit(path, f'{name}.txt', 'x\n')
            self.merge(name)
            (path / dirty).write_text('changed\n')
        items = self.plan()
        for name in ['modified', 'untracked']:
            self.assertFalse(items[name].remove)
            self.assertIn('uncommitted', items[name].reason)

    def test_unmerged_unstarted_and_detached_worktrees_are_kept(self):
        self.commit(self.worktree('unmerged'), 'wip.txt', 'wip\n')
        self.worktree('unstarted')
        self.git(self.repo, 'worktree', 'add', '--detach', self.root / 'detached', 'main')
        items = self.plan()
        for name in ['unmerged', 'unstarted', 'detached']:
            self.assertFalse(items[name].remove, name)

    def test_branch_without_worktree_is_removed_only_when_on_main(self):
        self.git(self.repo, 'branch', 'idle', 'main')
        self.git(self.repo, 'branch', 'wip', 'main')
        # An empty commit beside main: not merged, and no content proves otherwise.
        tree_commit = self.git(self.repo, *IDENTITY, 'commit-tree', '-p', 'wip', '-m', 'wip', 'wip^{tree}')
        self.git(self.repo, 'branch', '-f', 'wip', tree_commit)
        items = self.plan()
        self.assertTrue(items['idle'].remove, items['idle'].reason)
        self.assertEqual((items['wip'].remove, items['wip'].reason), (False, 'not merged'))
        self.assertEqual(items['main'].reason, 'main worktree')

    def test_apply_removes_only_targets(self):
        merged = self.worktree('merged')
        self.commit(merged, 'merged.txt', 'merged\n')
        squashed = self.worktree('squashed')
        self.commit(squashed, 'squashed.txt', 'squashed\n')
        kept = self.worktree('kept')
        self.commit(kept, 'kept.txt', 'kept\n')
        self.merge('merged')
        self.merge('squashed', squash=True)
        self.git(self.repo, 'fetch', 'origin')
        with contextlib.redirect_stdout(io.StringIO()):
            clean.main(['-C', str(self.repo), '--apply'])
        branches = self.git(self.repo, 'branch', '--format=%(refname:short)').split()
        self.assertEqual(sorted(branches), ['kept', 'main'])
        self.assertFalse(merged.exists())
        self.assertFalse(squashed.exists())
        self.assertTrue(kept.exists())


if __name__ == '__main__':
    unittest.main()
