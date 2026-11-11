import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from event_base import event_base


class EventBaseTest(unittest.TestCase):
    def base(self, name, event):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'event.json'
            path.write_text(json.dumps(event))
            with patch.dict(os.environ, GITHUB_EVENT_NAME=name, GITHUB_EVENT_PATH=str(path)):
                return event_base()

    def test_pull_request_push_and_manual_run(self):
        self.assertEqual(self.base('pull_request', {'pull_request': {'base': {'sha': 'abc123'}}}), 'abc123')
        self.assertEqual(self.base('push', {'before': 'def456'}), 'def456')
        self.assertEqual(self.base('workflow_dispatch', {}), 'HEAD')

    def test_new_branch_or_missing_base_is_rejected(self):
        for name, event in [('push', {'before': '0' * 40}), ('push', {}), ('pull_request', {})]:
            with self.subTest(name=name, event=event), self.assertRaises(ValueError):
                self.base(name, event)


if __name__ == '__main__':
    unittest.main()
