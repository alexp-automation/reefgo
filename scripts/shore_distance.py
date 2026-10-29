#!/usr/bin/env python3
"""Distance and bearing from each point to the nearest coastline (Natural Earth 10m).
Writes 'nm' (nautical miles) and 'sb' (bearing from the point to the nearest shore, degrees true) into the JSON list.
Usage: python3 scripts/shore_distance.py path/to/ne_10m_coastline.shp [points.json=reefs.json] [--max NM]
--max NM drops points farther than NM from the coast (used for boat ramps: keep the coastal ones only).
Pure Python shapefile reader (polyline records)."""
import json, math, struct, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
shp = args[0]; target = args[1] if len(args) > 1 else os.path.join(ROOT, 'reefs.json')
maxnm = float(sys.argv[sys.argv.index('--max') + 1]) if '--max' in sys.argv else None
# --- read polylines from the .shp ---
segs = []  # (x1, y1, x2, y2)
with open(shp, 'rb') as f:
    f.seek(100)
    while True:
        hdr = f.read(8)
        if len(hdr) < 8: break
        num, ln = struct.unpack('>ii', hdr); rec = f.read(ln * 2)
        typ = struct.unpack('<i', rec[:4])[0]
        if typ not in (3, 13, 23): continue
        nparts, npts = struct.unpack('<ii', rec[36:44]); parts = struct.unpack('<%di' % nparts, rec[44:44 + 4 * nparts])
        pts = struct.unpack('<%dd' % (2 * npts), rec[44 + 4 * nparts:44 + 4 * nparts + 16 * npts])
        xs, ys = pts[0::2], pts[1::2]
        for pi in range(nparts):
            a, b = parts[pi], parts[pi + 1] if pi + 1 < nparts else npts
            for i in range(a, b - 1):
                if -180 < xs[i] < -50 and 15 < ys[i] < 62: segs.append((xs[i], ys[i], xs[i + 1], ys[i + 1]))
print(len(segs), 'coast segments in the US box', file=sys.stderr)
# --- bucket segments by 0.5° cell ---
B = {}
for s in segs:
    for cx in {math.floor(s[0] * 2), math.floor(s[2] * 2)}:
        for cy in {math.floor(s[1] * 2), math.floor(s[3] * 2)}: B.setdefault((cx, cy), []).append(s)
def dist_pt_seg(px, py, x1, y1, x2, y2, k):  # local flat approximation, k = cos(lat); returns (distance in degrees, east offset, north offset)
    ax, ay = (x1 - px) * k, y1 - py; bx, by = (x2 - px) * k, y2 - py
    dx, dy = bx - ax, by - ay; L = dx * dx + dy * dy
    t = 0 if L == 0 else max(0, min(1, -(ax * dx + ay * dy) / L))
    ex, ey = ax + t * dx, ay + t * dy; return math.hypot(ex, ey), ex, ey
pts = json.load(open(target)); n = 0; out = []
for r in pts:
    k = math.cos(math.radians(r['lat'])); best = (9e9, 0, 0)
    for ring in range(0, 6):  # widen the search until something is found
        cand = []
        for cx in range(math.floor(r['lon'] * 2) - ring, math.floor(r['lon'] * 2) + ring + 1):
            for cy in range(math.floor(r['lat'] * 2) - ring, math.floor(r['lat'] * 2) + ring + 1):
                if ring == 0 or abs(cx - math.floor(r['lon'] * 2)) == ring or abs(cy - math.floor(r['lat'] * 2)) == ring: cand += B.get((cx, cy), [])
        for s in cand:
            d = dist_pt_seg(r['lon'], r['lat'], *s, k)
            if d[0] < best[0]: best = d
        if best[0] < 9e9 and best[0] < (ring + 0.5) * 0.5: break
    if best[0] < 9e9:
        r['nm'] = round(best[0] * 60, 1); n += 1  # degrees → nautical miles
        r['sb'] = round(math.degrees(math.atan2(best[1], best[2])) % 360)  # bearing to the nearest shore point
    else: r.pop('nm', None); r.pop('sb', None)
    if maxnm is None or ('nm' in r and r['nm'] <= maxnm): out.append(r)
json.dump(out, open(target, 'w'), ensure_ascii=False, separators=(',', ':'))
print('done', n, 'points with distance,', len(out), 'kept', file=sys.stderr)
