"""Offline reviewed ledger assembly. No network, raw nationwide data, or glob input."""
import argparse
import copy
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import sys
from urllib.parse import urlsplit


def reject(message):
    raise ValueError(message)


def unique_object(pairs):
    out = {}
    for key, value in pairs:
        if key in out:
            reject(f'duplicate JSON key: {key}')
        out[key] = value
    return out


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'), object_pairs_hook=unique_object,
                      parse_constant=lambda value: reject(f'invalid number: {value}'))


def exact(left, right):
    # Python otherwise considers True == 1. Object member order is immaterial.
    return json.dumps(left, sort_keys=True, ensure_ascii=False) == json.dumps(right, sort_keys=True, ensure_ascii=False)


def repo_path(root, name):
    path = (root / name).resolve()
    if Path(name).is_absolute() or not path.is_relative_to(root.resolve()):
        reject(f'path outside repository: {name}')
    return path


def evidence(root, ev):
    url = urlsplit(ev['sourceUrl'])
    if url.scheme not in ('https', 'http') or not url.hostname or url.username:
        reject('invalid evidence URL')
    if ev['actorType'] not in ('ai', 'human') or not ev['sourceLocator'].strip() or not ev['verificationMethod'].strip():
        reject('missing evidence details')
    original = ev['checkedAt']
    if len(original) == 10:
        day = dt.date.fromisoformat(original).isoformat()
    else:
        timestamp = dt.datetime.fromisoformat(original.replace('Z', '+00:00'))
        if timestamp.tzinfo is None:
            reject('checkedAt timestamp requires timezone')
        day = timestamp.date().isoformat()
    digest = hashlib.sha256(repo_path(root, ev['snapshotPath']).read_bytes()).hexdigest()
    if digest != ev['snapshotSHA256']:
        reject(f'evidence hash mismatch: {ev["snapshotPath"]}')
    return dict(ev, checkedAt=day)


def coordinate(value):
    """Validate geographic numbers, independent of map projection/viewport limits."""
    if not isinstance(value, dict) or set(value) != {'lat', 'lng'}:
        reject('coordinate requires exactly lat and lng')
    for key, limit in [('lat', 90), ('lng', 180)]:
        n = value[key]
        if type(n) not in (float, int) or not math.isfinite(n) or not -limit <= n <= limit:
            reject(f'invalid coordinate {key}: {n}')


def identity(collection, row):
    fields = ('id',) if collection == 'places' else ('cardId', 'placeId')
    key = tuple(row[f] for f in fields)
    if not all(isinstance(v, str) and v for v in key):
        reject('empty or invalid identity')
    return key


def apply_patches(inputs, patches, root):
    out = copy.deepcopy(inputs)
    touched = {}
    for p in patches:
        target, collection, match = p['target'], p['collection'], p['match']
        if target not in out or collection not in ('places', 'relations') or not match:
            reject(f'invalid patch target: {target}/{collection}')
        rows = out[target][collection]
        matches = [i for i, row in enumerate(rows) if all(k in row and exact(row[k], v) for k, v in match.items())]
        if len(matches) != 1:
            reject(f'patch must match exactly one row: {target}/{match}')
        index = matches[0]
        field = p.get('field')
        key = (target, collection, index)
        fields = touched.setdefault(key, set())
        if field in fields or None in fields or (field is None and fields):
            reject(f'duplicate/overlapping patch: {key}/{field}')
        fields.add(field)
        row = rows[index]
        if field is not None:
            exists = p.get('oldExists', True)
            if type(exists) is not bool or (field in row) != exists or (exists and not exact(row[field], p['old'])):
                reject(f'exact old mismatch: {key}/{field}')
        elif not exact(row, p['old']):
            reject(f'exact old mismatch: {key}')
        if p['new'] is None:
            reject('deletion is not approved')
        evidence(root, p['evidence'])
        if field is None:
            rows[index] = copy.deepcopy(p['new'])
        else:
            row[field] = copy.deepcopy(p['new'])
    return out


def merge(inputs):
    out = dict(schema=1, places=[], relations=[])
    for ledger in inputs:
        if type(ledger.get('schema')) is not int or ledger['schema'] != 1 or set(ledger) != {'schema', 'places', 'relations'}:
            reject('unsupported ledger schema')
    for collection in ('places', 'relations'):
        rows = {}
        for ledger in inputs:
            for row in ledger[collection]:
                key = identity(collection, row)
                if key in rows and not exact(rows[key], row):
                    reject(f'conflicting {collection}: {key}')
                rows[key] = copy.deepcopy(row)
        out[collection] = [rows[k] for k in sorted(rows)]
    aliases = set()
    ids = {p['id'] for p in out['places']}
    for p in out['places']:
        for alias in p['legacyIds']:
            if alias in aliases:
                reject(f'legacy alias collision: {alias}')
            aliases.add(alias)
        if 'coordinate' in p:
            coordinate(p['coordinate'])
    for r in out['relations']:
        if r['placeId'] not in ids:
            reject(f'unknown facility: {r["placeId"]}')
    return out


def apply_locations(ledger, updates, root):
    out = copy.deepcopy(ledger)
    places = {p['id']: p for p in out['places']}
    audit = []
    seen = set()
    for update in updates:
        fid = update['facilityId']
        if fid in seen:
            reject(f'duplicate coordinate update: {fid}')
        seen.add(fid)
        if fid not in places:
            reject(f'unknown location facility: {fid}')
        place = places[fid]
        if 'coordinate' in place:
            reject(f'existing coordinate cannot be overwritten: {fid}')
        coordinate(update['coordinate'])
        if 'approvalMode' in update or update.get('scope') == 'user-designated-center':
            from manual_user_approval import validate
            validate(root, update, place)
        normalized = evidence(root, update['evidence'])
        audit.append(dict(facilityId=fid, originalEvidence=copy.deepcopy(update['evidence']),
                          previousEvidence=copy.deepcopy(place['evidence'])))
        place['coordinate'] = copy.deepcopy(update['coordinate'])
        place['evidence'] = normalized
    return out, audit


def normalize_patch(kind, row):
    if kind == 'south':
        target = row['sourceFile']
        if target == 'data/work/national-input/places.json':
            target = 'data/overrides/places.json'
        return dict(target=target, collection=row['collection'], match=row['key'],
                    old=row['previous'], new=row['replacement'], evidence=row['evidence'])
    if kind == 'field':
        return dict(target=row['file'], collection=row['collection'], match=row['match'],
                    field=row['field'], oldExists=row.get('oldExists', True),
                    old=row['old'], new=row['new'], evidence=row['evidence'])
    if kind == 'west':
        return dict(target=row['target'], collection=row['collection'], match=row['key'],
                    old=row['old'], new=row['new'], evidence=row['evidence'])
    if kind == 'north-kanto':
        collection = row['section']
        fields = ('id',) if collection == 'places' else ('cardId', 'placeId')
        return dict(target=row['targetFile'], collection=collection,
                    match={k: row['old'][k] for k in fields}, old=row['old'], new=row['new'], evidence=row['evidence'])
    if kind == 'chubu' and row['op'] == 'replace-relation':
        return dict(target=row['file'], collection='relations', match=row['match'],
                    old=row['old'], new=row['new'], evidence=row['evidence'])
    reject(f'unsupported patch adapter: {kind}')


def load_selection(root, manifest):
    if manifest['schema'] != 1:
        reject('unsupported manifest schema')
    inputs = {}
    for name in manifest['inputs']:
        if name in inputs:
            reject(f'duplicate input: {name}')
        inputs[name] = read_json(repo_path(root, name))
    patches = []
    for selection in manifest['patches']:
        document = read_json(repo_path(root, selection['path']))
        rows = document[selection['collection']]
        # Explicit indexes plus full file hash pin the reviewed selection; new proposals cannot sneak in.
        if hashlib.sha256(repo_path(root, selection['path']).read_bytes()).hexdigest() != selection['sha256']:
            reject(f'patch manifest hash mismatch: {selection["path"]}')
        for index in selection['indexes']:
            patches.append(normalize_patch(selection['adapter'], rows[index]))
    updates = []
    for selection in manifest['locations']:
        document = read_json(repo_path(root, selection['path']))
        by_id = {}
        for row in document['updates']:
            fid = row['facilityId']
            if fid in by_id:
                reject(f'duplicate coordinate in source: {fid}')
            by_id[fid] = row
        for approved in selection['approved']:
            fid = approved['facilityId']
            if fid not in by_id:
                reject(f'approved location missing: {fid}')
            row = by_id[fid]
            digest = hashlib.sha256(json.dumps(row, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
            if digest != approved['sha256']:
                reject(f'approved location changed: {fid}')
            updates.append(row)
    return inputs, patches, updates


def assemble(root, manifest):
    inputs, patches, updates = load_selection(root, manifest)
    patched = apply_patches(inputs, patches, root)
    merged = merge(list(patched.values()))
    # Check original facility evidence too, before location evidence supersedes it.
    for collection in ('places', 'relations'):
        for row in merged[collection]:
            normalized = evidence(root, row['evidence'])
            if normalized != row['evidence']:
                reject('ledger evidence checkedAt must already be a date')
    output, audit = apply_locations(merged, updates, root)
    lifecycle_audit = None
    selections = manifest.get('locationLifecycle', [])
    if selections:
        from location_lifecycle import apply as apply_lifecycle
        documents = []
        seen = set()
        for selection in selections:
            if set(selection) != {'path', 'sha256'} or selection['path'] in seen:
                reject('invalid or duplicate lifecycle selection')
            seen.add(selection['path'])
            path = repo_path(root, selection['path'])
            raw = path.read_bytes()
            if hashlib.sha256(raw).hexdigest() != selection['sha256']:
                reject('location lifecycle selection hash mismatch')
            documents.append(json.loads(raw, object_pairs_hook=unique_object,
                                        parse_constant=lambda value: reject(f'invalid number: {value}')))
        output, lifecycle_audit = apply_lifecycle(root, output, updates, documents)
    paths = manifest['inputs'] + [s['path'] for s in manifest['patches'] + manifest['locations'] + selections]
    hashes = {name: hashlib.sha256(repo_path(root, name).read_bytes()).hexdigest() for name in paths}
    for selection in selections:
        if hashes[selection['path']] != selection['sha256']:
            reject('location lifecycle input changed during assembly')
    return output, dict(schema=1, inputSHA256=hashes, patchesApplied=len(patches),
                        locationsApplied=len(updates), locations=audit, **({'locationLifecycle': lifecycle_audit} if lifecycle_audit is not None else {}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--manifest', default='tools/national/manifest.json')
    parser.add_argument('--out', type=Path, help='default: stdout')
    parser.add_argument('--audit-out', type=Path, help='optional original location evidence and timestamps')
    args = parser.parse_args()
    try:
        result, audit = assemble(args.root, read_json(repo_path(args.root, args.manifest)))
        # Reject outputs in data (except data/work) and overwriting the manifest.
        for path in (args.out, args.audit_out):
            if path is not None and path.resolve().is_relative_to((args.root / 'data').resolve()) and not path.resolve().is_relative_to((args.root / 'data/work').resolve()):
                reject('output in source data tree is forbidden')
            if path is not None and path.resolve() == repo_path(args.root, args.manifest):
                reject('cannot overwrite manifest')
        if args.out and args.audit_out and args.out.resolve() == args.audit_out.resolve():
            reject('ledger and audit output paths must differ')
        serialized = json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n'
        if args.out:
            args.out.write_text(serialized, encoding='utf-8')
        else:
            sys.stdout.write(serialized)
        if args.audit_out:
            args.audit_out.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    except (ValueError, KeyError, TypeError, IndexError, OSError) as err:
        parser.exit(1, f'assembly failed: {err}\n')


if __name__ == '__main__':
    main()
