from functools import partial
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from importlib.util import find_spec
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from threading import Thread
import unittest
from unittest.mock import patch

import acquisition
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


@unittest.skipUnless(find_spec('mapbox_vector_tile'), 'optional research dependency not installed')
class FetchToCandidate(unittest.TestCase):
    def test_saved_pbf_via_http_and_cached_record(self):
        original = (Path(__file__).resolve().parents[2] /
                    'data/evidence/national/shizuoka-site-tolerance3-20261106/original/58043-26045.pbf')
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            tile = root / 'http/xyz/optimal_bvmap-v1/16/58043/26045.pbf'
            tile.parent.mkdir(parents=True)
            shutil.copyfile(original, tile)
            handler = partial(SimpleHTTPRequestHandler, directory=str(root / 'http'))
            with ThreadingHTTPServer(('127.0.0.1', 0), handler) as server:
                thread = Thread(target=server.serve_forever)
                thread.start()
                try:
                    url = f'http://127.0.0.1:{server.server_port}/xyz/optimal_bvmap-v1/16/58043/26045.pbf'
                    acquired = acquisition.fetch(url, root / 'storage', 'local-example')
                finally:
                    server.shutdown()
                    thread.join()
            # With the server closed, a second fetch must use the immutable cache.
            cached = acquisition.fetch(url, root / 'storage', 'local-example')
            self.assertEqual(cached['fetchedAt'], acquired['fetchedAt'])
            for status, record in [('acquired', acquired), ('cached', cached)]:
                with self.subTest(status=status):
                    self.assertEqual(record['status'], status)
                    self.assertFalse(Path(record['rawPath']).is_absolute())
                    self.assertEqual(acquisition.verify(record, root / 'storage'), original.read_bytes())
                    # The --out record is outside storage; both config refs use config's directory.
                    acquisition.write_record(root / f'{status}.json', record)
                    config = dict(facilityId='facility:example', source=dict(
                        record=f'{status}.json', storage='storage', sha256=record['sha256']),
                        tile=dict(z=16, x=58043, y=26045), layer='BldA', featureIndex=17, method='centroid')
                    (root / 'config.json').write_text(json.dumps(config))
                    output = root / f'{status}-candidate.json'
                    subprocess.run([sys.executable, '-B', str(Path(candidate_pipeline.__file__).resolve()),
                                    str(root / 'config.json'), '--out', str(output)],
                                   check=True, capture_output=True, text=True)
                    candidate = json.loads(output.read_text())
                    self.assertEqual(candidate['coordinate'], dict(lat=34.6084848, lng=138.8403272))
                    self.assertEqual(candidate['acquisition'], record)
                    self.assertEqual(candidate['observation']['review']['status'], 'pending')


if __name__ == '__main__':
    unittest.main()
