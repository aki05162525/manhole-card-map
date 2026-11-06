import hashlib
import json
from pathlib import Path
import tempfile
import subprocess
import unittest

from evidence_graph import graph, git_environment, roots


class GraphTest(unittest.TestCase):
    def repository(self, files):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        for name, value in files.items():
            path = root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(value if isinstance(value, bytes) else json.dumps(value).encode())
        for args in (['init', '-q', str(root)], ['-C', str(root), 'add', '.']):
            subprocess.run(['git', *args], env=git_environment(), check=True)
        return root

    def run_graph(self, entry, files=None):
        return graph(self.repository({'entry.json': entry, **(files or {})}), ['entry.json'])

    def test_decision_input_sha256(self):
        r = self.run_graph({'inputSHA256': {'data/raw': hashlib.sha256(b'x').hexdigest()}}, {'data/raw': b'x'})
        self.assertEqual(2, len(r['reachable']))

    def test_json_pointer(self):
        self.assertFalse(self.run_graph('data/a.json#/a/0', {'data/a.json': {'a': [1]}})['brokenOrMismatch'])

    def test_json_pointer_mismatch(self):
        self.assertEqual('json-pointer', self.run_graph('data/a.json#/b', {'data/a.json': {}})['brokenOrMismatch'][0]['reason'])

    def test_dictionary_path(self):
        self.assertEqual(2, len(self.run_graph({'data/a': '0' * 64}, {'data/a': b'x'})['reachable']))

    def test_relative(self):
        self.assertEqual(2, len(self.run_graph('./a.json', {'a.json': {}})['reachable']))

    def test_bare_resolution(self):
        r = self.run_graph({'file': 'a.json'}, {'sub/a.json': {}})
        self.assertEqual(2, len(r['reachable']))

    def test_bare_ambiguity(self):
        r = self.run_graph({'file': 'a.json'}, {'a/a.json': {}, 'b/a.json': {}})
        self.assertEqual(1, len(r['suspectReferences']))
        self.assertFalse(r['brokenOrMismatch'])

    def test_bare_missing(self):
        self.assertEqual(1, len(self.run_graph({'file': 'absent.json'})['suspectReferences']))

    def test_content_hash(self):
        self.assertEqual(2, len(self.run_graph(hashlib.sha256(b'x').hexdigest(), {'data/evidence/a/raw': b'x'})['reachable']))

    def test_directory_not_expanded(self):
        self.assertEqual(1, len(self.run_graph('data/evidence/a', {'data/evidence/a/raw': b'x'})['reachable']))

    def test_directory_roots(self):
        name = 'data/national/issue16/a/b/c.json'
        root = self.repository({name: {}})
        self.assertIn(name, roots(root, {name}))

    def test_referenced_directory(self):
        r = self.run_graph(['data', 'data/evidence', 'data/evidence/a', 'data/evidence/a/b'], {'data/evidence/a/b/raw': b'x', 'data/evidence/z/raw': b'z'})
        self.assertEqual(['data/evidence/a/b', None], [x['referencedDirectory'] for x in r['unreached']])

    def test_cycle(self):
        self.assertEqual(1, len(self.run_graph('./entry.json')['reachable']))

    def test_missing(self):
        self.assertEqual(1, len(self.run_graph('data/absent')['brokenOrMismatch']))

    def test_work(self):
        self.assertEqual(1, len(self.run_graph('data/work/cache')['ignoredWork']))

    def test_immutable_mismatch(self):
        r = self.run_graph({'path': 'data/evidence/a/raw.pdf', 'sha256': '0' * 64}, {'data/evidence/a/raw.pdf': b'x'})
        self.assertEqual(1, len(r['immutableMismatch']))

    def test_recorded_past_state(self):
        self.assertEqual(1, len(self.run_graph({'path': 'data/a.json', 'sha256': '0' * 64}, {'data/a.json': {}})['recordedPastState']))

    def test_historical_commit(self):
        r = self.run_graph({'head': 'old', 'files': [{'path': 'data/missing', 'sha256': '0' * 64}]})
        self.assertFalse(r['brokenOrMismatch'])

    def test_absolute_history(self):
        r = self.run_graph({'path': '/old/file', 'sha256': '0' * 64})
        self.assertFalse(r['unsupported'])
        self.assertTrue(all(x['kind'] == 'historical' for x in r['references']))

    def test_prose(self):
        self.assertFalse(self.run_graph('cmd/builddata/ledger.go validateEvidence uses time.Parse(...)')['references'])

    def test_tracked_spaces(self):
        self.assertEqual(2, len(self.run_graph('data/a b.json', {'data/a b.json': {}})['reachable']))

    def test_all_national_records_are_roots(self):
        # Follow-up and remaining-work records cite originals outside the manifest.
        r = graph(self.repository({
            'data/national/issue76/saitama/outcomes.json': {'snapshotPath': 'data/evidence/issue60/a.pdf', 'sha256': hashlib.sha256(b'pdf').hexdigest()},
            'data/evidence/issue60/a.pdf': b'pdf', 'data/evidence/issue60/b.pdf': b'other'}))
        self.assertIn('data/evidence/issue60/a.pdf', {x['path'] for x in r['reachable']})
        self.assertEqual(['data/evidence/issue60/b.pdf'], [x['path'] for x in r['unreached']])

    def test_recursive_roots(self):
        names = {'data/national/issue7/assignment-baseline.json', 'data/national/issue7/a/b/c.json'}
        self.assertTrue(names.issubset(roots(Path('.'), names)))

    def test_deterministic_bytes(self):
        root = self.repository({'entry.json': 'data/evidence/a', 'data/evidence/a/raw': b'x'})
        self.assertEqual(json.dumps(graph(root, ['entry.json']), sort_keys=True).encode(), json.dumps(graph(root, ['entry.json']), sort_keys=True).encode())

    def test_output_refusals(self):
        root = self.repository({'entry.json': {}})
        script = Path(__file__).with_name('evidence_graph.py')
        for out in (root / 'entry.json', root / 'data/new.json', root / 'data/work/new.json'):
            result = subprocess.run(['python3', '-B', str(script), '--root', str(root), '--out', str(out)], capture_output=True)
            self.assertNotEqual(0, result.returncode)


if __name__ == '__main__':
    unittest.main()
