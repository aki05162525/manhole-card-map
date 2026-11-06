"""Offline conservative reference graph. Unreached never means safe to delete."""
import argparse
import fnmatch
from collections import deque
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import sys
import subprocess
import os

from assemble import read_json, repo_path, reject

PATH = re.compile(r'(?:data|tools|cmd|internal)/[^\s\x22\x27\x60<>),;]+')
HASH = re.compile(r'^[0-9a-fA-F]{64}$')


def git_environment():
    return {k: v for k, v in os.environ.items() if not k.startswith('GIT_')}


# research_index.py:128-162 and national_audit.py:128,199 read these inputs.
DIRECTORY_ROOTS = (
    *((f'data/national/{c}', '**/*.json') for c in
      ('issue16', 'issue20', 'issue25', 'issue26', 'issue27', 'location-batch1', 'location-batch2')),
    *((f'data/national/{c}', '**/*review*.md') for c in
      ('issue16', 'issue20', 'issue25', 'issue26', 'issue27', 'location-batch1', 'location-batch2')),
    ('data/national/issue7/reviews', '*.json'),
    ('data/overrides/proposals', '*.json'),
)


def matches(path, pattern):
    """Match repository globs, with ** spanning zero or more directories."""
    parts, patterns = path.split('/'), pattern.split('/')
    def match(i, j):
        if j == len(patterns):
            return i == len(parts)
        if patterns[j] == '**':
            return match(i, j + 1) or (i < len(parts) and match(i + 1, j))
        return i < len(parts) and fnmatch.fnmatchcase(parts[i], patterns[j]) and match(i + 1, j + 1)
    return match(0, 0)


def tracked_files(root):
    return set(subprocess.check_output(["git", "-C", str(root), "ls-files", "-z"], env=git_environment()).decode().split("\0")) - {""}


def roots(root, tracked):
    names = {'tools/national/manifest.json', 'data/national/source-review/registry.json'}
    patterns = [
        'data/evidence/issue60/manual-user-*/decision.json',
        'data/national/issue7/**/*.json',
        'tools/national/*.py', '**/*_test.go', 'tools/build-real-data.py',
        'cmd/builddata/main.go']
    from research_index import CAMPAIGNS
    patterns += [f'data/national/{c}/**/*.json' for c in CAMPAIGNS]
    patterns += [f'data/national/{c}/**/*review*.md' for c in CAMPAIGNS]
    for pattern in patterns:
        names.update(p for p in tracked if matches(p, pattern))
    for directory, pattern in DIRECTORY_ROOTS:
        names.update(p for p in tracked if p.startswith(directory + '/')
                     and matches(p[len(directory) + 1:], pattern))
    # Tool sources are roots so literal inputs and unresolved computed inputs remain visible.
    return sorted(names - {'tools/national/evidence_graph.py', 'tools/national/test_evidence_graph.py'})


def graph(root, entries=None):
    root = Path(root).resolve()
    tracked = tracked_files(root)
    entries = sorted(set(roots(root, tracked) if entries is None else entries))
    queue = deque((p, p, []) for p in entries)
    seen, references, broken, unsupported = {}, [], [], []
    parents = {str(parent) for p in tracked for parent in PurePosixPath(p).parents}
    referenced_directories = set()
    json_cache = {}
    ignored, directories, suspects, mutable = [], [], [], []
    immutable = []
    digests = {}
    hash_index = {}
    for name in sorted(tracked):
        path = root / name
        if name.startswith('data/evidence/') and path.is_file():
            digests[name] = hashlib.sha256(path.read_bytes()).hexdigest()
            hash_index.setdefault(digests[name], []).append(name)

    def reference(source, origin, route, value, kind, expected=None, historical=False):
        record = dict(source=source, value=value, kind=kind)
        if expected:
            record['expectedSHA256'] = expected
        references.append(record)
        if value.startswith('/'):
            record['kind'] = 'historical'
            historical = True
        if historical or kind == 'external':
            return
        name, _, pointer = value.partition('#')
        if not name:
            name = source
        elif '/' not in name and kind == 'bare-file':
            filename = name
            parent = PurePosixPath(source).parent.as_posix()
            name = (Path(source).parent / name).as_posix()
            if name not in tracked:
                candidates = sorted(p for p in tracked if (parent == '.' or p.startswith(parent + '/')) and PurePosixPath(p).name == filename)
                if len(candidates) != 1:
                    suspects.append(dict(record, reason='ambiguous' if candidates else 'missing'))
                    return
                name = candidates[0]
        elif name.startswith('./') or name.startswith('../'):
            name = (Path(source).parent / name).as_posix()
        try:
            path = repo_path(root, name)
        except ValueError:
            unsupported.append(record)
            return
        name = path.relative_to(root).as_posix()
        if name in parents:
            directories.append(record)
            if name.startswith('data/evidence/') and len(PurePosixPath(name).parts) >= 3:
                referenced_directories.add(name)
            return
        if name.startswith('data/work/') and name not in tracked:
            ignored.append(record)
            return
        if name not in tracked:
            (suspects if kind in ('script-literal', 'markdown-link') or ':' in name or name.endswith('.php') else broken).append(dict(record, reason='missing'))
            return
        if not path.is_file():
            broken.append(dict(record, reason='missing'))
            return
        if expected:
            if name not in digests:
                digests[name] = hashlib.sha256(path.read_bytes()).hexdigest()
            if digests[name] != expected.lower():
                (immutable if name.startswith('data/evidence/') and path.suffix.lower() in ('.html', '.htm', '.pdf', '.png', '.jpg', '.jpeg', '.pbf', '.gz', '.zip', '.webp') else mutable).append(dict(record, reason='hash-mismatch', actualSHA256=digests[name]))
        if pointer:
            try:
                if name not in json_cache:
                    json_cache[name] = read_json(path)
                node = json_cache[name]
                if not pointer.startswith('/'):
                    raise ValueError('non-pointer fragment')
                for token in pointer[1:].split('/'):
                    token = token.replace('~1', '/').replace('~0', '~')
                    node = node[int(token)] if isinstance(node, list) else node[token]
            except (ValueError, KeyError, IndexError, TypeError, OSError):
                broken.append(dict(record, reason='json-pointer'))
        queue.append((name, origin, route + [record]))

    def walk(value, source, origin, route, historical=False):
        if isinstance(value, dict):
            historical = historical or ('head' in value and 'files' in value)
            expected = value.get('sha256') or value.get('SHA256')
            for key, item in sorted(value.items()):
                if isinstance(item, str) and HASH.fullmatch(item) and ('/' in key):
                    reference(source, origin, route, key, 'historical' if historical else 'path-hash-dictionary', item, historical)
                else:
                    walk(item, source, origin, route, historical)
                if key in ('file', 'path', 'snapshotPath') and isinstance(item, str) and '/' not in item:
                    reference(source, origin, route, item, 'bare-file', historical=historical)
                if key in ('path', 'snapshotPath') and isinstance(item, str) and expected and HASH.fullmatch(str(expected)):
                    reference(source, origin, route, item, 'historical' if historical else 'file-hash', expected, historical)
        elif isinstance(value, list):
            for item in value:
                walk(item, source, origin, route, historical)
        elif isinstance(value, str):
            if any(c.isspace() for c in value) and value not in tracked:
                return
            if not historical and HASH.fullmatch(value):
                for target in hash_index.get(value.lower(), []):
                    reference(source, origin, route, target, 'content-hash')
            if value.startswith(('https://', 'http://')):
                reference(source, origin, route, value, 'external')
            elif value.startswith('/'):
                reference(source, origin, route, value, 'historical', historical=True)
            elif value.startswith(('data/', 'tools/', 'cmd/', 'internal/', './', '../')):
                reference(source, origin, route, value, 'historical' if historical else ('json-pointer' if '#' in value else 'relative' if value.startswith('.') else 'file'), historical=historical)

    while queue:
        name, origin, route = queue.popleft()
        if name in seen:
            continue
        path = repo_path(root, name)
        if not path.is_file():
            broken.append(dict(source=origin, value=name, kind='root', reason='missing'))
            continue
        seen[name] = dict(path=name, bytes=path.stat().st_size, root=origin, route=route)
        if path.suffix == '.json':
            try:
                if name not in json_cache:
                    json_cache[name] = read_json(path)
                walk(json_cache[name], name, origin, route)
            except (ValueError, OSError) as error:
                unsupported.append(dict(source=name, kind='json-parse', detail=str(error)))
        elif path.suffix in ('.md', '.py', '.go'):
            text = path.read_text(encoding='utf-8')
            for match in PATH.finditer(text):
                value = match.group().rstrip('.:')
                if any(c in value for c in '*{}'):
                    unsupported.append(dict(source=name, kind='computed-reference', value=value))
                else:
                    reference(name, origin, route, value, 'markdown-link' if path.suffix == '.md' else 'script-literal')
            if path.suffix in ('.py', '.go'):
                unsupported.append(dict(source=name, kind='script-analysis', detail='Computed paths require manual interpretation; literal scan only.'))
            if path.suffix == '.md':
                for target in re.findall(r'\]\(([^)]+)\)', text):
                    if not target.startswith(('data/', 'http')):
                        reference(name, origin, route, './' + target, 'markdown-link')
    unreached = [dict(path=p, bytes=(root / p).stat().st_size, referencedDirectory=next((str(parent) for parent in PurePosixPath(p).parents if str(parent) in referenced_directories), None))
                 for p in sorted(tracked) if p.startswith('data/evidence/')
                 and (root / p).is_file() and p not in seen]
    result = dict(reachable=sorted(seen.values(), key=lambda x: x['path']),
                  brokenOrMismatch=broken, unsupported=unsupported, unreached=unreached,
                  references=references, ignoredWork=ignored, directories=directories,
                  suspectReferences=suspects, recordedPastState=mutable, immutableMismatch=immutable)
    summary = {}
    for key in ('reachable', 'brokenOrMismatch', 'unsupported', 'unreached', 'ignoredWork', 'directories', 'suspectReferences', 'recordedPastState', 'immutableMismatch', 'references'):
        rows = result[key]
        directories = {}
        for row in rows:
            name = row.get('path', row.get('source', ''))
            group = '/'.join(name.split('/')[:3])
            bucket = directories.setdefault(group, dict(count=0, bytes=0))
            bucket['count'] += 1
            bucket['bytes'] += row.get('bytes', 0)
        summary[key] = dict(count=len(rows), bytes=sum(x.get('bytes', 0) for x in rows),
                            directories=directories)
    summary['unreachedUnderReferencedDirectory'] = dict(count=sum(x['referencedDirectory'] is not None for x in unreached), bytes=sum(x['bytes'] for x in unreached if x['referencedDirectory'] is not None))
    summary['unreachedOutsideReferencedDirectory'] = dict(count=sum(x['referencedDirectory'] is None for x in unreached), bytes=sum(x['bytes'] for x in unreached if x['referencedDirectory'] is None))
    result['summary'] = summary
    result['scope'] = 'reachable: root closure; unreached: data/evidence files only; findings bytes are zero (reference records). No deletion judgment.'
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--references', action='store_true')
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    try:
        if args.out:
            destination = args.out.resolve()
            if destination.is_relative_to((args.root / 'data').resolve()):
                reject('output in source data tree is forbidden')
            if args.out.exists():
                reject('cannot overwrite existing output')
        result = graph(args.root)
        if not args.references:
            del result['references']
        serialized = json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2) + '\n'
        if args.out:
            with args.out.open('x', encoding='utf-8') as stream:
                stream.write(serialized)
        else:
            sys.stdout.write(serialized)
    except (ValueError, OSError) as error:
        parser.exit(1, f'evidence graph failed: {error}\n')


if __name__ == '__main__':
    main()
