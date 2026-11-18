import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).parent))
spec = importlib.util.spec_from_file_location('delegate_guard', Path(__file__).with_name('delegate_guard.py'))
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)
import command_guard  # noqa: E402  (needs the directory on sys.path)

STEPS = ('`git switch -c fix-review origin/harness/x` で作業し、終わったら '
         '`git push origin HEAD:harness/x` で push する。')

# (role, isolation, task) that must be refused.
BLOCKED = [
    # Reviews and research without their own worktree.
    ('review', None, 'PR #12 の差分をレビューする。'),
    ('review', 'shared', 'PR #12 の差分をレビューする。'),
    ('research', None, '台帳の位置候補を調べる。'),
    # Fixes for an open PR without the branch steps.
    ('implementation', 'worktree', 'PR #12 に修正を足して push する。'),
    ('implementation', 'worktree', 'PR #12 のレビューの指摘を直す。'),
    ('implementation', 'worktree', 'PR #12（harness/x）のブランチで作業する。'),
    ('general', 'worktree', 'Codex の指摘を PR #12 へ反映してコミットを追加する。PR #12 にコミットを積む。'),
    ('implementation', 'worktree', 'https://github.com/o/r/pull/12 に修正を追加する。'),
    (None, 'worktree', 'PR12 の指摘に対応する。'),
    ('implementation', 'worktree', 'PR #12 を修正して同じブランチに push する'),
    ('implementation', 'worktree', 'PR #12 のブランチに push する。'),
    ('implementation', 'worktree', 'PR #12 で出た指摘を直し、その PR に push する。'),
    ('implementation', 'worktree', 'Fix the review comments on PR #12 and push to that PR.'),
    ('implementation', 'worktree', 'Push the fix to PR #12.'),
    ('implementation', 'worktree', 'Address the feedback on #12 and push to the same branch.'),
    ('implementation', 'worktree', 'Add a commit to https://github.com/o/r/pull/12 with the fix.'),
    ('implementation', 'worktree', 'Update PR #12 with the missing tests.'),
    # Only half of the steps: `git switch <branch>` still stops, or `git push` makes a new branch.
    ('implementation', 'worktree', 'PR #12 に修正を足す。`git push origin HEAD:harness/x` で push する。'),
    ('implementation', 'worktree', 'PR #12 に修正を足す。`git switch -c fix origin/harness/x` で作業する。'),
]

ALLOWED = [
    ('review', 'worktree', 'PR #12 をレビューし、指摘を返す。コミットはしない。'),
    ('research', 'worktree', '台帳の位置候補を調べる。'),
    ('implementation', None, 'PR #12 のレビューの指摘を直す。'),  # shared checkout: not this rule
    ('implementation', 'worktree', 'PR #12 に修正を足す。' + STEPS),
    ('implementation', 'worktree', 'PR #12 のブランチに足す。`git checkout -b fix origin/harness/x` の後 '
                                   '`git push -u origin HEAD:harness/x`。'),
    # A PR mentioned as background, not as the branch to push to.
    ('implementation', 'worktree', 'この PR を作った後の main（PR #369 と #367 の組み合わせで lint が落ちた事故、'
                                   '#373 で修正）を再現するテストを書く。gh pr create --base main で PR を作る。'),
    ('implementation', 'worktree', 'Issue #342 の段階2を実装し、新しい PR を作る。'),
    ('implementation', 'worktree', 'Issue #12 にテストを追加し、新しい PR を作る。'),
    ('implementation', 'worktree', 'https://github.com/o/r/issues/12 に書かれた不具合を直し、新しい PR を作る。'),
    ('implementation', 'worktree', 'PR #12 のブランチを参考に、新しい PR を作る。'),
    ('implementation', 'worktree', 'PR #12 のブランチは別の worktree が使っている。新しいブランチで PR を作る。'),
    ('implementation', 'worktree', 'Fix issue #12 and open a new PR.'),
    ('implementation', 'worktree', "Read the branch of PR #12 and open a new PR with the same idea."),
    ('implementation', 'worktree', 'Push to a new branch and open a PR; PR #12 is unrelated.'),
    ('implementation', 'worktree', 'PR #12 を参考に新しい PR を作る。この PR でコミットを1つにまとめる。'),
    ('implementation', 'worktree', 'PR #12 をマージした後の main で、残りの件を直す。'),
    ('design', 'worktree', 'PR #12 で入った設計を読み、次の案を出す。'),
    ('implementation', 'worktree', ''),
]


def arguments(role, isolation, task):
    return {k: v for k, v in {'role': role, 'isolation': isolation, 'task': task}.items() if v is not None}


# Pairs from the review of PR #381: (refused, allowed) wordings of the same kind.
REVIEW_PAIRS = [
    ('PR #12 を修正して同じブランチに push する', 'Issue #12 にテストを追加し、新しい PR を作る。'),
    ('Fix the review comments on PR #12 and push to that PR.', 'PR #12 のブランチを参考に、新しい PR を作る。'),
]


class DelegateRuleTests(unittest.TestCase):
    def test_review_pairs(self):
        for refused, allowed in REVIEW_PAIRS:
            with self.subTest(refused=refused):
                self.assertEqual(guard.violations(arguments('implementation', 'worktree', refused)), [guard.PR_BRANCH])
                self.assertEqual(guard.violations(arguments('implementation', 'worktree', refused + STEPS)), [])
            with self.subTest(allowed=allowed):
                self.assertEqual(guard.violations(arguments('implementation', 'worktree', allowed)), [])

    def test_refuses_missing_worktrees_and_pr_branch_steps(self):
        for case in BLOCKED:
            with self.subTest(case=case):
                self.assertTrue(guard.violations(arguments(*case)), case)

    def test_allows_complete_briefs_and_background_mentions(self):
        for case in ALLOWED:
            with self.subTest(case=case):
                self.assertEqual(guard.violations(arguments(*case)), [], case)

    def test_shell_fallback_is_checked_like_the_tool(self):
        payload = json.dumps({'task': 'PR #12 の差分を見る', 'role': 'review'}, ensure_ascii=False)
        command = f'"$T3_ACP_MCP_ENTRYPOINT" acp-mcp-call delegate_task {command_guard.shlex.quote(payload)}'
        self.assertEqual(command_guard.violations(command), [guard.NO_WORKTREE.format('review')])
        allowed = json.dumps({'task': 'x', 'role': 'review', 'isolation': 'worktree'})
        self.assertEqual(command_guard.violations(f"acp-mcp-call delegate_task '{allowed}'"), [])


class DelegateHookTests(unittest.TestCase):
    def hooks(self, path):
        config = json.loads((ROOT / path).read_text())
        groups = [g for g in config['hooks']['PreToolUse'] if 'delegate_task' in g['matcher']]
        (group,) = groups
        (hook,) = group['hooks']
        return group['matcher'], hook['command']

    def run_hook(self, command_line, payload):
        env = {k: v for k, v in os.environ.items() if not k.startswith('GIT_')}
        env['CLAUDE_PROJECT_DIR'] = str(ROOT)
        return subprocess.run(['sh', '-c', command_line], cwd=ROOT, input=json.dumps(payload),
                              env=env, capture_output=True, text=True)

    def test_both_harnesses_route_the_t3_tool_to_the_guard(self):
        # Claude Code names the server t3-code; Codex normalizes it (t3_code, t3_code_direct).
        names = {'.claude/settings.json': 'mcp__t3-code__delegate_task',
                 '.codex/hooks.json': 'mcp__t3_code_direct__delegate_task'}
        for path, name in names.items():
            with self.subTest(path=path):
                matcher, command = self.hooks(path)
                self.assertRegex(name, matcher)
                self.assertNotRegex('mcp__t3-code__delegate_task_status', matcher)
                blocked = self.run_hook(command, {'tool_name': name, 'tool_input': {
                    'task': 'PR #12 の差分を見る', 'role': 'review', 'isolation': 'shared'}})
                self.assertEqual(blocked.returncode, 2, blocked.stderr)
                self.assertIn('worktree', blocked.stderr)
                allowed = self.run_hook(command, {'tool_name': name, 'tool_input': {
                    'task': 'PR #12 の差分を見る', 'role': 'review', 'isolation': 'worktree'}})
                self.assertEqual((allowed.returncode, allowed.stderr), (0, ''))

    def test_other_tools_pass_and_unreadable_input_blocks(self):
        script = ROOT / 'tools/agents/delegate_guard.py'
        def run(stdin):
            return subprocess.run([sys.executable, '-B', str(script)], input=stdin, capture_output=True, text=True)
        other = {'tool_name': 'mcp__t3-code__task_status', 'tool_input': {'role': 'review'}}
        self.assertEqual(run(json.dumps(other)).returncode, 0)
        self.assertEqual(run('not json').returncode, 2)


if __name__ == '__main__':
    unittest.main()
