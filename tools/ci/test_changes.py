import subprocess
import tempfile
import unittest
from pathlib import Path

from changes import classify, changed_paths


class ChangesTest(unittest.TestCase):
    def test_docs_do_not_run_application_checks(self):
        self.assertEqual(classify(['README.md', 'docs/design.md', 'web/README.md', 'AGENTS.md']), set())

    def test_web_including_offline_inputs_runs_frontend_suite(self):
        for path in ['web/src/a.ts', 'web/public/style.json', 'web/bun.lock', 'web/src/offline-update.ts']:
            self.assertEqual(classify([path]), {'frontend'})

    def test_backend_data_and_python_are_coupled(self):
        for path in ['cmd/builddata/main.go', 'internal/gkp/place.go', 'data/a.json', 'tools/national/assemble.py', 'data/evidence/source.md', 'go.sum']:
            self.assertEqual(classify([path]), {'backend'})

    def test_skill_inputs(self):
        for path in ['apm.yml', 'apm.lock.yaml', '.gitignore', '.agents/skills/a.md']:
            self.assertIn('agents', classify([path]))

    def test_shared_unknown_or_ci_changes_are_conservative(self):
        for path in ['mise.toml', '.github/workflows/ci.yml', 'tools/ci/changes.py', 'new-build-system.cfg']:
            self.assertEqual(classify([path]), {'frontend', 'backend', 'agents'})

    def test_union(self):
        self.assertEqual(classify(['web/src/a.ts', 'data/a.json']), {'frontend', 'backend'})

    def test_delete_and_rename_include_old_path(self):
        with tempfile.TemporaryDirectory() as directory:
            def git(*args):
                return subprocess.check_output(['git', '-C', directory, *args], text=True).strip()
            git('init', '-q')
            git('config', 'user.name', 'Test')
            git('config', 'user.email', 'test@example.com')
            root = Path(directory)
            (root / 'web').mkdir()
            (root / 'web/a.ts').write_text('export const a = 1;')
            git('add', '.')
            git('commit', '-qm', 'base')
            base = git('rev-parse', 'HEAD')
            git('mv', 'web/a.ts', 'notes.md')
            git('commit', '-qm', 'rename')
            paths = changed_paths(base, directory)
            self.assertEqual(set(paths), {'web/a.ts', 'notes.md'})
            self.assertEqual(classify(paths), {'frontend'})


class EventSelectionTest(unittest.TestCase):
    def run_event(self, name, event, paths=None, fetch_error=False):
        import json
        import os
        from unittest.mock import patch
        from changes import main
        with tempfile.TemporaryDirectory() as tmp:
            event_path = Path(tmp) / 'event.json'
            output = Path(tmp) / 'output'
            event_path.write_text(json.dumps(event))
            with patch.dict(os.environ, GITHUB_EVENT_NAME=name, GITHUB_EVENT_PATH=str(event_path), GITHUB_OUTPUT=str(output)):
                with patch('changes.subprocess.run', side_effect=subprocess.CalledProcessError(1, 'git') if fetch_error else None) as fetch:
                    with patch('changes.changed_paths', return_value=paths or []) as diff:
                        main()
            return output.read_text(), fetch, diff

    def test_pr_uses_base_and_current_merge_checkout(self):
        output, fetch, diff = self.run_event('pull_request', {'pull_request': {'base': {'sha': 'abc123'}}}, ['web/src/a.ts'])
        self.assertEqual(output, 'agents=false\nbackend=false\nfrontend=true\n')
        diff.assert_called_once_with('abc123')

    def test_push_uses_before(self):
        output, fetch, diff = self.run_event('push', {'before': 'def456'}, ['data/a.json'])
        self.assertEqual(output, 'agents=false\nbackend=true\nfrontend=false\n')
        diff.assert_called_once_with('def456')

    def test_manual_initial_push_and_missing_history_run_everything(self):
        for name, event, error in [('workflow_dispatch', {}, False), ('push', {'before': '0' * 40}, False), ('push', {}, False), ('pull_request', {'pull_request': {'base': {'sha': 'abc123'}}}, True)]:
            with self.subTest(name=name, event=event):
                output, _, diff = self.run_event(name, event, fetch_error=error)
                self.assertEqual(output, 'agents=true\nbackend=true\nfrontend=true\n')
                diff.assert_not_called()
