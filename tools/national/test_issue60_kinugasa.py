import copy
import unittest
from pathlib import Path
from assemble import assemble, read_json

ROOT = Path(__file__).resolve().parents[2]
FID = 'facility:kanto-south-ec19477e52b814868f78'
PREFIX = 'data/national/issue76/kanagawa/kinugasa-followup'

class KinugasaAdoptionTests(unittest.TestCase):
    def test_review_package_reproduces_preserved_inputs(self):
        from issue60_kinugasa import prepare
        for path, expected in prepare(ROOT).items():
            self.assertEqual(expected, read_json(ROOT / path), path)

    def test_only_approved_office_changes(self):
        manifest = read_json(ROOT / 'tools/national/manifest.json')
        # Replay this historical adoption independently of the later twelve.
        for key in ('locations', 'locationLifecycle'):
            manifest[key] = [r for r in manifest[key] if '/four-followup/' not in r['path'] and '/twelve-followup/' not in r['path']]
        baseline = copy.deepcopy(manifest)
        for key in ('locations', 'locationLifecycle'):
            baseline[key] = [r for r in manifest[key] if not r['path'].startswith(PREFIX + '/')]
        before, _ = assemble(ROOT, baseline)
        after, _ = assemble(ROOT, manifest)
        old = {p['id']: p for p in before['places']}
        new = {p['id']: p for p in after['places']}
        self.assertEqual({FID}, {fid for fid in old if old[fid] != new[fid]})
        self.assertEqual(old.keys(), new.keys())
        self.assertEqual(before['relations'], after['relations'])
        self.assertEqual(1670, len(after['relations']))
        self.assertEqual({'lat': 35.2571552, 'lng': 139.6625254}, new[FID]['coordinate'])
        self.assertEqual(475, sum(p.get('coordinate') is None for p in old.values()))
        self.assertEqual(474, sum(p.get('coordinate') is None for p in new.values()))
        summary = read_json(ROOT / 'data/national/issue76/remaining-index-after-kinugasa.json')['summary']
        self.assertEqual((474, 31, 114), (summary['remaining'], summary['kantoHeld'], summary['issue76Adopted']))
