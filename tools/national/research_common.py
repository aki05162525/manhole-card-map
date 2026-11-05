"""Reusable acquisition and geometry checks, deliberately separate from adoption.

Only decode_tile requires mapbox-vector-tile (2.2.0 in existing research).
Coordinates use XYZ Web Mercator tile arithmetic with y down. This arithmetic
is not evidence that a particular product's datum or licence permits adoption.
Raw evidence and original retrieval metadata are immutable on cache reuse.
"""
from datetime import datetime, timezone
import gzip
import hashlib
from html import escape
import json
import math
from pathlib import Path
import re
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from uuid import uuid4


def _now():
    return datetime.now(timezone.utc).isoformat()


def _digest(raw):
    return hashlib.sha256(raw).hexdigest()


def _write_json(path, value):
    # New cache metadata is published only after its immutable raw object exists.
    temporary = path.with_suffix('.tmp-' + uuid4().hex)
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)


def read_verified(path, sha256):
    raw = Path(path).read_bytes()
    if _digest(raw) != sha256:
        raise ValueError(f'hash mismatch: {path}')
    return raw


def _store_raw(directory, raw):
    digest = _digest(raw)
    path = directory / (digest + '.raw')
    if path.exists():
        read_verified(path, digest)
    else:
        with path.open('xb') as destination:
            destination.write(raw)
    return digest, str(path.resolve())


def fetch_cached(url, cache_dir, version, headers=None, timeout=30):
    """Return (bytes, provenance), or (None, failed attempt); never overwrite raw.

    version is the caller's source edition/cache namespace, not a guessed datum.
    Range requests require an exact Content-Range. A failed new request leaves
    every prior version available. Cache corruption raises instead of silently
    replacing evidence. The returned record can be kept in the research ledger.
    """
    if not version or not url.startswith(('https://', 'http://')):
        raise ValueError('HTTP URL and explicit source/cache version required')
    directory = Path(cache_dir)
    directory.mkdir(parents=True, exist_ok=True)
    headers = {k.lower(): v for k, v in (headers or {}).items()}
    request = {'url': url, 'version': version, 'requestHeaders': headers}
    key = _digest(json.dumps(request, sort_keys=True).encode())
    metadata = directory / (key + '.json')
    if metadata.exists():
        saved = json.loads(metadata.read_text())
        if any(saved.get(k) != v for k, v in request.items()):
            raise ValueError('cache provenance mismatch')
        raw = read_verified(saved['rawPath'], saved['sha256'])
        return raw, {**saved, 'status': 'cached', 'reusedAt': _now()}
    record = {'schema': 1, **request, 'attemptedAt': _now()}
    raw = None
    try:
        with urlopen(Request(url, headers=headers), timeout=timeout) as response:
            raw = response.read()
            record['httpStatus'] = response.status
            if not 200 <= response.status < 300:
                raise ValueError(f'HTTP status {response.status}')
            if 'range' in headers:
                requested = re.fullmatch(r'bytes=(\d+)-(\d+)', headers['range'])
                actual = re.fullmatch(r'bytes (\d+)-(\d+)/(\d+|\*)', response.headers.get('Content-Range', ''))
                if (not requested or not actual or response.status != 206 or
                        requested.groups() != actual.groups()[:2] or
                        len(raw) != int(requested[2]) - int(requested[1]) + 1):
                    raise ValueError('range response does not match requested bytes')
            elif response.status == 206:
                raise ValueError('unexpected partial range response')
            record.update({'etag': response.headers.get('ETag'),
                           'lastModified': response.headers.get('Last-Modified'),
                           'contentType': response.headers.get('Content-Type'),
                           'contentRange': response.headers.get('Content-Range'),
                           'responseURL': response.geturl() if hasattr(response, 'geturl') else url})
    except (OSError, ValueError) as error:
        if isinstance(error, HTTPError):
            raw = error.read()
            record.update(httpStatus=error.code, responseHeaders=dict(error.headers or {}), responseURL=error.geturl())
            error.close()
        if raw is not None:
            digest, path = _store_raw(directory, raw)
            record.update({'responseSHA256': digest, 'responseRawPath': path, 'responseBytes': len(raw)})
        record.update({'status': 'failed', 'error': f'{type(error).__name__}: {error}', 'finishedAt': _now()})
        _write_json(directory / ('attempt-' + uuid4().hex + '.json'), record)
        return None, record
    digest, raw_path = _store_raw(directory, raw)
    record.update({'status': 'acquired', 'fetchedAt': _now(), 'sha256': digest,
                   'rawPath': raw_path, 'bytes': len(raw)})
    _write_json(metadata, record)
    return raw, record


def adjacent_tiles(tile, radius=1):
    _validate_tile(tile)
    if not isinstance(radius, int) or radius < 0:
        raise ValueError('nonnegative integer radius required')
    n = 2 ** tile['z']
    return [{'z': tile['z'], 'x': x, 'y': y}
            for y in range(max(0, tile['y'] - radius), min(n, tile['y'] + radius + 1))
            for x in range(max(0, tile['x'] - radius), min(n, tile['x'] + radius + 1))]


def _validate_tile(tile):
    if (any(type(tile.get(k)) is not int for k in ('z', 'x', 'y')) or
            not 0 <= tile['z'] <= 30 or
            not all(0 <= tile[k] < 2 ** tile['z'] for k in ('x', 'y'))):
        raise ValueError('invalid XYZ tile')


def decode_tile(raw):
    """Decode all layers with north at the top; caller retains raw hash metadata."""
    from mapbox_vector_tile import decode
    if raw.startswith(b'\x1f\x8b'):
        raw = gzip.decompress(raw)
    return decode(raw, default_options={'y_coord_down': True})


def _points(coordinates):
    if coordinates and isinstance(coordinates[0], (int, float)):
        yield coordinates
    else:
        for part in coordinates:
            yield from _points(part)


def _translate(coordinates, dx, dy):
    if coordinates and isinstance(coordinates[0], (int, float)):
        return [coordinates[0] + dx, coordinates[1] + dy]
    return [_translate(part, dx, dy) for part in coordinates]


def combine_tiles(tiles):
    """Place every feature in one tile frame, retaining fragments and provenance.

    This does not dissolve tile fragments or identify which fragments are one
    building. tileBoundaryTouched indicates a possible clip at the source tile;
    outerBoundaryTouched marks an exposed edge of the acquired tile set,
    including a missing neighbour in a nonrectangular set.
    """
    if not tiles:
        raise ValueError('at least one tile required')
    for entry in tiles:
        _validate_tile(entry['tile'])
    z = tiles[0]['tile']['z']
    extent = tiles[0]['extent']
    if not isinstance(extent, (int, float)) or not math.isfinite(extent) or extent <= 0:
        raise ValueError('positive extent required')
    keys = [(t['tile']['x'], t['tile']['y']) for t in tiles]
    if len(set(keys)) != len(keys):
        raise ValueError('duplicate tile')
    if any(t['tile']['z'] != z or t['extent'] != extent for t in tiles):
        raise ValueError('mixed zoom or extent')
    base = {'z': z, 'x': min(x for x, y in keys), 'y': min(y for x, y in keys)}
    combined = []
    for entry in tiles:
        tile = entry['tile']
        x, y = tile['x'], tile['y']
        for index, feature in enumerate(entry['features']):
            geometry = feature['geometry']
            if geometry['type'] not in ('Polygon', 'MultiPolygon', 'LineString', 'MultiLineString'):
                raise ValueError('unsupported geometry: ' + geometry['type'])
            points = list(_points(geometry['coordinates']))
            if not points or any(len(p) != 2 or not all(math.isfinite(v) for v in p) for p in points):
                raise ValueError('finite 2D coordinates required')
            edges = {'west': min(p[0] for p in points) <= 0,
                     'east': max(p[0] for p in points) >= extent,
                     'north': min(p[1] for p in points) <= 0,
                     'south': max(p[1] for p in points) >= extent}
            neighbours = {'west': (x-1, y), 'east': (x+1, y), 'north': (x, y-1), 'south': (x, y+1)}
            combined.append({**feature, 'geometry': {'type': geometry['type'],
                'coordinates': _translate(geometry['coordinates'], (x-base['x'])*extent, (y-base['y'])*extent)},
                'sourceTile': dict(tile), 'sourceFeatureIndex': index,
                'tileBoundaryTouched': any(edges.values()),
                'outerBoundaryTouched': any(touched and neighbours[edge] not in keys for edge, touched in edges.items())})
    return {'schema': 1, 'baseTile': base, 'extent': extent, 'tiles': [dict(t['tile']) for t in tiles],
            'bounds': [0, 0, (max(x for x, y in keys)-base['x']+1)*extent,
                       (max(y for x, y in keys)-base['y']+1)*extent],
            'features': combined, 'identityApproved': False}


def render_svg(combined):
    """Draw every acquired polygon, hole and road; no centroid/area filtering."""
    left, top, right, bottom = combined['bounds']
    # Vector tile buffers may include geometry beyond the nominal tile extent.
    # Keep that geometry visible and report acquisition clipping separately.
    points = [p for f in combined['features'] for p in _points(f['geometry']['coordinates'])]
    if points:
        left, right = min(left, min(p[0] for p in points)), max(right, max(p[0] for p in points))
        top, bottom = min(top, min(p[1] for p in points)), max(bottom, max(p[1] for p in points))
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{left} {top} {right-left} {bottom-top}">',
             '<title>N up; all acquired features; building identity unverified</title>']
    for feature in combined['features']:
        geometry = feature['geometry']
        kind = geometry['type']
        coords = geometry['coordinates']
        rings = ([ring for poly in coords for ring in poly] if kind == 'MultiPolygon'
                 else coords if kind in ('Polygon', 'MultiLineString') else [coords])
        closed = kind in ('Polygon', 'MultiPolygon')
        paths = ['M ' + ' L '.join(f'{x:g},{y:g}' for x, y in ring) + (' Z' if closed else '') for ring in rings if ring]
        color = '#c03' if feature['outerBoundaryTouched'] else '#333'
        label = escape(str(feature.get('id', feature['sourceFeatureIndex'])))
        parts.append(f'<path d="{" ".join(paths)}" fill="{"#dbe7ed" if closed else "none"}" fill-rule="evenodd" stroke="{color}" stroke-width="1" vector-effect="non-scaling-stroke"><title>{label}</title></path>')
    parts.append('</svg>')
    return '\n'.join(parts) + '\n'


def _ring_contains(ring, point):
    x, y = point
    inside = False
    for a, b in zip(ring, ring[1:] + ring[:1]):
        cross = (x-a[0])*(b[1]-a[1]) - (y-a[1])*(b[0]-a[0])
        if cross == 0 and min(a[0], b[0]) <= x <= max(a[0], b[0]) and min(a[1], b[1]) <= y <= max(a[1], b[1]):
            return None  # boundary excluded
        if (a[1] > y) != (b[1] > y) and x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:
            inside = not inside
    return inside


def contains_point(geometry, point):
    """Strict inclusion for valid Polygon/MultiPolygon; boundaries excluded.

    This is an arithmetic check, not a topology validator. Self-intersecting or
    otherwise invalid polygons must be rejected by the source/geometry review.
    """
    kind = geometry['type']
    if kind not in ('Polygon', 'MultiPolygon'):
        raise ValueError('polygon required')
    if len(point) != 2 or not all(math.isfinite(v) for v in point):
        raise ValueError('finite point required')
    polygons = [geometry['coordinates']] if kind == 'Polygon' else geometry['coordinates']
    return any(rings and _ring_contains(rings[0], point) is True and
               all(_ring_contains(ring, point) is False for ring in rings[1:]) for rings in polygons)


def rounded_coordinate(geometry, tile, point_xy, extent=4096, digits=7):
    _validate_tile(tile)
    if not isinstance(extent, (int, float)) or not math.isfinite(extent) or extent <= 0:
        raise ValueError('positive extent required')
    if type(digits) is not int or not 0 <= digits <= 15:
        raise ValueError('digits must be in 0..15')
    inside = contains_point(geometry, point_xy)
    x, y = point_xy
    n = 2 ** tile['z']
    lng = (tile['x'] + x/extent)/n*360-180
    lat = math.degrees(math.atan(math.sinh(math.pi*(1-2*(tile['y']+y/extent)/n))))
    coordinate = {'lat': round(lat, digits), 'lng': round(lng, digits)}
    px = ((coordinate['lng']+180)/360*n-tile['x'])*extent
    py = ((1-math.asinh(math.tan(math.radians(coordinate['lat'])))/math.pi)/2*n-tile['y'])*extent
    rounded_inside = contains_point(geometry, (px, py))
    return {'coordinate': coordinate, 'unroundedWithin': inside, 'roundedWithin': rounded_inside,
            'roundedTileXY': [px, py], 'mechanicalChecksPassed': inside and rounded_inside,
            'identityApproved': False, 'crsApproved': False}


def new_observation(facility_id, planned_methods):
    """An empty plan records no successful acquisition, interpretation or review."""
    return {'schema': 1, 'facilityId': facility_id, 'plannedMethods': list(planned_methods),
            'performedMethods': [], 'acquisition': {'status': 'not_attempted', 'records': []},
            'pages': {'total': None, 'checked': []}, 'orientation': {'status': 'not_checked', 'evidence': []},
            'coverage': {'tiles': [], 'boundaryClipping': 'not_checked', 'renderPath': None},
            'buildingIdentity': {'status': 'not_checked', 'evidence': []},
            'surroundings': {'status': 'not_checked', 'evidence': []},
            'crs': {'status': 'not_checked', 'product': None, 'evidence': []},
            'licence': {'status': 'not_checked', 'evidence': []},
            'mechanicalChecks': {'status': 'not_run', 'evidence': []},
            'review': {'status': 'pending', 'reviewer': None, 'evidence': []}}


def validate_observation(row):
    if row.get('schema') != 1 or not row.get('facilityId'):
        raise ValueError('schema and facilityId required')
    for key in ('plannedMethods', 'performedMethods'):
        if not isinstance(row.get(key), list) or any(not isinstance(x, str) or not x for x in row[key]):
            raise ValueError(key + ' must contain method names')
    if row['acquisition']['status'] not in ('not_attempted', 'acquired', 'cached', 'failed', 'mixed'):
        raise ValueError('invalid acquisition status')
    pages = row['pages']
    total, checked = pages['total'], pages['checked']
    if (total is not None and (type(total) is not int or total < 1) or
            not isinstance(checked, list) or any(type(p) is not int or p < 1 or total is None or p > total for p in checked) or
            len(set(checked)) != len(checked)):
        raise ValueError('invalid page coverage')
    for field in ('orientation', 'buildingIdentity', 'surroundings', 'crs', 'licence'):
        item = row[field]
        if item['status'] not in ('not_checked', 'insufficient', 'confirmed', 'failed'):
            raise ValueError('invalid ' + field + ' status')
        if item['status'] != 'not_checked' and not item.get('evidence'):
            raise ValueError(field + ' requires evidence')
    mechanical = row['mechanicalChecks']
    if mechanical['status'] not in ('not_run', 'passed', 'failed') or mechanical['status'] != 'not_run' and not mechanical.get('evidence'):
        raise ValueError('invalid mechanical checks')
    review = row['review']
    if review['status'] not in ('pending', 'approved', 'held', 'unavailable'):
        raise ValueError('invalid review status')
    if review['status'] in ('approved', 'held') and (not review.get('reviewer') or not review.get('evidence')):
        raise ValueError('completed review requires reviewer and evidence')
    if review['status'] == 'approved' and (any(row[key]['status'] != 'confirmed' for key in ('buildingIdentity', 'crs', 'licence')) or mechanical['status'] != 'passed'):
        raise ValueError('review approval requires identity, product CRS, licence and mechanical checks')
