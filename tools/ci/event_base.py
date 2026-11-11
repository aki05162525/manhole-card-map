"""The commit a GitHub Actions event compares HEAD with."""
import json
import os
from pathlib import Path


def event_base():
    """The pull request base or the commit before a push; HEAD for a manual run, which compares nothing.

    Raises ValueError when the event names no base (a new branch, or an all-zero sha).
    """
    event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    name = os.environ['GITHUB_EVENT_NAME']
    if name == 'workflow_dispatch':
        return 'HEAD'
    base = event.get('pull_request', {}).get('base', {}).get('sha') if name == 'pull_request' else event.get('before')
    if not base or set(base) == {'0'}:
        raise ValueError('comparison base unavailable')
    return base
