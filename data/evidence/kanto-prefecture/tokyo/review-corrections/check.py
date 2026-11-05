"""Read-only reconstruction of review corrections; never overwrite evidence."""
import csv
import hashlib
import io
import json
from pathlib import Path
import zipfile
ROOT = Path(__file__).resolve().parents[5]
E = ROOT / "data/evidence/kanto-prefecture/tokyo"
def build():
    old = json.loads((E / "north/hintmation-comparison.json").read_text())
    source = old["numericFit"]["positionReferenceSource"]
    retrievals = json.loads((E / "north/retrievals.json").read_text())
    record = next(r for r in retrievals if r.get("status") == "acquired" and r["url"] == source["url"])
    raw = ROOT / record["rawPath"]
    assert hashlib.sha256(raw.read_bytes()).hexdigest() == source["sha256"]
    with zipfile.ZipFile(raw) as archive:
        reader = csv.DictReader(io.TextIOWrapper(archive.open(source["csv"]), encoding="cp932"))
        rows = [dict(town=r["大字・丁目名"], block=r["街区符号・地番"], lat=float(r["緯度"]), lng=float(r["経度"])) for r in reader if r["市区町村名"] == "北区" and "赤羽台" in r["大字・丁目名"]]
    assert len(rows) == 112
    assert all(-90 <= r["lat"] <= 90 and -180 <= r["lng"] <= 180 and r["block"] for r in rows)
    values = [r for r in rows if r["town"] == "赤羽台二丁目" and r["block"] == "1"]
    assert values
    tiles = json.loads((E / "east/RdCL-tiles.json").read_text())
    mapping = []
    for tile in tiles["tiles"]:
        original = ROOT / tile["path"]
        actual = original if original.exists() else original.with_name(original.name.replace("RdCL-", "maruyoshi-", 1))
        assert hashlib.sha256(actual.read_bytes()).hexdigest() == tile["sha256"]
        if actual != original:
            mapping.append(dict(original=tile["path"], corrected=str(actual.relative_to(ROOT)), sha256=tile["sha256"]))
    assert len(mapping) == 8
    return dict(schema=1, supersedesFields="north/hintmation-comparison.json: numericFit.positionReferenceBlocks and independentChecks[0]", source=source, positionReferenceBlocks=rows, independentCheck=dict(values=values, use="街区代表点のみ。旧『北端点から約33m』は未検証として撤回。棟同定・相似変換には使用しない。"), tilePathCorrections=mapping, candidateCoordinatesChanged=False)
if __name__ == "__main__":
    result = build()
    saved = Path(__file__).with_name("corrections.json")
    assert json.loads(saved.read_text()) == result
    print("PASS: 112 CSV rows, nonempty block lookup, 8 hash-verified tile aliases; read-only")
