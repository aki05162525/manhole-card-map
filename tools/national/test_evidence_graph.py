import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from evidence_graph import graph


class GraphTest(unittest.TestCase):
    def test_closure(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'data').mkdir()
            (root / 'data/image.png').write_bytes(b'image')
            digest = hashlib.sha256(b'image').hexdigest()
            (root / 'data/decision.json').write_text(json.dumps({
                'inputSHA256': {'data/image.png': digest},
                'relative': './cycle.json', 'missing': 'data/missing.json',
                'bad': {'path': 'data/image.png', 'sha256': '0' * 64},
                'pointer': 'data/cycle.json#/ok'}))
            (root / 'data/cycle.json').write_text(json.dumps({
                'ok': True, 'path': './decision.json'}))
            (root / 'data/history.json').write_text(json.dumps({
                'head': 'old', 'files': [{'path': 'data/image.png', 'sha256': 'f' * 64}]}))
            result = graph(root, ['data/decision.json', 'data/history.json'])
            self.assertIn('data/image.png', [x['path'] for x in result['reachable']])
            self.assertEqual(2, len(result['brokenOrMismatch']))
            self.assertTrue(any(x['kind'] == 'historical' for x in result['references']))
            self.assertEqual(result, graph(root, ['data/decision.json', 'data/history.json']))


if __name__ == '__main__':
    unittest.main()
