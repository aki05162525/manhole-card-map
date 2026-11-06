"""Read-only historical filesystem view for adoption regression tests."""
from contextlib import contextmanager
import os
from pathlib import Path
import shutil
from tempfile import TemporaryDirectory


@contextmanager
def before_four(root):
    """Replay prerequisite manifest and packages; never rewrite fixed evidence.

    Hard links keep resolved evidence paths inside the historical root, as the
    assembler requires. This view is exclusively read-only.
    """
    with TemporaryDirectory() as directory:
        target = Path(directory)
        def ignored(directory, names):
            excluded = {'four-followup', 'three-followup', 'newbuild-followup'}
            if Path(directory) == root / 'data':
                excluded.update(('work', 'raw'))
            return set(names) & excluded
        shutil.copytree(root / 'data', target / 'data', copy_function=os.link,
                        ignore=ignored)
        (target / 'tools/national').mkdir(parents=True)
        shutil.copyfile(root / 'data/evidence/issue60/four-followup/baseline-manifest.json',
                        target / 'tools/national/manifest.json')
        yield target


@contextmanager
def before_three(root):
    """Replay the fixed PR83 manifest without subsequent three-point packages."""
    with TemporaryDirectory() as directory:
        target = Path(directory)
        def ignored(directory, names):
            excluded = {'three-followup', 'newbuild-followup'}
            if Path(directory) == root / 'data':
                excluded.update(('work', 'raw'))
            return set(names) & excluded
        shutil.copytree(root / 'data', target / 'data', copy_function=os.link, ignore=ignored)
        (target / 'tools/national').mkdir(parents=True)
        shutil.copyfile(root / 'data/evidence/issue60/three-followup/baseline-manifest.json',
                        target / 'tools/national/manifest.json')
        yield target
@contextmanager
def before_newbuild(root):
    """Replay the fixed 133-adoption manifest without subsequent newbuild packages."""
    with TemporaryDirectory() as directory:
        target = Path(directory)
        def ignored(directory, names):
            excluded = {'newbuild-followup'}
            if Path(directory) == root / 'data':
                excluded.update(('work', 'raw'))
            return set(names) & excluded
        shutil.copytree(root / 'data', target / 'data', copy_function=os.link, ignore=ignored)
        (target / 'tools/national').mkdir(parents=True)
        shutil.copyfile(root / 'data/evidence/issue60/newbuild-followup/baseline-manifest.json',
                        target / 'tools/national/manifest.json')
        yield target


@contextmanager
def selected_history(root, excluded):
    """Read-only view of one branch's packages; fixed history is never edited."""
    import json
    with TemporaryDirectory() as directory:
        target = Path(directory)
        def ignored(directory, names):
            skip = set(excluded)
            if Path(directory) == root / 'data':
                skip.update(('work', 'raw'))
            return set(names) & skip
        shutil.copytree(root / 'data', target / 'data', copy_function=os.link, ignore=ignored)
        manifest = json.loads((root / 'tools/national/manifest.json').read_text())
        for key in ('locations', 'locationLifecycle'):
            manifest[key] = [s for s in manifest[key] if not set(Path(s['path']).parts) & set(excluded)]
        (target / 'tools/national').mkdir(parents=True)
        (target / 'tools/national/manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
        yield target
