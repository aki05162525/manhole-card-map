#!/usr/bin/env python3
"""Select commit checks from the index; keep dependency-wide checks intact."""

from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
FULL_FRONTEND = {
    'web/package.json', 'web/bun.lock', 'web/.oxlintrc.json',
    'web/.oxfmtrc.json', 'web/tsconfig.json', 'mise.toml', 'lefthook.yml',
    'tools/dev/check_staged.py', '.gitignore', 'web/.gitignore',
}
CODE_EXTENSIONS = {'.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'}
FORMAT_EXTENSIONS = CODE_EXTENSIONS | {'.css', '.json', '.jsonc', '.html', '.md', '.yaml', '.yml'}


def staged_paths(root=ROOT):
    # Disable rename detection so moving a file out of a checked directory still
    # checks its former dependants. NUL delimiters preserve whitespace in names.
    result = subprocess.run(
        ['git', 'diff', '--cached', '--name-only', '--no-renames', '-z'],
        cwd=root, check=True, capture_output=True,
    )
    return [p.decode('utf-8', errors='surrogateescape')
            for p in result.stdout.split(b'\0') if p]


def frontend_commands(paths, exists=lambda _: True):
    if FULL_FRONTEND.intersection(paths):
        return [['bun', 'run', name] for name in ['lint', 'format:check', 'typecheck']]
    lint, formatting = [], []
    typed = False
    for path in paths:
        if not path.startswith('web/'):
            continue
        relative = path[4:]
        file = Path(relative)
        in_source = relative.startswith(('src/', 'scripts/'))
        root_ts = len(file.parts) == 1 and file.suffix == '.ts'
        if (in_source and file.suffix in CODE_EXTENSIONS) or root_ts:
            typed = True
            if exists(path):
                lint.append(relative)
        if ((in_source and file.suffix in FORMAT_EXTENSIONS) or root_ts
                or (len(file.parts) == 1 and file.suffix == '.json')
                or relative == 'index.html') and exists(path):
            formatting.append(relative)
    commands = []
    if lint:
        commands.append(['bun', 'x', '--no-install', 'oxlint', '--max-warnings=0', '--', *lint])
    if formatting:
        commands.append(['bun', 'x', '--no-install', 'oxfmt', '--check', '--', *formatting])
    if typed:
        # A changed declaration may break an unchanged importer.
        commands.append(['bun', 'run', 'typecheck'])
    return commands


def go_commands(paths):
    if any(p.startswith(('data/', 'tools/national/')) for p in paths):
        # These tests read source data / run Python outside Go's cache inputs.
        return [['go', 'test', '-count=1', './...']]
    if any(p.endswith('.go') or p.startswith(('cmd/', 'internal/'))
           or p in {'go.mod', 'go.sum', 'mise.toml', 'lefthook.yml', 'tools/dev/check_staged.py'}
           for p in paths):
        return [['go', 'test', './...']]
    return []


def main():
    paths = staged_paths()
    if sys.argv[1:] == ['frontend']:
        commands = frontend_commands(paths, exists=lambda p: (ROOT / p).is_file())
        cwd = ROOT / 'web'
    elif sys.argv[1:] == ['go']:
        commands, cwd = go_commands(paths), ROOT
    else:
        raise SystemExit('usage: check_staged.py frontend|go')
    for command in commands:
        print('+', ' '.join(command), flush=True)
        subprocess.run(command, cwd=cwd, check=True)


if __name__ == '__main__':
    main()
