#!/usr/bin/env python3
"""Distance from each reef to the nearest coastline (Natural Earth 10m), in nautical miles, written as 'nm' into reefs.json.
Usage: python3 scripts/shore_distance.py path/to/ne_10m_coastline.shp. Pure Python shapefile reader (polyline records)."""
import json, math, struct, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
shp = sys.argv[1]
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
def dist_pt_seg(px, py, x1, y1, x2, y2, k):  # local flat approximation, k = cos(lat)
    ax, ay = (x1 - px) * k, y1 - py; bx, by = (x2 - px) * k, y2 - py
    dx, dy = bx - ax, by - ay; L = dx * dx + dy * dy
    t = 0 if L == 0 else max(0, min(1, -(ax * dx + ay * dy) / L))
    ex, ey = ax + t * dx, ay + t * dy; return math.hypot(ex, ey)
reefs = json.load(open(os.path.join(ROOT, 'reefs.json'))); n = 0
for r in reefs:
    k = math.cos(math.radians(r['lat'])); best = 9e9
    for ring in range(0, 6):  # widen the search until something is found
        cand = []
        for cx in range(math.floor(r['lon'] * 2) - ring, math.floor(r['lon'] * 2) + ring + 1):
            for cy in range(math.floor(r['lat'] * 2) - ring, math.floor(r['lat'] * 2) + ring + 1):
                if ring == 0 or abs(cx - math.floor(r['lon'] * 2)) == ring or abs(cy - math.floor(r['lat'] * 2)) == ring: cand += B.get((cx, cy), [])
        for s in cand: best = min(best, dist_pt_seg(r['lon'], r['lat'], *s, k))
        if best < 9e9 and best < (ring + 0.5) * 0.5: break
    if best < 9e9: r['nm'] = round(best * 60, 1); n += 1  # degrees → nautical miles
    else: r.pop('nm', None)
json.dump(reefs, open(os.path.join(ROOT, 'reefs.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('done', n, 'reefs with distance', file=sys.stderr)
