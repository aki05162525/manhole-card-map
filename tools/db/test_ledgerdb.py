import copy
from contextlib import closing
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import ledgerdb as db
from migrate_from_assemble import canonical

ROOT = Path(__file__).resolve().parents[2]
RESEARCH_CONTENT = ('status', 'stage', 'blockers', 'finding', 'stop_condition', 'resume_condition', 'next_action',
                    'next_source', 'next_source_url', 'next_source_urls', 'next_source_required', 'next_source_needed',
                    'next_source_task', 'next_source_not_required')


class RepositoryRowsTest(unittest.TestCase):
    def test_export_matches_assemble_output(self):
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory) / 'ledger.json'
            subprocess.run([sys.executable, '-B', 'tools/national/assemble.py', '--out', str(out)],
                           cwd=ROOT, check=True)
            expected = canonical(out.read_text(encoding='utf-8'))
        with closing(db.build(ROOT)) as database:
            actual = canonical(db.export_ledger(database))
        # Report the first differing line; the full ledger is several megabytes.
        if actual != expected:
            for number, (a, e) in enumerate(zip(actual.splitlines(), expected.splitlines()), 1):
                if a != e:
                    self.fail(f'line {number}: export {a[:200]!r} != assemble {e[:200]!r}')
            self.fail(f'length differs: export {len(actual)} != assemble {len(expected)}')

    def test_comparison_ignores_key_order_but_not_json_types(self):
        self.assertEqual(canonical('{"a": 1, "b": [true]}'), canonical('{"b": [true], "a": 1}'))
        self.assertNotEqual(canonical('{"a": true}'), canonical('{"a": 1}'))
        self.assertNotEqual(canonical('{"a": 1}'), canonical('{"a": 1.0}'))

    def test_build_then_dump_keeps_row_files(self):
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory)
            with closing(db.build(ROOT)) as database:
                db.dump(database, out)
            expected = sorted(p.name for p in (ROOT / db.ROWS).glob('*.jsonl'))
            self.assertEqual(sorted(p.name for p in out.iterdir()), expected)
            for name in expected:
                self.assertEqual((out / name).read_bytes(), (ROOT / db.ROWS / name).read_bytes(), name)

    def test_card_tables_match_registry(self):
        with closing(db.build(ROOT)) as database:
            registry = db.export_card_ids(database)
        self.assertEqual(registry, json.loads((ROOT / 'data/card-ids.json').read_text(encoding='utf-8')))


class ConstraintTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = db.read_rows(ROOT)

    def setUp(self):
        self.rows = copy.deepcopy(self.rows)

    def rejected(self, *fragments):
        with self.assertRaises(db.LedgerError) as raised:
            db.load(self.rows)
        for fragment in fragments:
            self.assertIn(fragment, str(raised.exception))

    def first(self, table, **match):
        return next(r for r in self.rows[table] if all(r[k] == v for k, v in match.items()))

    def test_relation_to_unknown_card(self):
        relation = self.rows['relation'][0]
        relation['card_id'] = '99-999-Z999'
        self.rejected(f"relation ('{relation['id']}',)", 'FOREIGN KEY', 'card')

    def test_same_card_facility_and_period(self):
        duplicate = dict(self.rows['relation'][0], id='relation:duplicate')
        self.rows['relation'].append(duplicate)
        self.rejected("relation ('relation:duplicate',)", 'UNIQUE')

    def test_other_period_of_same_card_and_facility_is_allowed(self):
        self.rows['relation'].append(dict(self.rows['relation'][0], id='relation:later',
                                          valid_from='2099-01-01'))
        db.load(self.rows).close()

    def test_latitude_out_of_range(self):
        decision = self.first('location_decision', action='adopt')
        decision['lat'] = 90.5
        self.rejected(f"location_decision ('{decision['facility_id']}', 1)", 'CHECK', 'lat')

    def test_actor_other_than_ai_or_human(self):
        evidence = self.rows['evidence'][0]
        evidence['actor_type'] = 'phone'
        self.rejected(f"evidence ('{evidence['id']}',)", 'CHECK', 'actor_type')

    def test_evidence_id_must_follow_content(self):
        evidence = self.rows['evidence'][0]
        evidence['source_locator'] += ' (edited)'
        self.rejected(f"evidence ('{evidence['id']}',)", 'does not match its content')

    def test_correction_must_follow_an_adoption(self):
        decision = self.first('location_decision', action='adopt')
        self.rows['location_decision'].append(dict(
            decision, seq=3, action='correct', decision_id='decision:test', reason_type='spelling',
            prepared_by='ai:a', reviewed_by='ai:b', reason='r', reviewed_at='2099-01-01',
            address_status='valid', identity_name='n', identity_address='a', lat=0.0, lng=0.0, scope=None,
            previous_state_sha256='0' * 64, adoption_source=None, adoption_sha256=None, adoption_extra=None))
        self.rejected(f"location_decision ('{decision['facility_id']}', 3)", 'previous decision')

    def test_identity_change_holds_every_member_of_the_building_group(self):
        changed, other = 'facility:chubu-east-3c366372adb1d9e39b13', 'facility:chubu-east-511d795c4d0bff516838'
        self.first('facility', id=changed)['name'] += '（改称）'
        with closing(db.load(self.rows)) as database:
            places = {p['id']: p for p in json.loads(db.export_ledger(database))['places']}
        for fid in (changed, other):
            self.assertNotIn('coordinate', places[fid])
            self.assertEqual(places[fid]['locationReview']['status'], 'needs-review')

    def test_rewriting_an_earlier_decision_breaks_the_chain(self):
        corrected = self.first('location_decision', action='correct')
        adoption = self.first('location_decision', facility_id=corrected['facility_id'], seq=1)
        adoption['lat'] = round(adoption['lat'] + 0.001, 7)
        self.rejected(f"location_decision ('{corrected['facility_id']}', 2)", 'previous_state_sha256')

    def test_approved_adoption_keeps_its_digest(self):
        adoption = self.first('location_decision', facility_id='facility:chubu-east-03b8e873197013417a8a', seq=1)
        adoption['adoption_sha256'] = None
        adoption['lat'] = round(adoption['lat'] + 0.001, 7)
        self.rejected("location_decision ('facility:chubu-east-03b8e873197013417a8a', 1)", 'adoption_sha256')
        # Relabelling it as an input-ledger coordinate does not lift the pin either.
        adoption['adoption_source'] = 'input-ledger'
        self.rejected("location_decision ('facility:chubu-east-03b8e873197013417a8a', 1)", 'facility evidence')

    def test_decision_cannot_predate_its_evidence(self):
        decision = self.first('location_decision', action='correct')
        source = self.first('evidence', id=decision['evidence_id'])
        later = dict(source, checked_at='2099-01-01')
        later['id'] = db.evidence_id(later)
        self.rows['evidence'].append(later)
        decision['evidence_id'] = later['id']
        self.rejected(f"location_decision ('{decision['facility_id']}', 2)", 'predates its evidence')

    def test_reviewed_adoption_state_follows_its_record(self):
        adoption = self.first('location_decision', seq=1, reason='Adopted building representative point')
        adoption['reason'] = 'Adopted facility representative point'
        self.rejected(f"location_decision ('{adoption['facility_id']}', 1)", 'a reviewed adoption takes reason')

    def test_hours_must_be_an_array_of_strings(self):
        relation = self.rows['relation'][0]
        relation['hours'] = '9:00-17:00'
        self.rejected(f"relation ('{relation['id']}',)", 'hours')

    def test_research_on_unknown_facility(self):
        research = self.rows['location_research'][0]
        research['facility_id'] = 'facility:missing'
        self.rejected(f"location_research ('facility:missing', '{research['source_ref']}')", 'FOREIGN KEY', 'facility')

    def test_research_on_located_facility(self):
        located = self.first('location_decision', action='adopt')['facility_id']
        self.rows['location_research'].append(dict(self.rows['location_research'][0], facility_id=located))
        self.rejected(f"location_research ('{located}',", 'has a current location')

    def test_research_needs_some_content(self):
        research = self.rows['location_research'][0]
        research.update(dict.fromkeys(RESEARCH_CONTENT))
        self.rejected('location_research', 'CHECK')

    def test_research_may_record_only_the_next_source(self):
        research = self.rows['location_research'][0]
        research.update(dict.fromkeys(RESEARCH_CONTENT), next_source_url='https://example.org/next')
        db.load(self.rows).close()

    def test_source_review_status(self):
        review = self.rows['source_review'][0]
        review['status'] = 'approved'
        self.rejected(f"source_review ('{review['id']}',)", 'CHECK', 'status')

    def test_source_review_evidence_after_review(self):
        evidence = self.rows['source_review_evidence'][0]
        evidence['checked_at'] = '2099-01-01'
        self.rejected(f"source_review_evidence ('{evidence['review_id']}', 0)", 'checked after its review')

    def test_review_target_needs_a_decision(self):
        target = self.rows['source_review_target'][0]
        target['seq'] = 99
        self.rejected(f"source_review_target ('{target['facility_id']}', 99)", 'FOREIGN KEY', 'location_decision')

    def test_review_target_must_name_the_adoption(self):
        adopted = next(t for t in self.rows['source_review_target'] if t['seq'] == 1)
        adopted['record_sha256'] = '0' * 64
        self.rejected(f"source_review_target ('{adopted['facility_id']}', 1)", 'adoption_sha256')

    def test_review_target_of_a_later_decision_follows_the_place(self):
        later = next(t for t in self.rows['source_review_target'] if t['seq'] > 1)
        self.first('facility', id=later['facility_id'])['phone'] = '000-0000-0000'
        self.rejected(f"source_review_target ('{later['facility_id']}', {later['seq']})", 'exported place')

    def test_attempt_needs_its_research_row(self):
        attempt = self.rows['location_research_attempt'][0]
        attempt['source_ref'] = 'data/national/missing.json#/0'
        self.rejected(f"location_research_attempt ('{attempt['facility_id']}', 'data/national/missing.json#/0', 0)",
                      'FOREIGN KEY', 'location_research')

    def test_attempt_positions_have_no_gap(self):
        attempt = self.rows['location_research_attempt'][0]
        self.rows['location_research_attempt'].append(dict(attempt, position=999))
        self.rejected(f"location_research_attempt ('{attempt['facility_id']}', '{attempt['source_ref']}')",
                      'positions must be 0..n-1')

    def test_candidate_on_located_facility(self):
        located = self.first('location_decision', action='adopt')['facility_id']
        self.rows['location_candidate'].append(dict(self.rows['location_candidate'][0], facility_id=located))
        self.rejected(f"location_candidate ('{located}',", 'has a current location')

    def test_recheck_needs_a_current_location(self):
        unlocated = self.rows['location_research'][0]['facility_id']
        self.rows['location_recheck'].append(dict(self.rows['location_recheck'][0], facility_id=unlocated))
        self.rejected(f"location_recheck ('{unlocated}',", 'has no current location')

    def test_user_answer_is_human(self):
        answer = self.rows['user_answer'][0]
        answer['actor_type'] = 'ai'
        self.rejected(f"user_answer ('{answer['source_ref']}',)", 'CHECK', 'actor_type')

    def test_user_answer_needs_a_facility(self):
        ref = self.rows['user_answer'][0]['source_ref']
        self.rows['user_answer_facility'] = [r for r in self.rows['user_answer_facility'] if r['source_ref'] != ref]
        self.rejected(f"user_answer ('{ref}',)", 'needs a facility')

    def test_user_answer_on_unknown_facility(self):
        link = self.rows['user_answer_facility'][0]
        link['facility_id'] = 'place:unknown'
        self.rejected(f"user_answer_facility ('{link['source_ref']}', 'place:unknown')", 'FOREIGN KEY', 'facility')

    def test_selection_review_is_an_object(self):
        review = next(r for r in self.rows['source_review'] if r['selection_review'] is not None)
        review['selection_review'] = 'corrected'
        self.rejected(f"source_review ('{review['id']}',)", 'selection_review')

    def test_cli_reports_table_and_key(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / db.ROWS).mkdir(parents=True)
            self.rows['relation'][0]['status'] = 'open'
            db.write_rows(self.rows, root / db.ROWS)
            result = subprocess.run([sys.executable, '-B', str(Path(db.__file__)), 'build', '--root', str(root),
                                     '--check'], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(f"relation ('{self.rows['relation'][0]['id']}',)", result.stderr)
        self.assertIn('status', result.stderr)


def synthetic_rows():
    """Four facilities: f1 input-ledger, f2 never located, f3 adopted then withdrawn, f4 adopted."""
    ev = dict(source_url='https://example.org/a', snapshot_sha256='a' * 64, legacy_snapshot_path='data/evidence/a',
              source_locator='p1', checked_at='2026-01-01', actor_type='ai', verification_method='read')
    ev['id'] = db.evidence_id(ev)
    names = {f: (f'name {f}', f'address {f}') for f in ('f1', 'f2', 'f3', 'f4')}
    facilities = [dict(id=f, name=n, address=a, phone='', identity_evidence_id=ev['id']) for f, (n, a) in names.items()]
    blank = dict.fromkeys(['previous_state_sha256', 'scope', 'adoption_source', 'adoption_sha256', 'adoption_extra',
                           'decision_id', 'reason_type', 'prepared_by', 'reviewed_by', 'reviewed_at', 'reason',
                           'address_status', 'identity_name', 'identity_address', 'source_version', 'review_due'])

    def reviewed(fid, seq, action, **extra):
        row = dict(blank, facility_id=fid, seq=seq, action=action, lat=35.0, lng=139.0, evidence_id=ev['id'],
                   reviewed_at='2026-01-01', reason=db.BUILDING_REASON, address_status='valid',
                   identity_name=names[fid][0], identity_address=names[fid][1])
        row.update(extra)
        if action == 'adopt':
            row.update(adoption_source='approved-location', scope='building')
            row['adoption_sha256'] = db.digest(db.adoption_record(row, ev))
        return row

    f3, f4 = reviewed('f3', 1, 'adopt'), reviewed('f4', 1, 'adopt')
    withdrawn = reviewed('f3', 2, 'withdraw', lat=None, lng=None, decision_id='decision:1',
                         reason_type='source-withdrawal', prepared_by='ai:a', reviewed_by='ai:b',
                         reason='withdrawn', review_due='2026-03-01',
                         previous_state_sha256=db.digest(db.decision_state(f3, ev)))
    relation = dict(condition=None, hours=[], maintenance_notes=None, change_kind=None, change_reason=None,
                    change_previous_place_ids=None, change_raw=None, source_hash='b' * 64, evidence_id=ev['id'],
                    valid_from=None, valid_to=None)
    research = dict(work_unit='w', researched_at='2026-02-01', stage=None, blockers=None, stop_condition=None,
                    resume_condition=None, next_action=None, next_source=None, next_source_url=None,
                    next_source_urls=None, next_source_required=None, next_source_needed=None, next_source_task=None,
                    next_source_not_required=None)
    answer = dict(work_unit='w', actor_type='human', answered_at='2026-02-02', question=None, answer_field='answer')
    return dict(
        card=[dict(id='c1'), dict(id='c2')], card_alias=[], card_excluded=[], evidence=[ev], facility=facilities,
        facility_legacy_id=[],
        relation=[dict(relation, id='r1', card_id='c1', facility_id='f1', status='active', review_until='2026-05-31'),
                  dict(relation, id='r2', card_id='c1', facility_id='f2', status='active', review_until='2026-06-01'),
                  dict(relation, id='r3', card_id='c2', facility_id='f3', status='ended', review_until=None)],
        location_decision=[dict(blank, facility_id='f1', seq=1, action='adopt', lat=35.0, lng=139.0,
                                evidence_id=ev['id'], adoption_source='input-ledger'), f3, withdrawn, f4],
        building_group=[dict(id='g', evidence_id=ev['id'])],
        building_group_member=[dict(facility_id='f3', group_id='g', position=0),
                               dict(facility_id='f4', group_id='g', position=1)],
        location_research=[dict(research, facility_id='f2', source_ref='a.json#/0', status='held', finding='x'),
                           dict(research, facility_id='f2', source_ref='b.json#/0', status=None, finding='y',
                                next_source='z')],
        location_research_attempt=[dict(facility_id='f2', source_ref='a.json#/0', position=i, kind='fetch',
                                        source_url='https://example.org/p', http_status=200, result='r', error=None,
                                        attempted_at='2026-02-01T00:00:00+00:00', snapshot_sha256=None)
                                   for i in range(2)],
        location_candidate=[dict(facility_id='f2', source_ref='c.json#/0', work_unit='w', lat=35.0, lng=139.0,
                                 scope=None, source_url='https://example.org/c', source_locator=None, checked_at=None,
                                 review_ref='r.json#/0', review_status='deferred', review_reason='q')],
        location_recheck=[dict(facility_id='f1', source_ref='d.json#/0', work_unit='w', kind='移転別棟', text='t'),
                          dict(facility_id='f4', source_ref='d.json#/1', work_unit='w', kind='座標競合', text='t')],
        user_answer=[dict(answer, source_ref='h.json#/0', answer='a1'), dict(answer, source_ref='h.json#/1', answer='a2')],
        user_answer_facility=[dict(source_ref='h.json#/0', facility_id='f2', position=0),
                              dict(source_ref='h.json#/0', facility_id='f4', position=1),
                              dict(source_ref='h.json#/1', facility_id='f1', position=0)],
        source_review=[dict(id='s', source_name='n', source_version='v', source_derivation='d',
                            status='needs-review', checked_at='2026-01-02', actor_type='ai', conditions='c', notes=None,
                            selection_review=None)],
        source_review_evidence=[dict(review_id='s', position=0, url='https://example.org/t', locator='l',
                                     checked_at='2026-01-02')],
        source_review_target=[dict(facility_id='f4', seq=1, review_id='s', record_sha256=f4['adoption_sha256'])])


class SummaryTest(unittest.TestCase):
    def test_counts_synthetic_rows(self):
        with closing(db.load(synthetic_rows())) as database:
            result = db.summary(database, '2026-06-01')
        self.assertEqual(result['facilities'], dict(total=4, byLocation=dict(located=2, none=1, withdrawn=1)))
        self.assertEqual(result['locationDecisions'], dict(
            byAction=dict(adopt=3, withdraw=1), currentByAction=dict(adopt=2, withdraw=1),
            adoptionsBySource={'approved-location': 2, 'input-ledger': 1}))
        relations = result['relations']
        self.assertEqual((relations['byStatus'], relations['pastReviewUntil']), (dict(active=2, ended=1), 1))
        self.assertEqual(relations['pastReviewUntilRows'][0]['id'], 'r1')
        review = result['locationReview']
        self.assertEqual((review['reviewDue'], review['pastReviewDue']), (1, 1))
        self.assertEqual(review['groupImpacts'],
                         [dict(groupId='g', facilityIds=['f3', 'f4'], triggerFacilityIds=['f3'])])
        self.assertEqual(result['research'], dict(byWorkUnitAndStatus=dict(w=dict(held=1, null=1)),
                                                  unlocatedWithResearch=1, unlocatedWithoutResearch=1,
                                                  unlocatedWithoutResearchIds=['f3'], attempts=2, withNextSource=1))
        self.assertEqual(result['locationCandidates'], dict(rows=1, facilities=1, withReview=1))
        self.assertEqual(result['locationRechecks'], dict(facilities=2, byKind={'移転別棟': 1, '座標競合': 1}))
        self.assertEqual(result['userAnswers'], dict(answers=2, facilities=3, unlocatedFacilities=1))
        self.assertEqual(result['sourceReviews'], dict(byStatus={'needs-review': 1},
                                                       reviewedDecisionsByStatus={'needs-review': 1},
                                                       locatedWithoutSourceReview=1))

    def test_identity_change_holds_the_location(self):
        rows = synthetic_rows()
        rows['facility'][3]['name'] = 'renamed'
        with closing(db.load(rows)) as database:
            result = db.summary(database, '2026-06-01')
        self.assertEqual(result['facilities']['byLocation'], dict(located=1, held=1, none=1, withdrawn=1))
        self.assertEqual(result['sourceReviews']['locatedWithoutSourceReview'], 1)


if __name__ == '__main__':
    unittest.main()
