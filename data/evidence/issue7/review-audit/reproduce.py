"""Independent adversarial checks; fixtures live only in TemporaryDirectory.
Run: PYTHONDONTWRITEBYTECODE=1 python data/evidence/issue7/review-audit/reproduce.py
Uses preserved reviewed sources so concurrent parent edits do not change results.
"""
import copy
import hashlib
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / 'source'))
from test_issue7_audit import AuditTests
import coverage

results = []
def case(name, action):
    fixture = AuditTests()
    fixture.setUp()
    try:
        detail = action(fixture)
        results.append(dict(case=name, passed=True, detail=detail))
    except Exception as exc:
        results.append(dict(case=name, passed=False, error=repr(exc)))
    finally:
        fixture.doCleanups()

def rejected(f, mutate, **kwargs):
    mutate(f)
    try:
        f.run_audit(**kwargs)
    except (ValueError, KeyError, TypeError) as exc:
        return str(exc)
    raise AssertionError('invalid input accepted')

def full(f, co=None, pins=None, pid='facility:0'):
    f.write('full.json', dict(schema=1, places=[dict(id=pid, coordinate=co or dict(status='confirmed',lat=35,lng=139))], pins=pins or []))

def expect(result, **counts):
    for key, value in counts.items():
        assert result['summary'][key] == value, (key,result['summary'][key],value)
    return counts

case('missing assignment classification', lambda f: rejected(f, lambda f: f.change_region(lambda d: d['unresolved'].pop())))
case('candidate and unresolved collision', lambda f: rejected(f, lambda f: f.change_region(lambda d: d['updates'].append(f.row))))
case('cross region classification', lambda f: rejected(f, lambda f: f.change_region(lambda d: d['unresolved'][0].update(facilityId='facility:1'))))
case('duplicate baseline assignment', lambda f: rejected(f, lambda f: (f.assignments['tohoku'].append('facility:0'), f.write('baseline.json', dict(schema=1,assignments=f.assignments,baselineLocationIds=[f'facility:old{n}' for n in range(642)])))))
case('hash covers noncoordinate metadata', lambda f: rejected(f, lambda f: f.write('followup.json', dict(schema=1,updates=[dict(f.row,reason='changed after approval')]))))
case('approval points to absent update', lambda f: rejected(f, lambda f: f.write('followup.json',dict(schema=1,updates=[]))))
case('duplicate selected ID', lambda f: rejected(f, lambda f: f.write('manifest.json',dict(schema=1,locations=f.manifest['locations']*2))))
case('duplicate JSON key', lambda f: rejected(f, lambda f: (f.root/'manifest.json').write_text('{"schema":1,"schema":1,"locations":[]}')))
case('NaN in selected coordinate', lambda f: rejected(f, lambda f: f.write('followup.json',dict(schema=1,updates=[dict(f.row,coordinate=dict(lat=float('nan'),lng=139))]))))
case('path traversal', lambda f: rejected(f, lambda f: f.write('manifest.json',dict(schema=1,locations=[dict(path='../outside.json',approved=[])]))))

def separation(f):
    f.change_region(lambda d: (d['unresolved'].pop(1),d['updates'].append(dict(facilityId='facility:13',coordinate=dict(lat=35,lng=139)))))
    r=f.run_audit()
    expect(r, regionalCandidates=1,originalUnresolved=809,currentAdopted=1,currentRemaining=809,candidateNotAdopted=1,currentIntegrated=None,targetPins=None,ledgerAdoptedMatches=None)
    rows={x['facilityId']:x for x in r['facilities']}
    assert rows['facility:0']['originalClassification']=='unresolved'
    assert rows['facility:0']['original']['attempts']==[]
    assert rows['facility:13']['currentStatus']=='remaining'
    return r['summary']
case('original candidate and followup remain distinct',separation)

def all_adopted(f):
    rows=[dict(facilityId=i,coordinate=dict(lat=35,lng=139)) for ids in f.assignments.values() for i in ids]
    f.write('followup.json',dict(schema=1,updates=rows))
    f.write('manifest.json',dict(schema=1,locations=[dict(path='followup.json',approved=[dict(facilityId=r['facilityId'],sha256=f.digest(r)) for r in rows])]))
    r=f.run_audit()
    expect(r,currentAdopted=810,currentRemaining=0,originalUnresolved=810,currentIntegrated=None,targetPins=None)
    assert all(x['original']['attempts']==[] and x['original']['investigationStatus']=='partial' for x in r['facilities'])
    return r['summary']
case('all adopted does not imply generated or deeply investigated',all_adopted)

def stale(f):
    full(f,dict(status='confirmed',lat=36,lng=139))
    f.write('ledger.json',dict(schema=1,places=[dict(id='facility:0',coordinate=dict(lat=36,lng=139))]))
    return expect(f.run_audit(full='full.json',ledger='ledger.json'),currentAdopted=1,currentIntegrated=0,adoptedLocationNotGenerated=1,targetConfirmedLocations=1,ledgerAdoptedMatches=0)
case('stale full and ledger do not count as integrated',stale)

def unselected(f):
    full(f,pid='facility:1',pins=[dict(id='facility:1',kind='place',lat=35,lng=139)])
    return expect(f.run_audit(full='full.json'),currentIntegrated=0,targetConfirmedLocations=1,targetPins=1,adoptedLocationNotGenerated=1)
case('unselected confirmed pin does not count as adoption',unselected)

def candidate(f):
    full(f,dict(status='candidate',lat=35,lng=139),[dict(id='facility:0',kind='place',reference=True,lat=35,lng=139)])
    return expect(f.run_audit(full='full.json'),currentIntegrated=0,targetConfirmedLocations=0,targetPins=0)
case('matching candidate with reference pin is not confirmed',candidate)
case('pin at stale coordinate',lambda f: rejected(f,lambda f: full(f,pins=[dict(id='facility:0',kind='place',lat=36,lng=139)]),full='full.json'))
case('duplicate nonreference pins',lambda f: rejected(f,lambda f: full(f,pins=[dict(id='facility:0',kind='place',lat=35,lng=139)]*2),full='full.json'))
case('boolean confirmed coordinate',lambda f: rejected(f,lambda f: full(f,dict(status='confirmed',lat=True,lng=139)),full='full.json'))
case('duplicate ledger IDs',lambda f: rejected(f,lambda f: f.write('ledger.json',dict(schema=1,places=[dict(id='facility:0')]*2)),ledger='ledger.json'))

def ledger_only(f):
    f.write('ledger.json',dict(schema=1,places=[dict(id='facility:0',coordinate=f.row['coordinate'])]))
    return expect(f.run_audit(ledger='ledger.json'),ledgerAdoptedMatches=1,currentIntegrated=None,targetPins=None)
case('ledger alone does not imply generated full',ledger_only)

def numeric(f):
    full(f)
    f.write('ledger.json',dict(schema=1,places=[dict(id='facility:0',coordinate=dict(lat=35.0,lng=139.0))]))
    return expect(f.run_audit(full='full.json',ledger='ledger.json'),currentIntegrated=1,ledgerAdoptedMatches=0)
case('OBSERVATION equal numeric int float ledger mismatch',numeric)

def invalid_candidate(f):
    full(f,dict(status='candidate',lat=999,lng=139))
    return expect(f.run_audit(full='full.json'),currentIntegrated=0,targetConfirmedLocations=0,targetPins=0)
case('OBSERVATION invalid nonconfirmed full coordinate accepted',invalid_candidate)

def boundary(f):
    d=dict(schema=1,evaluatedAt='2026-11-05',cards=[dict(id='01-test')],places=[dict(id='facility:0',coordinate=dict(status='confirmed',lat=35,lng=139))],relations=[dict(cardId='01-test',placeId='facility:0',review='verified',status='active')],pins=[])
    l=dict(schema=1,places=[dict(id='facility:0',coordinate=f.row['coordinate'])],relations=[dict(cardId='01-test',placeId='facility:0',status='active')])
    f.write('full.json',d); f.write('ledger.json',l)
    r=f.run_audit(full='full.json',ledger='ledger.json')
    expect(r,currentIntegrated=1,ledgerAdoptedMatches=1,targetPins=0)
    try:
        coverage.audit(d,l)
    except ValueError as exc:
        assert 'pin contract mismatch' in str(exc)
        return dict(issue7=r['summary'],coverage_rejection=str(exc))
    raise AssertionError('coverage did not reject missing required pin')
case('coverage owns required pin generation contract',boundary)

output=dict(sourceSHA256={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((HERE/'source').iterdir()) if p.is_file()},results=results)
print(json.dumps(output,ensure_ascii=False,indent=2))
sys.exit(not all(r['passed'] for r in results))
