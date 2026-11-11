import importlib.util
import json
import os
import shutil
import sys
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('check_staged', Path(__file__).with_name('check_staged.py'))
hooks = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hooks)


def clean_git_env():
    return {k: v for k, v in os.environ.items() if not k.startswith('GIT_')}


class HookSelectionTests(unittest.TestCase):
    def test_children_drop_git_environment_but_index_keeps_it(self):
        inherited = dict(os.environ, GIT_DIR='/hook/gitdir', GIT_INDEX_FILE='/hook/index',
                         GIT_CONFIG_COUNT='0', KEEP_ME='present')
        with patch.dict(os.environ, inherited, clear=True), \
                patch.object(sys, 'argv', ['check_staged.py', 'go']), \
                patch.object(hooks.subprocess, 'run') as run:
            run.return_value.stdout = b'internal/example.go\0'
            hooks.main()
        self.assertNotIn('env', run.call_args_list[0].kwargs)
        child_env = run.call_args_list[1].kwargs.get('env', inherited)
        self.assertEqual([key for key in child_env if key.startswith('GIT_')], [])
        self.assertEqual(child_env['KEEP_ME'], 'present')

    def test_hook_child_git_init_cannot_change_worktree_repository(self):
        clean_env = {k: v for k, v in os.environ.items() if not k.startswith('GIT_')}
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            def git(*args):
                return subprocess.check_output(['git', *map(str, args)], env=clean_env,
                                               stderr=subprocess.PIPE).decode().strip()
            repo, worktree = root / 'repo', root / 'worktree'
            git('init', repo)
            git('-C', repo, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false',
                'commit', '--allow-empty', '-m', 'base')
            git('-C', repo, 'worktree', 'add', '-b', 'test', worktree)
            (worktree / 'internal').mkdir()
            (worktree / 'internal/example.go').write_text('package example\n')
            # The normal index is empty; only the hook's alternate index selects Go.
            gitdir = git('-C', worktree, 'rev-parse', '--absolute-git-dir')
            env = dict(clean_env, GIT_DIR=gitdir, GIT_WORK_TREE=str(worktree),
                       GIT_INDEX_FILE=str(root / 'alternate-index'), GIT_CONFIG_COUNT='0')
            subprocess.run(['git', 'add', 'internal/example.go'], cwd=worktree,
                           env=env, check=True)
            script = worktree / 'tools/dev/check_staged.py'
            script.parent.mkdir(parents=True)
            shutil.copy(Path(__file__).with_name('check_staged.py'), script)
            (root / 'bin').mkdir()
            fake_go = root / 'bin/go'
            fake_go.write_text('#!' + sys.executable + '\n'
                               'import json, os, subprocess\n'
                               'from pathlib import Path\n'
                               f'Path({str(root / "env.json")!r}).write_text(json.dumps(dict(os.environ)))\n'
                               f'subprocess.run(["git", "init", {str(root / "child-repo")!r}], check=True)\n')
            fake_go.chmod(0o755)
            env['PATH'] = str(root / 'bin') + os.pathsep + clean_env['PATH']
            subprocess.run([sys.executable, '-B', str(script), 'go'], cwd=worktree,
                           env=env, check=True, capture_output=True)
            child_env = json.loads((root / 'env.json').read_text())
            self.assertFalse(any(k.startswith('GIT_') for k in child_env), child_env)
            self.assertEqual(git('-C', repo, 'config', 'core.bare'), 'false')
            self.assertEqual(git('-C', worktree, 'config', 'core.bare'), 'false')
            self.assertTrue((root / 'child-repo/.git').is_dir())

    def test_docs_do_not_run_checks(self):
        self.assertEqual(hooks.frontend_commands(['README.md', 'web/README.md']), [])
        self.assertEqual(hooks.go_commands(['README.md']), [])

    def test_typescript_only_lints_and_formats_changed_file(self):
        self.assertEqual(hooks.frontend_commands(['web/src/a.ts']), [
            ['bun', 'x', '--no-install', 'oxlint', '--max-warnings=0', '--', 'src/a.ts'],
            ['bun', 'x', '--no-install', 'oxfmt', '--check', '--', 'src/a.ts'],
            ['bun', 'run', 'typecheck'],
        ])

    def test_worker_typescript_is_checked_like_the_package_scripts(self):
        self.assertEqual(hooks.frontend_commands(['web/worker/app.ts']), [
            ['bun', 'x', '--no-install', 'oxlint', '--max-warnings=0', '--', 'worker/app.ts'],
            ['bun', 'x', '--no-install', 'oxfmt', '--check', '--', 'worker/app.ts'],
            ['bun', 'run', 'typecheck'],
        ])

    def test_css_does_not_typecheck(self):
        self.assertEqual(hooks.frontend_commands(['web/src/pages/map/style.css']), [
            ['bun', 'x', '--no-install', 'stylelint', '--', 'src/pages/map/style.css'],
            ['bun', 'x', '--no-install', 'oxfmt', '--check', '--', 'src/pages/map/style.css'],
        ])

    def test_deleted_css_does_not_run_stylelint(self):
        self.assertEqual(hooks.frontend_commands(
            ['web/src/old.css'], exists=lambda _: False), [])

    def test_html_checks_embedded_styles(self):
        for name in ['index.html', 'cards.html', 'about.html']:
            self.assertIn(['bun', 'x', '--no-install', 'stylelint', '--', name],
                          hooks.frontend_commands(['web/' + name]))

    def test_deleted_typescript_still_typechecks(self):
        self.assertEqual(hooks.frontend_commands(['web/src/old.ts'], exists=lambda _: False), [
            ['bun', 'run', 'typecheck'],
        ])

    def test_configuration_and_dependencies_fall_back_to_full_checks(self):
        for path in ['web/package.json', 'web/bun.lock', 'web/.oxlintrc.json',
                     'web/.oxfmtrc.json', 'web/tsconfig.json', 'web/.stylelintrc.json', 'mise.toml', 'lefthook.yml',
                     'tools/dev/check_staged.py']:
            with self.subTest(path=path):
                self.assertEqual(hooks.frontend_commands([path]), [
                    ['bun', 'run', 'lint'], ['bun', 'run', 'format:check'],
                    ['bun', 'run', 'typecheck'], ['bun', 'run', 'lint:css'],
                ])

    def test_go_uses_suite_to_cover_importers(self):
        self.assertEqual(hooks.go_commands(['internal/gkp/place.go']), [['go', 'test', './...']])
        self.assertEqual(hooks.go_commands(['web/src/a.ts']), [])

    def test_data_and_research_tool_changes_leave_uncached_suite_to_ci(self):
        for path in ['tools/research/candidate_pipeline.py', 'data/example.csv']:
            self.assertEqual(hooks.go_commands([path]), [])

    def test_mise_still_selects_go(self):
        self.assertEqual(hooks.go_commands(['mise.toml']), [['go', 'test', './...']])

    def test_hook_changes_select_hook_tests_without_go(self):
        for path in ['lefthook.yml', 'tools/dev/check_staged.py',
                     'tools/dev/test_check_staged.py', 'tools/dev/install_hooks.py']:
            with self.subTest(path=path):
                self.assertEqual(hooks.go_commands([path]), [])
                self.assertEqual(hooks.hook_commands([path]), [
                    ['python3', '-B', '-m', 'unittest', 'discover', '-s', 'tools/dev']])
        self.assertEqual(hooks.hook_commands(['data/example.csv']), [])

    def test_agent_guard_changes_select_guard_tests(self):
        guard = ['python3', '-B', '-m', 'unittest', 'discover', '-s', 'tools/agents']
        for path in ['tools/agents/command_guard.py', '.claude/settings.json',
                     '.codex/hooks.json', '.codex/rules/git-safety.rules']:
            with self.subTest(path=path):
                self.assertEqual(hooks.hook_commands([path]), [guard])
        self.assertEqual(hooks.hook_commands(['lefthook.yml', '.codex/hooks.json']), [
            ['python3', '-B', '-m', 'unittest', 'discover', '-s', 'tools/dev'], guard])
        self.assertEqual(hooks.hook_commands(['.claude/skills/mapcn/SKILL.md']), [])

    def test_git_preserves_spaces_and_deletions_and_rename_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            def git(*args):
                return subprocess.run(['git', '-C', tmp, *args], check=True, capture_output=True, env=clean_git_env())
            git('init')
            (root / 'old.ts').write_text('example\n')
            git('add', '.')
            git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '-m', 'base')
            (root / 'old.ts').rename(root / 'a space.ts')
            git('add', '-A')
            with patch.dict(os.environ, clean_git_env(), clear=True):
                paths = hooks.staged_paths(root)
            self.assertEqual(set(paths), {'old.ts', 'a space.ts'})

    def test_real_hook_skips_docs_and_passes_only_staged_files(self):
        lefthook = Path(__file__).resolve().parents[2] / 'web/node_modules/.bin/lefthook'
        if not lefthook.exists():
            self.skipTest('lefthook is installed by bun install')
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            def git(*args):
                return subprocess.run(['git', '-C', tmp, *args], check=True, capture_output=True, env=clean_git_env())
            git('init')
            (root / 'tools/dev').mkdir(parents=True)
            (root / 'tools/ci').mkdir(parents=True)
            for script in ('data_policy.py', 'ledger_history.py', 'event_base.py'):
                shutil.copy(Path(__file__).resolve().parents[2] / 'tools/ci' / script, root / 'tools/ci' / script)
            (root / 'web/src').mkdir(parents=True)
            (root / 'bin').mkdir()
            shutil.copy(Path(__file__).with_name('check_staged.py'), root / 'tools/dev/check_staged.py')
            shutil.copy(Path(__file__).resolve().parents[2] / 'lefthook.yml', root / 'lefthook.yml')
            log = root / 'commands.jsonl'
            fake = '#!' + sys.executable + '\nimport json, os, sys\nwith open(os.environ["HOOK_LOG"], "a") as f: f.write(json.dumps(sys.argv[1:]) + "\\n")\n'
            for tool in ['bun', 'go']:
                (root / 'bin' / tool).write_text(fake)
                (root / 'bin' / tool).chmod(0o755)
            (root / 'README.md').write_text('docs')
            (root / 'web/src/a space.ts').write_text('export const a = 1;\n')
            (root / 'web/src/unstaged.ts').write_text('export const b = 1;\n')
            # Only README is staged, though source files exist in the worktree.
            git('add', 'README.md')
            env = dict(clean_git_env(), PATH=str(root / 'bin') + os.pathsep + os.environ['PATH'], HOOK_LOG=str(log))
            def run_hook():
                subprocess.run([str(lefthook), 'run', 'pre-commit'], cwd=root, env=env,
                               check=True, capture_output=True)
            run_hook()
            self.assertFalse(log.exists())
            git('add', 'web/src/a space.ts')
            run_hook()
            commands = [json.loads(line) for line in log.read_text().splitlines()]
            self.assertEqual(commands, [command[1:] for command in hooks.frontend_commands(['web/src/a space.ts'])])
            # Exercise actual installed Git hooks on commits, with recording
            # stand-ins for Go/Bun so selection is independent of suite runtime.
            env['LEFTHOOK_BIN'] = str(lefthook)
            subprocess.run([str(lefthook), 'install'], cwd=root, env=env,
                           check=True, capture_output=True)
            def commit(message):
                subprocess.run(['git', '-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false',
                                'commit', '-m', message], cwd=root, env=env,
                               check=True, capture_output=True)
            commit('frontend base')
            log.unlink()
            (root / 'data').mkdir()
            (root / 'data/example.json').write_text('{}\n')
            git('add', 'data/example.json')
            commit('data only')
            self.assertFalse(log.exists(), 'data-only commit must not run Go')
            (root / 'example.go').write_text('package example\n')
            git('add', 'example.go')
            commit('Go source')
            self.assertEqual([json.loads(line) for line in log.read_text().splitlines()],
                             [['test', './...']])


class HookInstallationTests(unittest.TestCase):
    def test_install_cleans_only_undefined_generated_hooks_from_worktree(self):
        source = Path(__file__).resolve().parents[2]
        lefthook = source / 'web/node_modules/.bin/lefthook'
        if not lefthook.exists():
            self.skipTest('lefthook is installed by bun install')
        with tempfile.TemporaryDirectory() as tmp:
            repo, worktree = Path(tmp) / 'repo', Path(tmp) / 'worktree'
            env = dict(clean_git_env(), LEFTHOOK_BIN=str(lefthook))
            def git(*args):
                return subprocess.check_output(['git', *map(str, args)], env=env,
                                               stderr=subprocess.PIPE).decode().strip()
            git('init', repo)
            git('-C', repo, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false',
                'commit', '--allow-empty', '-m', 'base')
            git('-C', repo, 'worktree', 'add', '-b', 'test', worktree)
            config = worktree / 'lefthook.yml'
            config.write_text('pre-commit:\n  commands:\n    check:\n      run: "true"\n'
                              'pre-push:\n  commands:\n    check:\n      run: "true"\n')
            subprocess.run([str(lefthook), 'install'], cwd=worktree, env=env,
                           check=True, capture_output=True)
            hook_dir = Path(git('-C', worktree, 'rev-parse', '--git-path', 'hooks'))
            self.assertEqual(hook_dir.resolve(), (repo / '.git/hooks').resolve())
            self.assertIn('call_lefthook run "pre-push"', (hook_dir / 'pre-push').read_text())
            user_hook = hook_dir / 'post-commit'
            user_hook.write_text('#!/bin/sh\n# lefthook is useful, but this hook is mine\necho user\n')
            user_contents = user_hook.read_bytes()
            config.write_text('pre-commit:\n  commands:\n    check:\n      run: "true"\n')
            script = source / 'tools/dev/install_hooks.py'
            subprocess.run([sys.executable, '-B', str(script), str(lefthook)],
                           cwd=worktree, env=env, check=True, capture_output=True)
            self.assertFalse((hook_dir / 'pre-push').exists())
            self.assertTrue((hook_dir / 'pre-commit').exists())
            self.assertEqual(user_hook.read_bytes(), user_contents)


if __name__ == '__main__':
    unittest.main()
