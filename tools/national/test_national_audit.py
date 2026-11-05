import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

import national_audit as n
from issue7_audit import REGIONS


class NationalAuditTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.write('snapshot', 'original', raw=True)
        self.ev = dict(sourceUrl='https://example.org/place', snapshotPath='snapshot',
                       snapshotSHA256=hashlib.sha256(b'original').hexdigest(), sourceLocator='building',
                       checkedAt='2026-11-05', actorType='ai', verificationMethod='building comparison')
        self.p = dict(id='facility:one', legacyIds=[], name='One', address='A', evidence=self.ev)
        self.q = dict(id='facility:two', legacyIds=[], name='Two', address='A', evidence=self.ev)
        self.source = dict(schema=1, places=[self.p, self.q], relations=[
            dict(cardId='card:one', placeId=self.p['id'], status='active', evidence=self.ev),
            dict(cardId='card:two', placeId=self.q['id'], status='ended', evidence=self.ev)])
        self.write('input.json', self.source)
        self.update = dict(facilityId=self.p['id'], coordinate=dict(lat=35, lng=139), evidence=self.ev)
        self.write('locations.json', dict(schema=1, updates=[self.update]))
        self.manifest = dict(schema=1, inputs=['input.json'], patches=[], locations=[dict(path='locations.json', approved=[dict(facilityId=self.p['id'], sha256=hashlib.sha256(json.dumps(self.update, sort_keys=True, ensure_ascii=False).encode()).hexdigest())])])
        self.write('manifest.json', self.manifest)
        ids = [self.p['id'], self.q['id']] + [f'facility:fixed-{i}' for i in range(808)]
        assignments = {r: ids if i == 0 else [] for i, r in enumerate(REGIONS)}
        self.write('baseline.json', dict(schema=1, assignments=assignments, baselineLocationIds=[f'facility:old-{i}' for i in range(642)]))
        for region, values in assignments.items():
            self.write(f'regions/{region}.json', dict(schema=1, updates=[], unresolved=[dict(facilityId=v, reasonCategory='原典不足', reason='Needs evidence', investigationStatus='new-investigation', attempts=[], nextSource='Official GIS') for v in values]))
        self.full = dict(schema=1, updated='2026-10-21', evaluatedAt='2026-11-05', cards=[dict(id='card:one'), dict(id='card:two'), dict(id='card:outside')], places=[dict(self.p, coordinate=dict(status='confirmed', lat=34, lng=138)), dict(self.q, coordinate=dict(status='unconfirmed')), dict(id='place:outside', name='Outside', address='B', coordinate=dict(status='unconfirmed'))], relations=[dict(cardId='card:one', placeId=self.p['id'], review='verified', status='active', evidence=self.ev), dict(cardId='card:two', placeId=self.q['id'], review='verified', status='ended', evidence=self.ev), dict(cardId='card:outside', placeId='place:outside', review='needs-review', status='unknown')], pins=[])
        self.write('full.json', self.full)

    def write(self, name, value, raw=False):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(value if raw else json.dumps(value, ensure_ascii=False), encoding='utf-8')

    def audit(self, **kw):
        return n.audit(self.root, manifest='manifest.json', baseline='baseline.json', regions_dir='regions', reviews_dir='reviews', proposals_dir='proposals', **kw)

    def rows(self, result):
        return {r['facilityId']: r for r in result['facilities']}

    def test_separate_fixed_nationwide_and_stale_generation(self):
        result = self.audit(full='full.json')
        rows = self.rows(result)
        self.assertEqual(result['fixedAssignment']['currentRemaining'], 809)
        self.assertEqual(result['national']['generatedUnlocated'], 2)
        self.assertFalse(rows['place:outside']['fixedAssignment'])
        self.assertTrue(rows['place:outside']['axes']['relationUnconfirmed'])
        self.assertFalse(rows['facility:one']['generated']['matchesAdopted'])
        self.assertEqual(rows['facility:two']['workStatus'], 'excluded-ended')
        self.assertEqual(rows['facility:two']['investigation']['stage'], 'not-evaluated')
        self.assertIn('facility:two', result['fixedAssignment']['remainingIds'])
        self.assertEqual(result, self.audit(full='full.json'))

    def test_no_optional_inputs_is_unknown_not_zero(self):
        result = self.audit()
        self.assertIsNone(result['national']['generatedUnlocated'])
        self.assertIsNone(result['cards']['missingFromGenerated'])
        self.assertIsNone(self.rows(result)['facility:one']['generated'])
        self.assertIsNone(self.rows(result)['facility:one']['ledgerComparison'])

    def test_new_outside_approval_does_not_break_fixed_audit(self):
        outside = dict(self.p, id='facility:new', legacyIds=[])
        self.source['places'].append(outside)
        self.write('input.json', self.source)
        update = dict(self.update, facilityId='facility:new')
        self.write('locations.json', dict(schema=1, updates=[self.update, update]))
        self.manifest['locations'][0]['approved'].append(dict(facilityId='facility:new', sha256=hashlib.sha256(json.dumps(update, sort_keys=True, ensure_ascii=False).encode()).hexdigest()))
        self.write('manifest.json', self.manifest)
        result = self.audit()
        self.assertIn('facility:new', result['national']['outsideFixedSelectedIds'])
        self.assertEqual(result['fixedAssignment']['currentRemaining'], 809)

    def test_review_deferred_candidate_and_revoke(self):
        region = dict(schema=1, updates=[self.update], unresolved=[dict(facilityId=f'facility:fixed-{i}', reasonCategory='原典不足', reason='Need source', investigationStatus='unknown', attempts=[], nextSource='GIS') for i in range(808)] + [dict(facilityId='facility:two', reasonCategory='原典不足', reason='Need source', investigationStatus='unknown', attempts=[], nextSource='GIS')])
        self.write('regions/hokkaido.json', region)
        self.write('reviews/hokkaido.json', dict(schema=1, reviews=[dict(facilityId='facility:one', status='deferred', reason='Old building')]))
        self.manifest['locations'][0]['approved'] = []
        self.write('manifest.json', self.manifest)
        row = self.rows(self.audit())['facility:one']
        self.assertEqual(row['locationStatus'], 'unlocated')
        self.assertEqual(row['investigation']['reviews'][0]['record']['status'], 'deferred')
        self.assertEqual(row['investigation']['stage'], 'not-evaluated')
        self.assertIsNotNone(row['investigation']['reviews'][0]['ref'])

    def test_duplicates_and_dangling_full_relation_rejected(self):
        for mutate in [lambda d: d['places'].append(d['places'][0]), lambda d: d['relations'][0].update(placeId='missing')]:
            full = copy.deepcopy(self.full)
            mutate(full)
            self.write('bad.json', full)
            with self.assertRaises(ValueError):
                self.audit(full='bad.json')

    def test_proposal_unregistered_and_changed_are_separate(self):
        proposal = copy.deepcopy(self.source)
        proposal['places'].append(dict(self.p, id='facility:proposal'))
        proposal['relations'].append(dict(cardId='card:new', placeId='facility:proposal', status='active', evidence=self.ev))
        proposal['places'][0]['name'] = 'New name'
        self.write('proposals/p.json', proposal)
        result = self.audit()
        self.assertEqual(result['proposals']['unregisteredFacilityIds'], ['facility:proposal'])
        self.assertEqual(result['proposals']['differentFacilityIds'], ['facility:one'])
        self.assertEqual(len(result['proposals']['unregisteredRelations']), 1)

    def test_followups_priority_and_review_queue(self):
        self.write('reviews/hokkaido.json', dict(schema=1, reviews=[dict(facilityId='facility:one', status='deferred')]))
        self.write('followups.json', dict(schema=1, facilities=[dict(facilityId='facility:one', stage='building-comparison', blockers=['relocation'], nextAction='Compare new hall map', stopCondition='No new source', resumeCondition='New map', request=True, regionalGap=False, priorityException='Reported destination error', sourceConditions='review-required', sourceVintage='2022-01-01', references=['reviews/hokkaido.json#/reviews/0'])]))
        result = self.audit(full='full.json', followups='followups.json', as_of='2026-11-05')
        row = self.rows(result)['facility:one']
        self.assertEqual(row['priority']['tier'], 0)
        self.assertEqual(row['investigation']['stage'], 'building-comparison')
        self.assertEqual(result['reconfirmationQueue'][0]['facilityId'], 'facility:one')
        self.assertEqual(row['priority']['exception'], 'Reported destination error')

    def test_listing_requires_source_and_detects_missing_card(self):
        listing = dict(schema=1, source=dict(path='snapshot', sha256=self.ev['snapshotSHA256'], acquired='2026-11-05', method='Reviewed printed card IDs'), cards=[dict(id='card:one'), dict(id='card:missing')])
        self.write('listing.json', listing)
        result = self.audit(full='full.json', listing='listing.json')
        self.assertEqual(result['cards']['missingFromGenerated'], ['card:missing'])
        listing['source']['sha256'] = '0' * 64
        self.write('listing.json', listing)
        with self.assertRaises(ValueError):
            self.audit(full='full.json', listing='listing.json')

    def test_go_omitted_empty_hours_is_not_a_relation_change(self):
        self.source['relations'][1]['hours'] = []
        self.write('input.json', self.source)
        row = self.rows(self.audit(full='full.json'))['facility:two']
        self.assertTrue(row['generated']['matchesCurrentRelations'])
        self.assertEqual(row['workStatus'], 'excluded-ended')

    def test_stale_ended_full_cannot_exclude_current_active_relation(self):
        self.source['relations'][1]['status'] = 'active'
        self.write('input.json', self.source)
        row = self.rows(self.audit(full='full.json'))['facility:two']
        self.assertNotEqual(row['workStatus'], 'excluded-ended')
        self.assertFalse(row['generated']['matchesCurrentRelations'])

    def test_missing_generated_relation_is_explicit(self):
        self.full['relations'] = []
        self.write('full.json', self.full)
        row = self.rows(self.audit(full='full.json'))['facility:one']
        self.assertEqual(row['generated']['missingCurrentRelationCardIds'], ['card:one'])
        self.assertFalse(row['generated']['matchesCurrentRelations'])
        self.assertIn('generated-relation-mismatch', row['reconfirmationSignals'])

    def test_generated_exact_duplicate_relation_is_reported(self):
        self.full['relations'].append(dict(self.full['relations'][0]))
        self.write('full.json', self.full)
        result = self.audit(full='full.json')
        self.assertEqual(len(result['coverage']['duplicateGeneratedRelations']), 1)

    def test_pin_requires_its_verified_relation(self):
        self.full['pins'] = [dict(id='facility:one', kind='place', lat=34, lng=138, cardIds=['card:outside'])]
        self.write('full.json', self.full)
        with self.assertRaises(ValueError):
            self.audit(full='full.json')

    def test_missing_pin_and_changed_relation_evidence_reported(self):
        self.full['places'][0]['coordinate'].update(lat=35, lng=139)
        self.write('full.json', self.full)
        proposal = copy.deepcopy(self.source)
        proposal['relations'][0]['evidence'] = dict(proposal['relations'][0]['evidence'], verificationMethod='new fact')
        self.write('proposals/p.json', proposal)
        result = self.audit(full='full.json')
        self.assertIn('facility:one', result['national']['missingGeneratedPinIds'])
        self.assertEqual(result['proposals']['differentRelations'], [['card:one', 'facility:one']])

    def test_distinct_period_relations_preserved(self):
        self.full['relations'].append(dict(self.full['relations'][0], condition='winter'))
        self.write('full.json', self.full)
        self.assertEqual(self.rows(self.audit(full='full.json'))['facility:one']['priority']['firstPinCardCount'], 1)

    def test_bad_followup_reference_rejected(self):
        self.write('followups.json', dict(schema=1, facilities=[dict(facilityId='facility:one', references=['absent.json#/x'])]))
        with self.assertRaises(ValueError):
            self.audit(followups='followups.json')

    def test_snapshot_modified_during_assembly_is_rejected(self):
        self.write('snapshot', 'changed', raw=True)
        with self.assertRaises(ValueError):
            self.audit()


if __name__ == '__main__':
    unittest.main()
