"""Merge a verified Dependabot update after its pull-request CI succeeds."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'agents'))
from merge_guard import lint_changes


def eligible_update(message):
    # Accept only Dependabot's flat, signed metadata trailer. An unfamiliar
    # shape stays available for manual review. PR titles and labels are editable.
    _, sep, trailer = message.rpartition('\n---\nupdated-dependencies:\n')
    if not sep:
        return False
    body, end, _ = trailer.partition('\n...\n')
    if not end or not body.startswith('- dependency-name: '):
        return False
    for entry in body.removeprefix('- dependency-name: ').split('\n- dependency-name: '):
        name, *fields = entry.splitlines()
        if not name or not all(re.fullmatch(r'  [\w-]+: .+', field) for field in fields):
            return False
        kinds = [f for f in fields if f.startswith('  update-type:')]
        groups = [f for f in fields if f.startswith('  dependency-group:')]
        if kinds not in (['  update-type: version-update:semver-minor'],
                         ['  update-type: version-update:semver-patch']):
            return False
        if groups not in (['  dependency-group: actions'], ['  dependency-group: web'],
                          ['  dependency-group: go']):
            return False
    return True


def main():
    event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())['workflow_run']
    repo = os.environ['GITHUB_REPOSITORY']
    def api(path, *args):
        raw = subprocess.check_output(['gh', 'api', f'repos/{repo}/{path}', *args])
        return json.loads(raw) if raw.strip() else None

    for link in event['pull_requests']:
        number = int(link['number'])
        pr = api(f'pulls/{number}')
        head = pr['head']['sha']
        if (head != event['head_sha'] or pr['state'] != 'open' or pr['draft']
                or pr['base']['ref'] != 'main' or pr['head']['repo']['full_name'] != repo
                or pr['user']['login'] != 'dependabot[bot]' or pr['commits'] != 1):
            continue
        commit = api(f'commits/{head}')
        if ((commit['author'] or {}).get('login') != 'dependabot[bot]'
                or (commit['committer'] or {}).get('login') != 'web-flow'
                or not commit['commit']['verification']['verified'] or len(commit['parents']) != 1
                or not eligible_update(commit['commit']['message'])):
            continue
        subprocess.run(['git', 'fetch', '--quiet', '--no-tags', 'origin',
                        '+refs/heads/main:refs/remotes/origin/main', f'refs/pull/{number}/head'], check=True)
        changes = lint_changes('.', head, 'origin/main')
        checked_base = subprocess.check_output(['git', 'rev-parse', 'origin/main'], text=True).strip()
        if changes or api('git/ref/heads/main')['object']['sha'] != checked_base:
            print('Requesting a fresh Dependabot commit and CI:', ', '.join(changes))
            api(f'issues/{number}/comments', '-f', 'body=@dependabot rebase')
            continue
        # GitHub enforces all required checks and branch protection at merge;
        # never leave an auto-merge reservation that could apply to a later head.
        result = api(f'pulls/{number}/merge', '-X', 'PUT', '-f', f'sha={head}', '-f', 'merge_method=merge')
        if not result['merged']:
            raise RuntimeError(result['message'])
        # The built-in token suppresses push-triggered workflows.
        api('actions/workflows/ci.yml/dispatches', '-f', 'ref=main')


if __name__ == '__main__':
    main()
