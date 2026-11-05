"""Reproduce the fixed batch2 summary; run from the repository root.

Uses historical start/final manifests and current copies of their inputs, just
as the original documentation snippet did. Later input revisions require the
historical checkout; this is not an audit of today's full manifest.
"""
import json
import subprocess
from pathlib import Path

import assemble as a


def check():
    root = Path.cwd()
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
        print(i, after[i]['name'])


if __name__ == '__main__':
    check()
