import unittest
import candidate_pipeline

class Contract(unittest.TestCase):
    def test_candidate_only(self):
        self.assertEqual(candidate_pipeline.VERSION, '1')
        observation = candidate_pipeline.new_observation('facility:test', ['centroid'])
        self.assertEqual(observation['review']['status'], 'pending')
        self.assertEqual(observation['buildingIdentity']['status'], 'not_checked')

import hashlib
import json
import tempfile
from pathlib import Path
from unittest.mock import patch

class Pipeline(unittest.TestCase):
    def test_fixed_input_and_rejections(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            raw = b'artificial tile'
            (root/'tile').write_bytes(raw)
            digest = hashlib.sha256(raw).hexdigest()
            (root/'record.json').write_text(json.dumps(dict(schema=1, status='acquired', rawPath='tile', sha256=digest, bytes=len(raw))))
            config = dict(facilityId='facility:test', source=dict(record='record.json', storage='.', sha256=digest), tile=dict(z=16,x=58043,y=26045), layer='BldA', featureIndex=0, method='centroid')
            geometry = dict(type='Polygon', coordinates=[[[0,0],[100,0],[100,100],[0,100],[0,0]]])
            tile = {'BldA': dict(extent=4096, features=[dict(geometry=geometry, properties={'vt_code':3101})])}
            with patch.object(candidate_pipeline, 'decode_tile', return_value=tile):
                first = candidate_pipeline.generate(config, root)
                self.assertEqual(json.dumps(first), json.dumps(candidate_pipeline.generate(config, root)))
                self.assertEqual(first['result'], 'candidate')
                self.assertNotIn('reviewedBy', json.dumps(first))
                self.assertEqual(first['observation']['review']['status'], 'pending')
                for key, value in [('featureIndex',1), ('layer','wrong')]:
                    with self.assertRaises(ValueError):
                        candidate_pipeline.generate(dict(config, **{key:value}), root)
                with self.assertRaises(ValueError):
                    candidate_pipeline.generate(dict(config, source=dict(config['source'], sha256='0'*64)), root)
                geometry['coordinates'].append([[25,25],[75,25],[75,75],[25,75],[25,25]])
                with self.assertRaises(ValueError):
                    candidate_pipeline.generate(config, root)
    def test_boundary_and_rounding(self):
        geometry = dict(type='Polygon', coordinates=[[[0,0],[1,0],[1,1],[0,1],[0,0]]])
        for point in ([0,0.5],):
            self.assertFalse(candidate_pipeline.rounded_coordinate(geometry,dict(z=16,x=58043,y=26045),point)['mechanicalChecksPassed'])

        tiny = dict(type='Polygon', coordinates=[[[0,0],[1e-9,0],[1e-9,1e-9],[0,1e-9],[0,0]]])
        self.assertFalse(candidate_pipeline.rounded_coordinate(tiny,dict(z=16,x=58043,y=26045),[5e-10,5e-10])['mechanicalChecksPassed'])
