"""Index historical research without changing any location or hold decision."""
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import re

import assemble
from national_audit import audit, require

CAMPAIGNS = ('issue16', 'issue20', 'issue25', 'issue26', 'issue27', 'location-batch1', 'location-batch2')
CATEGORIES = {
    'comparison-not-performed': ('照合未実施', r'照合は未実施(?!ではない)|照合未実施|(?:照合|比較|Vector|外形).{0,6}未着手(?!を保留理由にはしていない)|取得・同定していない|外形・数値原典を取得していない'),
    'retrieval-failed': ('原本取得失敗', r'取得失敗|取得不能|HTTP ?[45]\d\d|直接取得404'),
    'source-insufficient': ('資料不足', r'資料不足|原典不足|根拠.{0,8}不足|資料.{0,8}不足'),
    'footprint-absent': ('外形未収録', r'外形未収録|外形.{0,10}収録されていない|外形.{0,10}未収録'),
    'building-unresolved': ('棟対応未確定', r'棟対応未確定|対応.{0,15}未成立|同定.{0,10}未確定|対応.{0,15}確定でき|棟.{0,15}未解決|棟.{0,15}未確定'),
    'conditions-unverified': ('座標系/利用条件未確認', r'(?:測地系|CRS|利用条件|利用手続|再配信条件).{0,30}(?:未|確定でき|残|不足|確認待ち)'),
    'distribution-unverified': ('現配布先の確認待ち', r'現配布.{0,20}確認|現配布.{0,20}補強|現況.{0,10}未確定'),
}


def records(value, pointer=''):
    if isinstance(value, dict):
        ids = [value['facilityId']] if isinstance(value.get('facilityId'), str) else value.get('facilityIds', [])
        for fid in ids:
            if isinstance(fid, str):
                yield fid, pointer, value
        for key, child in value.items():
            yield from records(child, pointer + '/' + key.replace('~', '~0').replace('/', '~1'))
    elif isinstance(value, list):
        for i, child in enumerate(value):
            yield from records(child, pointer + '/' + str(i))


def classify(record, ref):
    # These are searchable labels on quoted historical text, not new research findings.
    fields = ('stopCondition', 'stopReason', 'stop', 'reason', 'finding', 'result', 'conclusion')
    text = '\n'.join(str(record[k]) for k in fields if record.get(k))
    result = []
    for category, (label, pattern) in CATEGORIES.items():
        matches = [line for line in text.splitlines() if re.search(pattern, line)]
        if matches:
            result.append(dict(category=category, label=label, ref=ref, excerpts=matches,
                               assessment='historical-text-match; confirm scope before resuming'))
    if not result:
        result.append(dict(category='execution-not-recorded', label='原記録の追加分類待ち', ref=ref,
                           excerpts=[text] if text else [], assessment='not proof of nonexecution or source insufficiency'))
    return result


def assemble_index(places, histories, latest, hashes, baseline, as_of):
    ids = [p['id'] for p in places]
    require(len(ids) == len(set(ids)), 'duplicate facility ID')
    rows = []
    for p in sorted(places, key=lambda p: p['id']):
        if p.get('coordinate'):
            continue
        fid = p['id']
        last = latest.get(fid, {})
        record, ref = last.get('record', {}), last.get('ref')
        resume = next((record[k] for k in ('resumeCondition', 'resumeConditions', 'resumeWhen', 'resume', 'nextSource') if record.get(k)), None)
        rows.append(dict(facilityId=fid, name=p.get('name'), address=p.get('address'),
                         history=histories.get(fid, []), latestResultRef=ref,
                         priorDecision=record.get('decision', record.get('status', record.get('investigationStatus'))),
                         recordedStopCategories=record.get('stopCategories'),
                         recordedStage=record.get('stage'), originalInvestigationStatus=record.get('investigationStatus'),
                         performedMethod=record.get('performedMethod'), plannedMethod=record.get('plannedMethod'),
                         attemptsRef=ref+'/attempts' if 'attempts' in record else None,
                         classificationCandidates=classify(record, ref),
                         classificationStatus='requires-assessment; candidates are not confirmed stop reasons',
                         historicalReasonCategory=record.get('reasonCategory'),
                         stopCondition=record.get('stopCondition', record.get('stopReason', record.get('stop', record.get('reason')))),
                         resumeCondition=resume,
                         nextAction=resume or '原調査の実施範囲・停止条件を確認し、未実施の棟照合か新資料を明示して選定する。',
                         resumability='conditional-on-stated-evidence' if resume else 'requires-history-assessment',
                         automaticSelection=False, adoptionApproval=False))
    groups = []
    for key in ('name', 'address'):
        values = defaultdict(list)
        for row in rows:
            if row.get(key): values[row[key].strip()].append(row['facilityId'])
        groups.extend(dict(basis=key, value=v, facilityIds=fids, sameBuilding='not-established')
                      for v, fids in sorted(values.items()) if len(fids) > 1)
    return dict(schema=1, baselineCommit=baseline, asOf=as_of,
                population='current assembled ledger facilities without coordinates; excludes adopted and nonregistered facilities; no stock/distribution inference',
                classification='Labels match quoted latest historical result text; multiple labels retained; absence of a label is not proof of absence. Historical decision unchanged.',
                inputSHA256=dict(sorted(hashes.items())), facilities=rows, sharedResearchCandidates=groups,
                summary=dict(unlocated=len(rows), adoptedExcluded=len(places)-len(rows), duplicateFacilityIds=0,
                             classificationCandidateCounts=dict(sorted(Counter(b['category'] for r in rows for b in r['classificationCandidates']).items()))))


def attach_human_queue(rows, queue, relative):
    remaining = {row['facilityId'] for row in rows}
    references = {}
    for status in ('pending', 'answered'):
        for ordinal, entry in enumerate(queue.get(status, [])):
            ids = entry.get('facilityIds', [entry['facilityId']])
            require(entry['facilityId'] in ids, 'human queue primary ID missing from group')
            require(len(ids) == len(set(ids)), 'duplicate human queue group member')
            for fid in ids:
                require(fid not in references, 'duplicate human queue facility')
                if status == 'pending':
                    require(fid in remaining, 'human queue outside remaining population')
                references[fid] = f'{relative}#/{status}/{ordinal}'
    for row in rows:
        row['humanConfirmationRef'] = references.get(row['facilityId'])


def build(root, baseline, as_of, human_queue=None, followups=()):
    root = Path(root).resolve()
    report = audit(root, as_of=as_of)
    hashes = dict(report['inputSHA256'])
    manifest = assemble.read_json(root / 'tools/national/manifest.json')
    ledger, _ = assemble.assemble(root, manifest)
    histories, latest = defaultdict(list), {}
    for row in report['facilities']:
        fid = row['facilityId']
        original = row['provenance']['original']
        if original:
            # The audit stores the original record and pointer without reinterpretation.
            latest[fid] = original
            histories[fid].append(dict(ref=original['ref'], kind='original'))
        for review in row['investigation']['reviews']:
            histories[fid].append(dict(ref=review['ref'], kind='review'))
    reviews_without_ids = []
    for campaign in CAMPAIGNS:
        directory = root / 'data/national' / campaign
        for path in sorted(directory.rglob('*.json')):
            relative = path.relative_to(root).as_posix()
            raw = path.read_bytes()
            hashes[relative] = hashlib.sha256(raw).hexdigest()
            value = json.loads(raw, object_pairs_hook=assemble.unique_object)
            for fid, pointer, record in records(value):
                histories[fid].append(dict(ref=relative+'#'+pointer, kind='review' if 'review' in path.name else 'history'))
            # Only final outcome files advance latestResult; selection/review/initial records never do.
            final = path.name.endswith('outcomes.json') and not path.name.startswith(('initial-', 'research-'))
            if final:
                seen = set()
                for collection in ('rows', 'outcomes', 'groups', 'facilities'):
                    for ordinal, record in enumerate(value.get(collection, [])):
                        for fid in ([record['facilityId']] if 'facilityId' in record else record.get('facilityIds', [])):
                            require(fid not in seen, f'duplicate final outcome ID: {relative}: {fid}')
                            seen.add(fid)
                            latest[fid] = dict(ref=f'{relative}#/{collection}/{ordinal}', record=record)
            if campaign == 'issue25' and path.name == 'investigation.json':
                for fid in value['facilityIds']:
                    latest[fid] = dict(ref=relative+'#', record=value)
            if 'review' in path.name and not any(records(value)):
                reviews_without_ids.append(path)
    # Determine document scope after collecting all outcome members, independent of filenames.
    for path in reviews_without_ids:
        relative = path.relative_to(root).as_posix()
        prefixes = [path.parent.relative_to(root).as_posix()+'/']
        if relative == 'data/national/issue26/review.json':
            prefixes = ['data/national/'+c+'/' for c in ('issue25', 'issue26', 'issue27')]
        for fid in list(histories):
            if any(any(h['ref'].startswith(prefix) for prefix in prefixes) for h in histories[fid]):
                histories[fid].append(dict(ref=relative+'#', kind='scoped-review; inspect decision'))
    for campaign in CAMPAIGNS:
        for path in sorted((root / 'data/national' / campaign).rglob('*review*.md')):
            relative = path.relative_to(root).as_posix()
            hashes[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
            prefix = path.parent.relative_to(root).as_posix()+'/'
            for fid in histories:
                if any(h['ref'].startswith(prefix) for h in histories[fid]):
                    histories[fid].append(dict(ref=relative, kind='prose-review; inspect scope'))
    for fid in histories:
        histories[fid] = list({h['ref']: h for h in histories[fid]}.values())
    known_ids = {p['id'] for p in ledger['places']}
    for relative in followups:
        raw = assemble.repo_path(root, relative).read_bytes()
        hashes[relative] = hashlib.sha256(raw).hexdigest()
        document = json.loads(raw, object_pairs_hook=assemble.unique_object)
        seen = set()
        for ordinal, record in enumerate(document['rows']):
            fid = record['facilityId']
            require(fid in known_ids and fid not in seen, 'unknown or duplicate followup facility')
            seen.add(fid)
            ref = f'{relative}#/rows/{ordinal}'
            histories[fid].append(dict(ref=ref, kind='explicit-followup'))
            latest[fid] = dict(ref=ref, record=record)
    result = assemble_index(ledger['places'], histories, latest, hashes, baseline, as_of)
    if human_queue:
        raw = assemble.repo_path(root, human_queue).read_bytes()
        queue = json.loads(raw, object_pairs_hook=assemble.unique_object)
        attach_human_queue(result['facilities'], queue, human_queue)
        result['humanConfirmationQueueRef'] = human_queue
        digest = hashlib.sha256(raw).hexdigest()
        result['inputSHA256'][human_queue] = digest
        hashes[human_queue] = digest
    result['originalAuditDates'] = report['dates']
    result['historyCatalog'] = [p for p in sorted(hashes) if any('/'+c+'/' in p for c in CAMPAIGNS)]
    for p, digest in hashes.items():
        require(hashlib.sha256((root/p).read_bytes()).hexdigest() == digest, f'input changed: {p}')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--baseline', required=True)
    parser.add_argument('--as-of', required=True)
    parser.add_argument('--human-queue')
    parser.add_argument('--followup', action='append', default=[])
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    result = build(args.root, args.baseline, args.as_of, args.human_queue, args.followup)
    with args.out.open('x') as stream:
        stream.write(json.dumps(result, ensure_ascii=False, indent=2)+'\n')

if __name__ == '__main__': main()
