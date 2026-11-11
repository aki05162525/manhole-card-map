import copy
from contextlib import closing
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import ledgerdb as db

ROOT = Path(__file__).resolve().parents[2]


class RepositoryRowsTest(unittest.TestCase):
    def test_export_matches_assemble_output(self):
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory) / 'ledger.json'
            subprocess.run([sys.executable, '-B', 'tools/national/assemble.py', '--out', str(out)],
                           cwd=ROOT, check=True)
            expected = out.read_bytes()
        with closing(db.build(ROOT)) as database:
            actual = db.export_ledger(database).encode('utf-8')
        # Report the first differing line; the full ledger is several megabytes.
        if actual != expected:
            for number, (a, e) in enumerate(zip(actual.splitlines(), expected.splitlines()), 1):
                if a != e:
                    self.fail(f'line {number}: export {a[:200]!r} != assemble {e[:200]!r}')
            self.fail(f'length differs: export {len(actual)} != assemble {len(expected)}')

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
            previous_state_sha256='0' * 64, adoption_sha256=None, adoption_extra=None))
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


if __name__ == '__main__':
    unittest.main()
