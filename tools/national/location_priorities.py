"""Classify the registered unlocated population from a national_audit report."""
import argparse
from collections import Counter, defaultdict
import copy
import hashlib
import json
from pathlib import Path

import assemble
from national_audit import require


STATES = {'active', 'upcoming', 'suspended', 'ended'}


def classify(report, full=None, holds=None):
    holds = holds or {}
    source = report['facilities']
    ids = [r['facilityId'] for r in source]
    require(len(ids) == len(set(ids)), 'duplicate audit facility ID')
    population = [r for r in source if r['axes']['facilityRegistered'] and r['locationStatus'] == 'unlocated']
    target_ids = {r['facilityId'] for r in population}
    require(len(population) == report['national']['assembledUnlocated'], 'unlocated population count mismatch')
    require(set(holds) <= set(ids), 'hold references unknown facility')
    relations = defaultdict(list)
    if full is not None:
        for relation in full['relations']:
            relations[relation['placeId']].append(relation)
    groups = []
    for field in ('address', 'name'):
        values = defaultdict(list)
        for r in population:
            value = (r.get(field) or '').strip()
            if value:
                values[value].append(r['facilityId'])
        for value, members in sorted(values.items()):
            if len(members) > 1:
                groups.append(dict(id=f'{field}:{len(groups)+1}', basis=field, value=value,
                                   facilityIds=sorted(members), buildingIdentity='not-confirmed'))
    rows = []
    for original in population:
        row = copy.deepcopy(original)
        fid = row['facilityId']
        axes, generated = row['axes'], row.get('generated')
        statuses = axes.get('distributionStatuses')
        consistent = bool(generated and generated.get('matchesCurrentRelations') is True)
        if generated is None or statuses is None:
            category = 'not-evaluated'
        elif not consistent or axes.get('relationUnconfirmed') is not False or not statuses or not set(statuses) <= STATES:
            category = 'needs-review'
        elif len(set(statuses)) > 1:
            category = 'mixed'
        else:
            category = 'ended-only' if statuses == ['ended'] else statuses[0]
        trusted = category not in ('not-evaluated', 'needs-review')
        hold = copy.deepcopy(holds.get(fid))
        investigation = row['investigation']
        first = row['priority'].get('firstPinCardIds') if trusted else None
        row['distribution'] = dict(classification=category, statuses=statuses,
                                   matchesCurrentRelations=generated.get('matchesCurrentRelations') if generated else None,
                                   allRelationsVerified=not axes['relationUnconfirmed'] if axes.get('relationUnconfirmed') is not None else None)
        row['firstPinCardIds'] = first
        row['generatedRelations'] = copy.deepcopy(relations[fid]) if full is not None else None
        row['hold'] = hold
        row['currentInvestigationStage'] = (hold.get('stage', 'not-evaluated') if hold else investigation.get('stage', 'not-evaluated'))
        row['sharedGroupIds'] = [g['id'] for g in groups if fid in g['facilityIds']]
        row['nextAction'] = ('配布関係の現原典と生成世代を照合する' if not trusted else
                             '原典更新・配布再開を確認して再評価する' if category == 'ended-only' else
                             investigation.get('nextAction') or '原調査・レビューの不足根拠と利用可能な次資料を評価する')
        row['reevaluateWhen'] = investigation.get('resumeCondition') or '新しい公式資料・配布関係更新・利用者報告が得られた時'
        if hold:
            row['nextAction'] = '既存調査の再開条件を確認する。同じ資料・手法を反復しない'
            row['reevaluateWhen'] = hold['resumeCondition']
        row['automaticSelection'] = False
        row['notSelectedReason'] = ('existing-hold' if hold else 'ended-only-lower-priority' if category == 'ended-only' else
                                    'relation-verification-required' if not trusted else 'awaiting-explicit-selection')
        blockers = investigation.get('blockers', [])
        dangerous = bool(set(blockers) & {'relocation', 'conflict'} or
                         (row.get('locationReview') or {}).get('status') == 'needs-review' or
                         set(row.get('reconfirmationSignals', [])) & {'generated-location-mismatch', 'generated-location-without-current-adoption'})
        row['priority']['assessmentTier'] = (0 if dangerous else 1 if row['priority'].get('requested') is True else
                                            2 if row['priority'].get('regionalGap') is True else 3)
        rows.append(row)
    rows.sort(key=lambda r: (r['priority']['assessmentTier'], -(len(r['firstPinCardIds']) if r['firstPinCardIds'] is not None else 0), r['facilityId']))
    first_cards = sorted({c for r in rows for c in r['firstPinCardIds'] or []})
    relation_counts = Counter(r.get('status', 'unknown') for fid in target_ids for r in relations[fid])
    return dict(schema=1, dates=copy.deepcopy(report['dates']), auditInputSHA256=copy.deepcopy(report['inputSHA256']),
                definitions=dict(population='Registered assembled facilities without adopted coordinates; generated legacy-only facilities excluded.',
                                 distribution='Exclusive facility categories; mixed retains every status. Stale, unknown or unverified relations cannot establish ended-only.',
                                 relationCounts='All supplied full relation rows for target facilities, including period variants and exact duplicates. Card counts are distinct IDs.',
                                 firstPin='Verified active/upcoming cards without a nonreference facility pin in the audit; generation mismatch suppresses prioritization, not source evidence.',
                                 shared='Exact trimmed address/name only; neither building identity nor ID merge.',
                                 ranking='Wrong-destination signals, explicit request, regional gap, then first-pin distinct card count; not automatic work selection or coordinate approval.'),
                facilities=rows, sharedInvestigationCandidates=groups,
                coverage=dict(facilityIds=sorted(target_ids), count=len(rows), complete=True,
                              holdsOutsideCurrentPopulation=sorted(set(holds)-target_ids)),
                summary=dict(facilities=len(rows), distributionCounts=dict(sorted(Counter(r['distribution']['classification'] for r in rows).items())),
                             relationStatusCounts=dict(sorted(relation_counts.items())) if full is not None else None,
                             investigationStageCounts=dict(sorted(Counter(r['investigation']['stage'] for r in rows).items())),
                             currentInvestigationStageCounts=dict(sorted(Counter(r['currentInvestigationStage'] for r in rows).items())),
                             blockerCounts=dict(sorted(Counter(b for r in rows for b in set(r['investigation'].get('blockers', []))).items())),
                             heldFacilities=sum(r['hold'] is not None for r in rows),
                             firstPinCandidateCardIds=first_cards, firstPinCandidateCardCount=len(first_cards) if all(r['firstPinCardIds'] is not None for r in rows) else None,
                             knownFirstPinCandidateCardCount=len(first_cards)))


def build(root, audit, full=None, hold_outcomes=(), hold_selection=None):
    root = Path(root).resolve()
    hashes = {}

    def read(path):
        raw = assemble.repo_path(root, path).read_bytes()
        hashes[path] = hashlib.sha256(raw).hexdigest()
        return json.loads(raw, object_pairs_hook=assemble.unique_object,
                          parse_constant=lambda x: assemble.reject(f'invalid number: {x}'))

    report = read(audit)
    require(report.get('schema') == 1, 'unsupported audit schema')
    generated = read(full) if full else None
    if full:
        require(report['inputSHA256'].get(full) == hashes[full], 'full hash differs from audited input')
    selected = read(hold_selection) if hold_selection else None
    expected = [fid for g in selected['groups'] for fid in g['facilityIds']] if selected else None
    if expected is not None:
        require(len(expected) == len(set(expected)), 'duplicate hold selection ID')
    holds = {}
    for path in hold_outcomes:
        document = read(path)
        require(document.get('schema') == 1, 'unsupported hold schema')
        if selected:
            require(document.get('selectionSHA256') == hashes[hold_selection], 'hold selection hash mismatch')
        collection = 'outcomes' if 'outcomes' in document else 'groups'
        for i, record in enumerate(document[collection]):
            members = [record['facilityId']] if collection == 'outcomes' else record['facilityIds']
            stop = record.get('stopCondition') or record.get('stopReason')
            resume = record.get('resumeCondition') or record.get('resumeWhen')
            require(record.get('status') == 'held' and stop and resume, 'hold requires status and stop/resume conditions')
            for fid in members:
                require(fid not in holds, 'duplicate hold ID')
                holds[fid] = dict(record, facilityId=fid, stopCondition=stop, resumeCondition=resume,
                                  outcomeRef=f'{path}#/{collection}/{i}')
    if expected is not None:
        require(set(holds) == set(expected), 'hold selection coverage mismatch')
    result = classify(report, generated, holds)
    result['inputSHA256'] = dict(sorted(hashes.items()))
    for path, digest in hashes.items():
        require(hashlib.sha256(assemble.repo_path(root, path).read_bytes()).hexdigest() == digest, 'input changed during classification')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--audit', required=True)
    parser.add_argument('--full', help='internal full JSON used by the supplied audit (same path and hash)')
    parser.add_argument('--hold-selection')
    parser.add_argument('--hold-outcomes', action='append', default=[])
    parser.add_argument('--out', type=Path, required=True)
    args = vars(parser.parse_args())
    out = args.pop('out')
    try:
        root = args['root'].resolve()
        resolved = out.resolve()
        require(not resolved.is_relative_to(root / 'data') or resolved.is_relative_to(root / 'data/work'), 'source data output forbidden')
        require(not resolved.is_relative_to(root / 'data/work/issue7-baseline'), 'fixed baseline output forbidden')
        require(not out.exists(), 'output already exists')
        result = build(**args)
        with out.open('x', encoding='utf-8') as stream:
            stream.write(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False)+'\n')
    except (ValueError, KeyError, TypeError, IndexError, OSError) as error:
        parser.exit(1, f'Location priorities failed: {error}\n')


if __name__ == '__main__':
    main()
