"""Keep the batch2 summary's historical contract while extracting its CLI."""
import ast
from contextlib import redirect_stdout
import copy
import hashlib
import inspect
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import check_batch2_summary as summary

ROOT = Path(__file__).resolve().parents[2]
# Historical snippet from PR58 / 523d3011; imports only are moved out of main.
LEGACY_BODY = '''root = Path.cwd()
base = 'f66b7e994ef250fadee78f396d22fdfc40ba6a83'
final = '11b7e4ee271a3622f794e09e33d3fd6730be3e2b'
manifest_at = lambda ref: json.loads(subprocess.check_output(
    ['git', 'show', ref + ':tools/national/manifest.json']))
old, _ = a.assemble(root, manifest_at(base))
new, audit = a.assemble(root, manifest_at(final))
before = {p['id']: p for p in old['places']}
after = {p['id']: p for p in new['places']}
assert len(before) == len(old['places']) == len(after) == len(new['places']) == 1586
assert before.keys() == after.keys() and old['relations'] == new['relations']
assert len(new['relations']) == 1670
changed = {i for i in before if before[i] != after[i]}
allowed = {'coordinate', 'evidence', 'locationReview'}
for i in changed:
    assert 'coordinate' not in before[i]
    assert after[i]['locationReview']['status'] == 'confirmed'
    assert {k: v for k, v in before[i].items() if k not in allowed} == {
        k: v for k, v in after[i].items() if k not in allowed}
assert all(before[i] == after[i] for i in before if 'coordinate' in before[i])
selected, adopted = [], []
for path in sorted((root / 'data/national/location-batch2').glob('*/outcomes.json')):
    rows = a.read_json(path)['rows']
    ids = [r['facilityId'] for r in rows]
    selection = a.read_json(path.with_name('selection.json'))
    picks = selection.get('selectedIds', selection.get('selected', selection.get('rows')))
    if path.parent.name == 'kinki-east':
        picks = [r for r in picks if r['selection'] == 'selected']
    if path.parent.name == 'tokai':
        picks = [r for r in picks if r['selected']]
    selected_ids = [r if isinstance(r, str) else r['facilityId'] for r in picks]
    assert len(ids) == len(selected_ids) == 8 and set(ids) == set(selected_ids)
    accepted = {r['facilityId'] for r in rows
                if r.get('decision', r.get('status')) == 'adopted'}
    assert accepted == set(ids) & changed
    selected.extend(ids)
    adopted.extend(accepted)
    print(path.parent.name, '選定', len(ids), '採用', len(accepted), '保留', 8-len(accepted))
assert len(selected) == len(set(selected)) == 96
assert len(adopted) == len(changed) == 20 and set(adopted) == changed
assert all('coordinate' not in before[i] for i in selected)
assert all('coordinate' not in after[i] for i in set(selected) - changed)
assert sum('coordinate' not in p for p in before.values()) == 608
assert sum('coordinate' not in p for p in after.values()) == 588
manifest = manifest_at(final)
_, patches, updates = a.load_selection(root, manifest)
assert len(updates) == len({r['facilityId'] for r in updates}) == 864
assert len(manifest['patches']) == 12 and len(patches) == 113
lifecycle = [a.read_json(root / s['path']) for s in manifest['locationLifecycle']]
bindings = [b for d in lifecycle for b in d['bindings']]
assert len(lifecycle) == 9 and len(bindings) == len({b['facilityId'] for b in bindings}) == 24
assert sum(len(d.get('groups', [])) for d in lifecycle) == 2
assert sum(len(d.get('events', [])) for d in lifecycle) == 0
print('台帳1586施設/1670関係、未位置608→588、選定96/採用20/保留76、未選定512')
for i in sorted(changed):
    print(i, after[i]['name'])'''


class Batch2SummaryTests(unittest.TestCase):
    def test_extracted_body_has_identical_ast(self):
        expected = ast.parse(LEGACY_BODY).body
        actual = ast.parse(inspect.getsource(summary.check)).body[0].body
        self.assertEqual([ast.dump(n) for n in actual], [ast.dump(n) for n in expected])

    def test_frozen_baseline_bytes_are_unchanged(self):
        raw = (ROOT / 'data/evidence/location-batch2/hokuriku/baseline-manifest.json').read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(),
                         '59e832eb12b83c28f6a0156b0ec8a230b826dbdec6e23162d3e700b3ed3e98da')

    def test_old_and_extracted_checks_print_identical_results(self):
        # Synthetic, full-size ledger tests all original numeric assertions.
        # No git-history availability or live main manifest is needed by CI.
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            old = {'places': [{'id': f'f:{i}', 'name': f'施設{i}',
                               **({'coordinate': {'lat': 35, 'lng': 135}} if i >= 608 else {})}
                              for i in range(1586)], 'relations': list(range(1670))}
            new = copy.deepcopy(old)
            for i in range(20):
                new['places'][i].update(coordinate={'lat': 36, 'lng': 136}, locationReview={'status': 'confirmed'})
            documents = {}
            for region in range(12):
                path = root / f'data/national/location-batch2/region-{region:02}/outcomes.json'
                path.parent.mkdir(parents=True)
                path.touch()
                ids = [f'f:{i}' for i in range(region*8, region*8+8)]
                documents[path] = {'rows': [{'facilityId': fid, 'decision': 'adopted' if int(fid[2:]) < 20 else 'held'} for fid in ids]}
                documents[path.with_name('selection.json')] = {'selectedIds': ids}
            final = {'patches': [None]*12, 'locationLifecycle': [{'path': f'life-{i}.json'} for i in range(9)]}
            for i in range(9):
                documents[root / f'life-{i}.json'] = {'bindings': [{'facilityId': f'b:{j}'} for j in range(i*3, min(i*3+3, 24))],
                                                         'groups': [None] if i < 2 else []}
            def manifest(command):
                ref = command[-1].split(':')[0]
                self.assertIn(ref, ('f66b7e994ef250fadee78f396d22fdfc40ba6a83', '11b7e4ee271a3622f794e09e33d3fd6730be3e2b'))
                return json.dumps(final if ref.startswith('11b7') else {'baseline': True}).encode()
            def assemble(root_path, manifest):
                return (old if manifest.get('baseline') else new), {}
            def capture(run):
                output = io.StringIO()
                with redirect_stdout(output):
                    run()
                return output.getvalue()
            with patch.object(Path, 'cwd', return_value=root), \
                 patch.object(summary.subprocess, 'check_output', side_effect=manifest), \
                 patch.object(summary.a, 'assemble', side_effect=assemble), \
                 patch.object(summary.a, 'read_json', side_effect=lambda p: documents[p]), \
                 patch.object(summary.a, 'load_selection', return_value=(None, [None]*113, [{'facilityId': f'u:{i}'} for i in range(864)])):
                namespace = {'Path': Path, 'json': json, 'subprocess': summary.subprocess, 'a': summary.a}
                expected = capture(lambda: exec(LEGACY_BODY, namespace))
                actual = capture(summary.check)
            self.assertEqual(actual, expected)
            self.assertIn('未位置608→588', actual)
            self.assertEqual(actual.count('選定 8'), 12)
            self.assertEqual(len(actual.splitlines()), 33)


if __name__ == '__main__':
    unittest.main()
