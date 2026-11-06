"""Check workflow dependency coverage and the CI verification contract as text."""
import re
import unittest

from changes import classify
from test_workflow_checkout import ROOT, job


class ActionsLockTest(unittest.TestCase):
    def test_all_workflows_and_uses_are_locked(self):
        lock = (ROOT / '.github/workflows/actions.lock').read_text()
        workflows, dependencies = lock.split('\ndependencies:\n', 1)
        files = sorted((ROOT / '.github/workflows').glob('*.yml'))
        self.assertEqual([p.stem for p in files], ['agents', 'ci', 'deploy', 'preview'])
        for path in files:
            name = path.relative_to(ROOT).as_posix()
            match = re.search(rf"^    '{re.escape(name)}':\n(.*?)(?=^    '\.github/|\Z)", workflows, re.M | re.S)
            self.assertIsNotNone(match, name)
            refs = set(re.findall(r'(?m)^\s*- uses: (\S+)', path.read_text()))
            locked = set(re.findall(r"(?m)^        - '([^']+)'$", match[1]))
            self.assertTrue(refs <= locked, (name, refs - locked))
            for ref in refs:
                self.assertRegex(ref, r'@v?\d+\.\d+\.\d+$')
                self.assertIn(f"    '{ref}':\n", dependencies)

    def test_verify_is_in_changes_and_blocks_required_check(self):
        changes = job('ci.yml', 'changes')
        self.assertIn("if: steps.scope.outputs.workflow_lock == 'true'", changes)
        self.assertIn('gh extension install github/gh-actions-lock --pin v0.4.1', changes)
        self.assertIn('gh actions-lock --verify\n', changes)
        self.assertIn('GH_TOKEN: ${{ github.token }}', changes)
        for unsafe in ['continue-on-error', '--verify-local', '--accept-moved', '|| true']:
            self.assertNotIn(unsafe, changes)
        self.assertIn('needs: [changes, backend, frontend]', job('ci.yml', 'checks'))
        self.assertIn('test "$CHANGES" = success', job('ci.yml', 'checks'))
        workflow = (ROOT / '.github/workflows/ci.yml').read_text()
        self.assertIn('permissions:\n  contents: read\n', workflow)

    def test_dependabot_only_groups_weekly_actions(self):
        text = (ROOT / '.github/dependabot.yml').read_text()
        self.assertRegex(text, r'(?m)^version: 2$')
        self.assertEqual(re.findall(r'package-ecosystem: ["\']?([\w-]+)', text), ['github-actions'])
        self.assertIn('directory: "/"', text)
        self.assertIn('interval: weekly', text)
        self.assertRegex(text, r'groups:\n\s+actions:\n\s+patterns:\n\s+- "\*"')

    def test_github_changes_run_all_suites(self):
        for path in ['.github/dependabot.yml', '.github/workflows/actions.lock']:
            self.assertEqual(classify([path]), {'frontend', 'backend', 'agents'})


if __name__ == '__main__':
    unittest.main()
