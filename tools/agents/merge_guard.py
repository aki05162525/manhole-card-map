"""Refuse `gh pr merge` when the base branch changed its lint or type-check setup after the PR forked.

Branch protection does not require PRs to be up to date with main. If one PR
tightens a lint rule and another, checked against the older main, adds a
violation, both pass CI and main breaks (PR #369 and #367, fixed in #373).
command_guard.py calls check() for each `gh pr merge` it finds.

The check asks GitHub for the PR's head and base (`gh pr view`), fetches them
from origin, and diffs the lint setup between their merge base and the base
branch. A PR that has merged the current base passes. When the PR or the
fetch cannot be read, the merge is refused, since `gh pr merge` needs the same
network and credentials; a hook that times out lets the call run.
"""

import json
import re
import subprocess

LINT_PATHS = ['web/.oxlintrc.json', 'web/scripts/lint/', 'web/tsconfig*.json']
PACKAGE = 'web/package.json'
# Dependencies and scripts of web/package.json that change what lint or the type check reports.
LINT_PACKAGE = re.compile(r'oxlint.*|tsrs|typescript|@types/.+')
LINT_SCRIPTS = {'lint', 'typecheck'}
TIMEOUT = 8  # seconds per command; the hook itself has 30

MERGE_VALUE_OPTIONS = {'-R', '--repo', '--match-head-commit', '-b', '--body', '-F', '--body-file',
                       '-t', '--subject', '-A', '--author-email'}

CHANGED = ('PR {pr} の分岐点の後に、{base} の lint・型検査の設定が変わった（{files}）。'
           'その PR に {base} を取り込んで CI を通し直してからマージする。')
UNREADABLE = ('マージ前の lint 設定の確認ができない（{error}）。'
              '原因を直してからマージする。直せなければ利用者に伝える。')


def parse_args(args):
    """Split the arguments of `gh pr merge` into the PR selector and the options that matter."""
    selector, options, i = None, {}, 0
    while i < len(args):
        arg = args[i]
        name, has_value, value = arg.partition('=')
        if name in MERGE_VALUE_OPTIONS:
            if not has_value:
                value = args[i + 1] if i + 1 < len(args) else ''
                i += 1
            options[name] = value
        elif arg.startswith('-'):
            options[name] = True
        elif selector is None:
            selector = arg
        i += 1
    repo = options.get('--repo', options.get('-R'))
    return selector, repo, options.get('--match-head-commit'), '--disable-auto' in options


def run(command, cwd):
    result = subprocess.run(command, cwd=cwd, capture_output=True, text=True, timeout=TIMEOUT)
    if result.returncode:
        message = (result.stderr or result.stdout).strip().splitlines()
        raise RuntimeError(f'{" ".join(command[:3])}: {message[-1] if message else result.returncode}')
    return result.stdout.strip()


def same_repository(selector_repo, origin_url):
    """Whether `-R owner/name` (or a URL, or HOST/OWNER/NAME) names the repository behind origin."""
    def key(text):
        text = re.sub(r'\.git$', '', text.strip().rstrip('/'))
        return '/'.join(re.split(r'[/:]', text)[-2:]).lower()
    return key(selector_repo) == key(origin_url)


def package_changes(repo, old, new):
    """Names of lint and type-check entries of web/package.json that differ between two commits."""
    def read(rev):
        try:
            return json.loads(run(['git', 'show', f'{rev}:{PACKAGE}'], repo))
        except (RuntimeError, json.JSONDecodeError):
            return {}
    before, after = read(old), read(new)
    changed = []
    for section in ('dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'):
        a, b = before.get(section) or {}, after.get(section) or {}
        changed += [name for name in sorted(set(a) | set(b))
                    if LINT_PACKAGE.fullmatch(name) and a.get(name) != b.get(name)]
    a, b = before.get('scripts') or {}, after.get('scripts') or {}
    changed += [f'scripts.{name}' for name in sorted(LINT_SCRIPTS) if a.get(name) != b.get(name)]
    return [f'{PACKAGE} の {name}' for name in dict.fromkeys(changed)]


def lint_changes(repo, head, base):
    """Lint setup that changed on `base` since `head` forked from it."""
    fork = run(['git', 'merge-base', head, base], repo)
    files = run(['git', 'diff', '--name-only', fork, base, '--', *LINT_PATHS], repo).split('\n')
    return [f for f in files if f] + package_changes(repo, fork, base)


def check(args, cwd):
    """Return the reasons `gh pr merge <args>` run in cwd must not run."""
    selector, repo_option, match_head, disable_auto = parse_args(args)
    if disable_auto:
        return []
    try:
        repo = run(['git', 'rev-parse', '--show-toplevel'], cwd)
        origin = run(['git', 'remote', 'get-url', 'origin'], repo)
    except (RuntimeError, OSError, subprocess.TimeoutExpired):
        return []  # Not this repository's checkout; its rules do not apply.
    if repo_option and not same_repository(repo_option, origin):
        return []
    try:
        view = ['gh', 'pr', 'view', *([selector] if selector else []),
                *(['--repo', repo_option] if repo_option else []), '--json', 'number,headRefOid,baseRefName']
        pr = json.loads(run(view, repo))
        number, base = pr['number'], pr['baseRefName']
        head = match_head or pr['headRefOid']
        run(['git', 'fetch', '--quiet', '--no-tags', 'origin',
             f'+refs/heads/{base}:refs/remotes/origin/{base}', f'refs/pull/{number}/head'], repo)
        run(['git', 'cat-file', '-e', f'{head}^{{commit}}'], repo)
        changes = lint_changes(repo, head, f'refs/remotes/origin/{base}')
    except (RuntimeError, OSError, subprocess.TimeoutExpired, ValueError, KeyError, TypeError) as error:
        return [UNREADABLE.format(error=error)]
    if not changes:
        return []
    shown = '、'.join(changes[:5]) + (f' ほか {len(changes) - 5} 件' if len(changes) > 5 else '')
    return [CHANGED.format(pr=f'#{number}', base=base, files=shown)]

