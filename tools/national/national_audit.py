"""Reproducible national work queues; never approves or changes source data."""
import argparse
from collections import Counter, defaultdict
import datetime as dt
import hashlib
import json
from pathlib import Path

import assemble
from issue7_audit import REGIONS, index, require, unique_ids


STAGES = {'not-evaluated', 'not-attempted', 'retrieval-failed', 'retrieved',
          'numeric-search', 'building-comparison', 'conflict-investigation', 'conditions-review'}
# These classify original labels, not the depth or success of the investigation.
REASONS = {
    'source': ['原典不足', 'insufficient-primary-coordinate', 'insufficient-primary-coordinate-source',
               'missing-primary-coordinate', 'missing-primary-building-coordinate', 'missing-building-coordinate'],
    'identity': ['名称住所不一致', 'address-conflict', 'identity-or-address-mismatch', 'mixed-record', 'wrong-facility'],
    'building': ['building-correspondence-unresolved', 'building-not-identified', 'multiple-buildings',
                 'coordinate-scope-unresolved', '建物対象外の可能性', '現窓口同定未完', '複数棟・建物同定未完了',
                 'excessive-indoor-precision-or-missing-building-point'],
    'relocation': ['relocation', 'relocation-or-building-identity', 'relocation-or-multiple-buildings',
                   'relocation-or-separate-building', '移転・別棟', '移転・別棟・住所競合',
                   '移転・旧新地点の対応未確定', '移転別棟'],
    'conflict': ['coordinate-conflict', '座標競合'],
    'conditions': ['source-conditions-unverified'],
}
REASON_MAP = {label: group for group, labels in REASONS.items() for label in labels}


def relations(rows, context, variants=False):
    result = {}
    require(isinstance(rows, list), f'{context}: expected relations list')
    for ordinal, row in enumerate(rows):
        require(isinstance(row, dict), f'{context}: invalid relation')
        key = (row.get('cardId'), row.get('placeId'))
        require(all(isinstance(v, str) and v.strip() for v in key), f'{context}: invalid relation ID')
        if variants:
            key += (ordinal,)
        require(key not in result, f'{context}: duplicate relation {key[:2]}')
        result[key] = row
    return result


def references(value, pointer=''):
    """Preserve source pointers instead of interpreting heterogeneous review schemas."""
    if isinstance(value, dict):
        if isinstance(value.get('facilityId'), str):
            yield value['facilityId'], pointer, value
        for key, item in value.items():
            yield from references(item, pointer + '/' + key.replace('~', '~0').replace('/', '~1'))
    elif isinstance(value, list):
        for i, item in enumerate(value):
            yield from references(item, pointer + '/' + str(i))


def same_coordinate(a, b):
    return bool(a and b and all(a.get(k) == b.get(k) for k in ('lat', 'lng')))


def audit(root, manifest='tools/national/manifest.json', full=None, ledger=None,
          listing=None, baseline='data/national/issue7/assignment-baseline.json',
          regions_dir='data/national/issue7', reviews_dir='data/national/issue7/reviews',
          proposals_dir='data/overrides/proposals', followups=None, as_of=None):
    root = Path(root).resolve()
    hashes, cache = {}, {}

    def read_bytes(name):
        raw = assemble.repo_path(root, name).read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        require(name not in hashes or hashes[name] == digest, f'input changed during audit: {name}')
        hashes[name] = digest
        return raw

    def document(name):
        name = str(name)
        if name not in cache:
            value = json.loads(read_bytes(name), object_pairs_hook=assemble.unique_object,
                               parse_constant=lambda v: assemble.reject(f'invalid number: {v}'))
            require(isinstance(value, dict) and type(value.get('schema')) is int and value['schema'] == 1,
                    f'{name}: unsupported schema')
            cache[name] = value
        return cache[name]

    m = document(manifest)
    # Read all selection inputs before assembling, then ensure no file changed.
    for path in m['inputs'] + [r['path'] for r in m['patches'] + m['locations']]:
        document(path)
    assembled, assembly_audit = assemble.assemble(root, m)
    places = index(assembled['places'], 'id', 'assembled places')
    current_relations = relations(assembled['relations'], 'assembled relations')
    # Exact duplicate rows inside one input are errors; cross-input identical rows
    # are the documented assembly deduplication contract.
    for path in m['inputs']:
        index(document(path)['places'], 'id', path)
        relations(document(path)['relations'], path)
    selected = {}
    for selection in m['locations']:
        updates = index(document(selection['path'])['updates'], 'facilityId', selection['path'])
        for approval in selection['approved']:
            fid = approval['facilityId']
            require(fid not in selected, f'duplicate location approval: {fid}')
            selected[fid] = dict(ref=selection['path'] + '#/updates/' + str(list(updates).index(fid)),
                                 sha256=approval['sha256'], update=updates[fid])
    base = document(baseline)
    require(set(base['assignments']) == set(REGIONS), 'expected fixed 13 regions')
    owners, original = {}, {}
    for region in REGIONS:
        for fid in unique_ids(base['assignments'][region], region):
            require(fid not in owners, f'duplicate fixed assignment: {fid}')
            owners[fid] = region
    require(len(owners) == 810, 'expected fixed 810 assignments')
    old = unique_ids(base['baselineLocationIds'], 'baseline locations')
    require(len(old) == 642 and not old.intersection(owners), 'expected 642 disjoint baseline locations')
    for region in REGIONS:
        path = f'{regions_dir}/{region}.json'
        d = document(path)
        for collection in ('updates', 'unresolved'):
            for i, row in enumerate(d[collection]):
                fid = row['facilityId']
                require(owners.get(fid) == region and fid not in original, f'invalid/duplicate original: {fid}')
                if collection == 'updates':
                    assemble.coordinate(row['coordinate'])
                original[fid] = dict(ref=f'{path}#/{collection}/{i}', classification=collection, record=row)
    require(set(original) == set(owners), 'missing fixed original records')
    reviews = defaultdict(list)
    review_paths = sorted(assemble.repo_path(root, reviews_dir).glob('*.json'))
    for path in review_paths:
        name = path.relative_to(root).as_posix()
        for fid, pointer, record in references(document(name)):
            reviews[fid].append(dict(ref=name + '#' + pointer, record=record))
    follow = index(document(followups)['facilities'], 'facilityId', 'followups') if followups else {}
    for fid, row in follow.items():
        require(row.get('stage', 'not-evaluated') in STAGES, f'invalid stage: {fid}')
        require(isinstance(row.get('references'), list) and row['references'] and
                all(isinstance(v, str) and v for v in row['references']), f'followup requires references: {fid}')
        for reference in row['references']:
            name, separator, pointer = reference.partition('#')
            require(separator and pointer.startswith('/'), f'followup requires JSON pointer: {reference}')
            try:
                target = document(name)
                for part in pointer[1:].split('/'):
                    part = part.replace('~1', '/').replace('~0', '~')
                    target = target[int(part)] if isinstance(target, list) else target[part]
            except (OSError, KeyError, IndexError, TypeError, ValueError) as err:
                raise ValueError(f'invalid followup reference: {reference}') from err
        for flag in ('request', 'regionalGap'):
            require(flag not in row or type(row[flag]) is bool, f'invalid {flag}: {fid}')
        require(row.get('sourceConditions', 'not-evaluated') in
                ('not-evaluated', 'review-required', 'checked'), f'invalid sourceConditions: {fid}')

    generated = document(full) if full else None
    generated_places = index(generated['places'], 'id', 'full places') if generated else {}
    generated_cards = index(generated['cards'], 'id', 'full cards') if generated else {}
    generated_relations = relations(generated['relations'], 'full relations', variants=True) if generated else {}
    duplicate_generated = []
    if generated:
        seen_relations = {}
        for i, row in enumerate(generated['relations']):
            serialized = json.dumps(row, sort_keys=True, ensure_ascii=False)
            if serialized in seen_relations:
                duplicate_generated.append(dict(firstRef=f'{full}#/relations/{seen_relations[serialized]}', duplicateRef=f'{full}#/relations/{i}'))
            else:
                seen_relations[serialized] = i
    pins = index([p for p in generated['pins'] if p['kind'] == 'place' and not p.get('reference', False)], 'id', 'full place pins') if generated else {}
    if generated:
        for key, row in generated_relations.items():
            card, fid = key[:2]
            require(fid in generated_places and card in generated_cards, f'dangling full relation: {card}/{fid}')
        for fid, place in generated_places.items():
            co = place.get('coordinate', {})
            if co.get('status') == 'confirmed':
                assemble.coordinate({k: co.get(k) for k in ('lat', 'lng')})
        for fid, pin in pins.items():
            require(fid in generated_places, f'pin missing facility: {fid}')
            co = generated_places[fid].get('coordinate', {})
            require(co.get('status') == 'confirmed' and same_coordinate(co, pin), f'invalid place pin: {fid}')
            assemble.coordinate({k: pin.get(k) for k in ('lat', 'lng')})
            require(set(pin['cardIds']) <= set(generated_cards), f'pin missing card: {fid}')
            verified = {r['cardId'] for r in generated_relations.values() if r['placeId'] == fid and r.get('review') == 'verified'}
            require(set(pin['cardIds']) == verified and verified, f'pin relation mismatch: {fid}')
    comparison = document(ledger) if ledger else None
    comparison_places = index(comparison['places'], 'id', 'ledger places') if comparison else {}
    if comparison:
        relations(comparison['relations'], 'ledger relations')
        for p in comparison_places.values():
            if 'coordinate' in p:
                assemble.coordinate(p['coordinate'])
    evaluation = as_of or (generated.get('evaluatedAt') if generated else None)
    if evaluation:
        evaluation = dt.date.fromisoformat(evaluation).isoformat()
    if as_of and generated:
        require(generated.get('evaluatedAt') == evaluation, 'as-of differs from generated evaluatedAt')

    proposal_rows = []
    proposal_facilities, proposal_relations = set(), set()
    different_facilities, different_relations = set(), set()
    for path in sorted(assemble.repo_path(root, proposals_dir).glob('*.json')):
        name = path.relative_to(root).as_posix()
        d = document(name)
        index(d['places'], 'id', name)
        relations(d['relations'], name)
        for collection in ('places', 'relations'):
            for i, row in enumerate(d[collection]):
                key = row['id'] if collection == 'places' else (row['cardId'], row['placeId'])
                current = places.get(key) if collection == 'places' else current_relations.get(key)
                # Ignore location enrichment when comparing facility proposals.
                fields = {k: v for k, v in row.items() if collection != 'places' or k not in ('coordinate', 'evidence')}
                matches = current is not None and all(assemble.exact(current.get(k), v) for k, v in fields.items())
                status = 'unregistered' if current is None else 'matches-current' if matches else 'differs-current'
                proposal_rows.append(dict(ref=f'{name}#/{collection}/{i}', collection=collection, key=key, status=status))
                if status == 'unregistered':
                    (proposal_facilities if collection == 'places' else proposal_relations).add(key)
                elif status == 'differs-current':
                    (different_facilities if collection == 'places' else different_relations).add(key)

    def relation_matches(current, observed):
        if observed.get('review') != 'verified':
            return False
        if not assemble.exact(current.get('evidence'), observed.get('evidence')):
            return False
        if (current.get('hours') or []) != (observed.get('hours') or []):
            return False
        if current.get('condition') is not None and current['condition'] != observed.get('condition', ''):
            return False
        for key in ('validFrom', 'validTo', 'reviewUntil'):
            if current.get(key, '') != observed.get(key, ''):
                return False
        if current.get('sourceHash') != generated_cards.get(current['cardId'], {}).get('reviewSourceHash'):
            return False
        expected = current.get('status')
        if evaluation and current.get('validFrom') and evaluation < current['validFrom']:
            expected = 'upcoming'
        elif evaluation and current.get('validTo') and evaluation > current['validTo']:
            expected = 'ended'
        if current.get('reviewUntil') and evaluation and evaluation > current['reviewUntil']:
            return False
        return observed.get('status') == expected

    all_ids = sorted(set(places) | set(generated_places) | set(owners) | proposal_facilities)
    require(set(follow) <= set(all_ids), 'followup references unknown facility')
    rows, recheck = [], []
    by_place = defaultdict(list)
    effective_relations = generated_relations if generated else current_relations
    for key, relation in effective_relations.items():
        by_place[key[1]].append(relation)
    card_has_pin = {card for p in pins.values() for card in p['cardIds']} if generated else None
    address_groups, coordinate_groups = defaultdict(list), defaultdict(list)
    for fid in all_ids:
        p = places.get(fid) or generated_places.get(fid) or {}
        gp = generated_places.get(fid)
        co = places.get(fid, {}).get('coordinate')
        adopted = co is not None
        history = original.get(fid)
        f = follow.get(fid, {})
        original_row = history['record'] if history else {}
        group = REASON_MAP.get(original_row.get('reasonCategory'), 'not-evaluated')
        blockers = f.get('blockers', [group] if group != 'not-evaluated' else [])
        require(isinstance(blockers, list) and all(isinstance(b, str) and b for b in blockers), f'invalid blockers: {fid}')
        rs = by_place[fid]
        # Ledger statuses are raw claims. Effective ended/verified decisions only
        # come from generated full produced with the current listing and as-of.
        current_rs = [r for k, r in current_relations.items() if k[1] == fid]
        missing_relations = sorted({r['cardId'] for r in current_rs if not any(g['cardId'] == r['cardId'] for g in rs)}) if generated else None
        matching_relations = bool(current_rs and all(any(g['cardId'] == r['cardId'] and relation_matches(r, g) for g in rs) for r in current_rs) and all(any(r['cardId'] == g['cardId'] for r in current_rs) for g in rs)) if generated else None
        ended = bool(generated and matching_relations and rs and all(r.get('review') == 'verified' and r.get('status') == 'ended' for r in rs))
        conditions = f.get('sourceConditions', 'not-evaluated')
        signals = []
        if adopted:
            if 'relocation' in blockers or 'conflict' in blockers:
                signals.append('identity-or-coordinate-conflict')
            if conditions != 'checked':
                signals.append('source-conditions-' + conditions)
            if f.get('sourceVintage') and evaluation:
                vintage = dt.date.fromisoformat(f['sourceVintage'])
                if (dt.date.fromisoformat(evaluation) - vintage).days > 730:
                    signals.append('source-vintage-over-two-years')
            if f.get('reviewDue') and evaluation and dt.date.fromisoformat(f['reviewDue']) < dt.date.fromisoformat(evaluation):
                signals.append('review-due')
        g = None
        if generated:
            gc = gp.get('coordinate', {}) if gp else {}
            confirmed = gc.get('status') == 'confirmed'
            g = dict(present=gp is not None, confirmedLocation=confirmed, pin=fid in pins,
                     matchesAdopted=same_coordinate(co, gc) and confirmed if adopted else None,
                     unadoptedConfirmedLocation=bool(confirmed and not adopted),
                     matchesCurrentRelations=matching_relations, missingCurrentRelationCardIds=missing_relations,
                     missingExpectedPin=bool(confirmed and any(r.get('review') == 'verified' for r in rs) and fid not in pins))
            if adopted and not g['matchesAdopted']:
                signals.append('generated-location-mismatch')
            if g['unadoptedConfirmedLocation']:
                signals.append('generated-location-without-current-adoption')
            if g['missingExpectedPin']:
                signals.append('generated-pin-missing')
            if current_rs and not matching_relations:
                signals.append('generated-relation-mismatch')
        dangerous = any(s in signals for s in ('identity-or-coordinate-conflict', 'generated-location-mismatch', 'generated-location-without-current-adoption'))
        first_cards = sorted({r['cardId'] for r in rs if r.get('review') == 'verified' and r.get('status') in ('active', 'upcoming') and r['cardId'] not in card_has_pin}) if generated else None
        priority = dict(tier=0 if dangerous else 1 if f.get('request') else 2 if f.get('regionalGap') else 3,
                        requested=f.get('request'), regionalGap=f.get('regionalGap'),
                        firstPinCardIds=first_cards, firstPinCardCount=len(first_cards) if first_cards is not None else None,
                        exception=f.get('priorityException'), estimatedMinutes=f.get('estimatedMinutes'))
        row = dict(facilityId=fid, name=p.get('name'), address=p.get('address'), fixedAssignment=fid in owners,
                   region=owners.get(fid), locationStatus='adopted' if adopted else 'unlocated',
                   selection=selected.get(fid), currentCoordinate=co,
                   provenance=dict(original=history, facilityEvidence=p.get('evidence'),
                                   relationEvidence=[r.get('evidence') for r in rs], followupRef=f'{followups}#/facilities/{list(follow).index(fid)}' if fid in follow else None),
                   generated=g,
                   ledgerComparison=dict(present=fid in comparison_places, matchesCurrent=assemble.exact(comparison_places.get(fid), places.get(fid))) if comparison else None,
                   axes=dict(facilityRegistered=fid in places, generatedFacilityPresent=gp is not None if generated else None,
                             relationRegistered=any(k[1] == fid for k in current_relations),
                             relationUnconfirmed=any(r.get('review') != 'verified' for r in rs) if generated else None,
                             locationUnadopted=not adopted,
                             distributionStatuses=sorted({r.get('status', 'unknown') for r in rs}) if generated else None,
                             rawLedgerStatuses=sorted({r.get('status', 'unknown') for k, r in current_relations.items() if k[1] == fid})),
                   workStatus='excluded-ended' if ended else 'reconfirm' if signals else 'location-investigation' if not adopted else 'no-location-work',
                   investigation=dict(stage=f.get('stage', 'not-evaluated'), reasonGroup=group, blockers=blockers,
                                      originalStatus=original_row.get('investigationStatus'), originalAttempts=original_row.get('attempts'),
                                      originalNextSource=original_row.get('nextSource'), nextAction=f.get('nextAction'),
                                      stopCondition=f.get('stopCondition'), resumeCondition=f.get('resumeCondition'),
                                      nextActionStatus='specified' if f.get('nextAction') else 'not-evaluated', reviews=reviews[fid]),
                   priority=priority, reconfirmationSignals=signals)
        rows.append(row)
        if signals:
            recheck.append(dict(facilityId=fid, signals=signals, priority=priority))
        if p.get('address', '').strip():
            address_groups[p['address'].strip()].append(fid)
        if co:
            coordinate_groups[(co['lat'], co['lng'])].append(fid)
    ordering = lambda r: (r['priority']['tier'], -(r['priority']['firstPinCardCount'] or 0), r['facilityId'])
    rows.sort(key=ordering)
    recheck.sort(key=ordering)
    listing_ids, missing_cards, listing_source = None, None, None
    if listing:
        d = document(listing)
        listing_source = d['source']
        require(listing_source.get('method') and listing_source.get('acquired'), 'listing needs acquisition and ID mapping method')
        dt.date.fromisoformat(listing_source['acquired'])
        raw = read_bytes(listing_source['path'])
        require(hashlib.sha256(raw).hexdigest() == listing_source['sha256'], 'listing source hash mismatch')
        listing_ids = sorted(index(d['cards'], 'id', 'listing cards'))
        if generated:
            missing_cards = sorted(set(listing_ids) - set(generated_cards))
    # All JSON selection bytes must still match those used for inspection.
    for name in list(hashes):
        read_bytes(name)
    fixed_remaining = sorted(set(owners) - set(selected))
    return dict(schema=1, inputSHA256=dict(sorted(hashes.items())),
                dates=dict(asOf=evaluation, generatedAcquired=generated.get('updated') if generated else None,
                           generatedEvaluatedAt=generated.get('evaluatedAt') if generated else None,
                           listingSource=listing_source),
                definitions=dict(national='Union of assembled ledger, optional generated full, fixed assignment and explicit proposal files; not a claim of all facilities in Japan.',
                                 fixed='Fixed 810 minus current manifest explicit location selections. Ended facilities remain in this set.',
                                 investigation='Original labels do not prove completed investigation; normalized stage requires an explicit followup.',
                                 priorities='Suspected wrong destination, request, regional gap, first-pin card count; unknown request/gap remain null.',
                                 exclusions='Only generated verified ended-only relations exclude active work; fixed remaining count is unchanged.',
                                 sourceAge='Explicit sourceVintage older than 730 days is a review hint, not automatic invalidation.',
                                 proposalComparison='Compare proposal fields (facility comparison excludes location/evidence enrichment; relation evidence is compared) to assembled current data; differences are not automatic approvals or known errors.'),
                fixedAssignment=dict(baselineNoLongerSelectedIds=sorted(old-set(selected)), assigned=len(owners), currentAdopted=len(set(owners) & set(selected)), currentRemaining=len(fixed_remaining), remainingIds=fixed_remaining),
                national=dict(knownFacilityCount=len(all_ids), generatedFacilityCount=len(generated_places) if generated else None,
                              generatedUnlocated=sum(p.get('coordinate', {}).get('status') != 'confirmed' for p in generated_places.values()) if generated else None,
                              assembledUnlocated=sum('coordinate' not in p for p in places.values()),
                              outsideFixedSelectedIds=sorted(set(selected)-set(owners)-old),
                              missingGeneratedAdoptedIds=[r['facilityId'] for r in rows if r['currentCoordinate'] and generated and not r['generated']['matchesAdopted']] if generated else None,
                              missingGeneratedPinIds=sorted(r['facilityId'] for r in rows if generated and r['generated']['missingExpectedPin']) if generated else None,
                              excludedEndedIds=sorted(r['facilityId'] for r in rows if r['workStatus'] == 'excluded-ended')),
                cards=dict(listingIds=listing_ids, missingFromGenerated=missing_cards,
                           withoutRelation=sorted(set(generated_cards)-{key[0] for key in generated_relations}) if generated else None),
                proposals=dict(files=[p.relative_to(root).as_posix() for p in sorted(assemble.repo_path(root, proposals_dir).glob('*.json'))],
                               unregisteredFacilityIds=sorted(proposal_facilities), differentFacilityIds=sorted(different_facilities),
                               unregisteredRelations=[list(k) for k in sorted(proposal_relations)], differentRelations=[list(k) for k in sorted(different_relations)], records=proposal_rows),
                sharedInvestigationCandidates=dict(sameAddress=[dict(address=k, facilityIds=v) for k, v in sorted(address_groups.items()) if len(v)>1],
                                                   sameCoordinate=[dict(coordinate=dict(lat=k[0], lng=k[1]), facilityIds=v) for k, v in sorted(coordinate_groups.items()) if len(v)>1]),
                reconfirmationQueue=recheck, facilities=rows,
                coverage=dict(duplicateGeneratedRelations=duplicate_generated if generated else None, reviewFiles=[p.relative_to(root).as_posix() for p in review_paths],
                              followups=followups, originalReasons=REASONS,
                              evidenceValidation='assemble validates approved ledger/location evidence bytes; inputSHA256 lists JSON inputs and explicit listing source, not every archived evidence file.',
                              generatedRelations='Effective statuses are trusted only from supplied full; generation age and as-of are reported, not silently refreshed.'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    for name, default in [('manifest', 'tools/national/manifest.json'), ('baseline', 'data/national/issue7/assignment-baseline.json'),
                          ('regions-dir', 'data/national/issue7'), ('reviews-dir', 'data/national/issue7/reviews'),
                          ('proposals-dir', 'data/overrides/proposals')]:
        parser.add_argument('--' + name, default=default)
    for name in ('full', 'ledger', 'listing', 'followups', 'as-of'):
        parser.add_argument('--' + name)
    parser.add_argument('--out', type=Path, required=True)
    args = vars(parser.parse_args())
    out = args.pop('out')
    try:
        root = args['root'].resolve()
        resolved = out.resolve()
        require(not resolved.is_relative_to(root / 'data') or resolved.is_relative_to(root / 'data/work'), 'source data output forbidden')
        require(not resolved.is_relative_to(root / 'data/work/issue7-baseline'), 'fixed baseline output forbidden')
        require(not out.exists(), 'output already exists')
        result = audit(**args)
        with out.open('x', encoding='utf-8') as stream:
            stream.write(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    except (ValueError, KeyError, TypeError, IndexError, OSError) as err:
        parser.exit(1, f'National audit failed: {err}\n')


if __name__ == '__main__':
    main()
