#!/usr/bin/env python3
"""Merge official state ramp inventories into ramps.json.
Usage: python3 scripts/ramps_official.py ramps-HI.json ramps-CA.json ...
Official records go first; existing OSM records of the same state within 150 m of an official ramp are dropped as duplicates,
other OSM records stay. Field names are normalised to the FWC convention: trl (trailer parking), wc (restroom), wb (water body).
Then run scripts/shore_distance.py <coastline.shp> ramps.json --max 5 to refresh nm/sb and drop inland points."""
import json, math, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, 'ramps.json'); ramps = json.load(open(P))
MAP = {'park': 'trl', 'toilet': 'wc', 'water': 'wb'}
def norm(r):
    o = {}
    for k, v in r.items():
        k = MAP.get(k, k)
        if v is None or v == '': continue
        if k in ('fee', 'wc', 'salt'): v = 1 if v in (True, 1, '1', 'true', 'yes', 'Yes') else 0
        if k in ('lanes', 'trl'):
            try: v = int(float(v))
            except Exception: continue
        o[k] = v
    o['lat'] = round(float(o['lat']), 5); o['lon'] = round(float(o['lon']), 5); return o
def near(a, b, m=150):
    k = math.cos(math.radians(a['lat'])); return math.hypot((a['lon'] - b['lon']) * k, a['lat'] - b['lat']) * 111200 < m
for path in sys.argv[1:]:
    new = [norm(r) for r in json.load(open(path)) if r.get('lat') is not None and r.get('name')]
    sts = {r['st'] for r in new}; ids = {r['id'] for r in ramps}
    before = len(ramps)
    keep = [r for r in ramps if not (r.get('src') == 'OSM' and r['st'] in sts and any(near(r, n) for n in new))]
    added = [n for n in new if n['id'] not in ids]
    ramps = keep + added
    print(os.path.basename(path), 'official', len(new), 'OSM duplicates dropped', before - len(keep), 'added', len(added), file=sys.stderr)
json.dump(ramps, open(P, 'w'), ensure_ascii=False, separators=(',', ':'))
from collections import Counter; print(len(ramps), dict(Counter(r['st'] for r in ramps)), file=sys.stderr)
