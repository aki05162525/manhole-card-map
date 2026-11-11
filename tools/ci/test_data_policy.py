import os
import pathlib
import subprocess
import tempfile
import unittest

SCRIPT = pathlib.Path(__file__).with_name('data_policy.py').resolve()


def clean_git_env():
    return {k: v for k, v in os.environ.items() if not k.startswith('GIT_')}


class PolicyTest(unittest.TestCase):
    def test_index_and_history(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            def git(*args):
                return subprocess.check_output(['git', *args], cwd=root, env=clean_git_env())
            def write(path):
                target = root / path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text('content')
            def check(*args):
                return subprocess.run(['python3', '-B', str(SCRIPT), *args], cwd=root,
                                      capture_output=True, env=clean_git_env()).returncode
            git('init', '-q')
            git('config', 'user.email', 'test@example.com')
            git('config', 'user.name', 'Test')
            write('data/old.py')
            git('add', '.')
            git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'base')
            base = git('rev-parse', 'HEAD').decode().strip()
            self.assertEqual(check('--staged'), 0)
            write('data/new/fetch.py')
            git('add', '.')
            self.assertNotEqual(check('--staged'), 0)
            git('reset', '--hard', '-q')
            for path in ['data/日本語 空白.sh', 'data/new.go', 'data/new.ipynb']:
                write(path)
                git('add', '.')
                self.assertNotEqual(check('--staged'), 0)
                git('reset', '--hard', '-q')
            for path in ['tools/new.py', 'data/new.json', 'data/raw/gkp-list-20991231.html',
                         'data/terms/gsi/terms.html', 'data/user-answers/issue1/answers.md',
                         'data/user-answers/issue1/receipt.json', 'tools/research/testdata/tile.pbf']:
                write(path)
            (root / 'data/old.py').write_text('changed')
            git('add', '.')
            self.assertEqual(check('--staged'), 0)
            git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'allowed')
            self.assertEqual(check('--base', base), 0)
            write('data/copied.py')
            git('add', '.')
            self.assertNotEqual(check('--staged'), 0)
            git('reset', '--hard', '-q')
            git('mv', 'tools/new.py', 'data/renamed.py')
            self.assertNotEqual(check('--staged'), 0)
            git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'rename')
            self.assertNotEqual(check('--base', base), 0)
            git('rm', 'data/old.py', 'data/renamed.py')
            self.assertEqual(check('--staged'), 0)
            self.assertNotEqual(check('--base', 'missing-base'), 0)

    def test_fetched_originals_stay_in_ignored_work_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            def git(*args):
                return subprocess.check_output(['git', *args], cwd=root, env=clean_git_env())
            def write(path):
                target = root / path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text('content')
            def check(*args):
                return subprocess.run(['python3', '-B', str(SCRIPT), *args], cwd=root,
                                      capture_output=True, env=clean_git_env())
            git('init', '-q')
            git('config', 'user.email', 'test@example.com')
            git('config', 'user.name', 'Test')
            write('data/db/relation.jsonl')
            git('add', '.')
            git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'base')
            for path in ['data/evidence/notes.json', 'data/evidence/x/page.html', 'data/national/page.html',
                         'data/db/tile.pbf', 'data/overrides/site.PDF', 'data/work/originals/a/photo.jpg',
                         'data/new/tile.pbf.gz', 'data/source.csv', 'data/user-answers/issue1/schematic.png',
                         'data/user-answers/issue1/page.html']:
                with self.subTest(path=path):
                    write(path)
                    git('add', '-f', '.')
                    result = check('--staged')
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn(path, result.stderr.decode())
                    self.assertIn('data/work/', result.stderr.decode())
                    git('reset', '--hard', '-q')
                    git('clean', '-fdxq')
            # A rename into the old directory is an addition too.
            (root / 'data/evidence').mkdir()
            git('mv', 'data/db/relation.jsonl', 'data/evidence/relation.jsonl')
            self.assertNotEqual(check('--staged').returncode, 0)


if __name__ == '__main__':
    unittest.main()


class WorkflowTest(unittest.TestCase):
    def test_policy_is_in_unconditional_changes_job(self):
        workflow = SCRIPT.parents[2] / '.github/workflows/ci.yml'
        changes = workflow.read_text().split('  changes:', 1)[1].split('\n  backend:', 1)[0]
        self.assertIn('fetch-depth: 0', changes)
        self.assertIn('data_policy.py --ci', changes)
        self.assertNotRegex(changes.split('    steps:', 1)[0], r'(?m)^    if:')
        policy = changes.split('      - name: Enforce data code policy\n', 1)[1].split('      - ', 1)[0]
        self.assertIn('run: python3 -B tools/ci/data_policy.py --ci', policy)
        self.assertNotIn('if:', policy)
