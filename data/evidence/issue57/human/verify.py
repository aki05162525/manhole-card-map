"""Check received-answer bookkeeping; does not approve locations or source meanings."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]

def read(path):
    return json.loads((ROOT / path).read_text())

queue = read('data/national/issue57/human-confirmation-queue.json')
responses = read('data/national/issue57/human-responses.json')['responses']
crosscheck = read('data/evidence/issue57/human/source-crosscheck.json')['rows']
assert len(queue['answered']) == len(responses) == len(crosscheck) == 34
assert not queue['pending']
assert len({r['id'] for r in responses}) == 34
ids = [fid for r in responses for fid in r['facilityIds']]
assert len(ids) == len(set(ids)) == 40
for i, (answer, row, check) in enumerate(zip(responses, queue['answered'], crosscheck)):
    assert answer['checkedAt'] == '2026-11-05'
    assert not answer['adoptionApproval'] and not row['adoptionApproval']
    assert answer['facilityIds'] == row['facilityIds'] == check['facilityIds']
    assert answer['id'] == row['id'] == check['responseId']
    assert row['answerRef'].endswith('/responses/' + str(i))
    if i < 8:
        assert not answer['sourceURLs'] and not answer['sourceURLProvided']
    for source in check['urls']:
        assert source['userProvidedURL'] in answer['sourceURLs']
        for saved in source['matchingSavedEvidence']:
            actual = hashlib.sha256((ROOT / saved['snapshotPath']).read_bytes()).hexdigest()
            assert actual == saved['recordedSHA256'] == saved['actualSHA256']
            assert saved['hashMatches']
print('PASS: 34 response groups / 40 unique facility IDs / 0 pending / 0 location approvals; matched saved SHA256 verified')
