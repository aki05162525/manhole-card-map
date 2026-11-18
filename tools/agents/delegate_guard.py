#!/usr/bin/env python3
"""Refuse T3 `delegate_task` calls whose brief misses a worktree or the PR-branch steps.

Claude Code (.claude/settings.json) and Codex (.codex/hooks.json) run this as a
PreToolUse hook on the T3 MCP tool. Its name depends on the harness
(`mcp__t3-code__delegate_task`, `mcp__t3_code_direct__delegate_task`); the
arguments arrive as `tool_input`. command_guard.py applies the same check to
the shell fallback `acp-mcp-call delegate_task '<json>'`.

The checks read the brief as text, so they only catch the usual wording; the
examples in test_delegate_guard.py fix what is and is not refused.
"""

import json
import re
import sys

TOOL_NAME = re.compile(r'mcp__t3[-_]code[\w-]*__delegate_task')
READ_ONLY_ROLES = {'review', 'research'}

# A reference to a pull request: "PR #12", "PR12", "#12", ".../pull/12".
PR_REF = r'(?:\bPR\s*#?\s*|(?<![\w#&])#|/pull/)\d+'
# What follows the reference when the child is to add commits to that PR:
# "PR #12 に修正を足して", "PR #12（branch）のブランチで", "PR #12 のレビューの指摘を直す".
ADD_TO_PR = re.compile(
    PR_REF + r'\s*(?:[(（][^)）\n]*[)）])?\s*(?:'
    r'(?:に|へ)[^。\n]{0,20}?(?:足|追加|積|push|プッシュ)'
    r'|の\s*(?:ブランチ|head\b)'
    r'|の[^。\n]{0,20}?指摘[^。\n]{0,10}?(?:直|修正|対応|反映)'
    r')', re.I)
SWITCH_CREATE = re.compile(r'git\s+(?:switch\s+(?:-c|--create)|checkout\s+-b)\s')
PUSH_HEAD = re.compile(r'git\s+push\s+(?:-\S+\s+)*\S+\s+HEAD:')

NO_WORKTREE = ('レビュー・調査の担当（role: {}）にも isolation: "worktree" を渡す。'
               '試しのファイルや壊し方はその worktree の中で作らせ、/tmp や git worktree add は使わせない'
               '（作業ディレクトリの外への書き込みは承認待ちになる）。')
PR_BRANCH = ('開いている PR に修正を足す担当の task には、`git switch -c <作業名> origin/<branch>` で作業し、'
             '`git push origin HEAD:<branch>` で push する（force push はしない）手順を書く。'
             'その PR のブランチは別の worktree が checkout しているので、`git switch <branch>` では止まる。')


def violations(arguments):
    """Return the reasons a delegate_task call with these arguments must not run."""
    if not isinstance(arguments, dict):
        return []
    role = arguments.get('role')
    isolation = arguments.get('isolation')
    task = arguments.get('task') if isinstance(arguments.get('task'), str) else ''
    reasons = []
    if role in READ_ONLY_ROLES and isolation != 'worktree':
        reasons.append(NO_WORKTREE.format(role))
    if (role not in READ_ONLY_ROLES and isolation == 'worktree' and ADD_TO_PR.search(task)
            and not (SWITCH_CREATE.search(task) and PUSH_HEAD.search(task))):
        reasons.append(PR_BRANCH)
    return reasons


def main():
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as error:
        print(f'delegate_guard: フック入力の JSON を読めません: {error}', file=sys.stderr)
        return 2
    if not isinstance(payload, dict) or not TOOL_NAME.fullmatch(str(payload.get('tool_name', ''))):
        return 0
    reasons = violations(payload.get('tool_input'))
    if reasons:
        print('delegate_guard: この委任は実行できません（docs/harness.md の規則）。',
              *(f'- {reason}' for reason in reasons), sep='\n', file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
