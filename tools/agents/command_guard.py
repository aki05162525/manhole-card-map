#!/usr/bin/env python3
"""Block agent shell commands that skip hooks, unsign commits, edit global Git config or merge unchecked.

Claude Code (.claude/settings.json) and Codex (.codex/hooks.json) run this as a
PreToolUse hook: the tool call arrives as JSON on stdin, and exit status 2 with
a reason on stderr refuses it. Only the agent's own shell commands pass through
here; subprocesses started by tests (e.g. `-c commit.gpgsign=false` in a
temporary repository) are not tool calls and are therefore not inspected.

Two checks live in sibling modules: merge_guard.py asks GitHub whether a
`gh pr merge` target predates a lint change on its base, and delegate_guard.py
reads the T3 `acp-mcp-call delegate_task '<json>'` shell fallback like the MCP tool.

This is a guardrail, not a shell interpreter: it splits control operators,
nested `sh -c`/`eval` scripts and command substitutions, but cannot see
commands assembled at run time (variables, scripts on disk, other languages).
"""

import json
import os
import re
import shlex
import sys

import delegate_guard
import merge_guard

SEPARATORS = {'&&', '||', ';', ';;', '&', '|', '|&', '(', ')', '\n', '`'}
REDIRECTIONS = {'<', '>', '>>', '<<', '<<<', '>&', '<&', '&>', '>|'}
TWO_CHAR_OPERATORS = {'&&', '||', ';;', '|&', '>>', '<<', '>&', '<&', '&>', '>|'}
SHELLS = {'sh', 'bash', 'zsh', 'dash', 'ksh'}
FALSY = {'', '0', 'false', 'no', 'off'}
ASSIGNMENT = re.compile(r'([A-Za-z_][A-Za-z0-9_]*)=(.*)', re.S)
MAX_DEPTH = 5
# Reserved words after which the next word is in the command position.
RESERVED = {'if', 'then', 'else', 'elif', 'while', 'until', 'do', '!', '{'}
# Commands whose arguments may still set the environment of what they run.
ASSIGNING_COMMANDS = {'env', 'export', 'declare', 'typeset', 'readonly', 'local', 'sudo', 'doas',
                      'command', 'exec', 'nohup', 'time'}
# Commands that run their arguments as a command, with their options that consume the next word.
WRAPPERS = {'env': {'-u', '--unset', '-C', '--chdir'},
            'sudo': {'-u', '-g', '-C', '-D', '-h', '-p', '-r', '-t', '-U', '-T', '-R'},
            'doas': {'-u', '-C'}, 'command': set(), 'exec': {'-a'}, 'nohup': set(), 'time': {'-f', '-o'},
            'nice': {'-n'}, 'timeout': {'-s', '--signal', '-k', '--kill-after'}}

# Git's global options that consume the next word.
GIT_VALUE_OPTIONS = {'-C', '--git-dir', '--work-tree', '--namespace', '--super-prefix',
                     '--list-cmds', '--attr-source'}
COMMIT_SHORT_VALUE = set('mFCct')   # the value is the rest of the word or the next word
COMMIT_SHORT_ATTACHED = set('uS')   # optional value, only ever attached
COMMIT_LONG_VALUE = {'--message', '--file', '--reuse-message', '--reedit-message', '--template',
                     '--author', '--date', '--cleanup', '--fixup', '--squash', '--trailer',
                     '--pathspec-from-file'}
CONFIG_VALUE_OPTIONS = {'-f', '--file', '--blob', '--type', '--default', '--value', '--comment', '--url'}
CONFIG_READ_FLAGS = {'--get', '--get-all', '--get-regexp', '--get-urlmatch', '--list', '-l',
                     '--get-color', '--get-colorbool'}
CONFIG_WRITE_FLAGS = {'--add', '--replace-all', '--unset', '--unset-all', '--rename-section',
                      '--remove-section', '--edit', '-e'}
CONFIG_READ_ACTIONS = {'get', 'list'}
CONFIG_WRITE_ACTIONS = {'set', 'unset', 'rename-section', 'remove-section', 'edit'}
USER_CONFIG_FILES = {os.path.expanduser(p) for p in ('~/.gitconfig', '~/.config/git/config')}

HOOK_SKIP = 'コミット・プッシュのフックを飛ばす指定（{}）は禁止。フックの失敗は原因を直す。'
UNSIGNED = 'コミット署名を無効にする指定（{}）は禁止。署名が失敗したら作業を残して利用者に伝える。'
GLOBAL_CONFIG = 'Git の恒久設定（{}）は変更しない。必要ならコマンド単位の -c か環境で渡す。'
UNCHECKED_MERGE = ('gh pr merge は、前のコマンドが失敗しても走る形（; ・改行・| ・|| の後）で続けない。'
                   '確認の結果を見てから単独で実行するか、&& だけでつなぐ。')


def tokenize(text):
    """Split POSIX-shell text into words and operators; collect `$(...)` in double quotes.

    `#` starts a comment only at the beginning of a word, unlike shlex. The
    body of a here-document is text, not commands; only the substitutions of an
    unquoted one are collected. The bodies come back in the order of their `<<`
    so that a shell reading one as its script can be inspected. Raises
    ValueError for an unterminated quote.
    """
    tokens, nested, word, heredocs, bodies = [], [], [], [], []
    in_word = False
    i, n = 0, len(text)

    def flush():
        nonlocal in_word
        if in_word:
            tokens.append(''.join(word))
            word.clear()
            in_word = False

    while i < n:
        c = text[i]
        if c in ' \t\r':
            flush()
            i += 1
        elif c == '\\':
            if text[i + 1:i + 2] != '\n':  # a backslash-newline joins lines
                word.append(text[i + 1:i + 2])
                in_word = True
            i += 2
        elif c == "'":
            end = text.find("'", i + 1)
            if end < 0:
                raise ValueError('unterminated single quote')
            word.append(text[i + 1:end])
            in_word = True
            i = end + 1
        elif c == '"':
            j, buf = i + 1, []
            while j < n and text[j] != '"':
                if text[j] == '\\' and j + 1 < n and text[j + 1] in '"\\$`\n':
                    if text[j + 1] != '\n':
                        buf.append(text[j + 1])
                    j += 2
                else:
                    buf.append(text[j])
                    j += 1
            if j >= n:
                raise ValueError('unterminated double quote')
            quoted = ''.join(buf)
            # The shell still runs substitutions inside double quotes.
            nested.extend(substitutions(quoted))
            word.append(quoted)
            in_word = True
            i = j + 1
        elif c == '#' and not in_word:
            end = text.find('\n', i)
            i = n if end < 0 else end
        elif c == '\n' and heredocs:
            flush()
            tokens.append(c)
            i = here_bodies(text, i + 1, heredocs, nested, bodies)
        elif c in ';&|()<>\n`':
            flush()
            if text[i:i + 3] == '<<<':
                tokens.append('<<<')
                i += 3
            elif text[i:i + 2] == '<<':
                tokens.append('<<')
                i = here_delimiter(text, i + 2, tokens, heredocs)
            elif text[i:i + 2] in TWO_CHAR_OPERATORS:
                tokens.append(text[i:i + 2])
                i += 2
            else:
                tokens.append(c)
                i += 1
        else:
            word.append(c)
            in_word = True
            i += 1
    flush()
    if heredocs:  # the text ended before the body's newline
        here_bodies(text, n, heredocs, nested, bodies)
    return tokens, nested, bodies


def here_delimiter(text, i, tokens, heredocs):
    """Read the delimiter after `<<` or `<<-` at i; return the index after it.

    The delimiter goes to tokens as the redirection's target, and the
    here-document to heredocs as (delimiter, strip_tabs, quoted).
    """
    strip_tabs = text[i:i + 1] == '-'
    i += strip_tabs
    while i < len(text) and text[i] in ' \t':
        i += 1
    start = i
    while i < len(text) and text[i] not in ' \t\r\n;&|()<>`':
        if text[i] in '\'"':
            end = text.find(text[i], i + 1)
            i = len(text) if end < 0 else end + 1
        else:
            i += 2 if text[i] == '\\' else 1
    raw = text[start:i]
    delimiter = re.sub(r'\\(.)', r'\1', raw.replace("'", '').replace('"', ''))
    if delimiter:
        tokens.append(delimiter)
        heredocs.append((delimiter, strip_tabs, raw != delimiter))
    return i


def here_bodies(text, i, heredocs, nested, bodies):
    """Read the bodies of the pending here-documents starting at i; return the index after them."""
    for delimiter, strip_tabs, quoted in heredocs:
        body = []
        while i < len(text):
            end = text.find('\n', i)
            end = len(text) if end < 0 else end
            line = text[i:end]
            i = end + 1
            if (line.lstrip('\t') if strip_tabs else line) == delimiter:
                break
            body.append(line)
        body = '\n'.join(body)
        if not quoted:  # `$(...)` in an unquoted here-document still runs, unless escaped
            nested.extend(substitutions(re.sub(r'\\[\\$`]', '_', body)))
        bodies.append(body)
    heredocs.clear()
    return min(i, len(text))


def substitutions(text):
    """Return the scripts of `$(...)` and backtick substitutions in text."""
    scripts = re.findall(r'`([^`]*)`', text)
    start = text.find('$(')
    while start >= 0:
        depth, j = 1, start + 2
        while j < len(text) and depth:
            depth += {'(': 1, ')': -1}.get(text[j], 0)
            j += 1
        scripts.append(text[start + 2:j - 1] if depth == 0 else text[start + 2:])
        start = text.find('$(', j)
    return scripts


def segments(tokens):
    """Yield the words of each simple command, dropping redirection targets."""
    words, skip = [], False
    for token in tokens:
        if skip:
            skip = False
        elif token in SEPARATORS:
            if words:
                yield words
            words = []
        elif token in REDIRECTIONS:
            skip = True
        else:
            words.append(token)
    if words:
        yield words


def scripts(command, depth=0):
    """Yield the tokens of a shell command (string or argv list) and of every script nested in it.

    Nested scripts are command substitutions, `sh -c` arguments and `eval`.
    """
    if isinstance(command, list):
        command = shlex.join(str(part) for part in command)
    try:
        tokens, nested, bodies = tokenize(command)
    except ValueError:
        # Unbalanced quotes: inspect whitespace-separated pieces conservatively.
        tokens, nested, bodies = re.findall(r'[;&|()`\n]|[^\s;&|()`]+', command), [], []
    yield tokens
    if depth >= MAX_DEPTH:
        return
    for script in nested:
        yield from scripts(script, depth + 1)
    for words, stdin in commands(tokens, bodies):
        for i, w in enumerate(words):
            if os.path.basename(w) in SHELLS:
                script = shell_script(words[i + 1:])
                if script is not None:
                    yield from scripts(script, depth + 1)
            elif w == 'eval':
                yield from scripts(' '.join(words[i + 1:]), depth + 1)
        argv = invoked(words)
        if stdin and argv and os.path.basename(argv[0]) in SHELLS and reads_stdin(argv[1:]):
            for script in stdin:
                yield from scripts(script, depth + 1)


def commands(tokens, bodies):
    """Yield (words, stdin) for each simple command; stdin lists its here-documents and here-strings."""
    bodies = iter(bodies)
    words, stdin, redirect = [], [], None
    for token in [*tokens, ';']:
        if redirect:
            if redirect == '<<':
                stdin.append(next(bodies, ''))
            elif redirect == '<<<':
                stdin.append(token)
            redirect = None
        elif token in SEPARATORS:
            if words:
                yield words, stdin
            words, stdin = [], []
        elif token in REDIRECTIONS:
            redirect = token
        else:
            words.append(token)


def reads_stdin(args):
    """Whether a shell given these arguments reads its script from standard input."""
    if shell_script(args) is not None:
        return False
    for i, arg in enumerate(args):
        if arg == '--':
            return i + 1 == len(args)
        if arg in {'-o', '+o'} or arg.startswith('--'):
            continue
        if arg.startswith('-') and len(arg) > 1:
            if 's' in arg[1:]:
                return True
            continue
        if args[i - 1:i] not in (['-o'], ['+o']):
            return False  # a script file
    return True


def violations(command):
    """Return the reasons a shell command (string or argv list) must not run, without the network."""
    reasons = []
    for tokens in scripts(command):
        if merges_unchecked(tokens):
            reasons.append(UNCHECKED_MERGE)
        for words in segments(tokens):
            check_words(words, reasons)
    return list(dict.fromkeys(reasons))


def arguments_after(words, names):
    """Return the words after the first run of `names` (compared by basename), or None."""
    bases = [os.path.basename(w) for w in words]
    for i in range(len(words) - len(names) + 1):
        if bases[i:i + len(names)] == names:
            return words[i + len(names):]
    return None


def invoked(words):
    """Return the argv a simple command runs: its words after assignments and wrappers.

    `env A=1 gh ...`, `sudo -u me gh ...`, `timeout 30 gh ...` and `mise exec -- gh ...`
    run gh; in `echo gh pr merge` the words are arguments of echo.
    """
    i = 0
    while i < len(words):
        word, name = words[i], os.path.basename(words[i])
        if ASSIGNMENT.fullmatch(word) or word in RESERVED:
            i += 1
        elif name == 'command' and any(w in {'-v', '-V'} for w in words[i + 1:i + 3]):
            return []  # only looks the name up
        elif name == 'mise' and words[i + 1:i + 2] in (['exec'], ['x']):
            if '--' not in words[i:]:
                return []
            i = words.index('--', i) + 1
        elif name in WRAPPERS:
            i += 1
            while i < len(words) and words[i].startswith('-') and words[i] != '--':
                i += 2 if words[i] in WRAPPERS[name] else 1
            i += words[i:i + 1] == ['--']
            if name == 'timeout':
                i += 1  # the duration
        else:
            return words[i:]
    return []


def merge_arguments(words):
    """The arguments of `gh pr merge` when this simple command runs it, else None."""
    argv = invoked(words)
    if argv and os.path.basename(argv[0]) == 'gh' and argv[1:3] == ['pr', 'merge']:
        return argv[3:]
    return None


def merges_unchecked(tokens):
    """Whether `gh pr merge` follows a command by anything but a chain of `&&`.

    After `;`, a newline, a pipe or `||` it would run even though the check
    before it failed, or with the status of the last command of a pipeline.
    `--help` and `--disable-auto` do not merge.
    """
    words, joined, strict, target = [], False, True, False
    # `cond; then ...` and `cond; do ...` run only when cond succeeded, like `&&`.
    tokens = ['&&' if t in {';', '\n'} and tokens[i + 1:i + 2] in (['then'], ['do']) else t
              for i, t in enumerate(tokens)]
    for token in [*tokens, ';']:
        if target:
            target = False
        elif token in REDIRECTIONS:
            target = True
        elif token not in SEPARATORS:
            words.append(token)
        else:
            if words:
                merge = merge_arguments(words)
                if merge is not None and not merge_guard.parse_args(merge)[3] and joined and not strict:
                    return True
                joined, words = True, []
            if token != '&&':
                strict = strict and not joined
    return False


def check_words(words, reasons):
    check_assignments(leading_assignments(words), reasons)
    for i, w in enumerate(words):
        if os.path.basename(w) == 'git':
            check_git(words[i + 1:], reasons)
    delegated = arguments_after(words, ['acp-mcp-call', 'delegate_task'])
    if delegated:
        try:
            reasons.extend(delegate_guard.violations(json.loads(delegated[0])))
        except json.JSONDecodeError:
            pass  # Arguments assembled at run time are out of reach.


def shell_script(args):
    """Return the script of `sh -c script` style arguments, if any."""
    has_c, i = False, 0
    while i < len(args):
        arg = args[i]
        if arg in {'-o', '+o'}:
            i += 2
            continue
        if arg.startswith('--'):
            i += 1
            continue
        if arg.startswith('-') and len(arg) > 1:
            has_c = has_c or 'c' in arg[1:]
            i += 1
            continue
        return arg if has_c else None
    return None


def leading_assignments(words):
    """Return variables a simple command sets for itself or exports.

    Only command positions count: `LEFTHOOK=0 git ...`, `env`/`export` arguments
    and words after option-only wrappers such as `sudo`. The same text as an
    ordinary argument (`rg LEFTHOOK=0`, a commit message) is not an assignment.
    """
    env = {}
    for word in words:
        match = ASSIGNMENT.fullmatch(word)
        if match:
            env[match[1]] = match[2]
        elif os.path.basename(word) in ASSIGNING_COMMANDS or word.startswith('-') or word in RESERVED:
            continue
        else:
            break
    return env


def check_assignments(env, reasons):
    if env.get('LEFTHOOK', '1').lower() in FALSY:
        reasons.append(HOOK_SKIP.format(f'LEFTHOOK={env["LEFTHOOK"]}'))
    if env.get('LEFTHOOK_EXCLUDE'):
        reasons.append(HOOK_SKIP.format('LEFTHOOK_EXCLUDE'))
    for name, key in env.items():
        index = name.removeprefix('GIT_CONFIG_KEY_')
        if index != name:
            check_config_pair(key, env.get(f'GIT_CONFIG_VALUE_{index}'), reasons, name)
    parameters = env.get('GIT_CONFIG_PARAMETERS', '').lower()
    if 'commit.gpgsign' in parameters:
        reasons.append(UNSIGNED.format('GIT_CONFIG_PARAMETERS'))
    if 'core.hookspath' in parameters:
        reasons.append(HOOK_SKIP.format('GIT_CONFIG_PARAMETERS'))


def check_config_pair(key, value, reasons, label):
    """Check one configuration entry; value None means the value is not visible."""
    key = key.lower()
    if key == 'commit.gpgsign' and (value is None or value.lower() in FALSY):
        reasons.append(UNSIGNED.format(label))
    elif key == 'core.hookspath':
        reasons.append(HOOK_SKIP.format(label))


def long_option(arg, name, shortest):
    # Git accepts unambiguous abbreviations of long options.
    return arg == name or (name.startswith(arg) and len(arg) >= len(shortest))


def check_git(args, reasons):
    i = 0
    while i < len(args):
        arg = args[i]
        if arg == '-c' or (arg.startswith('-c') and not arg.startswith('--')):
            item = args[i + 1] if arg == '-c' and i + 1 < len(args) else arg[2:]
            key, has_value, value = item.partition('=')
            # `-c key` without "=" means true.
            check_config_pair(key, value if has_value else 'true', reasons, f'-c {item}')
            i += 2 if arg == '-c' else 1
        elif arg == '--config-env' or arg.startswith('--config-env='):
            item = args[i + 1] if arg == '--config-env' and i + 1 < len(args) else arg.partition('=')[2]
            check_config_pair(item.partition('=')[0], None, reasons, f'--config-env {item}')
            i += 2 if arg == '--config-env' else 1
        elif arg in GIT_VALUE_OPTIONS:
            i += 2
        elif arg.startswith('-'):
            i += 1
        else:
            break
    else:
        return
    subcommand, rest = args[i], args[i + 1:]
    if subcommand == 'commit':
        check_commit(rest, reasons)
        return
    options = rest[:rest.index('--')] if '--' in rest else rest
    for arg in options:
        if long_option(arg, '--no-verify', '--no-v'):
            reasons.append(HOOK_SKIP.format(f'git {subcommand} {arg}'))
        elif long_option(arg, '--no-gpg-sign', '--no-g'):
            reasons.append(UNSIGNED.format(f'git {subcommand} {arg}'))
    if subcommand == 'config':
        check_config(rest, reasons)


def check_commit(args, reasons):
    i = 0
    while i < len(args):
        arg = args[i]
        i += 1
        if arg == '--':
            break
        if arg.startswith('--'):
            name = arg.partition('=')[0]
            if long_option(name, '--no-verify', '--no-v'):
                reasons.append(HOOK_SKIP.format(f'git commit {arg}'))
            elif long_option(name, '--no-gpg-sign', '--no-g'):
                reasons.append(UNSIGNED.format(f'git commit {arg}'))
            elif name in COMMIT_LONG_VALUE and '=' not in arg:
                i += 1
        elif arg.startswith('-') and len(arg) > 1:
            for position, flag in enumerate(arg[1:], 2):
                if flag == 'n':
                    reasons.append(HOOK_SKIP.format(f'git commit {arg}'))
                elif flag in COMMIT_SHORT_VALUE:
                    if position == len(arg):  # value is the next word
                        i += 1
                    break
                elif flag in COMMIT_SHORT_ATTACHED:
                    break


def check_config(args, reasons):
    flags, positional, files = set(), [], []
    i = 0
    while i < len(args):
        arg = args[i]
        if arg == '--':
            positional.extend(args[i + 1:])
            break
        name, has_value, value = arg.partition('=')
        if arg in CONFIG_VALUE_OPTIONS:
            if arg in {'-f', '--file'} and i + 1 < len(args):
                files.append(args[i + 1])
            i += 2
            continue
        if arg.startswith('-') and arg != '-':
            flags.add(name)
            if name == '--file' and has_value:
                files.append(value)
        else:
            positional.append(arg)
        i += 1
    if positional and positional[0] in CONFIG_READ_ACTIONS | CONFIG_WRITE_ACTIONS:
        write = positional.pop(0) in CONFIG_WRITE_ACTIONS
    else:
        write = bool(flags & CONFIG_WRITE_FLAGS) or (
            not flags & CONFIG_READ_FLAGS and len(positional) >= 2)
    if not write:
        return
    scopes = sorted(flags & {'--global', '--system'})
    scopes += [f for f in files if os.path.expanduser(f) in USER_CONFIG_FILES]
    if scopes:
        reasons.append(GLOBAL_CONFIG.format('git config ' + ' '.join(scopes)))
    if positional:
        value = positional[1] if len(positional) > 1 else None
        check_config_pair(positional[0], value, reasons, 'git config ' + ' '.join(positional[:2]))


def main():
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as error:
        # Refuse rather than silently allow a command that could not be read.
        print(f'command_guard: フック入力の JSON を読めません: {error}', file=sys.stderr)
        return 2
    if not isinstance(payload, dict) or payload.get('tool_name', 'Bash') != 'Bash':
        return 0
    tool_input = payload.get('tool_input')
    command = tool_input.get('command') if isinstance(tool_input, dict) else None
    if not command:
        return 0
    reasons = violations(command)
    if not reasons:
        # Only now ask the network, and only for merges.
        cwd = payload.get('cwd') or os.getcwd()
        for tokens in scripts(command):
            for words in segments(tokens):
                merge = merge_arguments(words)
                if merge is not None:
                    reasons.extend(merge_guard.check(merge, cwd))
        reasons = list(dict.fromkeys(reasons))
    if reasons:
        print('command_guard: このコマンドは実行できません（AGENTS.md・docs/harness.md の規則）。',
              *(f'- {reason}' for reason in reasons), sep='\n', file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
