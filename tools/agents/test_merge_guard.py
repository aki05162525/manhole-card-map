import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).parent))
spec = importlib.util.spec_from_file_location('merge_guard', Path(__file__).with_name('merge_guard.py'))
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)

CLEAN_ENV = {k: v for k, v in os.environ.items() if not k.startswith('GIT_')}
PACKAGE = {'scripts': {'lint': 'oxlint src', 'lint:css': 'stylelint "src/**/*.css"', 'typecheck': 'bun check -b',
                       'test': 'vitest run'},
           'dependencies': {'react': '19.0.0'},
           'devDependencies': {'oxc-parser': '0.1.0', 'oxlint': '1.0.0', 'stylelint': '18.0.0',
                               'typescript': '7.0.0', 'vitest': '5.0.0'}}
# A lint plugin of web/scripts/lint/ that imports a package, like oxlint-context-values.mjs.
LINT_PLUGIN = 'import { parseSync } from "oxc-parser";\nimport { relative } from "node:path";\n'
LINT_PLUGIN_TEST = 'import { describe } from "vitest";\n'


def package(**changes):
    """PACKAGE with some entries of its sections replaced."""
    return json.dumps({k: {**v, **changes.get(k, {})} if isinstance(v, dict) else v for k, v in PACKAGE.items()},
                      indent=2)

FAKE_GH = '''\
#!{python}
"""Answer `gh pr view [selector] --json ...` from $FAKE_GH_PRS; log every call."""
import json, os, subprocess, sys
with open(os.environ['FAKE_GH_LOG'], 'a') as log:
    log.write(json.dumps(sys.argv[1:]) + '\\n')
args = sys.argv[1:]
if args[:2] != ['pr', 'view']:
    sys.exit('fake gh: unexpected call')
selector = args[2] if len(args) > 2 and not args[2].startswith('-') else None
if selector is None:  # like gh: the pull request of the current branch
    selector = subprocess.run(['git', 'branch', '--show-current'], capture_output=True, text=True).stdout.strip()
prs = json.load(open(os.environ['FAKE_GH_PRS']))
if selector not in prs:
    sys.exit('no pull requests found for branch "' + selector + '"')
print(json.dumps(prs[selector]))
'''


class Repositories:
    """An origin (bare) and a clone, with a fake `gh` that knows the pull requests."""

    def __init__(self, base):
        self.base = Path(base)
        self.origin, self.work, self.bin = self.base / 'origin.git', self.base / 'work', self.base / 'bin'
        self.prs_file, self.log = self.base / 'prs.json', self.base / 'gh.log'
        self.prs = {}
        self.git('init', '-q', '--bare', '-b', 'main', str(self.origin), cwd=self.base)
        self.git('clone', '-q', str(self.origin), str(self.work), cwd=self.base)
        self.git('switch', '-q', '-c', 'main')
        self.write('web/.oxlintrc.json', '{"rules": {}}\n')
        self.write('web/package.json', json.dumps(PACKAGE, indent=2))
        self.write('web/src/app.tsx', 'export const App = () => null;\n')
        self.write('web/scripts/lint/plugin.mjs', LINT_PLUGIN)
        self.write('web/scripts/lint/plugin.test.ts', LINT_PLUGIN_TEST)
        # The real CI workflow: the guard reads which scripts its lint and typecheck jobs run.
        self.write('.github/workflows/ci.yml', (ROOT / '.github/workflows/ci.yml').read_text())
        self.commit('init')
        self.git('push', '-q', 'origin', 'main')
        self.bin.mkdir()
        gh = self.bin / 'gh'
        gh.write_text(FAKE_GH.format(python=sys.executable))
        gh.chmod(0o755)
        self.env = {**CLEAN_ENV, 'PATH': f'{self.bin}{os.pathsep}{CLEAN_ENV.get("PATH", "")}',
                    'FAKE_GH_PRS': str(self.prs_file), 'FAKE_GH_LOG': str(self.log)}

    def git(self, *args, cwd=None):
        result = subprocess.run(['git', '-c', 'commit.gpgsign=false', '-c', 'user.name=Test',
                                 '-c', 'user.email=test@example.com', *args],
                                cwd=cwd or self.work, env=CLEAN_ENV, capture_output=True, text=True, check=True)
        return result.stdout.strip()

    def write(self, path, text):
        target = self.work / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text)

    def commit(self, message):
        self.git('add', '-A')
        self.git('commit', '-q', '-m', message)
        return self.git('rev-parse', 'HEAD')

    def change_main(self, path, text):
        self.git('switch', '-q', 'main')
        self.write(path, text)
        sha = self.commit(f'change {path}')
        self.git('push', '-q', 'origin', 'main')
        return sha

    def open_pr(self, number, branch, start='main'):
        """Branch from `start`, add a file, publish it as pull request `number`."""
        self.git('switch', '-q', '-c', branch, start)
        self.write(f'web/src/{branch}.tsx', 'export const B = () => <button>x</button>;\n')
        return self.publish(number, branch, self.commit(branch))

    def publish(self, number, branch, head):
        self.git('push', '-q', 'origin', f'{head}:refs/heads/{branch}', f'{head}:refs/pull/{number}/head')
        entry = {'number': number, 'headRefOid': head, 'baseRefName': 'main'}
        self.prs[str(number)] = self.prs[branch] = entry
        self.prs_file.write_text(json.dumps(self.prs))
        return head

    def hook(self, command):
        """Run the Claude Code Bash hook of .claude/settings.json on a command, in the clone."""
        settings = json.loads((ROOT / '.claude/settings.json').read_text())
        (group,) = [g for g in settings['hooks']['PreToolUse'] if g['matcher'] == 'Bash']
        (hook,) = group['hooks']
        payload = {'tool_name': 'Bash', 'cwd': str(self.work), 'tool_input': {'command': command}}
        return subprocess.run(['sh', '-c', hook['command']], cwd=self.work, input=json.dumps(payload),
                              env={**self.env, 'CLAUDE_PROJECT_DIR': str(ROOT)}, capture_output=True, text=True)

    def gh_calls(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()] if self.log.exists() else []

    def check(self, *args, cwd=None):
        with mock.patch.dict(os.environ, self.env, clear=True):
            return guard.check(list(args), str(cwd or self.work))


class MergeGuardTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.repos = Repositories(temp.name)

    def test_reproduces_the_lint_rule_that_landed_after_the_pr_forked(self):
        # PR #367 adds a <button> without type; #369 then enables react/button-has-type on main.
        r = self.repos
        r.open_pr(367, 'feature')
        r.change_main('web/.oxlintrc.json', '{"rules": {"react/button-has-type": "error"}}\n')
        (reason,) = r.check('367', '--merge')
        self.assertIn('web/.oxlintrc.json', reason)
        self.assertIn('取り込んで CI を通し直してから', reason)
        # Merging main into the PR (and pushing it) clears the way.
        r.git('switch', '-q', 'feature')
        r.git('merge', '-q', '--no-edit', 'origin/main')
        r.publish(367, 'feature', r.git('rev-parse', 'HEAD'))
        self.assertEqual(r.check('367', '--merge'), [])

    def test_sees_a_main_newer_than_the_local_remote_tracking_branch(self):
        r = self.repos
        r.open_pr(367, 'feature')
        r.change_main('web/scripts/lint/oxlint-layers.mjs', 'export default {};\n')
        r.git('update-ref', 'refs/remotes/origin/main', 'HEAD~1')  # a checkout that has not fetched
        (reason,) = r.check('367', '--squash')
        self.assertIn('web/scripts/lint/oxlint-layers.mjs', reason)

    def test_other_changes_on_main_and_prs_opened_after_the_change_pass(self):
        r = self.repos
        r.change_main('web/.oxlintrc.json', '{"rules": {"x": "error"}}\n')
        r.open_pr(368, 'later')
        r.change_main('web/src/app.tsx', 'export const App = () => <main />;\n')
        r.change_main('web/package.json', json.dumps({**PACKAGE, 'dependencies': {'react': '19.1.0'}}))
        self.assertEqual(r.check('368', '--merge'), [])

    def test_tsconfig_and_lint_dependencies_count(self):
        r = self.repos
        r.open_pr(370, 'feature')
        r.change_main('web/tsconfig.mapcn.json', '{}\n')
        r.change_main('web/package.json', json.dumps({**PACKAGE, 'devDependencies': {
            'oxlint': '1.1.0', 'typescript': '7.0.0'}}))
        (reason,) = r.check('370')
        self.assertIn('web/tsconfig.mapcn.json', reason)
        self.assertIn('web/package.json の oxlint', reason)

    def test_each_lint_dependency_and_ci_script_counts_on_its_own(self):
        # oxc-parser: imported by a lint plugin. stylelint: run by lint:css. lint:css: run by the CI lint job.
        for label, changed in [
            ('oxc-parser', package(devDependencies={'oxc-parser': '0.2.0'})),
            ('stylelint', package(devDependencies={'stylelint': '18.1.0'})),
            ('scripts.lint:css', package(scripts={'lint:css': 'stylelint "src/**/*.css" "*.html"'})),
        ]:
            with self.subTest(label=label), tempfile.TemporaryDirectory() as temp:
                r = Repositories(temp)
                r.open_pr(400, 'feature')
                r.change_main('web/package.json', changed)
                (reason,) = r.check('400')
                self.assertIn(f'（web/package.json の {label}）', reason)  # that entry alone

    def test_packages_and_scripts_outside_lint_pass(self):
        # vitest is imported only by a lint plugin's test, which the test job runs, not lint.
        r = self.repos
        r.open_pr(410, 'feature')
        r.change_main('web/package.json', package(devDependencies={'vitest': '5.1.0'},
                                                  scripts={'test': 'vitest run --silent'}))
        self.assertEqual(r.check('410'), [])

    def test_lint_scripts_come_from_the_ci_lint_and_typecheck_jobs(self):
        text = (ROOT / '.github/workflows/ci.yml').read_text()
        self.assertEqual(guard.ci_lint_scripts(text), {'lint', 'lint:css', 'knip', 'format:check', 'typecheck'})

    def test_a_package_json_that_is_not_an_object_is_unreadable(self):
        r = self.repos
        r.open_pr(411, 'feature')
        for text in ['[]', '{"devDependencies": []}', '{"scripts": "x"}', '{']:
            with self.subTest(text=text):
                r.change_main('web/package.json', text)
                (reason,) = r.check('411')
                self.assertIn('確認ができない', reason)

    def test_merge_words_outside_the_command_position_and_help_do_not_ask_github(self):
        r = self.repos  # no pull request exists, so any `gh pr view` fails
        for command in ['echo gh pr merge', 'echo "next: gh pr merge 5"', 'gh pr merge --help',
                        'gh pr merge 5 -h', 'git log --grep "gh pr merge"',
                        "cat > note.md <<'EOF'\nthen run\ngh pr merge 5\nEOF"]:
            with self.subTest(command=command):
                result = r.hook(command)
                self.assertEqual((result.returncode, result.stderr), (0, ''))
        self.assertEqual(r.gh_calls(), [])
        for command in ['gh pr merge 5', 'env GH_DEBUG=1 gh pr merge 5', 'sudo -u me gh pr merge 5',
                        "sh -c 'gh pr merge 5 --squash'", 'timeout 30 gh pr merge 5', 'mise exec -- gh pr merge 5',
                        'cd web && /usr/bin/gh pr merge 5', "cat <<'EOF' > x && gh pr merge 5\nbody\nEOF"]:
            with self.subTest(command=command):
                result = r.hook(command)
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertIn('確認ができない', result.stderr)

    def test_current_branch_and_match_head_commit(self):
        r = self.repos
        old = r.open_pr(371, 'feature')
        r.change_main('web/.oxlintrc.json', '{"rules": {"x": "error"}}\n')
        r.git('switch', '-q', 'feature')
        r.git('merge', '-q', '--no-edit', 'origin/main')
        r.publish(371, 'feature', r.git('rev-parse', 'HEAD'))
        self.assertEqual(r.check('--merge'), [])  # no number: gh resolves the current branch
        self.assertEqual(r.gh_calls()[-1][:3], ['pr', 'view', '--json'])
        # The commit that will be merged is the one named, not the head gh reports.
        (reason,) = r.check('371', '--merge', f'--match-head-commit={old}')
        self.assertIn('web/.oxlintrc.json', reason)

    def test_unreadable_pr_blocks_and_other_repositories_pass(self):
        r = self.repos
        (reason,) = r.check('999', '--merge')
        self.assertIn('確認ができない', reason)
        calls = len(r.gh_calls())
        self.assertEqual(r.check('5', '-R', 'someone/else', '--merge'), [])
        self.assertEqual(r.check('--disable-auto', '5'), [])
        self.assertEqual(len(r.gh_calls()), calls)
        self.assertEqual(r.check('5', cwd=r.base), [])  # not a Git checkout

    def test_claude_hook_runs_the_check_on_gh_pr_merge(self):
        r = self.repos
        r.open_pr(367, 'feature')
        r.change_main('web/.oxlintrc.json', '{"rules": {"react/button-has-type": "error"}}\n')
        blocked = r.hook('gh pr checks 367 && gh pr merge 367 --merge')
        self.assertEqual(blocked.returncode, 2, blocked.stderr)
        self.assertIn('web/.oxlintrc.json', blocked.stderr)
        allowed = r.hook('gh pr view 367 --json state')
        self.assertEqual((allowed.returncode, allowed.stderr), (0, ''))


class SameRepositoryTests(unittest.TestCase):
    def test_owner_and_name_match_any_remote_spelling(self):
        for origin in ['git@github.com:Owner/Repo.git', 'https://github.com/owner/repo', 'ssh://git@github.com/owner/repo.git']:
            with self.subTest(origin=origin):
                self.assertTrue(guard.same_repository('owner/repo', origin))
                self.assertTrue(guard.same_repository('github.com/owner/repo', origin))
                self.assertFalse(guard.same_repository('owner/other', origin))


if __name__ == '__main__':
    unittest.main()
