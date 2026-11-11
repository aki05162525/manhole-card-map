"""Select CI suites; unknown paths or unavailable history run all suites."""
import os
import subprocess

from event_base import event_base

ALL = {'frontend', 'backend', 'agents'}


def classify(paths):
    suites = set()
    for path in paths:
        # Skill files are Markdown too: inspect them before the documentation rule.
        if path in {'apm.yml', 'apm.lock.yaml'} or path.startswith(('.agents/', '.apm/')):
            suites.add('agents')
        elif path == '.gitignore':
            suites.update(ALL)
        elif path.startswith(('.github/', 'tools/ci/', 'tools/dev/')) or path in {'mise.toml', 'lefthook.yml'}:
            suites.update(ALL)
        elif path.startswith('docs/') or path == 'web/README.md' or ('/' not in path and path.endswith('.md')):
            continue
        elif path == 'data/card-ids.json':
            suites.update({'frontend', 'backend'})
        elif path.startswith('web/'):
            suites.add('frontend')
        elif path.startswith(('cmd/', 'internal/', 'data/', 'tools/research/', 'tools/db/')) or path in {'go.mod', 'go.sum'}:
            suites.add('backend')
        else:
            suites.update(ALL)
    return suites


def changed_paths(base, cwd='.'):
    # Disable rename detection so moving out of a suite also tests the old suite.
    raw = subprocess.check_output([
        'git', 'diff', '--name-only', '--no-renames', '-z', base, 'HEAD',
    ], cwd=cwd)
    return raw.decode('utf-8', errors='surrogateescape').rstrip('\0').split('\0') if raw else []


def main():
    try:
        # A manual run has nothing to compare and runs every suite, like a missing base.
        base = None if os.environ['GITHUB_EVENT_NAME'] == 'workflow_dispatch' else event_base()
    except ValueError:
        base = None
    suites = ALL.copy()
    workflow_lock = True
    if base:
        try:
            subprocess.run(['git', 'fetch', '--no-tags', '--depth=1', 'origin', base], check=True)
            paths = changed_paths(base)
            suites = classify(paths)
            workflow_lock = any(path.startswith('.github/workflows/') for path in paths)
        except subprocess.CalledProcessError:
            print('Base history unavailable; running all suites.')
    lines = [f'{name}={str(name in suites).lower()}' for name in sorted(ALL)]
    lines.append(f'workflow_lock={str(workflow_lock).lower()}')
    print('\n'.join(lines))
    with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
        output.write('\n'.join(lines) + '\n')


if __name__ == '__main__':
    main()
