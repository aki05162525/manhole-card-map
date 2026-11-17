"""Guard checkout scopes without a third-party YAML dependency."""
import json
import os
from pathlib import Path
import re
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / 'web'
CODE = ('.ts', '.tsx', '.mts', '.mjs', '.js')
# A quoted relative path: imports, new URL(..., import.meta.url), readFileSync(...).
RELATIVE = re.compile(r"""(["'`])(\.{1,2}/[^"'`\n$]*)\1""")
# path.join/resolve with literal segments, e.g. resolve('..', 'tools', 'x.mjs').
SEGMENTS = re.compile(r"""\b(?:join|resolve)\(([^()]*)\)""")
QUOTED = re.compile(r"""(["'`])([^"'`\n$]*)\1""")
ALIAS = re.compile(r"""(["'`])@/([^"'`\n$]*)\1""")
# Vite resolves root-absolute URLs in HTML entries from web/.
HTML_ROOT = re.compile(r'\b(?:src|href)="/([^"/][^"]*)"')


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


def sparse_patterns(workflow, name):
    match = re.search(r'^          sparse-checkout: \|\n((?:^            .+\n)+)', checkout(workflow, name), re.M)
    if match is None:
        raise AssertionError(f'{name} must use sparse-checkout')
    return [line.strip() for line in match[1].splitlines()]


def module_file(path):
    """Resolve an import target the way Vite does for the extensions used here."""
    candidates = [path, *(path.with_name(path.name + ext) for ext in CODE),
                  *(path / f'index{ext}' for ext in CODE)]
    return next((c for c in candidates if c.is_file()), None)


def frontend_entries():
    """Files the frontend job executes: Vitest tests, configs, build entries and job scripts."""
    config = (WEB / 'vitest.config.ts').read_text()
    entries = {WEB / 'vitest.config.ts', WEB / 'vite.config.ts', *WEB.glob('*.html')}
    for pattern in re.findall(r'include:\s*\[([^\]]*)\]', config):
        for glob in QUOTED.findall(pattern):
            entries.update(WEB.glob(glob[1]))
    scripts = json.loads((WEB / 'package.json').read_text())['scripts']
    pending = re.findall(r'bun run ([\w:-]+)', job('ci.yml', 'frontend-checks'))
    seen = set()
    while pending:
        name = pending.pop()
        if name in seen or name not in scripts:
            continue
        seen.add(name)
        pending += re.findall(r'bun run ([\w:-]+)', scripts[name])
        entries.update(WEB / s for s in re.findall(r'\bnode (scripts/\S+)', scripts[name]))
    return entries


def literals(text):
    yield from (m[2] for m in RELATIVE.finditer(text))
    for args in SEGMENTS.findall(text):
        parts = [q[1] for q in QUOTED.findall(args)]
        # Only fully literal calls such as resolve('..', 'tools'); a leading variable is unknown.
        if parts and QUOTED.match(args.strip()) and parts[0].split('/')[0] == '..':
            yield '/'.join(parts)


def frontend_external_paths():
    """Repository paths outside web/ that the frontend job's code refers to.

    Relative strings are resolved from the file and, for cwd-relative reads,
    from web/ (Vitest and the scripts run there); only existing targets count.
    Imports that stay inside web/ are followed, so helpers used by tests are scanned too.
    """
    external, seen = set(), set()
    pending = [p for p in frontend_entries() if p.is_file()]
    while pending:
        file = pending.pop()
        if file in seen:
            continue
        seen.add(file)
        text = file.read_text(errors='replace')
        targets = [(file.parent, s) for s in literals(text)]
        targets += [(WEB / 'src', './' + s) for _, s in ALIAS.findall(text)]
        if file.suffix == '.html':
            targets += [(WEB, './' + s) for s in HTML_ROOT.findall(text)]
        for base, spec in targets:
            spec = spec.split('?')[0]
            for origin in (base, WEB):
                target = Path(os.path.normpath(origin / spec))
                if WEB == target or WEB in target.parents:
                    found = module_file(target)
                    if found and found.suffix in CODE:
                        pending.append(found)
                    if found or target.exists():
                        break
                elif target != ROOT and ROOT in target.parents and target.exists():
                    external.add(target.relative_to(ROOT).as_posix())
                    break
    return sorted(external)


def uncovered(paths, patterns):
    """Paths omitted by literal sparse entries; both checked jobs keep root files."""
    return [p for p in paths if '/' in p
            and not any(p == d.strip('/') or p.startswith(d.strip('/') + '/') for d in patterns)]


class WorkflowCheckoutTest(unittest.TestCase):
    def test_required_frontend_check_rejects_failure_cancel_and_unexpected_skip(self):
        text = job('ci.yml', 'frontend')
        self.assertIn('needs: [changes, frontend-checks]', text)
        self.assertIn('if: always()', text)
        self.assertIn('SCOPE: ${{ needs.changes.outputs.frontend }}', text)
        self.assertIn('RESULT: ${{ needs.frontend-checks.result }}', text)
        self.assertIn('CHANGES: ${{ needs.changes.result }}', text)
        script = re.search(r'run: \|\n((?:          .+\n)+)', text)[1]
        for scope, result, changes, passed in [
            ('true', 'success', 'success', True),
            ('false', 'skipped', 'success', True),
            ('true', 'failure', 'success', False),
            ('true', 'cancelled', 'success', False),
            ('true', 'skipped', 'success', False),
            ('', 'skipped', 'failure', False),
        ]:
            with self.subTest(scope=scope, result=result, changes=changes):
                run = subprocess.run(['bash', '-e', '-c', script],
                    env={**os.environ, 'SCOPE': scope, 'RESULT': result, 'CHANGES': changes})
                self.assertEqual(run.returncode == 0, passed)

    def test_frontend_tasks_are_independent_and_vitest_shards_share_one_cache_snapshot(self):
        text = job('ci.yml', 'frontend-checks')
        self.assertIn('fromJson(needs.changes.outputs.frontend_matrix)', text)
        self.assertIn('fail-fast: false', text)
        for task in ('lint', 'typecheck', 'build', 'test'):
            self.assertIn(f"matrix.task == '{task}'", text)
        self.assertIn('CI_TEST_RELATED: ${{ needs.changes.outputs.frontend_related }}', text)
        self.assertIn('TEST_SHARD_INDEX: ${{ matrix.index }}', text)
        self.assertIn('TEST_SHARD_COUNT: ${{ matrix.count }}', text)
        self.assertIn('args=(--shard="$TEST_SHARD_INDEX/$TEST_SHARD_COUNT")', text)
        self.assertIn('if [ "$TEST_SHARD_COUNT" -gt 1 ]; then args+=(--passWithNoTests); fi', text)
        self.assertIn('bun run test:ci "${args[@]}"', text)
        restore = re.search(r'      - name: Restore selected Vitest timings on PR\n(.*?)(?=      - name:|\Z)', text, re.S)
        self.assertIsNotNone(restore)
        self.assertIn('key: ${{ needs.changes.outputs.timings_key }}', restore[1])
        self.assertNotIn('restore-keys:', restore[1])
        # An eviction after lookup must fail, not repartition just one shard.
        self.assertIn('fail-on-cache-miss: true', restore[1])
        self.assertIn('bun run build:fixture:ci', text)
        self.assertIn('bun run typecheck', text)

    def test_changes_selects_one_existing_vitest_timing_cache_for_all_shards(self):
        text = job('ci.yml', 'changes')
        self.assertIn('lookup-only: true', text)
        self.assertIn('cache-matched-key', text)
        self.assertIn('timings_key: ${{ steps.timings.outputs.cache-matched-key }}', text)
        self.assertIn('frontend_matrix: ${{ steps.scope.outputs.frontend_matrix }}', text)
        self.assertIn('frontend_related: ${{ steps.scope.outputs.frontend_related }}', text)

    def assert_sparse(self, workflow, name, patterns, non_cone=False):
        text = checkout(workflow, name)
        self.assertNotRegex(text, r'(?m)^\s*filter:')
        self.assertEqual(sparse_patterns(workflow, name), patterns)
        if non_cone:
            self.assertRegex(text, r'(?m)^          sparse-checkout-cone-mode: false$')
        else:
            self.assertNotRegex(text, r'(?m)^\s*sparse-checkout-cone-mode: false')

    def test_changes_checks_out_everything_without_old_blobs_and_keeps_base_history(self):
        # A sparse checkout implies blob:none, so the history's deleted originals are not downloaded.
        self.assert_sparse('ci.yml', 'changes', ['/*'], non_cone=True)
        self.assertRegex(checkout('ci.yml', 'changes'), r'(?m)^          fetch-depth: 0$')

    def test_frontend_keeps_fixture_inputs_and_worker_card_registry(self):
        self.assert_sparse('ci.yml', 'frontend-checks', ['/*', '!/*/', '/web/', '/tools/dev/', '/tools/ci/', '/tools/design/', '/.github/', '/data/card-ids.json', '/data/card-images.json'], non_cone=True)

    def test_agents_checks_scope_before_restoring_skills(self):
        self.assert_sparse('agents.yml', 'reproducibility', ['tools/ci', '.github', '.agents', '.apm'])

    def test_sparse_check_rejects_missing_tool_directory(self):
        # Simulates dropping tools/design from the frontend checkout.
        patterns = ['web', 'tools/dev', 'tools/ci', '.github']
        missing = uncovered(frontend_external_paths(), patterns)
        self.assertIn('tools/design/color-contrast.mjs', missing)
        self.assertNotIn('.github/workflows/preview.yml', missing)
        self.assertEqual(uncovered(['mise.toml', 'data/a.json'], patterns), ['data/a.json'])

    def test_frontend_checkout_covers_paths_read_by_tests_and_build(self):
        paths = frontend_external_paths()
        # Guard the extractor itself: these are known references outside web/.
        self.assertIn('tools/design/color-contrast.mjs', paths)
        self.assertIn('tools/design/theme-contrast.mjs', paths)
        self.assertIn('.github/workflows/preview.yml', paths)
        self.assertIn('data/card-ids.json', paths)
        self.assertIn('data/card-images.json', paths)
        self.assertEqual(uncovered(paths, sparse_patterns('ci.yml', 'frontend-checks')), [])

    def test_backend_retains_full_checkout_and_uncached_python_tests(self):
        text = checkout('ci.yml', 'backend')
        self.assertNotRegex(text, r'(?m)^\s*(?:filter|sparse-checkout|sparse-checkout-cone-mode):')
        self.assertIn('run: go test -count=1 ./...', job('ci.yml', 'backend'))


if __name__ == '__main__':
    unittest.main()
