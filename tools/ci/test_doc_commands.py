"""Check documented commands without executing their data processing paths."""
import ast
from functools import lru_cache
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import tempfile
import unittest
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
# Running this wrapper regenerates real data, so never invoke it to inspect
# documentation. Its documented options are listed here instead of --help.
NO_HELP = {'tools/build-real-data.py': ({'--update-card-ids'}, 'Regenerates real data; options are fixed here.')}
# No documented --help currently requires third-party packages.
HELP_EXCLUSIONS = {}
PYTHON_COMMAND = re.compile(r'\bpython3\s+-B\s+(tools/[^\s`]+\.py)\b')
OPTION = re.compile(r'(?<![\w-])--[a-zA-Z][\w-]*')
AS_OF = re.compile(r'(?<![\w-])--?as-of(?:\s+|=)[\'\"]?(\d{4}-\d{2}-\d{2})')


def documents(root):
    return [root / p for p in ('README.md', 'AGENTS.md', 'REVIEW.md', 'web/README.md')] + sorted((root / 'docs').glob('*.md'))


def commands(text):
    """Yield logical shell lines and inline Python invocations with source lines."""
    fence = None
    pending = ''
    start = 0
    for number, line in enumerate(text.splitlines(), 1):
        marker = re.match(r'^\s*(`{3,}|~{3,})(\w*)\s*$', line)
        if marker:
            if fence is None:
                fence = (marker[1][0], marker[2])
            elif marker[1][0] == fence[0]:
                fence = None
            continue
        if fence:
            if fence[1] not in {'sh', 'bash'}:
                continue
            if not pending:
                start = number
            pending += line.rstrip().removesuffix('\\') + ' '
            if line.rstrip().endswith('\\'):
                continue
            command, pending = pending.strip(), ''
            if command and not command.startswith('#'):
                yield start, command
        else:
            # Inline code is delimited by backticks; bare prose examples end at
            # Japanese punctuation/whitespace, not at the next paragraph.
            spans = re.findall(r'`([^`\n]+)`', line)
            bare = re.sub(r'`[^`]*`', '', line)
            spans += [m[0] for m in re.finditer(
                r'python3\s+-B\s+tools/[^\s`]+\.py(?:[ \t]+[ -~]+)?', bare)]
            for span in spans:
                if PYTHON_COMMAND.search(span):
                    yield number, span.strip()


def current_as_of(root):
    tree = ast.parse((root / 'tools/build-real-data.py').read_text())
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'AS_OF' for t in node.targets):
            return ast.literal_eval(node.value)
    raise ValueError('tools/build-real-data.py: AS_OF not found')


@lru_cache(maxsize=None)
def help_text(root, script, subcommand=''):
    command = [sys.executable, '-B', script]
    if subcommand:
        command.append(subcommand)
    command.append('--help')
    env = {k: v for k, v in os.environ.items() if not k.startswith('GIT_')}
    result = subprocess.run(command, cwd=root, env=env, capture_output=True,
                            text=True, timeout=5)
    if result.returncode:
        raise ValueError(f'{shlex.join(command)} failed: {result.stderr.strip()}')
    return result.stdout


def relative_links(text):
    # Fenced examples are not Markdown links. Reference definitions are links too.
    text = re.sub(r'(?ms)^\s*(`{3,}|~{3,})[^\n]*\n.*?^\s*\1\s*$', '', text)
    inline = re.findall(r'!?\[[^\]\n]*\]\(\s*(<[^>]+>|[^\s)]+)', text)
    references = re.findall(r'(?m)^\s{0,3}\[[^\]]+\]:\s*(<[^>]+>|\S+)', text)
    return [target.strip('<>') for target in inline + references]


def check_document(root, document, as_of):
    errors = []
    text = document.read_text()
    def error(line, command, reason):
        errors.append(f'{document.relative_to(root)}:{line}: {command}: {reason}')
    for line, command in commands(text):
        for date in AS_OF.findall(command):
            if date != as_of:
                error(line, command, f'as-of {date} != tools/build-real-data.py AS_OF {as_of}')
        for match in PYTHON_COMMAND.finditer(command):
            script = match[1]
            if not (root / script).is_file():
                error(line, command, f'script does not exist: {script}')
                continue
            try:
                # Limit arguments to this shell command; never execute the example.
                lexer = shlex.shlex(command[match.end():], posix=True, punctuation_chars=';&|<>')
                lexer.whitespace_split = True
                args = []
                for token in lexer:
                    if token and token[0] in ';&|<>':
                        break
                    args.append(token)
                options = {arg.split('=', 1)[0] for arg in args if arg.startswith('--')}
                if script in HELP_EXCLUSIONS:
                    continue
                if script in NO_HELP:
                    allowed, reason = NO_HELP[script]
                    if options - allowed:
                        error(line, command, f'{script} accepts only {sorted(allowed)} ({reason})')
                    continue
                help_output = help_text(str(root), script)
                # argparse lists subcommands as {fetch,verify}; only query a
                # documented subcommand, never an arbitrary positional input.
                choices = set(re.findall(r'\{([^{}]+)\}', help_output))
                subcommands = {item for group in choices for item in group.split(',')}
                if args and args[0] in subcommands:
                    help_output = help_text(str(root), script, args[0])
                for option in sorted(options - set(OPTION.findall(help_output))):
                    error(line, command, f'option absent from --help: {option}')
            except (ValueError, OSError, subprocess.TimeoutExpired) as exc:
                error(line, command, str(exc))
    for target in relative_links(text):
        parsed = urlsplit(target)
        if parsed.scheme or parsed.netloc or not parsed.path:
            continue
        path = unquote(parsed.path)
        resolved = root / path.lstrip('/') if path.startswith('/') else document.parent / path
        if not resolved.exists():
            error('link', target, 'relative link target does not exist')
    return errors


class DocumentCommandsTest(unittest.TestCase):
    def test_repository_documents(self):
        errors = [error for document in documents(ROOT)
                  for error in check_document(ROOT, document, current_as_of(ROOT))]
        self.assertEqual(errors, [], '\n' + '\n'.join(errors))

    def test_synthetic_documents_detect_each_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'tools').mkdir()
            (root / 'tools/example.py').write_text(
                'import argparse\np = argparse.ArgumentParser()\n'
                'p.add_argument("--as-of")\np.parse_args()\n')
            document = root / 'README.md'
            cases = [
                ('`python3 -B tools/missing.py`', 'script does not exist'),
                ('```bash\npython3 -B tools/example.py \\\n  --missing value\n```', 'option absent from --help: --missing'),
                ('```sh\npython3 -B tools/example.py --as-of 2000-01-01\n```', 'as-of 2000-01-01 !='),
                ('[broken](missing.md#section)', 'relative link target does not exist'),
            ]
            for text, reason in cases:
                with self.subTest(reason=reason):
                    document.write_text(text)
                    errors = check_document(root, document, '2026-11-06')
                    self.assertEqual(len(errors), 1, errors)
                    self.assertIn(reason, errors[0])
                    self.assertIn('README.md:', errors[0])

    def test_subcommand_help_accepts_equals_form(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'tools').mkdir()
            (root / 'tools/sub.py').write_text(
                'import argparse\np = argparse.ArgumentParser()\n'
                's = p.add_subparsers().add_parser("fetch")\n'
                's.add_argument("--storage")\np.parse_args()\n')
            document = root / 'README.md'
            document.write_text('```sh\npython3 -B tools/sub.py fetch --storage output\n```\n'
                                '`python3 -B tools/sub.py fetch --storage=output`')
            self.assertEqual(check_document(root, document, '2026-11-06'), [])

    def test_scope_and_no_help_wrapper_never_executes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'tools').mkdir()
            (root / 'docs/verification').mkdir(parents=True)
            (root / 'docs/current.md').touch()
            (root / 'docs/verification/old.md').touch()
            wrapper = root / 'tools/build-real-data.py'
            wrapper.write_text("AS_OF = '2026-11-06'\nraise RuntimeError('must not execute')\n")
            self.assertEqual(current_as_of(root), '2026-11-06')
            self.assertEqual([p.relative_to(root).as_posix() for p in documents(root)],
                             ['README.md', 'AGENTS.md', 'REVIEW.md', 'web/README.md', 'docs/current.md'])
            document = root / 'README.md'
            document.write_text('```sh\npython3 -B tools/build-real-data.py\n```')
            self.assertEqual(check_document(root, document, current_as_of(root)), [])
            document.write_text('`python3 -B tools/build-real-data.py --invented`')
            errors = check_document(root, document, current_as_of(root))
            self.assertEqual(len(errors), 1, errors)
            self.assertIn('accepts only', errors[0])
            document.write_text('`python3 -B tools/build-real-data.py --update-card-ids`')
            self.assertEqual(check_document(root, document, current_as_of(root)), [])

    def test_dates_in_non_python_shell_commands_and_relative_links(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'docs').mkdir()
            document = root / 'docs/example.md'
            (root / 'a b.md').touch()
            document.write_text('```sh\ngo run ./cmd/builddata -as-of 2000-01-01\n```\n'
                                '[ok](../a%20b.md#heading) [external](https://example.com/)\n'
                                '[ref]: ../missing.md\n')
            errors = check_document(root, document, '2026-11-06')
            self.assertEqual(len(errors), 2, errors)
            self.assertIn('as-of 2000-01-01 !=', errors[0])
            self.assertIn('../missing.md', errors[1])


if __name__ == '__main__':
    unittest.main()
