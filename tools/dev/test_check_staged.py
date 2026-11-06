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
            git('-C', repo, '-c', 'user.name=Test', '-c', 'user.email=test@example.com',
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

    def test_css_does_not_typecheck(self):
        self.assertEqual(len(hooks.frontend_commands(['web/src/style.css'])), 1)

    def test_deleted_typescript_still_typechecks(self):
        self.assertEqual(hooks.frontend_commands(['web/src/old.ts'], exists=lambda _: False), [
            ['bun', 'run', 'typecheck'],
        ])

    def test_configuration_and_dependencies_fall_back_to_full_checks(self):
        for path in ['web/package.json', 'web/bun.lock', 'web/.oxlintrc.json',
                     'web/.oxfmtrc.json', 'web/tsconfig.json', 'mise.toml', 'lefthook.yml',
                     'tools/dev/check_staged.py']:
            with self.subTest(path=path):
                self.assertEqual(hooks.frontend_commands([path]), [
                    ['bun', 'run', 'lint'], ['bun', 'run', 'format:check'],
                    ['bun', 'run', 'typecheck'],
                ])

    def test_go_uses_suite_to_cover_importers(self):
        self.assertEqual(hooks.go_commands(['internal/gkp/place.go']), [['go', 'test', './...']])
        self.assertEqual(hooks.go_commands(['web/src/a.ts']), [])

    def test_data_and_assembly_changes_bypass_go_cache(self):
        for path in ['tools/national/assemble.py', 'data/example.csv']:
            self.assertEqual(hooks.go_commands([path]), [['go', 'test', '-count=1', './...']])

    def test_git_preserves_spaces_and_deletions_and_rename_source(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            def git(*args):
                return subprocess.run(['git', '-C', tmp, *args], check=True, capture_output=True, env=clean_git_env())
            git('init')
            (root / 'old.ts').write_text('example\n')
            git('add', '.')
            git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-m', 'base')
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
            shutil.copy(Path(__file__).resolve().parents[2] / 'tools/ci/data_policy.py', root / 'tools/ci/data_policy.py')
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


if __name__ == '__main__':
    unittest.main()
