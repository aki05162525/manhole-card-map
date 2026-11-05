import pathlib,json,hashlib,contextlib,io
D=pathlib.Path('data/evidence/issue5/yokohama-priority');O=D.parent/'review-yokohama-priority'
paths=list(D.glob('*')); before={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths if p.is_file()}
# Execute the exact derivation, changing only its output destination.
s=(D/'derive.py').read_text().replace("(D/'derived-point.json').write_text", "(pathlib.Path('data/evidence/issue5/review-yokohama-priority')/'reproduced-point.json').write_text")
with contextlib.redirect_stdout(io.StringIO()):exec(compile(s,str(D/'derive.py'),'exec'),{'__file__':str((D/'derive.py').resolve())})
assert json.loads((O/'reproduced-point.json').read_text())==json.loads((D/'derived-point.json').read_text())
# Replace only writes in the builder with capture to compare its outputs without touching sources.
s=(D/'build.py').read_text();s=s.replace("write=lambda p,v:pathlib.Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\\n')", "write=lambda p,v:captured.update({str(p):json.dumps(v,ensure_ascii=False,indent=2)+'\\n'})")
captured={};exec(compile(s,str(D/'build.py'),'exec'),{'__file__':str((D/'build.py').resolve()),'captured':captured})
outputs={p:txt==pathlib.Path(p).read_text() for p,txt in captured.items()};assert outputs and all(outputs.values())
for p,h in before.items():assert hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()==h
(O/'reproduction.json').write_text(json.dumps({'deriveResultExactMatch':True,'buildOutputsExactMatch':outputs,'candidateDirectoryUnchanged':True,'candidateDirectoryHashes':before,'GoogleInputToDerive':False,'note':'derive.py only reads the specified archived GML; builder reads derived point plus provenance metadata; capture/redirection avoids source mutation.'},ensure_ascii=False,indent=2)+'\n');print('PASS derive exact JSON, build exact bytes, original directory hashes unchanged')
