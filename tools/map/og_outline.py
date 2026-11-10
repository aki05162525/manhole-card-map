"""Generate the land shape drawn on the share image from the N03 GeoJSON zip.
Usage: python3 tools/map/og_outline.py INPUT.zip web/scripts/og-outline.json

Illustration only. Outer rings of the municipalities around the four main
islands are snapped to a coarse grid; an edge that two rings share is inland,
so the edges that occur an odd number of times are the coast. They are joined into closed loops
and the small islands are dropped.
"""
import json
import sys

from generate import source_polygons

WINDOW = (128.5, 30.2, 146.3, 45.8)
GRID = 0.02
MIN_SPAN = 0.12


def ring(points):
    snapped = []
    for x, y in points:
        point = (round(x / GRID), round(y / GRID))
        if not snapped or snapped[-1] != point:
            snapped.append(point)
    if len(snapped) > 1 and snapped[0] == snapped[-1]:
        snapped.pop()
    return snapped


def loops(edges):
    neighbours = {}
    for a, b in edges:
        neighbours.setdefault(a, []).append(b)
        neighbours.setdefault(b, []).append(a)
    found = []
    while neighbours:
        start = next(iter(neighbours))
        loop = [start]
        while True:
            here = loop[-1]
            ahead = neighbours.get(here)
            if not ahead:
                break
            there = ahead.pop()
            if not ahead:
                del neighbours[here]
            neighbours[there].remove(here)
            if not neighbours[there]:
                del neighbours[there]
            if there == start:
                break
            loop.append(there)
        found.append(loop)
    return found


def main(source, output):
    west, south, east, north = WINDOW
    counts = {}
    for _, polygon in source_polygons(source):
        outer = polygon[0]
        xs = [p[0] for p in outer]
        ys = [p[1] for p in outer]
        if not (west <= (min(xs) + max(xs)) / 2 <= east and south <= (min(ys) + max(ys)) / 2 <= north):
            continue
        snapped = ring(outer)
        if len(snapped) < 3:
            continue
        for a, b in zip(snapped, snapped[1:] + snapped[:1]):
            edge = (a, b) if a < b else (b, a)
            counts[edge] = counts.get(edge, 0) + 1
    # Odd, not once: a sliver that collapses on the grid runs an edge twice.
    coast = sorted(edge for edge, count in counts.items() if count % 2)
    span = MIN_SPAN / GRID
    rings = [
        loop
        for loop in loops(coast)
        if max(p[0] for p in loop) - min(p[0] for p in loop) >= span
        or max(p[1] for p in loop) - min(p[1] for p in loop) >= span
    ]
    rings.sort(key=len, reverse=True)
    data = {
        "source": "国土交通省「国土数値情報（行政区域データ）」N03-20260101 を加工して作成",
        "grid": GRID,
        "rings": [[value for point in loop for value in point] for loop in rings],
    }
    with open(output, "w", encoding="utf-8") as stream:
        json.dump(data, stream, ensure_ascii=False, separators=(",", ":"))
        stream.write("\n")


if __name__ == "__main__":
    main(*sys.argv[1:])
