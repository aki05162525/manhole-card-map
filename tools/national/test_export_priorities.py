"""Compare the extracted exporter with the immutable Issue24 documentation snippet."""
import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import export_priorities

ROOT = Path(__file__).resolve().parents[2]
# Verbatim executable reference from docs/verification/issue24-priorities.md at
# 11b7e4ee271a3622f794e09e33d3fd6730be3e2b. Kept here to detect extraction drift.
LEGACY_EXPORT = '''import json, hashlib
from pathlib import Path

def export(source, decisions):
    report = json.loads(source.read_text())
    selection = json.loads(decisions.read_text())
    decision_rows = selection['rows']
    selected = {row['facilityId']: row for row in decision_rows}
    facilities = report['facilities']
    ids = [row['facilityId'] for row in facilities]
    if (len(set(ids)) != len(ids) or len(selected) != len(decision_rows)
            or set(ids) != set(selected)):
        raise ValueError('classification and selection IDs must match exactly without duplicates')
    rows = []
    for rank, facility in enumerate(facilities, 1):
        investigation = facility['investigation']
        hold = facility['hold']
        decision = selected[facility['facilityId']]
        rows.append(dict(
            facilityId=facility['facilityId'], automaticRank=rank,
            priority=facility['priority'], distribution=facility['distribution'],
            firstPinCardIds=facility['firstPinCardIds'],
            originalRef=facility['provenance'].get('original', {}).get('ref'),
            reviewRefs=[row['ref'] for row in investigation['reviews']],
            blockers=investigation['blockers'], normalizedStage=investigation['stage'],
            currentStage=facility['currentInvestigationStage'],
            holdRef=hold['outcomeRef'] if hold else None,
            stopCondition=hold['stopCondition'] if hold else investigation['stopCondition'],
            resumeCondition=hold['resumeCondition'] if hold else investigation['resumeCondition'],
            sharedGroupIds=facility['sharedGroupIds'], selection=decision['selection'],
            selectionReason=decision['reason'], reevaluateWhen=decision['reevaluateWhen']))
    return dict(schema=1, asOf=report['dates']['asOf'], source=str(source),
                sourceSHA256=hashlib.sha256(source.read_bytes()).hexdigest(),
                definitions=report['definitions'], summary=report['summary'],
                inputSHA256=report['inputSHA256'],
                sharedInvestigationCandidates=report['sharedInvestigationCandidates'], rows=rows)
'''


def example():
    facility = {
        'facilityId': 'facility:one', 'priority': {'assessmentTier': 0},
        'distribution': {'classification': 'needs-review'},
        'firstPinCardIds': None,
        'provenance': {'original': {'ref': 'original.json#/rows/0'}},
        'investigation': {'reviews': [{'ref': 'review.json#/rows/0'}],
                          'blockers': ['building'], 'stage': 'not-evaluated',
                          'stopCondition': '棟対応未確認', 'resumeCondition': '新しい配置図'},
        'currentInvestigationStage': 'held', 'hold': None, 'sharedGroupIds': ['address:1'],
    }
    held = copy.deepcopy(facility)
    held.update(facilityId='facility:two', firstPinCardIds=['card:a'], provenance={},
                hold={'outcomeRef': 'hold.json#/rows/0', 'stopCondition': '停止条件',
                      'resumeCondition': '再開条件'})
    report = {'dates': {'asOf': '2026-11-05'}, 'definitions': {'ranking': 'not approval'},
              'summary': {'facilities': 2}, 'inputSHA256': {'audit.json': 'a' * 64},
              'sharedInvestigationCandidates': [{'id': 'address:1', 'facilityIds': ['facility:one', 'facility:two']}],
              'facilities': [facility, held]}
    decisions = {'rows': [{'facilityId': fid, 'selection': 'not-selected',
                           'reason': '根拠待ち', 'reevaluateWhen': '新資料'}
                          for fid in ['facility:two', 'facility:one']]}
    return report, decisions


class ExportPrioritiesTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.source = Path(self.directory.name) / 'classification.json'
        self.decisions = Path(self.directory.name) / 'decisions.json'
        self.output = Path(self.directory.name) / 'snapshot.json'
        self.report, self.selection = example()
        self.write_inputs()

    def write_inputs(self):
        self.source.write_text(json.dumps(self.report, ensure_ascii=False))
        self.decisions.write_text(json.dumps(self.selection, ensure_ascii=False))

    def command(self):
        return subprocess.run([sys.executable, '-B', str(ROOT / 'tools/national/export_priorities.py'),
                               '--source', str(self.source), '--decisions', str(self.decisions),
                               '--out', str(self.output)], capture_output=True, text=True)

    def test_matches_legacy_snippet_byte_for_byte(self):
        namespace = {}
        exec(LEGACY_EXPORT, namespace)
        expected = namespace['export'](self.source, self.decisions)
        self.assertEqual(export_priorities.export(self.source, self.decisions), expected)
        result = self.command()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.output.read_bytes(), (json.dumps(expected, ensure_ascii=False, indent=2) + '\n').encode())
        self.assertEqual(expected['source'], str(self.source))
        self.assertEqual(expected['sourceSHA256'], hashlib.sha256(self.source.read_bytes()).hexdigest())
        self.assertEqual([r['automaticRank'] for r in expected['rows']], [1, 2])
        self.assertEqual(expected['rows'][1]['stopCondition'], '停止条件')

    def test_missing_extra_or_duplicate_ids_are_rejected_without_output(self):
        for mutation in ['missing', 'extra', 'duplicate-decision', 'duplicate-facility']:
            with self.subTest(mutation=mutation):
                self.report, self.selection = example()
                if mutation == 'missing':
                    self.selection['rows'].pop()
                elif mutation == 'extra':
                    self.selection['rows'].append(dict(self.selection['rows'][0], facilityId='facility:unknown'))
                elif mutation == 'duplicate-decision':
                    self.selection['rows'].append(self.selection['rows'][0])
                else:
                    self.report['facilities'].append(self.report['facilities'][0])
                self.write_inputs()
                with self.assertRaisesRegex(ValueError, 'IDs must match exactly without duplicates'):
                    export_priorities.export(self.source, self.decisions)
                result = self.command()
                self.assertEqual(result.returncode, 1)
                self.assertFalse(self.output.exists())

    def test_cli_never_overwrites_existing_output(self):
        self.output.write_bytes(b'original evidence')
        result = self.command()
        self.assertEqual(result.returncode, 1)
        self.assertEqual(self.output.read_bytes(), b'original evidence')


if __name__ == '__main__':
    unittest.main()
