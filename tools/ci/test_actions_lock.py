"""Check workflow dependency coverage and the CI verification contract as text."""
import re
import unittest

from test_workflow_checkout import ROOT, job


class ActionsLockTest(unittest.TestCase):
    def test_all_workflows_and_uses_are_locked(self):
        lock = (ROOT / '.github/workflows/actions.lock').read_text()
        workflows, dependencies = lock.split('\ndependencies:\n', 1)
        files = sorted((ROOT / '.github/workflows').glob('*.yml'))
        for path in files:
            name = path.relative_to(ROOT).as_posix()
            match = re.search(rf"^    '{re.escape(name)}':\n(.*?)(?=^    '\.github/|\Z)", workflows, re.M | re.S)
            self.assertIsNotNone(match, name)
            # Named steps can put uses: after name:/if:. Subdirectory actions
            # (cache/restore) share their repository's locked commit.
            uses = re.findall(r'(?m)^\s*(?:- )?uses: (\S+)', path.read_text())
            refs = {'/'.join(ref.split('@')[0].split('/')[:2]) + '@' + ref.split('@')[1]
                    for ref in uses}
            locked = set(re.findall(r"(?m)^        - '([^']+)'$", match[1]))
            self.assertTrue(refs <= locked, (name, refs - locked))
            for ref in refs:
                self.assertRegex(ref, r'@v?\d+\.\d+\.\d+$')
                self.assertIn(f"    '{ref}':\n", dependencies)

    def test_verify_is_in_changes(self):
        changes = job('ci.yml', 'changes')
        self.assertIn("if: steps.scope.outputs.workflow_lock == 'true'", changes)
        self.assertIn('gh extension install github/gh-actions-lock --pin v0.4.1', changes)
        self.assertIn('gh actions-lock --verify\n', changes)
        self.assertIn('GH_TOKEN: ${{ github.token }}', changes)
        for unsafe in ['continue-on-error', '--verify-local', '--accept-moved', '|| true']:
            self.assertNotIn(unsafe, changes)
        workflow = (ROOT / '.github/workflows/ci.yml').read_text()
        self.assertIn('permissions:\n  contents: read\n', workflow)

    def test_dependabot_updates_wait_out_a_cooldown(self):
        text = (ROOT / '.github/dependabot.yml').read_text()
        self.assertRegex(text, r'(?m)^version: 2$')
        entries = re.split(r'(?m)^  - (?=package-ecosystem:)', text)[1:]
        ecosystems = [re.match(r'package-ecosystem: (\S+)', e)[1] for e in entries]
        self.assertEqual(ecosystems, ['github-actions', 'bun', 'gomod'])
        for entry in entries:
            self.assertIn('interval: daily', entry)
            self.assertRegex(entry, r'cooldown:\n\s+default-days: (\d+)')
            self.assertGreaterEqual(int(re.search(r'default-days: (\d+)', entry)[1]), 7)
            self.assertNotIn('automerge', entry)
        self.assertRegex(entries[0], r'groups:\n\s+actions:\n\s+patterns:\n\s+- "\*"')
        self.assertIn('semver-major-days: 30', entries[1])
        # Dependabot has no security updates for Bun; audit.yml covers them.
        self.assertNotIn('applies-to: security-updates', entries[1])
        self.assertRegex(entries[2], r'applies-to: security-updates\n\s+patterns:\n\s+- "\*"')

    def test_bun_advisories_are_audited_daily(self):
        text = (ROOT / '.github/workflows/audit.yml').read_text()
        self.assertIn('- cron: "0 0 * * *"', text)
        self.assertIn('permissions:\n  contents: read\n', text)
        # Single advisories without a fixed release may be ignored by ID.
        self.assertRegex(
            text,
            r'      - run: bun audit(?: --ignore GHSA(?:-[0-9a-z]{4}){3})*\n'
            r'        working-directory: web\n',
        )
        self.assertNotIn('bun install', text)
        self.assertNotIn('secrets.', text)

    def test_dependabot_prs_get_no_preview_token(self):
        text = (ROOT / '.github/workflows/preview.yml').read_text()
        self.assertEqual(text.count("github.event.pull_request.user.login != 'dependabot[bot]'"), 2)


if __name__ == '__main__':
    unittest.main()
