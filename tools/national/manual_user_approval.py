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
ADDITIONAL_SOURCE = 'data/evidence/issue60/manual-user-additional'
ADDITIONAL_POINTS = {
    'facility:kanto-south-c673e03f2340f9a5bfef': {'lat': 35.710431, 'lng': 139.805807},
    'facility:kanto-south-integration-10': {'lat': 35.18845, 'lng': 139.65330},
    'facility:kanto-south-integration-legacy-yachiyo-1': {'lat': 35.72350, 'lng': 140.10600},
}
APPROVAL_GROUPS = {SOURCE + '/decision.json': POINTS.copy(), ADDITIONAL_SOURCE + '/decision.json': ADDITIONAL_POINTS}
POINTS = POINTS | ADDITIONAL_POINTS
SITE_ID = 'facility:kanto-south-integration-legacy-yachiyo-1'
SITE_REASON = '利用者指定の旧敷地代表点（単体棟・位置精度・利用条件は未検証）'
REASON = '利用者指定採用（位置・利用条件は未検証）'


def validate(root, update, place):
    fid = update['facilityId']
    if (update.get('approvalMode') != 'manual-user-approval' or
            update.get('scope') != ('user-designated-historical-site' if fid == SITE_ID else 'user-designated-center') or
            fid not in POINTS or not exact(update['coordinate'], POINTS[fid]) or
            update.get('positionValidation') != 'not-independently-verified' or
            update.get('usageTerms') != 'not-verified' or
            update.get('coordinateSource') != 'user-report-google-acquisition-unverified' or
            update.get('expectedOldPlaceSHA256') != digest(place)):
        reject('invalid manual user approval or old place mismatch')
    ev = update['evidence']
    if (ev['snapshotPath'] not in APPROVAL_GROUPS or ev['actorType'] != 'human'):
        reject('manual user approval requires its explicit decision evidence')
    decision = read_json(repo_path(root, ev['snapshotPath']))
    if (decision['approvalMode'] != 'manual-user-approval' or
            decision['approvedCoordinates'] != APPROVAL_GROUPS[ev['snapshotPath']] or
            fid not in decision['approvedCoordinates'] or
            decision['expectedOldPlaceSHA256'].get(fid) != digest(place)):
        reject('manual user decision scope changed')
    for path, sha in decision['inputSHA256'].items():
        if hashlib.sha256(repo_path(root, path).read_bytes()).hexdigest() != sha:
            reject('manual user approval input hash mismatch: ' + path)
