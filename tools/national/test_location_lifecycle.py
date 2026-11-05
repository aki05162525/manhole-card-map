import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

import assemble
import location_lifecycle as lifecycle


class LocationLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'evidence').write_bytes(b'location evidence')
        self.ev = dict(sourceUrl='https://example.org/map', snapshotPath='evidence',
                       snapshotSHA256=hashlib.sha256(b'location evidence').hexdigest(), sourceLocator='building',
                       checkedAt='2026-11-05', actorType='ai', verificationMethod='building comparison')
        self.identity = dict(name='Hall', address='Old address')
        self.update = dict(facilityId='facility:one', coordinate=dict(lat=35, lng=139), evidence=self.ev)
        self.ledger = dict(schema=1, places=[dict(id='facility:one', legacyIds=[], **self.identity,
                            coordinate=self.update['coordinate'], evidence=self.ev)], relations=[])
        self.binding = dict(facilityId='facility:one', identity=self.identity,
                            adoption=self.update, adoptionSHA256=lifecycle.digest(self.update),
                            sourceVersion='2022', reviewDue='2026-10-01')
        self.doc = dict(schema=1, bindings=[self.binding], events=[], groups=[])

    def run_lifecycle(self, ledger=None, updates=None):
        return lifecycle.apply(self.root, ledger or self.ledger, [self.update] if updates is None else updates, [self.doc])

    def event(self, action, previous, **changes):
        event = dict(id='decision:1', facilityId='facility:one', action=action,
                     previousSHA256=lifecycle.digest(previous), reason='Reviewed current building',
                     reasonType='evidence-update', identity=copy.deepcopy(self.identity), evidence=self.ev,
                     preparedBy='researcher', reviewedBy='independent-reviewer', reviewedAt='2026-11-05',
                     addressStatus='valid', sourceVersion='2026', reviewDue='2027-01-01')
        if action != 'withdraw':
            event['coordinate'] = copy.deepcopy(self.update['coordinate'])
        return dict(event, **changes)

    def test_legacy_unchanged_and_bound_identity_change_removes_coordinate(self):
        legacy, audit = lifecycle.apply(self.root, self.ledger, [self.update], [])
        self.assertEqual(legacy, self.ledger)
        altered = copy.deepcopy(self.ledger)
        altered['places'][0]['address'] = 'New address'
        output, audit = self.run_lifecycle(ledger=altered)
        self.assertNotIn('coordinate', output['places'][0])
        self.assertEqual(output['places'][0]['locationReview']['status'], 'needs-review')
        self.assertEqual(output['places'][0]['locationReview']['addressStatus'], 'needs-review')
        self.assertEqual(audit['facilities'][0]['state']['coordinate'], self.update['coordinate'])

    def test_spelling_reaffirm_and_relocation_correct(self):
        for action, reason, coordinate in [('reaffirm', 'spelling', self.update['coordinate']), ('correct', 'relocation', dict(lat=36, lng=140))]:
            with self.subTest(action=action):
                self.doc['events'] = []
                _, initial = self.run_lifecycle()
                new_identity = dict(name='Hall', address='New address')
                self.doc['events'] = [self.event(action, initial['facilities'][0]['state'], identity=new_identity, coordinate=coordinate, reasonType=reason)]
                changed = copy.deepcopy(self.ledger)
                changed['places'][0].update(new_identity)
                output, audit = self.run_lifecycle(ledger=changed)
                self.assertEqual(output['places'][0]['coordinate'], coordinate)
                self.assertEqual(output['places'][0]['locationReview']['status'], 'confirmed')
                self.assertEqual(len(audit['facilities'][0]['history']), 1)

    def test_withdraw_does_not_resurrect_and_keeps_current_address(self):
        _, initial = self.run_lifecycle()
        self.doc['events'] = [self.event('withdraw', initial['facilities'][0]['state'], reasonType='source-withdrawal')]
        for _ in range(2):
            output, _ = self.run_lifecycle()
            self.assertNotIn('coordinate', output['places'][0])
            self.assertEqual(output['places'][0]['locationReview']['status'], 'withdrawn')
            self.assertEqual(output['places'][0]['locationReview']['addressStatus'], 'valid')

    def test_hash_old_value_and_independent_review_rejected(self):
        _, initial = self.run_lifecycle()
        event = self.event('withdraw', initial['facilities'][0]['state'])
        for changes in [dict(previousSHA256='0'*64), dict(reviewedBy='researcher'), dict(reviewedBy=' researcher '), dict(preparedBy=' researcher ', reviewedBy='researcher'), dict(reason=''), dict(extra=True)]:
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                self.doc['events'] = [dict(event, **changes)]
                self.run_lifecycle()

    def test_removed_selection_needs_withdrawal_history(self):
        unlocated = copy.deepcopy(self.ledger)
        del unlocated['places'][0]['coordinate']
        with self.assertRaises(ValueError):
            self.run_lifecycle(ledger=unlocated, updates=[])
        _, initial = self.run_lifecycle()
        self.doc['events'] = [self.event('withdraw', initial['facilities'][0]['state'])]
        output, _ = self.run_lifecycle(ledger=unlocated, updates=[])
        self.assertEqual(output['places'][0]['locationReview']['status'], 'withdrawn')

    def test_due_date_is_queue_only_and_explicit_group_impact(self):
        other = dict(self.ledger['places'][0], id='facility:two')
        self.ledger['places'].append(other)
        update = dict(self.update, facilityId='facility:two')
        self.doc['bindings'].append(dict(self.binding, facilityId='facility:two', adoption=update, adoptionSHA256=lifecycle.digest(update)))
        self.doc['groups'] = [dict(id='building:hall', facilityIds=['facility:one','facility:two'], evidence=self.ev)]
        output, audit = lifecycle.apply(self.root, self.ledger, [self.update,update], [self.doc])
        self.assertIn('coordinate', output['places'][0])
        self.assertEqual(audit['reviewQueue'][0]['reviewDue'], '2026-10-01')
        self.ledger['places'][0]['address'] = 'Changed'
        output, audit = lifecycle.apply(self.root, self.ledger, [self.update,update], [self.doc])
        self.assertTrue(all('coordinate' not in p for p in output['places']))
        self.assertEqual(audit['groupImpacts'][0]['facilityIds'], ['facility:one','facility:two'])

    def test_relocation_cannot_reaffirm_previous_coordinate(self):
        _, initial = self.run_lifecycle()
        self.doc['events'] = [self.event('reaffirm', initial['facilities'][0]['state'], reasonType='relocation', identity=dict(name='Hall', address='Moved'))]
        with self.assertRaises(ValueError):
            self.run_lifecycle()

    def test_overlapping_building_groups_rejected(self):
        self.doc['groups'] = [dict(id='building:one', facilityIds=['facility:one','facility:two'], evidence=self.ev),
                              dict(id='building:two', facilityIds=['facility:two','facility:three'], evidence=self.ev)]
        for fid in ('facility:two','facility:three'):
            self.ledger['places'].append(dict(self.ledger['places'][0],id=fid))
            update=dict(self.update,facilityId=fid)
            self.doc['bindings'].append(dict(self.binding,facilityId=fid,adoption=update,adoptionSHA256=lifecycle.digest(update)))
        updates=[b['adoption'] for b in self.doc['bindings']]
        with self.assertRaises(ValueError):
            lifecycle.apply(self.root,self.ledger,updates,[self.doc])

    def test_source_inventory_does_not_call_withdrawn_selection_adopted(self):
        import source_inventory
        _, initial = self.run_lifecycle()
        self.doc['events'] = [self.event('withdraw', initial['facilities'][0]['state'])]
        original = copy.deepcopy(self.ledger)
        del original['places'][0]['coordinate']
        for name, data in [('input.json',original),('locations.json',dict(schema=1,updates=[self.update])),('lifecycle.json',self.doc)]:
            (self.root/name).write_text(json.dumps(data))
        manifest=dict(schema=1,inputs=['input.json'],patches=[],locations=[dict(path='locations.json',approved=[dict(facilityId='facility:one',sha256=lifecycle.digest(self.update))])],locationLifecycle=[dict(path='lifecycle.json',sha256=hashlib.sha256((self.root/'lifecycle.json').read_bytes()).hexdigest())])
        (self.root/'manifest.json').write_text(json.dumps(manifest))
        result=source_inventory.inventory(self.root,'manifest.json',candidate_files=[],as_of='2026-11-05')
        self.assertEqual(result['summary']['adoptedRecords'],0)
        self.assertFalse(result['records'][0]['currentlyAdoptedRecord'])
        self.assertEqual(result['records'][0]['locationReview']['status'],'withdrawn')

    def test_manifest_file_hash_pins_lifecycle(self):
        original = copy.deepcopy(self.ledger)
        del original['places'][0]['coordinate']
        for name, data in [('input.json',original),('locations.json',dict(schema=1,updates=[self.update])),('lifecycle.json',self.doc)]:
            (self.root/name).write_text(json.dumps(data))
        manifest=dict(schema=1,inputs=['input.json'],patches=[],locations=[dict(path='locations.json',approved=[dict(facilityId='facility:one',sha256=lifecycle.digest(self.update))])],locationLifecycle=[dict(path='lifecycle.json',sha256=hashlib.sha256((self.root/'lifecycle.json').read_bytes()).hexdigest())])
        output, audit = assemble.assemble(self.root,manifest)
        self.assertEqual(output['places'][0]['locationReview']['status'],'confirmed')
        (self.root/'lifecycle.json').write_text(json.dumps(dict(self.doc,events=[{}])))
        with self.assertRaises(ValueError):
            assemble.assemble(self.root,manifest)

if __name__ == '__main__':
    unittest.main()
