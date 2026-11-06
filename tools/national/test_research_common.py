"""Regression tests for shared research mechanics; none approve a building identity."""
import copy
import hashlib
import io
from urllib.error import HTTPError
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import research_common as research


def polygon(left=0, top=0, right=100, bottom=100):
    return {'type': 'Polygon', 'coordinates': [[[left, top], [right, top], [right, bottom], [left, bottom], [left, top]]]}


class Response:
    status = 200
    headers = {'ETag': '"edition-1"', 'Last-Modified': 'Mon, 01 Jan 2024 00:00:00 GMT'}
    def __init__(self, raw=b'original'):
        self.raw = raw
    def read(self):
        return self.raw
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False


class AcquisitionTests(unittest.TestCase):
    def test_cache_keeps_original_provenance_and_detects_tampering(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(research, 'urlopen', return_value=Response()) as opener:
            raw, first = research.fetch_cached('https://example.test/map', directory, 'v1')
            again, cached = research.fetch_cached('https://example.test/map', directory, 'v1')
            self.assertEqual(raw, again)
            self.assertEqual(opener.call_count, 1)
            self.assertEqual(cached['status'], 'cached')
            for key in ('fetchedAt', 'sha256', 'url', 'version', 'etag', 'rawPath'):
                self.assertEqual(first[key], cached[key])
            Path(cached['rawPath']).write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError, 'hash'):
                research.fetch_cached('https://example.test/map', directory, 'v1')

    def test_range_failure_keeps_response_bytes_as_failed_evidence(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(research, 'urlopen', return_value=Response()):
            raw, record = research.fetch_cached('https://example.test/map', directory, 'v1', headers={'Range': 'bytes=0-7'})
            self.assertIsNone(raw)
            self.assertEqual(record['status'], 'failed')
            self.assertEqual(research.read_verified(record['responseRawPath'], record['responseSHA256']), b'original')
            self.assertFalse(list(Path(directory).glob('[0-9a-f]' * 64 + '.json')))

    def test_http_error_keeps_error_body_and_status(self):
        error = HTTPError('https://example.test/map', 404, 'missing', {'Content-Type': 'text/html'}, io.BytesIO(b'missing page'))
        with tempfile.TemporaryDirectory() as directory, patch.object(research, 'urlopen', side_effect=error):
            raw, record = research.fetch_cached('https://example.test/map', directory, 'v1')
            self.assertIsNone(raw)
            self.assertEqual(record['httpStatus'], 404)
            self.assertEqual(record['responseHeaders']['Content-Type'], 'text/html')
            self.assertEqual(research.read_verified(record['responseRawPath'], record['responseSHA256']), b'missing page')

    def test_adjacent_tiles_clip_at_world_edge(self):
        self.assertEqual(research.adjacent_tiles({'z': 1, 'x': 0, 'y': 0}), [
            {'z': 1, 'x': 0, 'y': 0}, {'z': 1, 'x': 1, 'y': 0},
            {'z': 1, 'x': 0, 'y': 1}, {'z': 1, 'x': 1, 'y': 1}])

    def test_valid_range_and_new_version_create_separate_records(self):
        response = Response(b'abc')
        response.status = 206
        response.headers = {'Content-Range': 'bytes 10-12/20', 'ETag': '"e1"'}
        with tempfile.TemporaryDirectory() as directory, patch.object(research, 'urlopen', return_value=response) as opener:
            raw, old = research.fetch_cached('https://example.test/map', directory, 'v1', headers={'Range': 'bytes=10-12'})
            _, new = research.fetch_cached('https://example.test/map', directory, 'v2', headers={'Range': 'bytes=10-12'})
            self.assertEqual(raw, b'abc')
            self.assertEqual(old['status'], 'acquired')
            self.assertEqual(new['version'], 'v2')
            self.assertEqual(opener.call_count, 2)
            self.assertEqual(old['rawPath'], new['rawPath'])  # identical bytes share immutable object

    def test_new_version_and_failed_attempt_do_not_replace_old_raw(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(research, 'urlopen', return_value=Response()):
                _, old = research.fetch_cached('https://example.test/map', directory, 'v1')
            with patch.object(research, 'urlopen', side_effect=OSError('offline')):
                raw, failed = research.fetch_cached('https://example.test/map', directory, 'v2')
            self.assertIsNone(raw)
            self.assertEqual(failed['status'], 'failed')
            self.assertIn('offline', failed['error'])
            self.assertNotIn('sha256', failed)
            self.assertEqual(Path(old['rawPath']).read_bytes(), b'original')
            self.assertTrue(list(Path(directory).glob('attempt-*.json')))

    def test_range_request_requires_matching_partial_response(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(research, 'urlopen', return_value=Response()):
            raw, record = research.fetch_cached('https://example.test/map', directory, 'v1', headers={'Range': 'bytes=0-7'})
            self.assertIsNone(raw)
            self.assertEqual(record['status'], 'failed')
            self.assertIn('range', record['error'])


class GeometryTests(unittest.TestCase):
    def test_combination_retains_all_features_and_reports_outer_clipping(self):
        first = {'tile': {'z': 2, 'x': 1, 'y': 1}, 'extent': 100,
                 'features': [{'id': 'large', 'geometry': polygon(-20, 10, 150, 90)},
                              {'id': 'seam', 'geometry': polygon(80, 20, 100, 40)}]}
        second = {'tile': {'z': 2, 'x': 2, 'y': 1}, 'extent': 100,
                  'features': [{'id': 'other', 'geometry': polygon(0, 20, 20, 40)}]}
        merged = research.combine_tiles([first, second])
        self.assertEqual(len(merged['features']), 3)
        self.assertEqual(merged['features'][2]['geometry']['coordinates'][0][0], [100, 20])
        self.assertTrue(merged['features'][0]['outerBoundaryTouched'])
        self.assertFalse(merged['features'][1]['outerBoundaryTouched'])
        self.assertTrue(merged['features'][1]['tileBoundaryTouched'])
        svg = research.render_svg(merged)
        self.assertEqual(svg.count('<path '), 3)
        self.assertIn('viewBox="-20 0 220 100"', svg)
        self.assertIn('fill-rule="evenodd"', svg)
        self.assertIn('N up', svg)
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            research.combine_tiles([first, first])

    def test_holes_and_polygon_boundaries_are_not_inside(self):
        geometry = polygon()
        geometry['coordinates'].append([[40, 40], [60, 40], [60, 60], [40, 60], [40, 40]])
        self.assertFalse(research.contains_point(geometry, (50, 50)))
        self.assertFalse(research.contains_point(geometry, (0, 50)))
        self.assertTrue(research.contains_point(geometry, (20, 20)))
        multi = {'type': 'MultiPolygon', 'coordinates': [geometry['coordinates'], polygon(200, 0, 300, 100)['coordinates']]}
        self.assertTrue(research.contains_point(multi, (250, 50)))

    def test_rounding_can_move_an_inside_point_outside(self):
        tile = {'z': 16, 'x': 55000, 'y': 25000}
        point = (50.0, 50.0)
        geometry = polygon(49.999999, 49.999999, 50.000001, 50.000001)
        result = research.rounded_coordinate(geometry, tile, point)
        self.assertTrue(result['unroundedWithin'])
        self.assertFalse(result['roundedWithin'])
        self.assertFalse(result['mechanicalChecksPassed'])
        broad = research.rounded_coordinate(polygon(), tile, point)
        self.assertTrue(broad['roundedWithin'])
        self.assertFalse(broad['identityApproved'])


class ObservationTests(unittest.TestCase):
    def test_planned_methods_are_not_executed_or_approved(self):
        row = research.new_observation('facility:test', ['all-pages', 'adjacent-tiles'])
        research.validate_observation(row)
        self.assertEqual(row['performedMethods'], [])
        self.assertEqual(row['acquisition']['status'], 'not_attempted')
        self.assertEqual(row['buildingIdentity']['status'], 'not_checked')
        self.assertEqual(row['review']['status'], 'pending')
        row['review']['status'] = 'approved'
        with self.assertRaisesRegex(ValueError, 'identity|review'):
            research.validate_observation(row)

    def approved_observation(self):
        row = research.new_observation('facility:test', [])
        for key in ('buildingIdentity', 'licence'):
            row[key] = {'status': 'confirmed', 'evidence': ['source.json']}
        row['crs'] = {'status': 'insufficient', 'product': 'test-product', 'evidence': ['datum-name-unresolved.json']}
        row['mechanicalChecks'] = {'status': 'passed', 'evidence': ['calculation.json']}
        row['review'] = {'status': 'approved', 'reviewer': 'independent', 'evidence': ['review.json']}
        row['positionSuitability'] = {
            'status': 'acceptable',
            'evidence': ['uncertainty-assessment.json'],
            'uncertaintyBasis': 'Independent control points constrain the positional uncertainty.',
            'buildingAssessment': 'The uncertainty region remains within the identified building, away from the adjacent road.',
        }
        return row

    def test_site_confirmed_approval_requirements(self):
        row = self.approved_observation()
        row['buildingIdentity']['status'] = 'site_confirmed'
        row['surroundings'] = {'status': 'confirmed', 'evidence': ['site-review.json']}
        row['positionSuitability']['buildingAssessment'] = '棟は未特定。同一敷地内約50mで、道路・線路・川から離れた施設内の点。'
        research.validate_observation(row)
        for field, key, value in [
                ('surroundings', 'status', 'not_checked'),
                ('surroundings', 'status', 'insufficient'),
                ('buildingIdentity', 'evidence', []),
                ('buildingIdentity', 'status', 'not_checked'),
                ('positionSuitability', 'buildingAssessment', ' '),
                ('licence', 'status', 'insufficient'),
                ('mechanicalChecks', 'status', 'failed'),
                ('positionSuitability', 'status', 'held')]:
            with self.subTest(field=field, key=key, value=value):
                invalid = copy.deepcopy(row)
                invalid[field][key] = value
                with self.assertRaises(ValueError):
                    research.validate_observation(invalid)

    def test_unresolved_datum_name_with_evidenced_suitability_can_be_approved(self):
        row = self.approved_observation()
        research.validate_observation(row)
        self.assertEqual(row['crs']['status'], 'insufficient')

    def test_confirmed_crs_alone_does_not_establish_suitability(self):
        row = self.approved_observation()
        row['crs']['status'] = 'confirmed'
        del row['positionSuitability']
        with self.assertRaisesRegex(ValueError, 'suitability'):
            research.validate_observation(row)

    def test_suitability_requires_basis_building_assessment_and_evidence(self):
        for key in ('uncertaintyBasis', 'buildingAssessment', 'evidence'):
            with self.subTest(key=key):
                row = self.approved_observation()
                row['positionSuitability'][key] = [] if key == 'evidence' else ' '
                with self.assertRaisesRegex(ValueError, 'suitability'):
                    research.validate_observation(row)

    def test_suitability_does_not_override_failed_crs_or_unconfirmed_building(self):
        for key, status in [('crs', 'failed'), ('crs', 'not_checked'), ('buildingIdentity', 'insufficient'), ('licence', 'insufficient')]:
            with self.subTest(key=key, status=status):
                row = self.approved_observation()
                row[key]['status'] = status
                with self.assertRaises(ValueError):
                    research.validate_observation(row)

    def test_mechanical_success_cannot_approve_crs_or_identity(self):
        row = research.new_observation('facility:test', [])
        row['mechanicalChecks'] = {'status': 'passed', 'evidence': ['calculation.json']}
        research.validate_observation(row)
        self.assertEqual(row['crs']['status'], 'not_checked')
        self.assertEqual(row['buildingIdentity']['status'], 'not_checked')
        row['pages'] = {'total': 3, 'checked': [1, 1, 4]}
        with self.assertRaisesRegex(ValueError, 'page'):
            research.validate_observation(row)


if __name__ == '__main__':
    unittest.main()
