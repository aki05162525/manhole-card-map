"""Guard checkout scopes without a third-party YAML dependency."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]


def job(workflow, name):
    text = (ROOT / '.github/workflows' / workflow).read_text()
    match = re.search(rf'^  {name}:\n(.*?)(?=^  [\w-]+:|\Z)', text, re.M | re.S)
    if match is None:
        raise AssertionError(f'Missing job: {name}')
    return match[1]


def checkout(workflow, name):
    text = job(workflow, name)
    matches = re.findall(r'^      - uses: actions/checkout@v[0-9]+(?:\.[0-9]+){0,2}\n(.*?)(?=^      - |\Z)',
                         text, re.M | re.S)
    if len(matches) != 1:
        raise AssertionError(f'Expected one checkout in {name}')
    return matches[0]


class WorkflowCheckoutTest(unittest.TestCase):
    def assert_sparse(self, workflow, name, patterns, non_cone=False):
        text = checkout(workflow, name)
        self.assertNotRegex(text, r'(?m)^\s*filter:')
        match = re.search(r'^          sparse-checkout: \|\n((?:^            .+\n)+)', text, re.M)
        self.assertIsNotNone(match, f'{name} must use sparse-checkout')
        self.assertEqual([line.strip() for line in match[1].splitlines()], patterns)
        if non_cone:
            self.assertRegex(text, r'(?m)^          sparse-checkout-cone-mode: false$')
        else:
            self.assertNotRegex(text, r'(?m)^\s*sparse-checkout-cone-mode: false')

    def test_changes_excludes_only_evidence_and_keeps_base_history(self):
        self.assert_sparse('ci.yml', 'changes', ['/*', '!/data/evidence/'], non_cone=True)
        self.assertRegex(checkout('ci.yml', 'changes'), r'(?m)^          fetch-depth: 0$')

    def test_frontend_uses_synthetic_data_without_backend_sources(self):
        self.assert_sparse('ci.yml', 'frontend', ['web', 'tools/dev', 'tools/ci', '.github'])

    def test_agents_checks_scope_before_restoring_skills(self):
        self.assert_sparse('agents.yml', 'reproducibility', ['tools/ci', '.github', '.agents', '.apm'])

    def test_backend_retains_full_checkout_and_uncached_evidence_tests(self):
        text = checkout('ci.yml', 'backend')
        self.assertNotRegex(text, r'(?m)^\s*(?:filter|sparse-checkout|sparse-checkout-cone-mode):')
        self.assertIn('run: go test -count=1 ./...', job('ci.yml', 'backend'))


if __name__ == '__main__':
    unittest.main()
