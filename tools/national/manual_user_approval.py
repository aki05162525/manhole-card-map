"""Issue60's explicit user exception, separate from independent location review.

The fixed scope is deliberately not a general bypass of the adoption gate.
"""
import hashlib
from assemble import exact, read_json, repo_path, reject
from location_lifecycle import digest

PREFIX = 'data/national/issue60/manual-user-approval'
SOURCE = 'data/evidence/issue60/manual-user-approval'
POINTS = {
    'facility:kanto-south-8d82eff13732778fad69': {'lat': 35.73177, 'lng': 139.22852},
    'facility:kanto-south-b8a0f5c7b930cf13dc47': {'lat': 35.25792, 'lng': 139.66228},
    'facility:kanto-south-f4a2060d8b43f0ac3acb': {'lat': 35.57720, 'lng': 140.38395},
}
REASON = '利用者指定採用（位置・利用条件は未検証）'


def validate(root, update, place):
    fid = update['facilityId']
    if (update.get('approvalMode') != 'manual-user-approval' or
            update.get('scope') != 'user-designated-center' or
            fid not in POINTS or not exact(update['coordinate'], POINTS[fid]) or
            update.get('positionValidation') != 'not-independently-verified' or
            update.get('usageTerms') != 'not-verified' or
            update.get('coordinateSource') != 'user-report-google-acquisition-unverified' or
            update.get('expectedOldPlaceSHA256') != digest(place)):
        reject('invalid manual user approval or old place mismatch')
    ev = update['evidence']
    if (ev['snapshotPath'] != SOURCE + '/decision.json' or ev['actorType'] != 'human'):
        reject('manual user approval requires its explicit decision evidence')
    decision = read_json(repo_path(root, ev['snapshotPath']))
    if (decision['approvalMode'] != 'manual-user-approval' or
            decision['approvedCoordinates'] != POINTS or
            decision['expectedOldPlaceSHA256'].get(fid) != digest(place)):
        reject('manual user decision scope changed')
    for path, sha in decision['inputSHA256'].items():
        if hashlib.sha256(repo_path(root, path).read_bytes()).hexdigest() != sha:
            reject('manual user approval input hash mismatch: ' + path)
