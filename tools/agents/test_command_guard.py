import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('command_guard', Path(__file__).with_name('command_guard.py'))
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)
RULES = ROOT / '.codex/rules/git-safety.rules'

BLOCKED = [
    # Skipping commit hooks.
    'git commit --no-verify -m x',
    'git commit -n -m x',
    'git commit -nm x',
    'git commit -anm x',
    'git commit --no-veri -m x',
    'git commit -m x -n',
    'git push --no-verify',
    'git push origin HEAD --no-verify',
    'git merge --no-verify topic',
    'LEFTHOOK=0 git commit -m x',
    'LEFTHOOK=false git commit -m x',
    'LEFTHOOK_EXCLUDE=frontend git commit -m x',
    'env LEFTHOOK=0 git commit -m x',
    'export LEFTHOOK=0 && git commit -m x',
    'git -c core.hooksPath=/dev/null commit -m x',
    'git config core.hooksPath /tmp/empty',
    # Disabling signatures.
    'git -c commit.gpgsign=false commit -m x',
    'git -c commit.gpgSign=no commit -m x',
    'git -C web -c commit.gpgsign=0 commit -m x',
    'git --config-env=commit.gpgsign=OFF commit -m x',
    'git commit --no-gpg-sign -m x',
    'git rebase --no-gpg-sign main',
    'git config commit.gpgsign false',
    'git config set --local commit.gpgsign false',
    'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=commit.gpgsign GIT_CONFIG_VALUE_0=false git commit -m x',
    "GIT_CONFIG_PARAMETERS=\"'commit.gpgsign'='false'\" git commit -m x",
    # Permanent Git configuration.
    'git config --global user.name Someone',
    'git config --system core.editor vim',
    'git config --global --unset user.signingkey',
    'git config --global --add safe.directory /x',
    'git config --global -e',
    'git config set --global user.name Someone',
    'git config unset --global user.name',
    # Compound commands and nested shells.
    'git status && git commit --no-verify -m x',
    'git add . ; git commit -n -m x',
    'true || git push --no-verify',
    'echo ok | git commit -n -F -',
    '(cd web && git commit --no-verify -m x)',
    'git status\ngit commit --no-verify -m x',
    "bash -lc 'git commit --no-verify -m x'",
    'sh -c "LEFTHOOK=0 git commit -m x"',
    "zsh -c 'cd web; git -c commit.gpgsign=false commit -m x'",
    "eval 'git commit -n -m x'",
    'echo "$(git commit --no-verify -m x)"',
    'echo `git commit -n -m x`',
    'sudo git config --system core.editor vim',
    'timeout 10 git commit --no-verify -m x',
    'mise exec -- git commit --no-verify -m x',
    '/usr/bin/git commit -n -m x',
    # Unbalanced quotes still get a conservative scan.
    "git commit --no-verify -m 'unterminated",
]

ALLOWED = [
    'git commit -m "fix -n option"',
    'git commit -m "skip --no-verify in docs"',
    'git commit -m -n',
    'git commit -F msg.txt',
    'git commit --amend --no-edit',
    'git commit -S -m x',
    'git commit -m x -- -n',
    'git commit -m LEFTHOOK=0',
    'git config --get commit.gpgsign',
    'git config --global --get user.name',
    'git config --global --list',
    'git config --global -l --show-origin',
    'git config get --global user.name',
    'git config list --global',
    'git config --global user.name',
    'git config --local user.name Someone',
    'git config user.email someone@example.com',
    'git log -n 3',
    'git push',
    'git push -n origin HEAD',
    'git merge -n topic',
    'git -c commit.gpgsign=true commit -m x',
    'git -c user.name=Test commit -m x',
    'LEFTHOOK_VERBOSE=1 git commit -m x',
    'LEFTHOOK=1 git commit -m x',
    'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=user.signingkey GIT_CONFIG_VALUE_0=~/.ssh/k.pub git commit -m x',
    'grep -rn "git commit --no-verify" docs',
    "rg 'LEFTHOOK=0' AGENTS.md",
    'python3 -B -m unittest discover -s tools/dev',
    'cd web && bun run test',
    'echo "--no-verify"',
]


def clean_env(**extra):
    env = {k: v for k, v in os.environ.items() if not k.startswith('GIT_')}
    env.update(extra)
    return env


class GuardTableTests(unittest.TestCase):
    def test_blocks_hook_skips_unsigned_commits_and_permanent_config(self):
        for command in BLOCKED:
            with self.subTest(command=command):
                self.assertTrue(guard.violations(command), command)

    def test_allows_ordinary_commands_and_quoted_text(self):
        for command in ALLOWED:
            with self.subTest(command=command):
                self.assertEqual(guard.violations(command), [], command)

    def test_argv_lists_are_checked_like_shell_strings(self):
        self.assertTrue(guard.violations(['bash', '-lc', 'git commit -n -m x']))
        self.assertEqual(guard.violations(['git', 'commit', '-m', 'fix -n option']), [])


class HookIntegrationTests(unittest.TestCase):
    def run_hook(self, command_line, payload, **env):
        return subprocess.run(['sh', '-c', command_line], cwd=ROOT, input=json.dumps(payload),
                              env=clean_env(**env), capture_output=True, text=True)

    def claude_hook(self):
        settings = json.loads((ROOT / '.claude/settings.json').read_text())
        (group,) = [g for g in settings['hooks']['PreToolUse'] if g['matcher'] == 'Bash']
        (hook,) = group['hooks']
        return hook['command']

    def codex_hook(self):
        config = json.loads((ROOT / '.codex/hooks.json').read_text())
        # Codex matchers are regular expressions; anchor so apply_patch never matches.
        (group,) = [g for g in config['hooks']['PreToolUse'] if g['matcher'] == '^Bash$']
        (hook,) = group['hooks']
        return hook['command']

    def test_claude_settings_hook_blocks_with_exit_2_and_reason(self):
        command = self.claude_hook()
        blocked = self.run_hook(command, {'tool_name': 'Bash', 'tool_input': {
            'command': 'git commit --no-verify -m x'}}, CLAUDE_PROJECT_DIR=str(ROOT))
        self.assertEqual(blocked.returncode, 2, blocked.stderr)
        self.assertIn('--no-verify', blocked.stderr)
        allowed = self.run_hook(command, {'tool_name': 'Bash', 'tool_input': {
            'command': 'git commit -m "fix -n option"'}}, CLAUDE_PROJECT_DIR=str(ROOT))
        self.assertEqual((allowed.returncode, allowed.stderr), (0, ''))

    def test_codex_hook_resolves_the_guard_from_the_git_root(self):
        command = self.codex_hook()
        blocked = self.run_hook(command, {'tool_name': 'Bash', 'tool_input': {
            'command': ['bash', '-lc', 'LEFTHOOK=0 git commit -m x']}})
        self.assertEqual(blocked.returncode, 2, blocked.stderr)
        self.assertIn('LEFTHOOK', blocked.stderr)
        allowed = self.run_hook(command, {'tool_name': 'Bash', 'tool_input': {'command': 'git status'}})
        self.assertEqual((allowed.returncode, allowed.stderr), (0, ''))

    def test_other_tools_and_malformed_input(self):
        script = ROOT / 'tools/agents/command_guard.py'
        def run(stdin):
            return subprocess.run([sys.executable, '-B', str(script)], input=stdin,
                                  env=clean_env(), capture_output=True, text=True)
        self.assertEqual(run(json.dumps({'tool_name': 'Edit', 'tool_input': {}})).returncode, 0)
        # Unreadable input blocks rather than silently allowing the command.
        self.assertEqual(run('not json').returncode, 2)


@unittest.skipUnless(shutil.which('codex'), 'codex CLI is not installed')
class CodexRulesTests(unittest.TestCase):
    def decision(self, *command):
        result = subprocess.run(['codex', 'execpolicy', 'check', '--rules', str(RULES), '--', *command],
                                env=clean_env(), capture_output=True, text=True, check=True)
        return json.loads(result.stdout).get('decision')

    def test_rules_forbid_direct_bypass_forms(self):
        for command in [
            ['git', 'commit', '--no-verify', '-m', 'x'],
            ['git', 'commit', '-n', '-m', 'x'],
            ['git', 'commit', '-nm', 'x'],
            ['git', 'push', '--no-verify'],
            ['git', 'commit', '--no-gpg-sign', '-m', 'x'],
            ['git', '-c', 'commit.gpgsign=false', 'commit', '-m', 'x'],
            ['git', 'config', '--global', '--unset', 'user.name'],
            ['git', 'config', 'set', '--global', 'user.name', 'x'],
            ['git', 'config', 'commit.gpgsign', 'false'],
            ['LEFTHOOK=0', 'git', 'commit', '-m', 'x'],
            ['env', 'LEFTHOOK=0', 'git', 'commit', '-m', 'x'],
        ]:
            with self.subTest(command=command):
                self.assertEqual(self.decision(*command), 'forbidden')

    def test_rules_leave_ordinary_commands_alone(self):
        for command in [
            ['git', 'commit', '-m', 'fix -n option'],
            ['git', 'config', '--global', '--get', 'user.name'],
            ['git', 'log', '-n', '3'],
            ['git', 'push'],
        ]:
            with self.subTest(command=command):
                self.assertIsNone(self.decision(*command))


if __name__ == '__main__':
    unittest.main()
