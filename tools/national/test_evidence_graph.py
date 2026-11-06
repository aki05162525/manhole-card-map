import hashlib
import json
from pathlib import Path
import tempfile
import subprocess
import os
import unittest

from evidence_graph import graph, git_environment


class GraphTest(unittest.TestCase):
    def test_hash_and_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'data/evidence/sub').mkdir(parents=True)
            (root / 'data/evidence/sub/raw.bin').write_bytes(b'raw')
            (root / 'data/evidence/sub/other.bin').write_bytes(b'other')
            (root / 'entry.json').write_text(json.dumps({'digest': hashlib.sha256(b'raw').hexdigest(), 'directory': 'data/evidence/sub', 'cache': 'data/work/cache'}))
            subprocess.run(['git', 'init', '-q', str(root)], check=True, env=git_environment())
            subprocess.run(['git', '-C', str(root), 'add', '.'], check=True, env=git_environment())
            result = graph(root, ['entry.json'])
            self.assertEqual('data/evidence/sub/other.bin', result['unreached'][0]['path'])
            self.assertTrue(result['unreached'][0]['underReferencedDirectory'])
            self.assertEqual(1, len(result['ignoredWork']))
            self.assertEqual(1, len(result['directories']))

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
            subprocess.run(['git', 'init', '-q', str(root)], check=True, env=git_environment())
            subprocess.run(['git', '-C', str(root), 'add', '.'], check=True, env=git_environment())
            result = graph(root, ['data/decision.json', 'data/history.json'])
            self.assertIn('data/image.png', [x['path'] for x in result['reachable']])
            self.assertEqual(1, len(result['brokenOrMismatch']))
            self.assertEqual(1, len(result['recordedPastState']))
            self.assertTrue(any(x['kind'] == 'historical' for x in result['references']))
            self.assertEqual(result, graph(root, ['data/decision.json', 'data/history.json']))


if __name__ == '__main__':
    unittest.main()
