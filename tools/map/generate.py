"""Generate prefectures.ts and optional shared border GeoJSON from N03 GeoJSON zip (one Feature per line).
Usage: python3 tools/map/generate.py INPUT.zip OUTPUT.ts [--borders OUTPUT.json]
Bounds retain polygons whose bounding-box center lies in the windows below.
Coordinates remain N03 JGD2011 longitude/latitude; no reprojection is applied.
"""
import argparse
import hashlib
import gzip
import math
import struct
from collections import defaultdict
import json
import zipfile
from pathlib import Path

GROUPS = [
 ("hokkaido","北海道",1,1),("tohoku","東北",2,7),("kanto","関東",8,14),
 ("chubu","中部",15,23),("kinki","近畿",24,30),("chugoku","中国",31,35),
 ("shikoku","四国",36,39),("kyushu","九州",40,46),("okinawa","沖縄",47,47)]
# Mainland-focused windows: exclude northern territories, Tokyo islands,
# Kagoshima Amami and farther south, Okinawa outlying island groups.
WINDOWS = {"01": (139,41,146,46), "13": (138,35,141,37),
           "46": (129,30,132,33), "47": (127,26,129,28)}
# Placement overrides are for 30px labels at the phone national zoom (about 3.2).
AREA_BADGES = {
 "hokkaido":([142.5,43.5],"北海道中央"),
 "tohoku":([140.5,39],"東北中央"),
 "kanto":([139.8,35.7],"東京中心部"),
 "chubu":([137.5,36.1],"長野・岐阜県境"),
 "kinki":([135.8,34.78],"京都・奈良県境"),
 "chugoku":([133,35.3],"島根県東部の陸地・四国との間隔を確保"),
 "shikoku":([133.1,33.35],"高知県西部の内陸・中国との間隔を確保"),
 "kyushu":([130.6,32.7],"熊本県の陸地・四国との間隔を確保"),
 "okinawa":([127.8,26.5],"沖縄本島中央")}
PREF_BADGES = {"31": ([133.82,35.33],"鳥取県の陸地"),
               "32": ([132.5,35.0],"島根県本土の陸地")}

def merge_bounds(bounds):
    return [[min(b[0][0] for b in bounds),min(b[0][1] for b in bounds)],
            [max(b[1][0] for b in bounds),max(b[1][1] for b in bounds)]]

def include_polygon(code, bounds):
    if code not in WINDOWS:
        return True
    w,s,e,n = WINDOWS[code]
    x,y = [(bounds[0][i]+bounds[1][i])/2 for i in range(2)]
    return w <= x <= e and s <= y <= n

def area_for_code(code):
    return next(a for a,_,lo,hi in GROUPS if lo <= int(code) <= hi)


def source_polygons(source):
    with zipfile.ZipFile(source) as archive:
        with archive.open("N03-20260101.geojson") as stream:
            for line in stream:
                if not line.lstrip().startswith(b'{ "type": "Feature",'):
                    continue
                feature = json.loads(line.rstrip().rstrip(b","))
                geometry = feature["geometry"]
                polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
                for polygon in polygons:
                    yield feature["properties"]["N03_007"][:2], polygon


def simplify(points, tolerance):
    # Local equirectangular metres; one projection per shared chain.
    scale_x = 111320 * math.cos(math.radians(sum(p[1] for p in points)/len(points)))
    projected = [(p[0]*scale_x, p[1]*111320) for p in points]
    keep = {0, len(points)-1}
    stack = [(0, len(points)-1)]
    while stack:
        start, end = stack.pop()
        ax, ay = projected[start]
        bx, by = projected[end]
        dx, dy = bx-ax, by-ay
        length = dx*dx+dy*dy
        furthest, distance = None, tolerance*tolerance
        for i in range(start+1, end):
            x, y = projected[i]
            t = max(0, min(1, ((x-ax)*dx+(y-ay)*dy)/length)) if length else 0
            d = (x-ax-t*dx)**2+(y-ay-t*dy)**2
            if d > distance:
                furthest, distance = i, d
        if furthest is not None:
            keep.add(furthest)
            stack.extend([(start, furthest), (furthest, end)])
    # Do not erase small closed enclave borders.
    if points[0] == points[-1] and len(keep) < 4:
        return points
    return [points[i] for i in sorted(keep)]


def shared_border_lines(polygons, tolerance=750):
    # N03 coordinates have nine decimal places, but GeoJSON conversion can
    # leave binary float noise (e.g. 130.1 vs 130.10000000000002). Normalize
    # to source precision (~0.1mm), never to the simplified display precision.
    # Packed edges keep the national pass small.
    owners = {}
    shared = defaultdict(set)
    for code, polygon in polygons:
        for ring in polygon:  # Include holes (enclaves) too.
            for a, b in zip(ring, ring[1:]):
                a, b = tuple(round(v,9) for v in a[:2]), tuple(round(v,9) for v in b[:2])
                if a == b:
                    continue
                a, b = sorted((a, b))
                edge = struct.pack('4d', *a, *b)
                other = owners.pop(edge, None)
                if other is None:
                    owners[edge] = code
                elif other != code:
                    shared[tuple(sorted((code, other)))].add((a, b))
    print(f"Shared original segments: {sum(map(len, shared.values()))}; prefecture pairs: {len(shared)}")
    lines = []
    for pair, edges in sorted(shared.items()):
        graph = defaultdict(set)
        for a, b in edges:
            graph[a].add(b)
            graph[b].add(a)
        def walk(start, next_point):
            chain = [start]
            while True:
                graph[start].remove(next_point)
                graph[next_point].remove(start)
                chain.append(next_point)
                start = next_point
                if len(graph[start]) != 1 or start == chain[0]:
                    return chain
                next_point = next(iter(graph[start]))
        chains = []
        for point in sorted(graph):
            if len(graph[point]) != 2:
                while graph[point]:
                    chains.append(walk(point, min(graph[point])))
        for point in sorted(graph):
            while graph[point]:
                chains.append(walk(point, min(graph[point])))
        for chain in chains:
            coordinates = [[round(x,4), round(y,4)] for x,y in simplify(chain, tolerance)]
            coordinates = [p for i,p in enumerate(coordinates) if not i or p != coordinates[i-1]]
            if len(coordinates) >= 2:
                lines.append(dict(type="Feature", properties={"p":list(pair)},
                                  geometry=dict(type="LineString", coordinates=coordinates)))
    return lines


def generate(source):
    found = {}
    with zipfile.ZipFile(source) as archive:
        with archive.open("N03-20260101.geojson") as stream:
            for line in stream:
                if not line.lstrip().startswith(b'{ "type": "Feature",'):
                    continue
                feature = json.loads(line.rstrip().rstrip(b","))
                props = feature["properties"]
                code = props["N03_007"][:2]
                entry = found.setdefault(code, [props["N03_001"],[]])
                geometry = feature["geometry"]
                polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
                for polygon in polygons:
                    ring = polygon[0]
                    bounds = [[min(p[0] for p in ring),min(p[1] for p in ring)],
                              [max(p[0] for p in ring),max(p[1] for p in ring)]]
                    if include_polygon(code,bounds):
                        entry[1].append(bounds)
    prefs = []
    for code,(name,parts) in sorted(found.items()):
        bounds = merge_bounds(parts)
        area = area_for_code(code)
        badge = PREF_BADGES.get(code, ([(bounds[0][i]+bounds[1][i])/2 for i in range(2)],"中心"))[0]
        prefs.append(dict(code=code,name=name,area=area,bounds=bounds,badge=badge))
    if len(prefs) != 47:
        raise ValueError("Expected 47 prefectures")
    areas = []
    for id,name,_,_ in GROUPS:
        members = [p for p in prefs if p["area"] == id]
        areas.append(dict(id=id,name=name,prefs=[p["name"] for p in members],
                          bounds=merge_bounds([p["bounds"] for p in members]),badge=AREA_BADGES[id][0]))
    return prefs,areas

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source")
    parser.add_argument("output")
    parser.add_argument("--borders", help="Shared prefecture borders GeoJSON output")
    parser.add_argument("--tolerance", type=float, default=750, help="Douglas-Peucker tolerance in metres")
    args = parser.parse_args()
    prefs,areas = generate(args.source)
    with open(args.source,"rb") as f:
        digest = hashlib.file_digest(f,"sha256").hexdigest()
    Path(args.output).write_text(
        "// Generated by tools/map/generate.py; do not edit.\n"
        "// N03-20260101 (JGD2011), source ZIP SHA256: "+digest+"\n"
        "// Exclusion windows and badge overrides: tools/map/generate.py\n"
        "export type Bounds = [[number, number], [number, number]];\n"
        "export type Prefecture = { code: string; name: string; area: string; bounds: Bounds; badge: [number, number] };\n"
        "export type Area = { id: string; name: string; prefs: string[]; bounds: Bounds; badge: [number, number] };\n"
        "export const prefectures: Prefecture[] = "+json.dumps(prefs,ensure_ascii=False)+";\n"
        "export const areas: Area[] = "+json.dumps(areas,ensure_ascii=False)+";\n")

    if args.borders:
        if args.tolerance <= 0:
            parser.error("tolerance must be positive")
        lines = shared_border_lines(source_polygons(args.source), args.tolerance)
        content = json.dumps(dict(type="FeatureCollection", features=lines), separators=(",",":")) + "\n"
        compressed = gzip.compress(content.encode(), mtime=0)
        if len(compressed) > 30*1024:
            raise ValueError(f"Borders gzip exceeds 30 KiB: {len(compressed)}")
        Path(args.borders).write_text(content)
        print(f"Borders: {len(lines)} lines, {len(content.encode())} bytes, gzip {len(compressed)} bytes, tolerance {args.tolerance} m; ZIP SHA256 {digest}")
