"""Offline coordinate-source inventory; a record is never a licence approval."""
import argparse
from collections import Counter
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit

from assemble import (apply_patches, assemble, coordinate, load_selection, merge,
                      read_json, reject, repo_path)
from issue7_audit import REGIONS


DEFAULT_CANDIDATES = tuple(f'data/national/issue7/{region}.json' for region in REGIONS)
TERM_STATUSES = {'unreviewed', 'needs-review', 'conditional', 'usable', 'prohibited'}


def digest(row):
    return hashlib.sha256(json.dumps(row, sort_keys=True, ensure_ascii=False, allow_nan=False).encode()).hexdigest()


def day(value):
    if not isinstance(value, str) or dt.date.fromisoformat(value).isoformat() != value:
        reject(f'invalid calendar date: {value}')
    return value


def require_text(value, context):
    if not isinstance(value, str) or not value.strip():
        reject(f'missing {context}')


def inventory(root, manifest='tools/national/manifest.json', candidate_files=None,
              registry=None, as_of=None):
    root = Path(root).resolve()
    if as_of is not None:
        day(as_of)
    hashes = {}

    def file_hash(name):
        path = repo_path(root, name)
        if name not in hashes:
            hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest()
        return hashes[name]

    def document(name):
        file_hash(name)
        value = read_json(repo_path(root, name))
        if not isinstance(value, dict) or type(value.get('schema')) is not int or value['schema'] != 1:
            reject(f'unsupported schema: {name}')
        return value

    def snapshot(ev, required):
        if not isinstance(ev, dict):
            reject('invalid evidence object')
        name, expected = ev.get('snapshotPath'), ev.get('snapshotSHA256')
        if name is None or expected is None:
            if required:
                reject('missing adopted snapshot reference')
            return dict(status='unrecorded', path=name, expectedSHA256=expected, actualSHA256=None)
        path = repo_path(root, name)
        if not path.is_file():
            if required:
                reject(f'missing adopted snapshot: {name}')
            return dict(status='missing', path=name, expectedSHA256=expected, actualSHA256=None)
        actual = file_hash(name)
        if actual != expected:
            reject(f'evidence hash mismatch: {name}')
        return dict(status='verified', path=name, expectedSHA256=expected, actualSHA256=actual)

    m = document(manifest)
    paths = m['inputs'] + [s['path'] for s in m['patches'] + m['locations']]
    for path in paths:
        file_hash(path)
    # Keep assembly's existing evidence, old-value and approval checks intact.
    integrated, assembly_audit = assemble(root, m)
    inputs, patches, updates = load_selection(root, m)
    patched = apply_patches(inputs, patches, root)
    base = merge(list(patched.values()))
    for patch in patches:
        snapshot(patch['evidence'], True)
    for collection in ('places', 'relations'):
        for original in base[collection]:
            snapshot(original['evidence'], True)
    adopted_ids = {p['id'] for p in integrated['places'] if 'coordinate' in p}
    records = {}

    def add(row, fid, adoption, origin, collection):
        require_text(fid, 'facility ID')
        coordinate(row['coordinate'])
        row_hash = digest(row)
        key = (fid, row_hash)
        if key in records:
            existing = records[key]
            if origin not in existing['origins']:
                existing['origins'].append(origin)
            if adoption != 'candidate':
                if existing['adoption'] != 'candidate':
                    reject(f'duplicate adopted record: {fid}')
                existing['adoption'] = adoption
            return
        ev = row.get('evidence', {})
        snap = snapshot(ev, adoption != 'candidate')
        records[key] = dict(facilityId=fid, recordSHA256=row_hash,
                            adoption=adoption, currentlyAdoptedFacility=fid in adopted_ids,
                            origins=[origin], recordCollection=collection,
                            coordinate=row['coordinate'], scope=row.get('scope'), evidence=ev,
                            snapshot=snap,
                            temporalMetadata=dict(checkedAt=ev.get('checkedAt'),
                                                  fetchedAt=ev.get('fetchedAt', row.get('fetchedAt')),
                                                  sourceAsOf=ev.get('sourceAsOf', row.get('sourceAsOf'))),
                            source=dict(name=None, version=None, derivation=None),
                            termsStatus='unreviewed', reviewId=None,
                            sourceInterpretation='unassessed: URL or keyword occurrence is not coordinate provenance',
                            rawRecord=row)

    for p in base['places']:
        if 'coordinate' not in p:
            continue
        origins = sorted(path for path, doc in patched.items()
                         if any(row['id'] == p['id'] for row in doc['places']))
        add(p, p['id'], 'ledger-coordinate', origins[0], 'places-after-patches')
        records[(p['id'], digest(p))]['origins'] = origins
    selected_keys = set()
    for selection in m['locations']:
        doc = document(selection['path'])
        by_id = {r['facilityId']: r for r in doc['updates']}
        for approval in selection['approved']:
            row = by_id[approval['facilityId']]
            key = (row['facilityId'], digest(row))
            if key in selected_keys:
                reject(f'duplicate approval: {key[0]}')
            selected_keys.add(key)
            add(row, row['facilityId'], 'manifest-location', selection['path'], 'updates')

    candidate_paths = sorted(set([s['path'] for s in m['locations']] +
                                list(DEFAULT_CANDIDATES if candidate_files is None else candidate_files)))
    for name in candidate_paths:
        doc = document(name)
        seen = set()
        if not isinstance(doc.get('updates'), list):
            reject(f'candidate updates must be an array: {name}')
        for row in doc['updates']:
            fid = row['facilityId']
            if fid in seen:
                reject(f'duplicate candidate ID: {name}/{fid}')
            seen.add(fid)
            add(row, fid, 'candidate', name, 'updates')

    reviews = []
    matched = set()
    if registry is not None:
        reg = document(registry)
        if not isinstance(reg.get('reviews'), list):
            reject('registry reviews must be an array')
        review_ids = set()
        for review in reg['reviews']:
            rid = review['id']
            require_text(rid, 'review ID')
            if rid in review_ids:
                reject(f'duplicate review ID: {rid}')
            review_ids.add(rid)
            if review.get('status') not in TERM_STATUSES:
                reject(f'invalid terms status: {rid}')
            checked = day(review['checkedAt'])
            if as_of is not None and checked > as_of:
                reject(f'review after as-of: {rid}')
            source = review['source']
            if not isinstance(source, dict) or set(source) != {'name', 'version', 'derivation'}:
                reject(f'source requires name, version and derivation: {rid}')
            for field, value in source.items():
                require_text(value, f'{rid} source {field}')
            if not isinstance(review.get('evidence'), list) or not review['evidence']:
                reject(f'missing terms evidence: {rid}')
            for ev in review['evidence']:
                url = urlsplit(ev['url'])
                if url.scheme not in ('http', 'https') or not url.hostname or url.username or url.password:
                    reject(f'invalid terms URL: {rid}')
                require_text(ev['locator'], 'terms locator')
                if day(ev['checkedAt']) > checked:
                    reject(f'terms evidence after review date: {rid}')
                if 'snapshotPath' in ev or 'snapshotSHA256' in ev:
                    snapshot(ev, True)
            if not isinstance(review.get('selectors'), list) or not review['selectors']:
                reject(f'missing exact selectors: {rid}')
            facilities = set()
            record_ids = []
            for selector in review['selectors']:
                if not isinstance(selector, dict) or set(selector) != {'facilityId', 'recordSHA256'}:
                    reject(f'exact facilityId and recordSHA256 selector required: {rid}')
                if not re.fullmatch('[a-f0-9]{64}', selector['recordSHA256']):
                    reject(f'invalid record hash: {rid}')
                key = (selector['facilityId'], selector['recordSHA256'])
                if key not in records:
                    reject(f'stale or out-of-scope selector: {rid}/{key[0]}')
                if key in matched:
                    reject(f'overlapping source reviews: {rid}/{key[0]}')
                matched.add(key)
                row = records[key]
                if row['snapshot']['status'] != 'verified' and review['status'] in ('conditional', 'usable'):
                    reject(f'unverified coordinate snapshot cannot be usable: {rid}/{key[0]}')
                row.update(source=source, termsStatus=review['status'], reviewId=rid,
                           sourceInterpretation='explicit review of this exact record; not domain-wide approval')
                facilities.add(key[0])
                record_ids.append(dict(facilityId=key[0], recordSHA256=key[1]))
            reviews.append(dict(review, facilityIds=sorted(facilities),
                                matchedRecords=sorted(record_ids, key=lambda r: (r['facilityId'], r['recordSHA256']))))

    rows = sorted(records.values(), key=lambda r: (r['facilityId'], r['recordSHA256']))
    for row in rows:
        row['origins'].sort()
    groups = {}
    for row in rows:
        assessed = row['reviewId'] is not None
        # Unknown records stay grouped by recorded provenance, not guessed provider.
        identity = row['source'] if assessed else {
            'sourceUrl': row['evidence'].get('sourceUrl'),
            'sourceLocator': row['evidence'].get('sourceLocator'),
            'verificationMethod': row['evidence'].get('verificationMethod')}
        key = digest(dict(assessed=assessed, identity=identity))
        group = groups.setdefault(key, dict(id=key, identityStatus='reviewed' if assessed else 'unassessed',
                                            identity=identity, facilityIds=[], records=[]))
        group['facilityIds'].append(row['facilityId'])
        group['records'].append(dict(facilityId=row['facilityId'], recordSHA256=row['recordSHA256'],
                                     adoption=row['adoption'], termsStatus=row['termsStatus']))
    for group in groups.values():
        group['facilityIds'] = sorted(set(group['facilityIds']))
    # Fail if any input changed during assembly or evidence verification.
    for name, expected in hashes.items():
        if hashlib.sha256(repo_path(root, name).read_bytes()).hexdigest() != expected:
            reject(f'input changed during inventory: {name}')
    return dict(schema=1, evaluatedAt=as_of, inputSHA256=dict(sorted(hashes.items())),
                definitions=dict(adopted='coordinates in assembled ledger; not distribution/inventory confirmation',
                                 candidate='unselected distinct facilityId+recordSHA256 rows in explicit candidate files',
                                 snapshot='bytes/hash checked; coordinate interpretation is not automatically verified',
                                 terms='exact record review only; absent review is unreviewed, never inferred from a URL'),
                coverage=dict(manifest=manifest, candidateFiles=candidate_paths,
                              registry=registry, allRepositoryCandidatesScanned=False,
                              listingAcquiredAt=None, generatedDataCompared=False,
                              exclusions=['unresolved rows without coordinate proposals',
                                          'candidate files not explicitly listed',
                                          'browser-generated data; this tool inventories canonical ledger and proposals']),
                summary=dict(adoptedFacilities=len(adopted_ids),
                             adoptedRecords=sum(r['adoption'] != 'candidate' for r in rows),
                             candidateRecords=sum(r['adoption'] == 'candidate' for r in rows),
                             termsStatus=dict(sorted(Counter(r['termsStatus'] for r in rows).items()))),
                records=rows, sourceGroups=[groups[k] for k in sorted(groups)],
                reviews=sorted(reviews, key=lambda r: r['id']))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--manifest', default='tools/national/manifest.json')
    parser.add_argument('--candidates', action='append', default=[], help='additional candidate file (repeatable)')
    parser.add_argument('--no-default-candidates', action='store_true')
    parser.add_argument('--registry')
    parser.add_argument('--as-of', required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.out.exists():
            reject('output already exists')
        output = args.out.resolve()
        if output.is_relative_to((args.root / 'data/work/issue7-baseline').resolve()):
            reject('output in fixed Issue7 baseline is forbidden')
        if output.is_relative_to((args.root / 'data').resolve()) and not output.is_relative_to((args.root / 'data/work').resolve()):
            reject('output in source data tree is forbidden')
        candidates = ([] if args.no_default_candidates else list(DEFAULT_CANDIDATES)) + args.candidates
        result = inventory(args.root, args.manifest, candidates, args.registry, args.as_of)
        with args.out.open('x', encoding='utf-8') as handle:
            handle.write(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    except (ValueError, KeyError, TypeError, IndexError, OSError) as err:
        parser.exit(1, f'source inventory failed: {err}\n')


if __name__ == '__main__':
    main()
