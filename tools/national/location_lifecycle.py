"""Opt-in location bindings and reviewed, hash-chained decisions.

Archive state remains in the audit. Browser ledgers receive only current coordinates
and a compact locationReview; old coordinates never become fallback destinations.
"""
import copy
import datetime as dt
import hashlib
import json

from assemble import coordinate, evidence, exact, reject


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def fields(value, required, optional=()):
    if not isinstance(value, dict) or not set(required) <= set(value) or set(value) - set(required) - set(optional):
        reject('invalid location lifecycle fields')


def text(value):
    if not isinstance(value, str) or not value.strip():
        reject('missing location lifecycle text')
    return value


def day(value):
    if not isinstance(value, str) or dt.date.fromisoformat(value).isoformat() != value:
        reject('location lifecycle date must be YYYY-MM-DD')
    return value


def identity(value):
    fields(value, ('name', 'address'))
    for v in value.values():
        text(v)
    return copy.deepcopy(value)


def apply(root, ledger, updates, documents):
    out = copy.deepcopy(ledger)
    places = {p['id']: p for p in out['places']}
    adopted = {}
    for update in updates:
        fid = update['facilityId']
        if fid in adopted:
            reject(f'duplicate adopted location: {fid}')
        adopted[fid] = update
    bindings, events, groups = {}, [], {}
    for document in documents:
        fields(document, ('schema', 'bindings', 'events', 'groups'))
        if type(document['schema']) is not int or document['schema'] != 1:
            reject('unsupported location lifecycle schema')
        for key in ('bindings', 'events', 'groups'):
            if not isinstance(document[key], list):
                reject('location lifecycle collections must be arrays')
        for binding in document['bindings']:
            fields(binding, ('facilityId', 'identity', 'adoption', 'adoptionSHA256'), ('sourceVersion', 'reviewDue'))
            fid = text(binding['facilityId'])
            if fid not in places or fid in bindings:
                reject(f'unknown or duplicate location binding: {fid}')
            snapshot = binding['adoption']
            if not isinstance(snapshot, dict) or snapshot.get('facilityId') != fid or digest(snapshot) != binding['adoptionSHA256']:
                reject(f'location adoption hash mismatch: {fid}')
            coordinate(snapshot['coordinate'])
            ev = evidence(root, snapshot['evidence'])
            state = dict(identity=identity(binding['identity']), coordinate=copy.deepcopy(snapshot['coordinate']),
                         evidence=ev, status='confirmed', addressStatus='valid', reason=('Adopted facility representative point' if snapshot.get('scope') == 'facility' else 'Adopted building representative point'),
                         decisionId='', reviewedAt=ev['checkedAt'], sourceVersion=binding.get('sourceVersion', ''),
                         reviewDue=binding.get('reviewDue', ''))
            if snapshot.get('approvalMode') == 'manual-user-approval':
                from manual_user_approval import REASON, SITE_ID, SITE_REASON
                state['reason'] = SITE_REASON if fid == SITE_ID else REASON
            if state['sourceVersion']:
                text(state['sourceVersion'])
            if state['reviewDue']:
                day(state['reviewDue'])
            if fid in adopted and digest(adopted[fid]) != binding['adoptionSHA256']:
                reject(f'current adoption differs from bound adoption: {fid}')
            current = places[fid].get('coordinate')
            if current is not None and (not exact(current, state['coordinate']) or not exact(places[fid]['evidence'], ev)):
                reject(f'current coordinate/evidence differs from bound baseline: {fid}')
            bindings[fid] = dict(binding=copy.deepcopy(binding), state=state, history=[], selected=fid in adopted,
                                 baselinePresent=current is not None)
        events.extend(document['events'])
        for group in document['groups']:
            fields(group, ('id', 'facilityIds', 'evidence'))
            gid = text(group['id'])
            if gid in groups or not isinstance(group['facilityIds'], list) or len(group['facilityIds']) < 2 or len(set(group['facilityIds'])) != len(group['facilityIds']):
                reject('invalid or duplicate explicit building group')
            evidence(root, group['evidence'])
            groups[gid] = copy.deepcopy(group)
    seen_events = set()
    for event in events:
        fields(event, ('id', 'facilityId', 'action', 'previousSHA256', 'reason', 'reasonType', 'identity',
                       'evidence', 'preparedBy', 'reviewedBy', 'reviewedAt', 'addressStatus'),
               ('coordinate', 'sourceVersion', 'reviewDue'))
        eid, fid = text(event['id']), text(event['facilityId'])
        if eid in seen_events or fid not in bindings:
            reject('unknown binding or duplicate location decision')
        seen_events.add(eid)
        entry = bindings[fid]
        previous = entry['state']
        if digest(previous) != event['previousSHA256']:
            reject(f'location decision previous state mismatch: {eid}')
        action = event['action']
        if action not in ('reaffirm', 'correct', 'withdraw'):
            reject('invalid location decision action')
        if action == 'reaffirm' and event['reasonType'] in ('relocation', 'source-withdrawal'):
            reject('relocation or source withdrawal cannot reaffirm an old coordinate')
        if event['reasonType'] not in ('spelling', 'relocation', 'source-withdrawal', 'evidence-update'):
            reject('invalid location decision reasonType')
        if text(event['preparedBy']).strip() == text(event['reviewedBy']).strip():
            reject('location decision requires independent reviewer')
        reviewed = day(event['reviewedAt'])
        if reviewed < previous['reviewedAt']:
            reject('location decisions must be chronological')
        ev = evidence(root, event['evidence'])
        if ev['checkedAt'] > reviewed:
            reject('location decision predates its evidence')
        address_status = event['addressStatus']
        if address_status not in ('valid', 'needs-review'):
            reject('invalid reviewed address status')
        if action == 'withdraw':
            if 'coordinate' in event:
                reject('withdrawal must not contain a new coordinate')
            co = None
        else:
            coordinate(event.get('coordinate'))
            co = copy.deepcopy(event['coordinate'])
            if address_status != 'valid':
                reject('confirmed location requires valid current address')
            if action == 'reaffirm' and not exact(co, previous['coordinate']):
                reject('reaffirm must retain the previous coordinate')
            if action == 'correct' and exact(co, previous['coordinate']):
                reject('correct must change the previous coordinate')
        state = dict(identity=identity(event['identity']), coordinate=co, evidence=ev,
                     status='withdrawn' if action == 'withdraw' else 'confirmed',
                     addressStatus=address_status, reason=text(event['reason']), decisionId=eid,
                     reviewedAt=reviewed, sourceVersion=event.get('sourceVersion', previous['sourceVersion']),
                     reviewDue=event.get('reviewDue', ''))
        if state['sourceVersion']:
            text(state['sourceVersion'])
        if state['reviewDue']:
            day(state['reviewDue'])
        entry['history'].append(dict(event=copy.deepcopy(event), previousState=copy.deepcopy(previous),
                                     nextState=copy.deepcopy(state), nextSHA256=digest(state)))
        entry['state'] = state
    pending = set()
    for fid, entry in bindings.items():
        # Removing a manifest selection alone cannot silently delete its history.
        if not entry['baselinePresent'] and entry['state']['status'] != 'withdrawn':
            reject(f'bound adoption disappeared without withdrawal: {fid}')
        current_identity = {k: places[fid][k] for k in ('name', 'address')}
        if not exact(current_identity, entry['state']['identity']):
            pending.add(fid)
    impacts = []
    group_pending = set()
    grouped = set()
    for gid, group in sorted(groups.items()):
        ids = group['facilityIds']
        if grouped.intersection(ids):
            reject('facility cannot belong to overlapping building groups')
        grouped.update(ids)
        if any(fid not in bindings for fid in ids):
            reject('building group must reference explicit location bindings')
        triggers = sorted(fid for fid in ids if fid in pending or bindings[fid]['history'])
        if triggers:
            impacts.append(dict(groupId=gid, facilityIds=sorted(ids), triggerFacilityIds=triggers,
                                evidence=group['evidence']))
        if pending.intersection(ids):
            group_pending.update(ids)
    audit, queue = [], []
    for fid, entry in sorted(bindings.items()):
        place, state = places[fid], entry['state']
        review = {k: state[k] for k in ('status', 'addressStatus', 'reason', 'decisionId', 'reviewedAt', 'sourceVersion', 'reviewDue') if state[k] != ''}
        if fid in pending or fid in group_pending:
            review.update(status='needs-review', addressStatus='needs-review',
                          reason='Facility identity changed since location review' if fid in pending else 'A reviewed building group member changed identity')
        if review['status'] == 'confirmed':
            place['coordinate'] = copy.deepcopy(state['coordinate'])
        else:
            place.pop('coordinate', None)
        place['locationReview'] = review
        place['evidence'] = copy.deepcopy(state['evidence'])
        if state['reviewDue']:
            queue.append(dict(facilityId=fid, reviewDue=state['reviewDue'], sourceVersion=state['sourceVersion'],
                              reason='Reconfirmation schedule only; not automatic invalidation'))
        audit.append(dict(facilityId=fid, binding=entry['binding'], state=state, stateSHA256=digest(state),
                          history=entry['history'], effectiveReview=review, selectionPresent=entry['selected']))
    return out, dict(facilities=audit, groupImpacts=impacts, reviewQueue=queue)
