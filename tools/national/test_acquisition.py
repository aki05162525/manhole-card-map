import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import acquisition as a


class AcquisitionTest(unittest.TestCase):
    def test_move(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'old'
            with patch('research_common.urlopen') as request:
                response = request.return_value.__enter__.return_value
                response.read.return_value = b'abc'
                response.status = 200
                response.headers = {}
                response.geturl.return_value = 'https://example.test/final'
                record = a.fetch('https://example.test', root, 'edition')
            shutil.move(root, Path(tmp) / 'new')
            self.assertEqual(a.verify(record, Path(tmp) / 'new'), b'abc')

    def test_outcomes(self):
        for status, headers, requested, expected in (
                (200, {}, {}, 'acquired'),
                (206, {'Content-Range': 'bytes 0-2/10'}, {'Range': 'bytes=0-2'}, 'acquired'),
                (206, {}, {}, 'failed'),
                (500, {}, {}, 'failed')):
            with self.subTest(status=status, requested=requested), tempfile.TemporaryDirectory() as tmp:
                with patch('research_common.urlopen') as request:
                    response = request.return_value.__enter__.return_value
                    response.read.return_value = b'abc'
                    response.status = status
                    response.headers = headers
                    response.geturl.return_value = 'https://example.test/final'
                    record = a.fetch('https://example.test', tmp, 'v1', requested)
                self.assertEqual(record['status'], expected)
                self.assertEqual(a.verify(record, tmp), b'abc')
                if expected == 'acquired':
                    with patch('research_common.urlopen', side_effect=AssertionError('network')):
                        reused = a.fetch('https://example.test', tmp, 'v1', requested)
                    self.assertEqual(reused['status'], 'cached')
                    self.assertEqual(reused['fetchedAt'], record['fetchedAt'])
                    Path(tmp, record['rawPath']).write_bytes(b'bad')
                    with self.assertRaises(ValueError):
                        a.verify(record, tmp)

    def test_paths_and_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'link').symlink_to(root, target_is_directory=True)
            for name in ('../escape', '/absolute', 'link/raw'):
                with self.assertRaises(ValueError):
                    a.safe_path(root, name)
            path = root / 'record.json'
            a.write_record(path, {})
            with self.assertRaises(FileExistsError):
                a.write_record(path, {})
