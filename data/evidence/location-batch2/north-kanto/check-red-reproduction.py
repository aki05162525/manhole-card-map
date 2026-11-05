import sys,copy,unittest,io,json,pathlib
from unittest.mock import patch
sys.path.insert(0,'tools/national')
import assemble as a
import test_location_batch2_north_kanto as t
original=a.read_json
manifest=original(t.ROOT/'tools/national/manifest.json')
for k in ['locations','locationLifecycle']:manifest[k]=[r for r in manifest[k] if not r['path'].startswith(t.PREFIX)]
def read(path):return copy.deepcopy(manifest) if path == t.ROOT/'tools/national/manifest.json' else original(path)
stream=io.StringIO()
with patch.object(a,'read_json',side_effect=read):
 result=unittest.TextTestRunner(stream=stream,verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(t.NorthKantoBatch2Test))
pathlib.Path('data/work/location-batch2/north-kanto/red-reproduction.log').write_text('Later reproduction; not the original pre-adoption run. Manifest on disk unchanged.\n'+stream.getvalue())
assert result.testsRun==2 and len(result.failures)==3 and not result.errors
print(json.dumps({'testsRun':result.testsRun,'failures':len(result.failures),'failureTests':[str(test) for test,_ in result.failures],'note':'後日の再現検査。元の実行ログと偽らない。2施設subTest失敗＋差分テスト失敗。'},ensure_ascii=False))
