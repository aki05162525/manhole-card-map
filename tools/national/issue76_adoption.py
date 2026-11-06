"""Explicit Issue76 review gate; never infer approval from a proposed selection.

Hashes bind the review to assessment content, not to irrelevant later prose edits.
They do not establish that the reviewer or underlying evidence is trustworthy;
that remains the independent review required by REVIEW.md.
"""
import copy
import hashlib

from assemble import read_json
from location_lifecycle import digest


def approved_ids(outcomes, common, review):
    """Return only the IDs explicitly approved for these exact inputs."""
    if (review.get('status') != 'approved' or
            not isinstance(review.get('reviewer'), str) or not review['reviewer'].strip() or
            not isinstance(review.get('evidence'), list) or not review['evidence'] or
            any(not isinstance(ref, str) or not ref.strip() for ref in review['evidence'])):
        raise ValueError('completed independent review required')
    if (review.get('assessmentSHA256') != digest(outcomes) or
            review.get('commonSHA256') != digest(common)):
        raise ValueError('review inputs changed')
    rows = {row['facilityId']: row for row in outcomes}
    if len(rows) != len(outcomes):
        raise ValueError('duplicate assessed facility')
    selected = review.get('approvedIds')
    if (not isinstance(selected, list) or any(not isinstance(fid, str) for fid in selected) or
            len(set(selected)) != len(selected)):
        raise ValueError('explicit unique approved IDs required')
    for fid in selected:
        row = rows.get(fid)
        if (not row or row['recommendation'] != 'propose' or
                row['positionSuitability']['status'] != 'acceptable'):
            raise ValueError('approval includes an unassessed or held facility: ' + fid)
    return set(selected)


def prepare_county(root, county, baseline):
    """Prepare reviewed rows in memory, preserving source coordinates and history."""
    directory = root / 'data/national/issue76' / county
    rows = read_json(directory / 'assessment.json')['outcomes']
    package = read_json(directory / 'review-inputs.json')
    review = read_json(directory / 'review.json')
    common = package['common']
    for path, expected in common['files'].items():
        if hashlib.sha256((root / path).read_bytes()).hexdigest() != expected:
            raise ValueError('common evidence changed: ' + path)
    document = common['document']
    if hashlib.sha256((root / document['path']).read_bytes()).hexdigest() != document['sha256']:
        raise ValueError('common assessment changed')
    selected = approved_ids(rows, common, review)
    old = {p['id']: p for p in baseline['places']}
    updates, bindings, provenance = [], [], []
    for row in rows:
        fid = row['facilityId']
        if fid not in selected:
            continue
        if fid not in old or old[fid].get('coordinate') is not None:
            raise ValueError('expected an existing unlocated facility: ' + fid)
        source = read_json(root / row['sourceLocationPath'])
        matches = [r for r in source['updates'] if r['facilityId'] == fid]
        if len(matches) != 1 or digest(matches[0]) != row['sourceLocationSHA256']:
            raise ValueError('reviewed candidate changed: ' + fid)
        update = copy.deepcopy(matches[0])
        evidence = update['evidence']
        method = row.get('adoptionMethod', '国土地理院最適化ベクトルタイルを加工。')
        evidence['verificationMethod'] = (
            f"{method}既存候補の座標を保持し、Issue76の独立レビューで{row.get('adoptionPointDescription', '建物代表点')}として本採用。"
            f"原調査・棟同定・利用条件・資料の限界: {row['sourceLocationPath']} ({row['sourceLocationSHA256']})。"
            f"不確かさ・隣棟/道路への影響: data/national/issue76/{county}/assessment.json ({fid})、"
            f"docs/verification/issue76-common.md。採用承認: data/national/issue76/{county}/review.json。"
            f"原資料確認日{matches[0]['evidence']['checkedAt']}を保持。採用レビュー日{review['reviewedAt']}。"
            "現在の在庫・配布継続・現地経路を新たに確認したものではない。")
        # checkedAt remains the source verification date, not a new survey date.
        updates.append(update)
        bindings.append(dict(facilityId=fid,
                             identity={key: old[fid][key] for key in ('name', 'address')},
                             adoption=copy.deepcopy(update), adoptionSHA256=digest(update),
                             sourceVersion=row.get('sourceVersion', 'optimal_bvmap-v1 2026-07-01; Issue76 reviewed building representative point')))
        provenance.append(dict(facilityId=fid, expectedOldPlaceSHA256=digest(old[fid]),
                               originalLocationPath=row['sourceLocationPath'],
                               originalLocationSHA256=row['sourceLocationSHA256']))
    return ({'schema': 1, 'updates': updates},
            {'schema': 1, 'bindings': bindings, 'events': [], 'groups': []},
            {'schema': 1, 'reviewedAt': review['reviewedAt'], 'rows': provenance})
