"""Prepare a fresh checkout or worktree: tools, frontend dependencies, hooks and agent skills."""
import argparse
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]


def steps(has_apm):
    web = ROOT / 'web'
    yield ['mise', 'install'], ROOT
    yield ['mise', 'exec', '--', 'bun', 'install', '--frozen-lockfile'], web
    yield ['mise', 'exec', '--', 'bun', 'run', 'hooks:install'], web
    if has_apm:
        # Skill outputs are not tracked; see docs/development-agents.md.
        yield ['apm', 'install', '--frozen'], ROOT


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args(argv)
    has_apm = shutil.which('apm') is not None
    for command, cwd in steps(has_apm):
        print('+', ' '.join(command), flush=True)
        subprocess.run(command, cwd=cwd, check=True)
    if not has_apm:
        print('apm was not found, so agent skills were not restored. '
              'See docs/development-agents.md.', file=sys.stderr)
    return 0


if __name__ == '__main__':
    sys.exit(main())
