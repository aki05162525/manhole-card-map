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
            excluded = {'four-followup', 'three-followup'}
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
            excluded = {'three-followup'}
            if Path(directory) == root / 'data':
                excluded.update(('work', 'raw'))
            return set(names) & excluded
        shutil.copytree(root / 'data', target / 'data', copy_function=os.link, ignore=ignored)
        (target / 'tools/national').mkdir(parents=True)
        shutil.copyfile(root / 'data/evidence/issue60/three-followup/baseline-manifest.json',
                        target / 'tools/national/manifest.json')
        yield target


@contextmanager
def before_manual(root):
    """Replay the fixed 531b8d2b manifest before the user exception."""
    with TemporaryDirectory() as directory:
        target = Path(directory)
        def ignored(directory, names):
            return set(names) & ({'work', 'raw'} if Path(directory) == root / 'data' else set())
        shutil.copytree(root / 'data', target / 'data', copy_function=os.link, ignore=ignored)
        (target / 'tools/national').mkdir(parents=True)
        shutil.copyfile(root / 'data/evidence/issue60/manual-user-approval/baseline-manifest.json',
                        target / 'tools/national/manifest.json')
        yield target
