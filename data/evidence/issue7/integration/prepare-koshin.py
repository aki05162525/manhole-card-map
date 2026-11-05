"""Apply independently reviewed exact corrections to an integration copy."""
import hashlib
import json
from pathlib import Path

source = Path('data/national/issue7/koshin.json')
review_path = Path('data/national/issue7/reviews/koshin.json')
review = json.loads(review_path.read_text())
assert hashlib.sha256(source.read_bytes()).hexdigest() == review['sourceSHA256']
data = json.loads(source.read_text())
for correction in review['requiredCorrections']:
    if correction['targetFile'] != str(source):
        continue
    keys = correction['jsonPointer'].strip('/').split('/')
    target = data
    for key in keys[:-1]:
        target = target[int(key)] if isinstance(target, list) else target[key]
    assert target[keys[-1]] == correction['old']
    target[keys[-1]] = correction['new']
assert {u['facilityId'] for u in data['updates']} == set(review['acceptedAfterRequiredCorrectionsFacilityIds'])
for update in data['updates']:
    assert update['evidence']['checkedAt'] == '2026-11-05'
output = Path('data/national/issue7/koshin-reviewed.json')
output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
print(f'{output}: {len(data["updates"])} reviewed updates; source preserved')
