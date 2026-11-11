import json
import os
import pathlib
import subprocess
import tempfile
import unittest

SCRIPT = pathlib.Path(__file__).with_name('ledger_history.py').resolve()


def clean_git_env():
    return {k: v for k, v in os.environ.items() if not k.startswith('GIT_')}


def base_rows():
    """f1 located, f2 never located, g1 and g2 located in one building."""
    facility = [dict(id=f, name=f'name {f}', address=f'address {f}', phone='') for f in ('f1', 'f2', 'g1', 'g2')]
    decision = [dict(facility_id=f, seq=1, action='adopt', lat=35.0, lng=139.0, reason=None) for f in ('f1', 'g1', 'g2')]
    member = [dict(facility_id='g1', group_id='g'), dict(facility_id='g2', group_id='g')]
    return dict(facility=facility, location_decision=decision, building_group_member=member)


def follow(rows, facility_id, action='reaffirm'):
    seq = max(r['seq'] for r in rows['location_decision'] if r['facility_id'] == facility_id) + 1
    rows['location_decision'].append(dict(facility_id=facility_id, seq=seq, action=action, lat=35.0, lng=139.0,
                                          reason='checked'))


def facility(rows, facility_id):
    return next(r for r in rows['facility'] if r['id'] == facility_id)


class LedgerHistoryTest(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = pathlib.Path(directory.name)
        self.git('init', '-q')
        self.git('config', 'user.email', 'test@example.com')
        self.git('config', 'user.name', 'Test')

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.root, env=clean_git_env())

    def write(self, rows):
        for table, table_rows in rows.items():
            path = self.root / 'data/db' / f'{table}.jsonl'
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in table_rows), encoding='utf-8')
        self.git('add', '-A')

    def commit(self, rows):
        self.write(rows)
        self.git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'rows', '--allow-empty')
        return self.git('rev-parse', 'HEAD').decode().strip()

    def check(self, *args):
        return subprocess.run(['python3', '-B', str(SCRIPT), *args], cwd=self.root, capture_output=True, text=True,
                              env=clean_git_env())

    def assert_rejected(self, rows, *fragments):
        """The staged change and the same change committed on top of the base are both rejected."""
        base = self.git('rev-parse', 'HEAD').decode().strip()
        self.write(rows)
        for result in (self.check('--staged'), (self.commit(rows), self.check('--base', base))[1]):
            self.assertNotEqual(result.returncode, 0, result.stdout)
            for fragment in fragments:
                self.assertIn(fragment, result.stderr)
        self.git('reset', '-q', '--hard', base)

    def assert_accepted(self, rows):
        base = self.git('rev-parse', 'HEAD').decode().strip()
        self.write(rows)
        for result in (self.check('--staged'), (self.commit(rows), self.check('--base', base))[1]):
            self.assertEqual(result.returncode, 0, result.stderr)
        self.git('reset', '-q', '--hard', base)

    def test_changing_or_removing_a_past_decision_is_rejected(self):
        self.commit(base_rows())
        rows = base_rows()
        rows['location_decision'][0]['lat'] = 35.1
        self.assert_rejected(rows, "location_decision ('f1', 1)", 'lat')
        rows = base_rows()
        del rows['location_decision'][0]
        self.assert_rejected(rows, "location_decision ('f1', 1)", 'removed')

    def test_appending_a_decision_is_accepted(self):
        self.commit(base_rows())
        rows = base_rows()
        follow(rows, 'f1', 'correct')
        self.assert_accepted(rows)

    def test_dropping_a_column_is_not_a_change_of_past_rows(self):
        self.commit(base_rows())
        rows = base_rows()
        for row in rows['location_decision']:
            del row['reason']
        self.assert_accepted(rows)

    def test_address_change_of_a_located_facility_needs_a_decision(self):
        self.commit(base_rows())
        rows = base_rows()
        facility(rows, 'f1')['address'] = 'moved'
        self.assert_rejected(rows, 'facility f1', 'add a location decision')
        follow(rows, 'f1')
        self.assert_accepted(rows)

    def test_name_change_of_one_group_member_needs_a_decision_for_every_member(self):
        self.commit(base_rows())
        rows = base_rows()
        facility(rows, 'g1')['name'] = 'renamed'
        follow(rows, 'g1')
        self.assert_rejected(rows, 'facility g2', 'g1')
        follow(rows, 'g2')
        self.assert_accepted(rows)

    def test_address_change_of_an_unlocated_facility_is_accepted(self):
        self.commit(base_rows())
        rows = base_rows()
        facility(rows, 'f2')['address'] = 'moved'
        facility(rows, 'f1')['phone'] = '000-0000-0000'
        self.assert_accepted(rows)

    def test_base_without_row_files(self):
        self.git('-c', 'commit.gpgsign=false', 'commit', '-qm', 'empty', '--allow-empty')
        self.assert_accepted(base_rows())

    def test_first_commit_without_head(self):
        self.write(base_rows())
        result = self.check('--staged')
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    unittest.main()
