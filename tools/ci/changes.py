"""Select CI suites; unknown paths or unavailable history run all suites."""
import os
import json
import re
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
        elif path in {'data/card-ids.json', 'data/card-images.json'}:
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


def changed_statuses(base, cwd='.'):
    """Return status and path pairs, with renames represented as delete and add."""
    raw = subprocess.check_output([
        'git', 'diff', '--name-status', '--no-renames', '-z', base, 'HEAD',
    ], cwd=cwd)
    fields = raw.decode('utf-8', errors='surrogateescape').rstrip('\0').split('\0') if raw else []
    if len(fields) % 2:
        raise ValueError('Incomplete git diff status output')
    return list(zip(fields[::2], fields[1::2]))


def related_sources(event, paths, statuses):
    """Use Vitest dependency selection only for simple PR source additions or edits."""
    if event != 'pull_request' or not paths or statuses is None:
        return None
    if paths != [path for _, path in statuses]:
        return None
    for status, path in statuses:
        if status not in {'A', 'M'} or not re.fullmatch(r'web/src/.+\.tsx?', path):
            return None
        if path.endswith('.d.ts') or '__mocks__' in path.split('/'):
            return None
        if path.startswith('web/src/shared/universal/'):
            return None
    return [path.removeprefix('web/') for path in paths]


def frontend_matrix(event):
    matrix = [{'task': task, 'index': 1, 'count': 1} for task in ('lint', 'typecheck', 'build')]
    count = 3 if event == 'pull_request' else 1
    return matrix + [{'task': 'test', 'index': index, 'count': count}
                     for index in range(1, count + 1)]


def main():
    event = os.environ['GITHUB_EVENT_NAME']
    try:
        # A manual run has nothing to compare and runs every suite, like a missing base.
        base = None if event == 'workflow_dispatch' else event_base()
    except ValueError:
        base = None
    suites = ALL.copy()
    workflow_lock = True
    related = None
    if base:
        try:
            subprocess.run(['git', 'fetch', '--no-tags', '--depth=1', 'origin', base], check=True)
            paths = changed_paths(base)
            suites = classify(paths)
            workflow_lock = any(path.startswith('.github/workflows/') for path in paths)
            if event == 'pull_request' and paths:
                try:
                    related = related_sources(event, paths, changed_statuses(base))
                except (subprocess.CalledProcessError, ValueError):
                    print('Change statuses unavailable; running all frontend tests.')
        except subprocess.CalledProcessError:
            print('Base history unavailable; running all suites.')
    lines = [f'{name}={str(name in suites).lower()}' for name in sorted(ALL)]
    lines.append(f'workflow_lock={str(workflow_lock).lower()}')
    lines.append('frontend_related=' + json.dumps(related, separators=(',', ':')))
    lines.append('frontend_matrix=' + json.dumps({'include': frontend_matrix(event)}, separators=(',', ':')))
    print('\n'.join(lines))
    with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
        output.write('\n'.join(lines) + '\n')


if __name__ == '__main__':
    main()
