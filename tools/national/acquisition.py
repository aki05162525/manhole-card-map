"""Portable acquisition records. Raw objects and records are never overwritten."""
import argparse
import hashlib
import json
from pathlib import Path
import tempfile

from research_common import _now, fetch_cached, read_verified

USER_AGENT = 'manhole-card-map/0.1 (personal project; research acquisition)'


def safe_path(root, name):
    """Resolve a relative reference without traversal or symlink components."""
    root = Path(root)
    path = Path(name)
    if path.is_absolute() or not path.parts or '..' in path.parts:
        raise ValueError('relative path within storage required')
    if root.is_symlink():
        raise ValueError('symlink forbidden')
    current = root
    for part in path.parts:
        current = current / part
        if current.is_symlink():
            raise ValueError('symlink forbidden')
    return current


def verify(record, root):
    """Return verified response bytes (including failed HTTP response bodies)."""
    if record.get('schema') != 1 or record.get('status') not in ('acquired', 'cached', 'failed'):
        raise ValueError('invalid acquisition record')
    failed = record['status'] == 'failed'
    path_key, hash_key, size_key = ('responseRawPath', 'responseSHA256', 'responseBytes') if failed else ('rawPath', 'sha256', 'bytes')
    if path_key not in record:
        if failed and hash_key not in record and size_key not in record:
            return None
        raise ValueError('missing raw reference')
    raw = read_verified(safe_path(root, record[path_key]), record[hash_key])
    if len(raw) != record[size_key]:
        raise ValueError('byte count mismatch')
    return raw


def from_result(raw, provenance, root):
    """Convert fetch_cached's result, preserving metadata and relative raw refs."""
    record = dict(provenance, schema=1)
    for key in ('rawPath', 'responseRawPath'):
        if key in record:
            source = Path(record[key])
            relative = source.absolute().relative_to(Path(root).absolute())
            safe_path(root, relative)
            record[key] = relative.as_posix()
    verified = verify(record, root)
    if record['status'] != 'failed' and (raw is None or raw != verified):
        raise ValueError('result bytes mismatch')
    if record['status'] == 'failed' and raw is not None:
        raise ValueError('failed result must not supply successful bytes')
    return record


def write_record(path, record):
    """Publish a new JSON record exclusively."""
    with Path(path).open('x', encoding='utf-8') as stream:
        stream.write(json.dumps(record, ensure_ascii=False, indent=2) + '\n')


def fetch(url, root, version, headers=None, timeout=30):
    """Fetch one URL; root holds portable records and content-addressed originals.

    Reuse keys include URL, edition and request headers. Cache hits preserve
    fetchedAt. Internal fetch_cached absolute metadata lives only in a temporary
    directory; durable records contain relative references exclusively.
    """
    root = Path(root)
    safe_path(root, 'objects')
    headers = {k.lower(): v for k, v in (headers or {}).items()}
    headers.setdefault('user-agent', USER_AGENT)
    key = hashlib.sha256(json.dumps(dict(url=url, version=version, requestHeaders=headers), sort_keys=True).encode()).hexdigest()
    cached = safe_path(root, key + '.json')
    if cached.exists():
        record = json.loads(cached.read_text())
        if any(record.get(k) != v for k, v in dict(url=url, version=version, requestHeaders=headers).items()):
            raise ValueError('cache provenance mismatch')
        verify(record, root)
        if record['status'] != 'failed':
            return dict(record, status='cached', reusedAt=_now())
    root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        raw, provenance = fetch_cached(url, tmp, version, headers, timeout)
        for path_key, hash_key in (('rawPath', 'sha256'), ('responseRawPath', 'responseSHA256')):
            if path_key in provenance:
                body = read_verified(provenance[path_key], provenance[hash_key])
                target = safe_path(root, 'objects/' + provenance[hash_key] + '.raw')
                target.parent.mkdir(parents=True, exist_ok=True)
                if target.exists():
                    read_verified(target, provenance[hash_key])
                else:
                    with target.open('xb') as stream:
                        stream.write(body)
                provenance[path_key] = str(target.absolute())
        record = from_result(raw, provenance, root)
    if record['status'] != 'failed':
        write_record(cached, record)
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    get = sub.add_parser('fetch')
    get.add_argument('url')
    get.add_argument('--storage', type=Path, required=True, help='explicit raw storage outside Git, e.g. data/work/originals/<work>')
    get.add_argument('--version', required=True)
    get.add_argument('--range', dest='byte_range')
    get.add_argument('--user-agent', default=USER_AGENT)
    get.add_argument('--out', type=Path, required=True)
    check = sub.add_parser('verify')
    check.add_argument('record', type=Path)
    check.add_argument('--storage', type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.command == 'verify':
            verify(json.loads(args.record.read_text()), args.storage)
        else:
            repo = Path(__file__).resolve().parents[2]
            output = args.out.resolve()
            if output.is_relative_to(repo / 'data') and not output.is_relative_to(repo / 'data/work'):
                raise ValueError('source data output forbidden; use --storage for raw originals')
            storage = args.storage.resolve()
            if storage.is_relative_to(repo / 'data') and not storage.is_relative_to(repo / 'data/work'):
                raise ValueError('raw storage in tracked data forbidden; use data/work/originals/<work>')
            if output.is_relative_to(repo / 'data/work/issue7-baseline'):
                raise ValueError('fixed baseline output forbidden')
            if args.out.exists() or args.out.is_symlink():
                raise FileExistsError(args.out)
            headers = {'user-agent': args.user_agent}
            if args.byte_range:
                headers['range'] = args.byte_range
            record = fetch(args.url, args.storage, args.version, headers)
            write_record(args.out, record)
    except (ValueError, OSError, KeyError, TypeError) as error:
        parser.exit(1, f'acquisition failed: {error}\n')


if __name__ == '__main__':
    main()
