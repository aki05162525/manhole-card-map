"""Protect the fixed pilot sample and traceability without requiring local-only originals."""
import hashlib
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
SELECTION = ROOT / 'data/national/issue16/selection.json'


class PilotEvidenceTests(unittest.TestCase):
    def test_fixed_selection_and_outcomes(self):
        raw = SELECTION.read_bytes()
        selection = json.loads(raw)
        groups = selection['groups']
        self.assertEqual(len(groups), 20)
        ids = [f for g in groups for f in g['facilityIds']]
        self.assertEqual(len(ids), len(set(ids)), 'one facility must not be counted in two groups')
        self.assertTrue(selection['selectedAt'])
        self.assertTrue(selection['inputSHA256'])
        self.assertEqual({g['owner'] for g in groups}, {'group-a', 'group-b'})
        for owner in ('group-a', 'group-b'):
            path = SELECTION.parent / (owner + '-outcomes.json')
            if not path.exists():
                self.fail(f'missing outcomes: {owner}')
            data = json.loads(path.read_bytes())
            self.assertEqual(data['selectionSHA256'], hashlib.sha256(raw).hexdigest())
            expected = {f for g in groups if g['owner'] == owner for f in g['facilityIds']}
            rows = data['outcomes']
            self.assertEqual(len(rows), len({r['facilityId'] for r in rows}))
            self.assertEqual({r['facilityId'] for r in rows}, expected)
            for row in rows:
                self.assertTrue(row['stopCondition'])
                self.assertTrue(row['resumeCondition'])
                self.assertTrue(row['newEvidenceRefs'])
                for ref in row['newEvidenceRefs'] + [row['originalRef']]:
                    name, _, pointer = ref.partition('#')
                    path = (ROOT / name).resolve()
                    self.assertTrue(path.is_relative_to(ROOT / 'data'))
                    self.assertFalse(path.is_relative_to(ROOT / 'data/work'))
                    target = json.loads(path.read_bytes())
                    if pointer:
                        self.assertTrue(pointer.startswith('/'))
                        for component in pointer[1:].split('/'):
                            component = component.replace('~1', '/').replace('~0', '~')
                            target = target[int(component)] if isinstance(target, list) else target[component]


if __name__ == '__main__':
    unittest.main()
