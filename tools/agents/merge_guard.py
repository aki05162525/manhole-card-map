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

The lint setup is what the CI lint and typecheck jobs run: the scripts their
steps call (`bun run <script>` in .github/workflows/ci.yml), the packages those
scripts start, the packages the lint plugins of web/scripts/lint/ import and the
lint configs name, the type checker and type definitions, and the config files
of those tools. Other dependencies (react, vitest) do not count.
"""

import json
import re
import subprocess

# Config files of the tools the CI lint and typecheck jobs run.
LINT_PATHS = ['web/.oxlintrc.json', 'web/.stylelintrc.json', 'web/.oxfmtrc.json', 'web/knip.json',
              'web/scripts/lint/', 'web/tsconfig*.json']
PACKAGE = 'web/package.json'
CI_WORKFLOW = '.github/workflows/ci.yml'
LINT_PLUGINS = 'web/scripts/lint/'
DEPENDENCY_SECTIONS = ('dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies')
# The type checker behind `bun check` and oxlint's typeAware, and the definitions it reads.
TYPE_PACKAGES = re.compile(r'typescript|tsrs|@types/.+')
# Keys of the lint configs whose values name packages (oxlint's `plugins` are built-in names).
CONFIG_PACKAGE_KEYS = {'web/.oxlintrc.json': {'jsPlugins'},
                       'web/.stylelintrc.json': {'customSyntax', 'plugins', 'extends'}}
CI_JOBS = re.compile(r"matrix\.task\s*==\s*'(?:lint|typecheck)'")
IMPORT = re.compile(r'''(?:\bfrom|\bimport\s*\(?|\brequire\s*\()\s*["']([^"'.][^"']*)["']''')
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
    skip = '--disable-auto' in options or '--help' in options or '-h' in options
    return selector, repo, options.get('--match-head-commit'), skip


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


def ci_lint_scripts(workflow):
    """Names of the package.json scripts the CI lint and typecheck steps run (`bun run <name>`)."""
    steps = re.split(r'\n(?=\s*- (?:name|uses|if|run):)', workflow)
    return {name for step in steps if CI_JOBS.search(step)
            for name in re.findall(r'\bbun run ([\w:.-]+)', step)}


def show(repo, rev, path):
    """The text of path at rev, or None when the file is not there."""
    try:
        run(['git', 'cat-file', '-e', f'{rev}:{path}'], repo)
    except RuntimeError:
        return None
    return run(['git', 'show', f'{rev}:{path}'], repo)


def label(rev):
    return rev.removeprefix('refs/remotes/') if '/' in rev else rev[:12]


def read_json(repo, rev, path):
    text = show(repo, rev, path)
    if text is None:
        return {}
    try:
        data = json.loads(text)
    except json.JSONDecodeError as error:
        raise ValueError(f'{label(rev)} の {path} を JSON として読めない: {error}') from None
    if not isinstance(data, dict):
        raise ValueError(f'{label(rev)} の {path} のトップレベルがオブジェクトでない')
    return data


def read_package(repo, rev):
    """web/package.json at rev, with its scripts and dependency sections checked to be objects."""
    data = read_json(repo, rev, PACKAGE)
    for section in ('scripts', *DEPENDENCY_SECTIONS):
        if not isinstance(data.get(section, {}), dict):
            raise ValueError(f'{label(rev)} の {PACKAGE} の {section} がオブジェクトでない')
    return data


def package_name(specifier):
    parts = specifier.split('/')
    return '/'.join(parts[:2] if specifier.startswith('@') else parts[:1])


def started_packages(scripts):
    """First words of the commands in scripts: `stylelint "src/**/*.css"` starts stylelint."""
    names = set()
    for script in scripts:
        for command in re.split(r'&&|\|\||[;|&]', str(script)):
            words = [w for w in command.split() if not re.fullmatch(r'\w+=\S*', w)]
            if words:
                names.add(words[0])
    return names


def lint_plugin_imports(repo, rev):
    """Packages imported by the lint plugins of web/scripts/lint/ (not their tests or type stubs)."""
    files = run(['git', 'ls-tree', '-r', '--name-only', rev, '--', LINT_PLUGINS], repo).split('\n')
    sources = [f for f in files if re.search(r'\.(?:mjs|cjs|js|mts|ts)$', f)
               and not re.search(r'\.test\.|\.d\.[mc]?ts$', f)]
    if not sources:
        return set()
    text = run(['git', 'show', *(f'{rev}:{f}' for f in sources)], repo)
    return {package_name(s) for s in IMPORT.findall(text) if not s.startswith('node:')}


def config_packages(repo, rev):
    """Package names the lint configs refer to, such as stylelint's customSyntax."""
    names = set()

    def collect(value, keys, inside=False):
        if isinstance(value, dict):
            for key, item in value.items():
                collect(item, keys, inside or key in keys)
        elif isinstance(value, list):
            for item in value:
                collect(item, keys, inside)
        elif inside and isinstance(value, str) and not value.startswith('.'):
            names.add(package_name(value))
    for path, keys in CONFIG_PACKAGE_KEYS.items():
        collect(read_json(repo, rev, path), keys)
    return names


def package_changes(repo, old, new):
    """Lint and type-check entries of web/package.json that differ between two commits."""
    before, after = read_package(repo, old), read_package(repo, new)
    scripts = ci_lint_scripts(show(repo, new, CI_WORKFLOW) or '')
    old_scripts, new_scripts = before.get('scripts', {}), after.get('scripts', {})
    lint_packages = set()
    for rev, data in ((old, before), (new, after)):
        lint_packages |= started_packages(data['scripts'][s] for s in scripts if s in data.get('scripts', {}))
        lint_packages |= lint_plugin_imports(repo, rev) | config_packages(repo, rev)
    changed = []
    for section in DEPENDENCY_SECTIONS:
        a, b = before.get(section, {}), after.get(section, {})
        changed += [name for name in sorted(set(a) | set(b))
                    if (name in lint_packages or TYPE_PACKAGES.fullmatch(name)) and a.get(name) != b.get(name)]
    changed += [f'scripts.{name}' for name in sorted(scripts) if old_scripts.get(name) != new_scripts.get(name)]
    return [f'{PACKAGE} の {name}' for name in dict.fromkeys(changed)]


def lint_changes(repo, head, base):
    """Lint setup that changed on `base` since `head` forked from it."""
    fork = run(['git', 'merge-base', head, base], repo)
    files = run(['git', 'diff', '--name-only', fork, base, '--', *LINT_PATHS], repo).split('\n')
    return [f for f in files if f] + package_changes(repo, fork, base)


def check(args, cwd):
    """Return the reasons `gh pr merge <args>` run in cwd must not run.

    `--disable-auto` and `--help` do not merge. `--auto` is checked when it is
    requested; the base may still change before GitHub merges.
    """
    selector, repo_option, match_head, skip = parse_args(args)
    if skip:
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
        if not isinstance(pr, dict):
            raise ValueError('gh pr view の結果がオブジェクトでない')
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
