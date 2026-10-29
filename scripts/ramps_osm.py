#!/usr/bin/env python3
"""Boat ramps from OpenStreetMap (leisure=slipway) → ramps.json.
Usage: python3 scripts/ramps_osm.py overpass1.json [overpass2.json ...]
Then: python3 scripts/shore_distance.py ne_10m_coastline.shp ramps.json --max 3   (keeps the coastal ramps only)
Keeps named ramps; drops private ones. State comes from addr:state or the nearest reef in reefs.json."""
import json, math, os, sys, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
reefs = json.load(open(os.path.join(ROOT, 'reefs.json')))
ST = {'florida': 'FL', 'alabama': 'AL', 'mississippi': 'MS', 'louisiana': 'LA', 'texas': 'TX', 'georgia': 'GA', 'south carolina': 'SC', 'north carolina': 'NC', 'virginia': 'VA', 'maryland': 'MD', 'delaware': 'DE', 'new jersey': 'NJ', 'new york': 'NY', 'connecticut': 'CT', 'rhode island': 'RI', 'massachusetts': 'MA', 'new hampshire': 'NH', 'maine': 'ME', 'california': 'CA', 'oregon': 'OR', 'washington': 'WA', 'hawaii': 'HI'}
def state_of(lat, lon, tags):
    s = (tags.get('addr:state') or '').strip(); s = ST.get(s.lower(), s.upper() if len(s) == 2 else None)
    if s: return s
    k = math.cos(math.radians(lat)); best, bd = None, 9e9
    for r in reefs:
        d = (r['lat'] - lat) ** 2 + ((r['lon'] - lon) * k) ** 2
        if d < bd: bd, best = d, r['st']
    return best if math.sqrt(bd) * 60 < 120 else None
seen = set(); out = []
for path in sys.argv[1:]:
    for e in json.load(open(path)).get('elements', []):
        tags = e.get('tags', {}); lat = e.get('lat') or e.get('center', {}).get('lat'); lon = e.get('lon') or e.get('center', {}).get('lon')
        if lat is None: continue
        name = (tags.get('name') or '').strip()
        if not name: continue
        if tags.get('access') in ('private', 'no', 'customers', 'members', 'permit'): continue
        if re.search(r'\bprivate\b', name, re.I): continue
        key = (round(lat, 4), round(lon, 4))
        if key in seen: continue
        seen.add(key)
        st = state_of(lat, lon, tags)
        if not st: continue
        r = {'id': 'R' + str(e['id']), 'name': name, 'lat': round(lat, 5), 'lon': round(lon, 5), 'st': st}
        if tags.get('fee') == 'yes': r['fee'] = 1
        if tags.get('operator'): r['op'] = tags['operator'][:60]
        out.append(r)
out.sort(key=lambda r: (r['st'], r['name']))
json.dump(out, open(os.path.join(ROOT, 'ramps.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'named public ramps', file=sys.stderr)
