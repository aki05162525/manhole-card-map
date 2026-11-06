#!/usr/bin/env python3
"""Skip publishing only when all changes are known to be private inputs."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

PRIVATE_DIRS = ('docs/', 'tools/ci/', 'tools/dev/', '.agents/', '.apm/')
PRIVATE_FILES = {
    'web/README.md', 'lefthook.yml', 'apm.yml', 'apm.lock.yaml',
    '.github/workflows/ci.yml', '.github/workflows/agents.yml',
}
CONFIG_KEYS = ('VITE_MAP_STYLE_URL', 'PUBLIC_RELEASE', 'PUBLIC_ORIGIN')
SHA_PATTERN = r'[0-9a-f]{40}'


def publish_needed(paths):
    return any(not (path.startswith(PRIVATE_DIRS) or path in PRIVATE_FILES
                    or ('/' not in path and path.endswith('.md'))) for path in paths)


def config_fingerprint(env):
    payload = json.dumps({key: env.get(key, '') for key in CONFIG_KEYS},
                         sort_keys=True, separators=(',', ':')).encode()
    return hashlib.sha256(payload).hexdigest()[:16]


def parse_marker(message):
    if not isinstance(message, str):
        return None
    match = re.fullmatch(rf'sha=({SHA_PATTERN});cfg=([0-9a-f]{{16}})', message)
    return match.groups() if match else None


def changed_paths(base, cwd=None):
    subprocess.run(['git', 'cat-file', '-e', f'{base}^{{commit}}'], cwd=cwd,
                   check=True, capture_output=True)
    result = subprocess.run(
        ['git', 'diff', '--name-only', '--no-renames', '-z', base, 'HEAD', '--'],
        cwd=cwd, check=True, capture_output=True,
    )
    return [path.decode('utf-8', errors='surrogateescape')
            for path in result.stdout.split(b'\0') if path]


def base_decision(base):
    if not re.fullmatch(SHA_PATTERN, base or ''):
        return True, 'missing-or-invalid-base'
    try:
        needed = publish_needed(changed_paths(base))
        return needed, 'publish-inputs-changed' if needed else 'private-inputs-only'
    except (OSError, subprocess.SubprocessError):
        return True, 'base-or-diff-unavailable'


def marker_decision(message, cfg):
    marker = parse_marker(message)
    if marker is None:
        return True, 'production-marker-unknown'
    base, previous_cfg = marker
    if cfg != previous_cfg:
        return True, 'configuration-changed'
    return base_decision(base)


def read_production_marker(wrangler_version, worker):
    """Wrangler JSON adapter. Any unsupported shape/traffic split is unknown.

    status returns the active deployment, not the latest uploaded preview version.
    Read the version annotation (a rollback deployment has its own message).
    Keep all assumptions about Wrangler JSON in this function.
    """
    try:
        command = ['bunx', f'wrangler@{wrangler_version}']

        def read(*args):
            result = subprocess.run(
                [*command, *args, '--name', worker, '--json'],
                check=True, capture_output=True, text=True, timeout=180,
            )
            return json.loads(result.stdout)

        deployment = read('deployments', 'status')
        versions = deployment['versions']
        if not isinstance(versions, list) or len(versions) != 1:
            return None
        active = versions[0]
        version_id = active['version_id']
        if active['percentage'] != 100 or not isinstance(version_id, str):
            return None
        if not re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}', version_id):
            return None
        version = read('versions', 'view', version_id)
        if version['id'] != version_id:
            return None
        message = version['annotations']['workers/message']
        return message if parse_marker(message) else None
    except (OSError, subprocess.SubprocessError, ValueError, KeyError, TypeError):
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', default='')
    parser.add_argument('--production', action='store_true')
    parser.add_argument('--worker', default='manhole-card-map')
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    cfg = config_fingerprint(os.environ)
    if args.force:
        needed, reason = True, 'workflow-dispatch'
    elif args.production:
        try:
            package = json.loads(Path('web/package.json').read_text())
            message = read_production_marker(package['devDependencies']['wrangler'], args.worker)
        except (OSError, ValueError, KeyError, TypeError):
            message = None
        needed, reason = marker_decision(message, cfg)
    else:
        needed, reason = base_decision(args.base)
    outputs = f'publish={str(needed).lower()}\nreason={reason}\n'
    if args.production or args.force:
        # Failure to identify the checkout must stop a publish, never label it
        # with a different commit's SHA.
        head = subprocess.run(['git', 'rev-parse', 'HEAD'], check=True,
                              capture_output=True, text=True).stdout.strip()
        if not re.fullmatch(SHA_PATTERN, head):
            raise ValueError('Invalid checkout SHA')
        outputs += f'marker=sha={head};cfg={cfg}\n'
    print(outputs, end='')
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
            output.write(outputs)


if __name__ == '__main__':
    main()
