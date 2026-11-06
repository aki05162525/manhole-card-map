"""Publish scope, production markers and workflow safety without dependencies."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from test_workflow_checkout import job, checkout, ROOT

SCRIPT = ROOT / 'tools/ci/publish_inputs.py'
CLEAN_ENV = {k: v for k, v in os.environ.items() if not k.startswith('GIT_')}
SHA = 'a' * 40
CFG = 'b' * 16


class PublishInputsTest(unittest.TestCase):
    def setUp(self):
        import publish_inputs
        self.module = publish_inputs

    def test_allowlist(self):
        for path in ['docs/x.md', 'README.md', 'AGENTS.md', 'REVIEW.md', 'web/README.md',
                     'tools/ci/a.py', 'tools/dev/a.py', 'lefthook.yml', '.agents/a',
                     '.apm/a', 'apm.yml', 'apm.lock.yaml', '.github/workflows/ci.yml',
                     '.github/workflows/agents.yml', '.github/dependabot.yml']:
            with self.subTest(path=path):
                self.assertFalse(self.module.publish_needed([path]))
        for path in ['data/evidence/a.md', 'web/src/a.ts', 'unknown/a',
                     '.github/workflows/deploy.yml', '.github/workflows/preview.yml',
                     'web/other.md', 'mise.toml', '.github/workflows/actions.lock']:
            with self.subTest(path=path):
                self.assertTrue(self.module.publish_needed(['docs/x.md', path]))
        self.assertFalse(self.module.publish_needed([]))

    def test_marker(self):
        self.assertEqual(self.module.parse_marker(f'sha={SHA};cfg={CFG}'), (SHA, CFG))
        for marker in ['', None, {}, f'sha={SHA[:7]};cfg={CFG}',
                       f'sha={SHA};cfg={CFG}\n', f'sha={SHA};cfg=broken']:
            with self.subTest(marker=marker):
                self.assertIsNone(self.module.parse_marker(marker))

    def test_configuration_changes(self):
        module = self.module
        first = module.config_fingerprint({})
        self.assertEqual(len(first), 16)
        for key in ['VITE_MAP_STYLE_URL', 'PUBLIC_RELEASE', 'PUBLIC_ORIGIN']:
            self.assertNotEqual(first, module.config_fingerprint({key: 'changed'}))
        self.assertEqual(first, module.config_fingerprint({'UNRELATED': 'x'}))
        self.assertTrue(module.marker_decision(f'sha={SHA};cfg={CFG}', 'c' * 16)[0])
        self.assertTrue(module.marker_decision('broken', CFG)[0])

    def test_production_reader(self):
        module = self.module
        version_id = '12345678-1234-1234-1234-123456789abc'
        deployment = {'versions': [{'version_id': version_id, 'percentage': 100}],
                      'annotations': {'workers/message': 'rollback message must be ignored'}}
        version = {'id': version_id, 'annotations': {'workers/message': f'sha={SHA};cfg={CFG}'}}
        def result(value):
            return subprocess.CompletedProcess([], 0, json.dumps(value), '')
        with patch.object(module.subprocess, 'run', side_effect=[result(deployment), result(version)]) as run:
            self.assertEqual(module.read_production_marker('worker'), f'sha={SHA};cfg={CFG}')
            self.assertIn('deployments', run.call_args_list[0].args[0])
            self.assertEqual(run.call_args_list[0].args[0][0], module.WRANGLER)
            self.assertIn(version_id, run.call_args_list[1].args[0])
        for value in [{}, [], {'versions': []}, {'versions': [
                {'version_id': version_id, 'percentage': 50},
                {'version_id': version_id, 'percentage': 50}]}]:
            with patch.object(module.subprocess, 'run', return_value=result(value)):
                self.assertIsNone(module.read_production_marker('worker'))
        for output in ['not json', '{"versions": null}']:
            with patch.object(module.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, output, '')):
                self.assertIsNone(module.read_production_marker('worker'))
        for bad_version in [{}, {'id': 'different', 'annotations': version['annotations']},
                            {'id': version_id, 'annotations': {'workers/message': 'broken'}}]:
            with patch.object(module.subprocess, 'run', side_effect=[result(deployment), result(bad_version)]):
                self.assertIsNone(module.read_production_marker('worker'))
        for error in [OSError('missing wrangler'), subprocess.CalledProcessError(1, 'wrangler'),
                      subprocess.TimeoutExpired('wrangler', 180)]:
            with patch.object(module.subprocess, 'run', side_effect=error):
                self.assertIsNone(module.read_production_marker('worker'))


class GitScopeTest(unittest.TestCase):
    def setUp(self):
        clean_environment = patch.dict(os.environ, CLEAN_ENV, clear=True)
        clean_environment.start()
        self.addCleanup(clean_environment.stop)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.git('init', '-q')
        self.git('config', 'user.email', 'test@example.test')
        self.git('config', 'user.name', 'Test')
        self.write('docs/x.md')
        self.write('web/x')
        self.commit()
        self.base = self.git('rev-parse', 'HEAD').strip()

    def git(self, *args):
        return subprocess.run(['git', *args], cwd=self.root, env=CLEAN_ENV,
                              check=True, capture_output=True, text=True).stdout

    def write(self, name):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text('content')

    def commit(self):
        self.git('add', '.')
        self.git('commit', '-qm', 'test')

    def cli(self, base, *args):
        output = self.root / '.git/scope-output'
        output.unlink(missing_ok=True)
        subprocess.run([sys.executable, '-B', str(SCRIPT), '--base', base, *args],
                       cwd=self.root, env={**CLEAN_ENV, 'GITHUB_OUTPUT': str(output)},
                       check=True, capture_output=True, text=True)
        return output.read_text()

    def test_empty_and_missing_base_publish(self):
        for base in ['', 'bad', 'f' * 40]:
            self.assertIn('publish=true\n', self.cli(base))

    def test_docs_only_and_force(self):
        self.write('docs/new.md')
        self.commit()
        self.assertIn('publish=false\n', self.cli(self.base))
        self.assertIn('publish=true\n', self.cli(self.base, '--force'))

    def test_deleted_web_file(self):
        self.git('rm', 'web/x')
        self.commit()
        self.assertIn('publish=true\n', self.cli(self.base))

    def test_moves_include_source_and_destination(self):
        import publish_inputs
        self.git('mv', 'web/x', 'docs/moved.md')
        self.commit()
        self.assertEqual(set(publish_inputs.changed_paths(self.base, cwd=self.root)),
                         {'web/x', 'docs/moved.md'})
        self.assertIn('publish=true\n', self.cli(self.base))
        self.git('mv', 'docs/x.md', 'docs/renamed.md')
        self.commit()
        previous = self.git('rev-parse', 'HEAD^').strip()
        self.assertEqual(set(publish_inputs.changed_paths(previous, cwd=self.root)),
                         {'docs/x.md', 'docs/renamed.md'})
        self.assertIn('publish=false\n', self.cli(previous))

    def test_document_move_to_evidence_publishes(self):
        self.git('mv', 'docs/x.md', 'docs/moved.md')
        self.commit()
        self.assertIn('publish=false\n', self.cli(self.base))
        (self.root / 'data/evidence').mkdir(parents=True)
        self.git('mv', 'docs/moved.md', 'data/evidence/a.md')
        self.commit()
        self.assertIn('publish=true\n', self.cli(self.base))

    def test_rollback_marker_compares_actual_published_commit(self):
        import publish_inputs
        self.write('web/source.ts')
        self.commit()
        latest = self.git('rev-parse', 'HEAD').strip()
        original = publish_inputs.changed_paths
        with patch.object(publish_inputs, 'changed_paths',
                          side_effect=lambda base: original(base, cwd=self.root)):
            self.assertFalse(publish_inputs.marker_decision(f'sha={latest};cfg={CFG}', CFG)[0])
            self.assertTrue(publish_inputs.marker_decision(f'sha={self.base};cfg={CFG}', CFG)[0])
            self.assertTrue(publish_inputs.marker_decision(f'sha={"f" * 40};cfg={CFG}', CFG)[0])

    def test_production_failure_and_force_outputs(self):
        # No web/package.json: production metadata cannot be read, so publish.
        self.assertIn('publish=true\n', self.cli('', '--production'))
        self.assertIn('reason=production-marker-unknown\n', self.cli('', '--production'))
        output = self.cli('', '--production', '--force')
        self.assertIn('reason=workflow-dispatch\n', output)
        head = self.git('rev-parse', 'HEAD').strip()
        self.assertRegex(output, rf'marker=sha={head};cfg=[0-9a-f]{{16}}\n')
        marker = next(line[7:] for line in output.splitlines() if line.startswith('marker='))
        self.assertEqual(len(marker.encode()), 65)

    def test_nul_paths_and_diff_failure(self):
        import publish_inputs
        self.write('data/line\nbreak.md')
        self.commit()
        self.assertIn('publish=true\n', self.cli(self.base))
        with patch.object(publish_inputs, 'changed_paths', side_effect=OSError('diff failed')):
            self.assertTrue(publish_inputs.base_decision(self.base)[0])


class PublishWorkflowTest(unittest.TestCase):
    def test_deploy_checks_and_marker_order(self):
        text = job('deploy.yml', 'deploy')
        checks = ['node scripts/check-deploy.mjs', 'node scripts/smoke-deploy.mjs --access-only',
                  'bun run wrangler deploy --message', 'run: node scripts/smoke-deploy.mjs\n']
        positions = [text.index(value) for value in checks]
        self.assertEqual(positions, sorted(positions))
        self.assertIn("needs.scope.outputs.publish == 'true'", text)
        self.assertIn('needs: scope', text)
        self.assertIn('needs.scope.outputs.marker', text)

    def test_existing_gates_and_force(self):
        for name in ['scope', 'deploy']:
            text = job('deploy.yml', name)
            for condition in ["vars.CLOUDFLARE_DEPLOY_ENABLED == 'true'",
                              "github.event_name == 'workflow_dispatch'",
                              "github.ref == 'refs/heads/main'",
                              "github.event.workflow_run.conclusion == 'success'",
                              "github.event.workflow_run.event == 'push'"]:
                self.assertIn(condition, text)
        scope = job('deploy.yml', 'scope')
        self.assertIn('--force', scope)
        self.assertIn('workflow_dispatch', scope[scope.index('run: |'):])
        self.assertIn('fetch-depth: 0', checkout('deploy.yml', 'scope'))
        # The token-holding job must run the Wrangler pinned by bun.lock.
        self.assertIn('bun install --frozen-lockfile', scope)
        self.assertNotIn('bunx', scope)
        for path in ['tools/ci', '/web/package.json', '/web/bun.lock']:
            self.assertIn(path, checkout('deploy.yml', 'scope'))

    def test_skipped_deploy_still_checks_access(self):
        text = job('deploy.yml', 'access')
        self.assertIn("needs.scope.outputs.publish == 'false'", text)
        self.assertIn("vars.PUBLIC_RELEASE != 'true'", text)
        self.assertIn('node scripts/smoke-deploy.mjs --access-only', text)
        self.assertNotIn('bun install', text)

    def test_preview_scope(self):
        text = (ROOT / '.github/workflows/preview.yml').read_text()
        self.assertNotIn('paths-ignore', text)
        self.assertIn('needs: scope', job('preview.yml', 'preview'))
        self.assertIn("needs.scope.outputs.publish == 'true'", job('preview.yml', 'preview'))
        self.assertIn('github.event.pull_request.base.sha', job('preview.yml', 'scope'))
        self.assertIn('fetch-depth: 0', checkout('preview.yml', 'scope'))
        self.assertIn('publish_inputs.py --base', job('preview.yml', 'scope'))


if __name__ == '__main__':
    unittest.main()
