"""技術検証 4 の保存済み結果を集計する（Python 標準ライブラリのみ）。"""

import collections
import json
import math
from pathlib import Path
import statistics


def distance(lat1, lon1, lat2, lon2):
    """半径 6,371 km の球面上の直線距離を求める。"""
    a, b, c, d = map(math.radians, (lat1, lon1, lat2, lon2))
    h = math.sin((a - c) / 2) ** 2 + math.cos(a) * math.cos(c) * math.sin((b - d) / 2) ** 2
    return 12742 * math.asin(min(1, math.sqrt(h)))


def stats(values):
    values = sorted(values)
    return {"件数": len(values), "中央値km": statistics.median(values),
            "90%点km": values[math.ceil(len(values) * .9) - 1], "最大km": values[-1]}


def main():
    work = Path("data/work")
    sources = json.loads((work / "addresses-sources.json").read_text())
    ocr = {r["index"]: r for r in json.loads((work / "ocr.json").read_text())}
    # 比較用の点であり、公開用の座標補正には用いない。出典は報告書を参照。
    landmarks = {
        "東京都新宿区西新宿2-8-1": (35 + 41 / 60 + 22 / 3600, 139 + 41 / 60 + 30 / 3600),
        "大阪府大阪市北区梅田3-1-1": (34.702714, 135.495965),
        "東京都台東区上野公園1-60": (35.7111375, 139.7738421),
    }
    for filename in ("geocoded.json", "geocoded-c.json"):
        rows = json.loads((work / filename).read_text())
        assert len(rows) == len(sources) == 356
        assert {r["query"]["input"] for r in rows} == set(sources)
        levels, borrowed, borrowed_addresses = (collections.Counter() for _ in range(3))
        distances, borrowed_distances, excluded, coarse, places = [], [], [], [], []
        for row in rows:
            query, result = row["query"]["input"], row["result"]
            level = result["coordinate_level"]
            levels[level] += 1
            if any(s["borrowed"] for s in sources[query]):
                borrowed_addresses[level] += 1
            if level in ("city", "prefecture", "unknown"):
                coarse.append({"住所": query, "段階": level, "出どころ": sources[query]})
            for source in sources[query]:
                if source["borrowed"]:
                    borrowed[level] += 1
                lid = ocr[source["index"]]
                coords = result["lat"], result["lon"], lid.get("lat"), lid.get("lng")
                if any(v is None or not math.isfinite(v) or v == 0 for v in coords):
                    excluded.append({"住所": query, "行": source["index"], "場所": source["place"]})
                    continue
                km = distance(*coords)
                distances.append(km)
                if source["borrowed"]:
                    borrowed_distances.append(km)
            for prefix, reference in landmarks.items():
                if query.startswith(prefix):
                    places.append({"住所": query, "段階": level,
                                   "座標": [result["lat"], result["lon"]],
                                   "比較点からの距離m": 1000 * distance(result["lat"], result["lon"], *reference)})
        print(json.dumps({"ファイル": filename, "座標の段階": levels,
                          "借用した場所": borrowed, "借用を含む住所": borrowed_addresses,
                          "蓋との距離": stats(distances), "借用した場所と蓋の距離": stats(borrowed_distances),
                          "距離の除外": excluded, "市区町村以下に進まない住所": coarse,
                          "有名な場所": places}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
