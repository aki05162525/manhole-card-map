#!/usr/bin/env python3
"""Offline coverage audit of builddata full.json and its assembled ledger (stdlib)."""
import argparse
from datetime import date
from collections import Counter, defaultdict
import hashlib
import json
import math
from pathlib import Path
import sys

STATUSES = ('active', 'suspended', 'ended', 'unknown', 'upcoming')
REGIONS = {
    'north': tuple(range(1, 8)), 'kanto-north': (8, 9, 10, 11),
    'kanto-south': (0, 12, 13, 14), 'chubu-east': tuple(range(15, 21)),
    'chubu-west': (21, 22, 23), 'kinki': tuple(range(24, 31)),
    'chugoku-shikoku': tuple(range(31, 40)), 'kyushu-okinawa': tuple(range(40, 48)),
}


def region(card_id):
    prefix = card_id.split('-')[0]
    if len(prefix) != 2 or not prefix.isdigit():
        raise ValueError('invalid cardId prefecture prefix: ' + card_id)
    for name, codes in REGIONS.items():
        if int(prefix) in codes:
            return name
    raise ValueError('unknown cardId prefecture prefix: ' + card_id)


def index(rows, key):
    out = {}
    for row in rows:
        k = key(row)
        if k in out:
            raise ValueError('duplicate identity: ' + str(k))
        out[k] = row
    return out


def pair(row):
    return row['cardId'], row['placeId']


def coordinate(value):
    if not isinstance(value, dict):
        return False
    for name, limit in [('lat', 85), ('lng', 180)]:
        n = value.get(name)
        if isinstance(n, bool) or not isinstance(n, (int, float)) or not math.isfinite(n) or abs(n) > limit:
            return False
    return True


def status_counts(rows):
    counts = Counter(r['status'] for r in rows)
    return {s: counts[s] for s in STATUSES}


def audit(full, ledger):
    """Use effective Go results, never resurrect stale ledger statuses or coordinates."""
    if full['schema'] != 1 or ledger['schema'] != 1:
        raise ValueError('unsupported schema')
    cards = index(full['cards'], lambda r: r['id'])
    places = index(full['places'], lambda r: r['id'])
    lp = index(ledger['places'], lambda r: r['id'])
    lr = index(ledger['relations'], pair)
    grouped = defaultdict(list)
    for r in full['relations']:
        if r['cardId'] not in cards or r['placeId'] not in places:
            raise ValueError('dangling relation reference: ' + str(pair(r)))
        if r.get('status', 'unknown') not in STATUSES:
            raise ValueError('invalid relation status')
        grouped[pair(r)].append(r)
    for key in lr:
        if key not in grouped:
            raise ValueError('ledger relation missing from full: ' + str(key))
        if key[1] not in lp:
            raise ValueError('ledger relation reference missing: ' + str(key))
    located = {}
    for pid, p in places.items():
        co = p.get('coordinate', {})
        located[pid] = co.get('status') == 'confirmed' and coordinate(co)
        if co.get('status') == 'confirmed' and not coordinate(co):
            raise ValueError('invalid confirmed coordinate: ' + pid)
        if located[pid] and (pid not in lp or lp[pid].get('coordinate') != {k: co[k] for k in ('lat', 'lng')}):
            raise ValueError('confirmed coordinate not approved in ledger: ' + pid)
    for pid, p in lp.items():
        if pid not in places:
            raise ValueError('ledger place missing from full: ' + pid)
        co = p.get('coordinate')
        if co is not None and (not coordinate(co) or not located[pid]):
            raise ValueError('ledger coordinate differs from full: ' + pid)
    for key, rows in grouped.items():
        if len({(r.get('review'), r.get('status', 'unknown')) for r in rows}) != 1:
            raise ValueError('conflicting duplicate relation: ' + str(key))
    actual = set()
    pin_ids = set()
    for pin in full['pins']:
        if pin['kind'] != 'place' or pin.get('reference', False):
            continue
        if pin['id'] in pin_ids:
            raise ValueError('duplicate place pin: ' + pin['id'])
        pin_ids.add(pin['id'])
        actual.update((cid, pin['id']) for cid in pin['cardIds'])
    expected = {key for key, rows in grouped.items() if located[key[1]] and any(r.get('review') == 'verified' for r in rows)}
    if expected != actual or pin_ids != {pid for _, pid in expected}:
        raise ValueError('place pin contract mismatch: missing=%s extra=%s' % (sorted(expected - actual), sorted(actual - expected)))
    for pin in full['pins']:
        if pin['kind'] != 'place' or pin.get('reference', False):
            continue
        co = places[pin['id']]['coordinate']
        if not coordinate(pin) or any(pin[k] != co[k] for k in ('lat', 'lng')):
            raise ValueError('place pin coordinate mismatch: ' + pin['id'])
        states = {r.get('status', 'unknown') for rows in grouped.values() for r in rows
                  if r['placeId'] == pin['id'] and r.get('review') == 'verified'}
        expected_status = next(iter(states)) if len(states) == 1 else 'unknown'
        if pin.get('status') != expected_status:
            raise ValueError('place pin status mismatch: ' + pin['id'])
    relations = []
    for (cid, pid), rows in sorted(grouped.items()):
        signatures = {(r.get('review'), r.get('status', 'unknown')) for r in rows}
        if len(signatures) != 1:
            raise ValueError('conflicting duplicate relation: ' + str((cid, pid)))
        r = rows[0]
        verified = r.get('review') == 'verified'
        status = r.get('status', 'unknown')
        if verified and (cid, pid) not in lr:
            raise ValueError('verified relation absent from ledger: ' + str((cid, pid)))
        if verified:
            approved = lr[(cid, pid)]
            today = date.fromisoformat(full['evaluatedAt'])
            dates = {k: date.fromisoformat(approved[k]) for k in
                     ('reviewUntil', 'validFrom', 'validTo') if approved.get(k)}
            if 'reviewUntil' in dates and today > dates['reviewUntil']:
                raise ValueError('verified relation exceeds ledger reviewUntil: ' + str((cid, pid)))
            if 'validFrom' in dates and 'validTo' in dates and dates['validFrom'] > dates['validTo']:
                raise ValueError('invalid ledger validity interval')
            effective = approved.get('status', 'unknown')
            if 'validFrom' in dates and today < dates['validFrom']:
                effective = 'upcoming'
            elif 'validTo' in dates and today > dates['validTo']:
                effective = 'ended'
            if status != effective:
                raise ValueError('verified relation status differs from ledger: ' + str((cid, pid)))
            source = cards[cid].get('reviewSourceHash')
            if source and source != approved.get('sourceHash'):
                raise ValueError('verified relation source differs from ledger: ' + str((cid, pid)))
        reasons = []
        if not located[pid]:
            reasons.append('location_unconfirmed')
        if not verified:
            reasons.append('distribution_unverified')
        if status == 'unknown':
            reasons.append('distribution_status_unknown')
        if status in ('suspended', 'ended', 'upcoming'):
            reasons.append('distribution_' + status)
        relations.append({'cardId': cid, 'placeId': pid, 'region': region(cid),
                          'rawRows': len(rows), 'review': r.get('review', ''), 'status': status,
                          'verified': verified, 'located': located[pid], 'displayed': (cid, pid) in actual,
                          'activeLocated': verified and located[pid] and status == 'active',
                          'evidenceBacked': bool(r.get('evidence') or lr.get((cid, pid), {}).get('evidence')),
                          'proposalAddition': lr.get((cid, pid), {}).get('change', {}).get('kind') == 'addition',
                          'reasons': reasons})
    by_card, by_place = defaultdict(list), defaultdict(list)
    for r in relations:
        by_card[r['cardId']].append(r)
        by_place[r['placeId']].append(r)
    card_rows = []
    for cid, card in sorted(cards.items()):
        rows = by_card[cid]
        shown = [r for r in rows if r['displayed']]
        card_rows.append({'cardId': cid, 'region': region(cid), 'sourceCardStatus': card.get('status', 'unknown'),
                          'placeIds': [r['placeId'] for r in rows],
                          'displayedPlaceIds': [r['placeId'] for r in shown],
                          'undisplayedPlaceIds': [r['placeId'] for r in rows if not r['displayed']],
                          'displayCoverage': 'none' if not shown else 'all' if len(shown) == len(rows) else 'partial',
                          'allRelationsVerified': bool(rows) and all(r['verified'] for r in rows),
                          'anyRelationVerified': any(r['verified'] for r in rows),
                          'hasUnknownDistribution': not rows or any(not r['verified'] or r['status'] == 'unknown' for r in rows),
                          'activeLocated': any(r['activeLocated'] for r in rows),
                          'reasons': sorted({reason for r in rows for reason in r['reasons']}) if rows else ['no_relations']})
    place_rows = []
    for pid, p in sorted(places.items()):
        rows = by_place[pid]
        unknown = not rows or any(not r['verified'] or r['status'] == 'unknown' for r in rows)
        evidence = bool(p.get('evidence') or lp.get(pid, {}).get('evidence') or any(r['evidenceBacked'] for r in rows))
        gap = ('evidence_backed_distribution_unconfirmed' if evidence else 'distribution_unconfirmed') if unknown else ('location_only_unconfirmed' if not located[pid] else 'none')
        place_rows.append({'placeId': pid, 'name': p.get('name', ''), 'cardIds': [r['cardId'] for r in rows],
                           'regions': sorted({r['region'] for r in rows}),
                           'legacyIds': sorted(lp.get(pid, {}).get('legacyIds') or []),
                           'located': located[pid], 'displayed': pid in pin_ids,
                           'coordinateStatus': p.get('coordinate', {}).get('status', 'unconfirmed'),
                           'evidenceBacked': evidence, 'gapClass': gap,
                           'proposalAddition': any(r['proposalAddition'] for r in rows),
                           'statuses': status_counts(rows),
                           'reasons': sorted({reason for r in rows for reason in r['reasons']}) if rows else ['no_relations'],
                           'unconfirmedDistributionCardIds': [r['cardId'] for r in rows if not r['verified'] or r['status'] == 'unknown'],
                           'undisplayedCardIds': [r['cardId'] for r in rows if not r['displayed']]})
    summary = {'cards': len(cards), 'places': len(places), 'ledgerPlaces': len(lp), 'ledgerRelations': len(lr),
               'rawRelationRows': len(full['relations']), 'uniqueCardPlacePairs': len(relations),
               'duplicateRelationRows': len(full['relations']) - len(relations),
               'rawRelationStatuses': status_counts([dict(r, status=r.get('status', 'unknown')) for r in full['relations']]),
               'uniquePairStatuses': status_counts(relations),
               'verifiedUniquePairStatuses': status_counts([r for r in relations if r['verified']]),
               'locatedVerifiedUniquePairStatuses': status_counts([r for r in relations if r['verified'] and r['located']]),
               'verifiedRawRelationRows': sum(r.get('review') == 'verified' for r in full['relations']),
               'verifiedUniquePairs': sum(r['verified'] for r in relations),
               'knownStatusVerifiedUniquePairs': sum(r['verified'] and r['status'] != 'unknown' for r in relations),
               'locatedPlaces': sum(located.values()), 'displayedPlaces': len(pin_ids),
               'undisplayedPlaces': len(places) - len(pin_ids),
               'anyRelationVerifiedCards': sum(c['anyRelationVerified'] for c in card_rows),
               'displayedCards': sum(c['displayCoverage'] != 'none' for c in card_rows),
               'fullyDisplayedCards': sum(c['displayCoverage'] == 'all' for c in card_rows),
               'partiallyDisplayedCards': sum(c['displayCoverage'] == 'partial' for c in card_rows),
               'undisplayedCards': sum(c['displayCoverage'] == 'none' for c in card_rows),
               'cardsWithUnknownDistribution': sum(c['hasUnknownDistribution'] for c in card_rows),
               'allRelationsVerifiedCards': sum(c['allRelationsVerified'] for c in card_rows),
               'activeLocatedCards': sum(c['activeLocated'] for c in card_rows),
               'activeLocatedPlaces': len({r['placeId'] for r in relations if r['activeLocated']}),
               'placeGapClasses': dict(sorted(Counter(p['gapClass'] for p in place_rows).items()))}
    regions = {}
    for name in REGIONS:
        cs = [c for c in card_rows if c['region'] == name]
        rs = [r for r in relations if r['region'] == name]
        regions[name] = {'cardIds': [c['cardId'] for c in cs],
                         'placeIds': sorted({r['placeId'] for r in rs}),
                         'unlocatedPlaceIds': sorted({r['placeId'] for r in rs if not r['located']}),
                         'unlocatedLedgerPlaceIds': sorted({r['placeId'] for r in rs if not r['located'] and r['placeId'] in lp}),
                         'undisplayedPlaceIds': sorted({r['placeId'] for r in rs if not r['displayed']}),
                         'undisplayedCardIds': [c['cardId'] for c in cs if c['displayCoverage'] == 'none'],
                         'uniquePairs': len(rs), 'rawRelationRows': sum(r['rawRows'] for r in rs)}
    return {'schema': 1, 'evaluatedAt': full.get('evaluatedAt'), 'summary': summary,
            'regions': regions, 'cards': card_rows, 'places': place_rows, 'relations': relations,
            'duplicateRelations': [{'cardId': r['cardId'], 'placeId': r['placeId'], 'rawRows': r['rawRows']} for r in relations if r['rawRows'] > 1],
            'undisplayedPlaces': [p for p in place_rows if not p['displayed']],
            'undisplayedCards': [c for c in card_rows if c['displayCoverage'] == 'none']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--full', type=Path, required=True)
    parser.add_argument('--ledger', type=Path, required=True)
    parser.add_argument('--out', type=Path, help='new output file; default stdout; never overwrite')
    args = parser.parse_args()
    try:
        if args.out and (args.out.exists() or args.out.resolve() in (args.full.resolve(), args.ledger.resolve())):
            raise ValueError('output must be a new file, distinct from inputs')
        inputs = [p.read_bytes() for p in (args.full, args.ledger)]
        result = audit(*(json.loads(raw) for raw in inputs))
        result['inputSHA256'] = {name: hashlib.sha256(raw).hexdigest() for name, raw in zip(('full', 'ledger'), inputs)}
        output = json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n'
        if args.out:
            with args.out.open('x', encoding='utf-8') as stream:
                stream.write(output)
        else:
            sys.stdout.write(output)
    except (ValueError, KeyError, TypeError, OSError) as exc:
        parser.exit(2, 'coverage: %s\n' % exc)


if __name__ == '__main__':
    main()
