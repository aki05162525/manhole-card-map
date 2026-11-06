import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import candidate_pipeline

URL = 'https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/16/58043/26045.pbf'
SQUARE = [[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]


class Contract(unittest.TestCase):
    def test_candidate_only(self):
        self.assertEqual(candidate_pipeline.VERSION, '1')
        observation = candidate_pipeline.new_observation('facility:test', ['centroid'])
        self.assertEqual(observation['review']['status'], 'pending')
        self.assertEqual(observation['buildingIdentity']['status'], 'not_checked')


class Pipeline(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        raw = b'artificial tile'
        (self.root / 'tile').write_bytes(raw)
        self.digest = hashlib.sha256(raw).hexdigest()
        self.record = dict(schema=1, status='acquired', url=URL, rawPath='tile', sha256=self.digest, bytes=len(raw))
        self.write_record()
        self.config = dict(facilityId='facility:test', source=dict(record='record.json', storage='.', sha256=self.digest),
                           tile=dict(z=16, x=58043, y=26045), layer='BldA', featureIndex=0, method='centroid')

    def write_record(self):
        (self.root / 'record.json').write_text(json.dumps(self.record))

    def generate(self, coordinates, **config):
        geometry = dict(type='Polygon', coordinates=coordinates)
        tile = {'BldA': dict(extent=4096, features=[dict(geometry=geometry, properties={'vt_code': 3101})])}
        with patch.object(candidate_pipeline, 'decode_tile', return_value=tile):
            return candidate_pipeline.generate(dict(self.config, **config), self.root)

    def test_fixed_input_is_only_a_candidate(self):
        first = self.generate([[[10, 10], [110, 10], [110, 110], [10, 110], [10, 10]]])
        self.assertEqual(json.dumps(first), json.dumps(self.generate([[[10, 10], [110, 10], [110, 110], [10, 110], [10, 10]]])))
        self.assertEqual(first['result'], 'candidate')
        self.assertNotIn('reviewedBy', json.dumps(first))
        self.assertEqual(first['observation']['review']['status'], 'pending')

    def test_rejects_wrong_selection_or_source(self):
        inner = [[[10, 10], [110, 10], [110, 110], [10, 110], [10, 10]]]
        for key, value in [('featureIndex', 1), ('layer', 'wrong')]:
            with self.assertRaises(ValueError):
                self.generate(inner, **{key: value})
        with self.assertRaises(ValueError):
            self.generate(inner, source=dict(self.config['source'], sha256='0' * 64))

    def test_rejects_centroid_in_hole(self):
        with self.assertRaises(ValueError):
            self.generate([[[10, 10], [110, 10], [110, 110], [10, 110], [10, 10]],
                           [[35, 35], [85, 35], [85, 85], [35, 85], [35, 35]]])

    def test_tile_must_match_source_url(self):
        inner = [[[10, 10], [110, 10], [110, 110], [10, 110], [10, 10]]]
        with self.assertRaisesRegex(ValueError, 'tile does not match source URL'):
            self.generate(inner, tile=dict(z=16, x=58044, y=26045))
        del self.record['url']
        self.write_record()
        with self.assertRaisesRegex(ValueError, 'tile does not match source URL'):
            self.generate(inner)

    def test_rejects_feature_clipped_at_tile_edge(self):
        for ring in (SQUARE, [[3990, 10], [4096, 10], [4096, 110], [3990, 110], [3990, 10]],
                     [[3990, 10], [4120, 10], [4120, 110], [3990, 110], [3990, 10]]):
            with self.assertRaisesRegex(ValueError, 'tile boundary'):
                self.generate([ring])

    def test_boundary_and_rounding(self):
        tile = dict(z=16, x=58043, y=26045)
        geometry = dict(type='Polygon', coordinates=[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]])
        self.assertFalse(candidate_pipeline.rounded_coordinate(geometry, tile, [0, 0.5])['mechanicalChecksPassed'])
        tiny = dict(type='Polygon', coordinates=[[[0, 0], [1e-9, 0], [1e-9, 1e-9], [0, 1e-9], [0, 0]]])
        self.assertFalse(candidate_pipeline.rounded_coordinate(tiny, tile, [5e-10, 5e-10])['mechanicalChecksPassed'])


if __name__ == '__main__':
    unittest.main()
