import os
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from changes import classify, changed_paths, changed_statuses, related_sources, frontend_matrix


class ChangesTest(unittest.TestCase):
    def test_related_sources_only_for_safe_pr_source_changes(self):
        self.assertEqual(related_sources('pull_request', ['web/src/a.ts', 'web/src/nested/b.tsx'],
                                         [('M', 'web/src/a.ts'), ('A', 'web/src/nested/b.tsx')]),
                         ['src/a.ts', 'src/nested/b.tsx'])
        for paths, statuses in [
            (['web/src/a.ts'], [('D', 'web/src/a.ts')]),
            (['web/src/a.ts', 'web/src/a.css'], [('M', 'web/src/a.ts'), ('M', 'web/src/a.css')]),
            (['web/src/a.d.ts'], [('M', 'web/src/a.d.ts')]),
            (['web/src/__mocks__/a.ts'], [('M', 'web/src/__mocks__/a.ts')]),
            (['web/src/contract/japan-time.ts'], [('M', 'web/src/contract/japan-time.ts')]),
            (['web/src/a.ts'], [('M', 'web/src/b.ts')]),
            ([], []),
        ]:
            with self.subTest(paths=paths):
                self.assertIsNone(related_sources('pull_request', paths, statuses))
        self.assertIsNone(related_sources('push', ['web/src/a.ts'], [('M', 'web/src/a.ts')]))

    def test_matrix_keeps_push_unsharded_and_pr_three_shards(self):
        self.assertEqual(frontend_matrix('pull_request'),
                         [{'task': 'lint', 'index': 1, 'count': 1},
                          {'task': 'typecheck', 'index': 1, 'count': 1},
                          {'task': 'build', 'index': 1, 'count': 1},
                          *[{'task': 'test', 'index': i, 'count': 3} for i in (1, 2, 3)]])
        for event in ('push', 'workflow_dispatch'):
            self.assertEqual(frontend_matrix(event)[-1], {'task': 'test', 'index': 1, 'count': 1})

    def test_docs_do_not_run_application_checks(self):
        self.assertEqual(classify(['README.md', 'docs/design.md', 'web/README.md', 'AGENTS.md']), set())

    def test_web_including_data_inputs_runs_frontend_suite(self):
        for path in ['web/src/a.ts', 'web/public/style.json', 'web/bun.lock', 'web/src/card-data.ts']:
            self.assertEqual(classify([path]), {'frontend'})

    def test_card_registry_runs_both_worker_and_backend_checks(self):
        self.assertEqual(classify(['data/card-ids.json']), {'frontend', 'backend'})
        self.assertEqual(classify(['data/card-images.json']), {'frontend', 'backend'})

    def test_backend_data_and_python_are_coupled(self):
        for path in ['cmd/builddata/main.go', 'internal/gkp/place.go', 'data/a.json', 'tools/research/candidate_pipeline.py', 'data/user-answers/a.md', 'go.sum',
                     'tools/db/schema.sql', 'data/db/relation.jsonl']:
            self.assertEqual(classify([path]), {'backend'})

    def test_skill_inputs(self):
        for path in ['apm.yml', 'apm.lock.yaml', '.gitignore', '.agents/skills/a.md']:
            self.assertIn('agents', classify([path]))

    def test_local_skill_sources_run_only_the_skill_checks(self):
        # Local skills are Markdown under agents/skills/, restored by APM like the pinned ones.
        self.assertEqual(classify(['agents/skills/a/SKILL.md']), {'agents'})

    def test_shared_unknown_or_ci_changes_are_conservative(self):
        for path in ['mise.toml', '.github/workflows/ci.yml', 'tools/ci/changes.py', 'new-build-system.cfg']:
            self.assertEqual(classify([path]), {'frontend', 'backend', 'agents'})

    def test_union(self):
        self.assertEqual(classify(['web/src/a.ts', 'data/a.json']), {'frontend', 'backend'})

    def test_delete_and_rename_include_old_path(self):
        env = {k: v for k, v in os.environ.items() if not k.startswith('GIT_')}
        with tempfile.TemporaryDirectory() as directory:
            def git(*args):
                return subprocess.check_output(['git', '-C', directory, *args], text=True, env=env).strip()
            git('init', '-q')
            git('config', 'user.name', 'Test')
            git('config', 'user.email', 'test@example.com')
            root = Path(directory)
            (root / 'web').mkdir()
            (root / 'web/a.ts').write_text('export const a = 1;')
            git('add', '.')
            git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'base')
            base = git('rev-parse', 'HEAD')
            git('mv', 'web/a.ts', 'notes.md')
            git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'rename')
            from unittest.mock import patch
            with patch.dict(os.environ, env, clear=True):
                paths = changed_paths(base, directory)
                statuses = changed_statuses(base, directory)
            self.assertEqual(set(paths), {'web/a.ts', 'notes.md'})
            self.assertEqual(dict((path, status) for status, path in statuses),
                             {'web/a.ts': 'D', 'notes.md': 'A'})
            self.assertEqual(classify(paths), {'frontend'})


class EventSelectionTest(unittest.TestCase):
    def run_event(self, name, event, paths=None, statuses=None, fetch_error=False):
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
                        with patch('changes.changed_statuses', return_value=statuses if statuses is not None else [('M', p) for p in paths or []]):
                            main()
            return output.read_text(), fetch, diff

    def test_pr_uses_base_and_current_merge_checkout(self):
        output, fetch, diff = self.run_event('pull_request', {'pull_request': {'base': {'sha': 'abc123'}}}, ['web/src/a.ts'])
        self.assertIn('agents=false\nbackend=false\nfrontend=true\nworkflow_lock=false\n', output)
        self.assertIn('frontend_related=["src/a.ts"]\n', output)
        self.assertIn('frontend_matrix=', output)
        diff.assert_called_once_with('abc123')

    def test_push_uses_before(self):
        output, fetch, diff = self.run_event('push', {'before': 'def456'}, ['data/a.json'])
        self.assertIn('agents=false\nbackend=true\nfrontend=false\nworkflow_lock=false\n', output)
        self.assertIn('frontend_related=null\n', output)
        diff.assert_called_once_with('def456')

    def test_pr_deletion_runs_all_frontend_tests(self):
        output, _, _ = self.run_event('pull_request', {'pull_request': {'base': {'sha': 'abc123'}}},
                                      ['web/src/a.ts'], [('D', 'web/src/a.ts')])
        self.assertIn('frontend_related=null\n', output)

    def test_manual_initial_push_and_missing_history_run_everything(self):
        for name, event, error in [('workflow_dispatch', {}, False), ('push', {'before': '0' * 40}, False), ('push', {}, False), ('pull_request', {'pull_request': {'base': {'sha': 'abc123'}}}, True)]:
            with self.subTest(name=name, event=event):
                output, _, diff = self.run_event(name, event, fetch_error=error)
                self.assertIn('agents=true\nbackend=true\nfrontend=true\nworkflow_lock=true\n', output)
                self.assertIn('frontend_related=null\n', output)
                diff.assert_not_called()


class WorkflowLockSelectionTest(unittest.TestCase):
    def test_changed_workflow_and_lockfile_verify(self):
        for path in ['.github/workflows/ci.yml', '.github/workflows/preview.yml',
                     '.github/workflows/actions.lock']:
            output, _, _ = EventSelectionTest().run_event('push', {'before': 'abc123'}, [path])
            self.assertIn('workflow_lock=true\n', output)

    def test_unrelated_changes_skip_verification(self):
        for path in ['docs/x.md', '.github/dependabot.yml', 'web/src/a.ts']:
            output, _, _ = EventSelectionTest().run_event('push', {'before': 'abc123'}, [path])
            self.assertIn('workflow_lock=false\n', output)
