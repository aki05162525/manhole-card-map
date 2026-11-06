#!/usr/bin/env python3
"""Remove obsolete Lefthook-generated hooks, then install the current hooks."""

import json
from pathlib import Path
import subprocess
import sys


def install_hooks(lefthook):
    config = json.loads(subprocess.check_output(
        [str(lefthook), 'dump', '--format', 'json'], text=True))
    # Git resolves the shared hooks directory for both checkouts and worktrees,
    # including a configured core.hooksPath. Do not assume .git is a directory.
    hooks = Path(subprocess.check_output(
        ['git', 'rev-parse', '--git-path', 'hooks'], text=True).strip())
    if hooks.is_dir():
        for hook in hooks.iterdir():
            if hook.name in config or hook.is_symlink() or not hook.is_file():
                continue
            content = hook.read_bytes()
            # Lefthook 2.2.2's generated shell wrapper has no "generated" banner.
            # Require both its function signature and its hook-specific tail;
            # mentioning lefthook in a user's script is not sufficient.
            tail = f'call_lefthook run "{hook.name}" "$@"'.encode()
            if (content.startswith(b'#!/bin/sh\n')
                    and b'\ncall_lefthook()\n{\n' in content
                    and content.rstrip().endswith(tail)):
                hook.unlink()
                print(f'Removed obsolete Lefthook hook: {hook.name}', flush=True)
    subprocess.run([str(lefthook), 'install'], check=True)


if __name__ == '__main__':
    # An explicit binary lets temporary-repository tests use the installed tool.
    binary = Path(sys.argv[1]).resolve() if len(sys.argv) == 2 else (
        Path(__file__).resolve().parents[2] / 'web/node_modules/.bin/lefthook')
    install_hooks(binary)
