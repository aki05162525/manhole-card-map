import datetime as dt
import hashlib
import json
import re
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from urllib.parse import urlsplit

import source_inventory as inventory


def digest(row):
    return hashlib.sha256(json.dumps(row, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


class SourceInventoryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / 'snapshot.txt').write_text('fixture original')
        self.ev = dict(sourceUrl='https://example.org/maps?google=link', snapshotPath='snapshot.txt',
                       snapshotSHA256=hashlib.sha256(b'fixture original').hexdigest(),
                       sourceLocator='facility coordinates', checkedAt='2026-11-05', actorType='ai',
                       verificationMethod='Coordinates extracted from this facility record.')
        self.base = dict(id='facility:base', legacyIds=[], name='Base', address='One', phone='',
                         coordinate=dict(lat=35, lng=139), evidence=self.ev)
        self.pending = dict(id='facility:new', legacyIds=[], name='New', address='Two', phone='', evidence=self.ev)
        self.update = dict(facilityId='facility:new', coordinate=dict(lat=36, lng=140), evidence=self.ev)
        self.other = dict(facilityId='facility:other', coordinate=dict(lat=37, lng=141), evidence=self.ev)
        self.write('ledger.json', dict(schema=1, places=[self.base, self.pending], relations=[]))
        self.write('locations.json', dict(schema=1, updates=[self.update, self.other]))
        self.manifest = dict(schema=1, inputs=['ledger.json'], patches=[], locations=[dict(
            path='locations.json', approved=[dict(facilityId='facility:new', sha256=digest(self.update))])])
        self.write('manifest.json', self.manifest)

    def write(self, path, data):
        (self.root / path).write_text(json.dumps(data))

    def run_inventory(self, **kwargs):
        return inventory.inventory(self.root, 'manifest.json', candidate_files=[], as_of='2026-11-05', **kwargs)

    def test_complete_adopted_base_and_unselected_candidates_without_url_guess(self):
        a = self.run_inventory()
        self.assertEqual(a, self.run_inventory())
        self.assertEqual(a['summary']['adoptedFacilities'], 2)
        self.assertEqual(a['summary']['candidateRecords'], 1)
        self.assertEqual(len(a['records']), 3)
        base = next(r for r in a['records'] if r['facilityId'] == 'facility:base')
        self.assertEqual(base['adoption'], 'ledger-coordinate')
        self.assertEqual(base['source']['name'], None)
        self.assertEqual(base['termsStatus'], 'unreviewed')
        self.assertEqual(base['evidence']['verificationMethod'], self.ev['verificationMethod'])
        self.assertEqual(base['snapshot']['status'], 'verified')
        self.assertIn('snapshot.txt', a['inputSHA256'])
        self.assertEqual(sum(len(g['records']) for g in a['sourceGroups']), 3)
        self.assertTrue(all(g['identityStatus'] == 'unassessed' for g in a['sourceGroups']))

    def test_registry_only_matches_exact_record_and_preserves_unreviewed(self):
        self.write('registry.json', dict(schema=1, reviews=[dict(id='review-one',
            source=dict(name='Example GIS', version='2026', derivation='direct facility coordinate'),
            status='conditional', checkedAt='2026-11-05',
            evidence=[dict(url='https://example.org/terms', locator='Reuse', checkedAt='2026-11-05')],
            selectors=[dict(facilityId='facility:new', recordSHA256=digest(self.update))])]))
        a = self.run_inventory(registry='registry.json')
        records = {r['facilityId']: r for r in a['records']}
        self.assertEqual(records['facility:new']['termsStatus'], 'conditional')
        self.assertEqual(records['facility:base']['termsStatus'], 'unreviewed')
        self.assertEqual(a['reviews'][0]['facilityIds'], ['facility:new'])

    def test_registry_rejects_broad_duplicate_and_stale_selectors(self):
        review = dict(id='review-one', source=dict(name='GIS', version='2026', derivation='direct'),
                      status='conditional', checkedAt='2026-11-05', evidence=[dict(url='https://example.org/terms', locator='terms', checkedAt='2026-11-05')],
                      selectors=[dict(facilityId='facility:new', recordSHA256=digest(self.update))])
        for changes in [dict(selectors=[dict(domain='example.org')]),
                        dict(selectors=[dict(facilityId='facility:new', recordSHA256='0' * 64)])]:
            self.write('registry.json', dict(schema=1, reviews=[dict(review, **changes)]))
            with self.assertRaises(ValueError):
                self.run_inventory(registry='registry.json')
        self.write('registry.json', dict(schema=1, reviews=[review, dict(review, id='review-two')]))
        with self.assertRaises(ValueError):
            self.run_inventory(registry='registry.json')

    def test_rejects_modified_adopted_evidence_approval_and_duplicate_candidate(self):
        (self.root / 'snapshot.txt').write_text('modified')
        with self.assertRaises(ValueError):
            self.run_inventory()
        (self.root / 'snapshot.txt').write_text('fixture original')
        self.write('locations.json', dict(schema=1, updates=[dict(self.update, coordinate=dict(lat=1, lng=2)), self.other]))
        with self.assertRaises(ValueError):
            self.run_inventory()
        self.write('locations.json', dict(schema=1, updates=[self.update, self.other, self.other]))
        with self.assertRaises(ValueError):
            self.run_inventory()

    def test_invalid_json_and_missing_candidate_evidence_are_not_silently_approved(self):
        (self.root / 'manifest.json').write_text('{"schema":1,"schema":1}')
        with self.assertRaises(ValueError):
            self.run_inventory()
        self.write('manifest.json', self.manifest)
        self.write('locations.json', dict(schema=1, updates=[self.update, dict(self.other, evidence=dict(self.ev, snapshotPath='missing.txt'))]))
        a = self.run_inventory()
        r = next(r for r in a['records'] if r['facilityId'] == 'facility:other')
        self.assertEqual(r['snapshot']['status'], 'missing')
        self.assertEqual(r['termsStatus'], 'unreviewed')

    def test_candidates_with_nonfinite_coordinates_and_registry_future_dates_fail(self):
        self.write('locations.json', dict(schema=1, updates=[self.update, dict(self.other, coordinate=dict(lat=float('nan'), lng=141))]))
        with self.assertRaises(ValueError):
            self.run_inventory()
        self.write('locations.json', dict(schema=1, updates=[self.update, self.other]))
        self.write('registry.json', dict(schema=1, reviews=[dict(id='future',
            source=dict(name='GIS', version='2026', derivation='direct'), status='usable', checkedAt='2026-11-06',
            evidence=[dict(url='https://example.org/terms', locator='terms', checkedAt='2026-11-06')],
            selectors=[dict(facilityId='facility:new', recordSHA256=digest(self.update))])]))
        with self.assertRaises(ValueError):
            self.run_inventory(registry='registry.json')

    def test_future_terms_evidence_cannot_inherit_older_review_date(self):
        self.write('registry.json', dict(schema=1, reviews=[dict(id='future-evidence',
            source=dict(name='GIS', version='2026', derivation='direct'), status='usable', checkedAt='2026-11-05',
            evidence=[dict(url='https://example.org/terms', locator='terms', checkedAt='2026-11-06')],
            selectors=[dict(facilityId='facility:new', recordSHA256=digest(self.update))])]))
        with self.assertRaises(ValueError):
            self.run_inventory(registry='registry.json')

    def test_superseded_and_relation_evidence_are_in_input_hashes(self):
        content = b'previous facility evidence'
        (self.root / 'previous.txt').write_bytes(content)
        old_ev = dict(self.ev, snapshotPath='previous.txt', snapshotSHA256=hashlib.sha256(content).hexdigest())
        self.pending['evidence'] = old_ev
        self.write('ledger.json', dict(schema=1, places=[self.base, self.pending], relations=[]))
        result = self.run_inventory()
        self.assertIn('previous.txt', result['inputSHA256'])
        self.assertIsNone(result['records'][0]['temporalMetadata']['fetchedAt'])
        self.assertIsNone(result['records'][0]['temporalMetadata']['sourceAsOf'])

    def test_additional_candidate_file_retains_original_and_distinct_record(self):
        other = dict(self.update, coordinate=dict(lat=35.5, lng=140))
        self.write('original.json', dict(schema=1, updates=[other]))
        result = inventory.inventory(self.root, 'manifest.json', ['original.json'], as_of='2026-11-05')
        rows = [r for r in result['records'] if r['facilityId'] == 'facility:new']
        self.assertEqual(len(rows), 2)
        self.assertEqual({r['adoption'] for r in rows}, {'candidate', 'manifest-location'})
        self.assertTrue(all(r['currentlyAdoptedFacility'] for r in rows))

    def test_cli_cannot_write_fixed_issue7_baseline(self):
        out = self.root / 'data/work/issue7-baseline/new.json'
        out.parent.mkdir(parents=True)
        proc = subprocess.run([sys.executable, '-B', str(Path(inventory.__file__)), '--root', str(self.root),
                               '--manifest', 'manifest.json', '--no-default-candidates', '--as-of', '2026-11-05', '--out', str(out)], capture_output=True, text=True)
        self.assertNotEqual(proc.returncode, 0)
        self.assertFalse(out.exists())

    def test_cli_does_not_overwrite_existing_output(self):
        out = self.root / 'out.json'
        out.write_text('keep')
        proc = subprocess.run([sys.executable, '-B', str(Path(inventory.__file__)), '--root', str(self.root),
                               '--manifest', 'manifest.json', '--no-default-candidates', '--as-of', '2026-11-05', '--out', str(out)], capture_output=True, text=True)
        self.assertNotEqual(proc.returncode, 0)
        self.assertEqual(out.read_text(), 'keep')


class CheckedInSourceReviewTests(unittest.TestCase):
    def test_checked_in_reviews_match_current_adoptions_and_document_evidence(self):
        root = Path(__file__).resolve().parents[2]
        registry_path = 'data/national/source-review/registry.json'
        registry = json.loads((root / registry_path).read_text())
        self.assertTrue(registry['reviews'], 'initial review scope must be explicit')
        as_of = max(review['checkedAt'] for review in registry['reviews'])
        # No data/work input is needed. Exact selectors, original evidence hashes
        # and manifest approval hashes are checked by the same public function.
        result = inventory.inventory(root, registry=registry_path, as_of=as_of)
        by_key = {(row['facilityId'], row['recordSHA256']): row for row in result['records']}
        for review in registry['reviews']:
            with self.subTest(review=review['id']):
                self.assertTrue(review['evidence'])
                self.assertTrue(review.get('conditions', '').strip())
                for selector in review['selectors']:
                    row = by_key[(selector['facilityId'], selector['recordSHA256'])]
                    self.assertNotEqual(row['adoption'], 'candidate', 'initial review includes existing adoption')
                    self.assertEqual(row['reviewId'], review['id'])
                    self.assertTrue(row['evidence']['sourceLocator'])
                    self.assertTrue(row['evidence']['verificationMethod'])
                if review['status'] in ('conditional', 'usable'):
                    self.assertTrue(any(urlsplit(ev['url']).scheme == 'https' and ev['locator']
                                        for ev in review['evidence']))
        self.assertTrue(any(review['status'] == 'conditional' for review in registry['reviews']),
                        'pilot needs at least one specifically bounded usable source')
        self.assertTrue(any(row['termsStatus'] == 'unreviewed' for row in result['records']),
                        'initial sample must not silently approve every source')

    def test_retrieval_records_distinguish_success_failure_and_cover_review_urls(self):
        root = Path(__file__).resolve().parents[2]
        registry = json.loads((root / 'data/national/source-review/registry.json').read_text())
        log = json.loads((root / 'data/national/source-review/retrievals.json').read_text())
        self.assertEqual(log['schema'], 1)
        urls = set()
        for row in log['retrievals']:
            with self.subTest(url=row['url']):
                urls.add(row['url'])
                url = urlsplit(row['url'])
                self.assertEqual(url.scheme, 'https')
                self.assertTrue(url.hostname)
                self.assertFalse(url.username or url.password)
                timestamp = dt.datetime.fromisoformat(row['fetchedAt'])
                self.assertEqual(timestamp.utcoffset(), dt.timedelta(0))
                self.assertTrue(row['method'].strip())
                self.assertTrue(row['locator'].strip())
                self.assertIsInstance(row['status'], int)
                if 200 <= row['status'] < 300:
                    self.assertRegex(row['rawSHA256'], r'^[a-f0-9]{64}$')
                    self.assertIsInstance(row['rawBytes'], int)
                    self.assertGreater(row['rawBytes'], 0)
                    self.assertEqual(urlsplit(row['finalUrl']).scheme, 'https')
                    # Check only metadata, never read unpublished raw snapshots.
                    path = Path(row['localUnpublishedSnapshot'])
                    self.assertFalse(path.is_absolute())
                    self.assertNotIn('..', path.parts)
                    self.assertEqual(path.parts[:2], ('data', 'work'))
                else:
                    self.assertIsNone(row['rawSHA256'])
                    self.assertTrue(row['error'])
        for review in registry['reviews']:
            for evidence in review['evidence']:
                self.assertIn(evidence['url'], urls, 'review URL needs a retrieval attempt record')
        for relative in ('docs/source-inventory.md', 'docs/verification/issue15-source-review.md'):
            path = root / relative
            content = path.read_text()
            self.assertIn('source', content.lower())
            for target in re.findall(r'\]\(([^)]+)\)', content):
                if urlsplit(target).scheme or target.startswith('#'):
                    continue
                self.assertTrue((path.parent / target.split('#')[0]).is_file(), target)


if __name__ == '__main__':
    unittest.main()
