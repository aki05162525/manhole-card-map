"""Regression tests for shared research mechanics; none approve a building identity."""
import io
from urllib.error import HTTPError
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
            self.assertIn('range', record['error'])
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


class GeometryTests(unittest.TestCase):
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


if __name__ == '__main__':
    unittest.main()
