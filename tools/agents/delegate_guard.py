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

# An issue is not a pull request: "Issue #12", ".../issues/12" are removed before reading.
ISSUE_REF = re.compile(r'\b(?:issues?|イシュー)\s*#\s*\d+|\S*/issues/\d+', re.I)
# A reference to a pull request: "PR #12", "PR12", "#12", ".../pull/12".
PR_REF = r'(?:\bPR\s*#?\s*|(?<![\w#&/])#|(?:https?://\S*?)?/pull/)\d+'
# Wordings that make an existing PR the destination of the child's commits. A PR
# or its branch mentioned for reference ("PR #12 のブランチを参考に") is not one.
TO_PR = re.compile(
    # "PR #12 に修正を足す", "PR #12 を修正して", "PR #12（branch）のブランチで",
    # "PR #12 のレビューの指摘を直す", "PR #12 で出た指摘に対応する".
    PR_REF + r'\s*(?:[(（][^)）\n]*[)）])?\s*(?:'
    r'(?:に|へ)[^。\n]{0,20}?(?:足|追加|積|push|プッシュ)'
    r'|を\s*(?:修正|直|更新)'
    r'|の\s*(?:ブランチ|head\b)\s*(?:に|へ|で)'
    r'|[のでに][^。\n]{0,20}?指摘[^。\n]{0,10}?(?:直|修正|対応|反映)'
    r')'
    # "Push the fix to PR #12", "Fix the review comments on PR #12", "Add a commit to #12", "Update PR #12".
    r'|\bpush\b[^.\n]{0,40}?\b(?:to|onto|into)\s+' + PR_REF +
    r'|\b(?:fix|address|apply|resolve|handle)\b[^.\n]{0,30}?\b(?:comments?|feedback|findings?|reviews?)'
    r'\s+(?:on|in|for|of|from)\s+' + PR_REF +
    r'|\b(?:add|push)\b[^.\n]{0,20}?\bcommits?\s+(?:to|on|onto)\s+' + PR_REF +
    r'|\bupdate\s+' + PR_REF, re.I)
# "同じブランチに push", "その PR に足す", "push to that PR": the destination named
# without its number, counted only when the task refers to a PR.
TO_SAME = re.compile(
    # "この PR で" may be the new PR, so その・この count only with に・へ.
    r'(?:(?:同じ|元の|既存の)\s*(?:PR|ブランチ)\s*(?:に|へ|で)|(?:その|この)\s*(?:PR|ブランチ)\s*(?:に|へ))'
    r'[^。\n]{0,20}?(?:push|プッシュ|足|追加|積|コミット)'
    r'|\bpush\b[^.\n]{0,40}?\b(?:to|onto|into)\s+(?:that|the same|the existing|its)\s+'
    r'(?:PR|pull request|branch)\b', re.I)
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
    task = ISSUE_REF.sub('Issue', task)
    reasons = []
    if role in READ_ONLY_ROLES and isolation != 'worktree':
        reasons.append(NO_WORKTREE.format(role))
    to_pr = TO_PR.search(task) or (re.search(PR_REF, task, re.I) and TO_SAME.search(task))
    if (role not in READ_ONLY_ROLES and isolation == 'worktree' and to_pr
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
