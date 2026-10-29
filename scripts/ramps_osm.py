#!/usr/bin/env python3
"""Boat ramps from OpenStreetMap (leisure=slipway) → ramps.json, merged with official state inventories when present.
Usage: python3 scripts/ramps_osm.py [--skip FL,TX] [--merge fwc_ramps.json] overpass1.json [overpass2.json ...]
Then: python3 scripts/shore_distance.py ne_10m_coastline.shp ramps.json --max 5   (keeps the coastal ramps only)
Drops private ramps and canoe/kayak-only launches; unnamed ramps are kept as "Boat ramp"; lanes of one ramp (within 150 m) collapse into one point.
State comes from addr:state or the nearest reef in reefs.json. --skip drops OSM ramps in states covered by an official inventory given with --merge."""
import json, math, os, sys, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
reefs = json.load(open(os.path.join(ROOT, 'reefs.json')))
args = sys.argv[1:]; skip = set(); merge = []
while args and args[0].startswith('--'):
    k = args.pop(0)
    if k == '--skip': skip = set(args.pop(0).split(','))
    elif k == '--merge': merge.append(args.pop(0))
ST = {'florida': 'FL', 'alabama': 'AL', 'mississippi': 'MS', 'louisiana': 'LA', 'texas': 'TX', 'georgia': 'GA', 'south carolina': 'SC', 'north carolina': 'NC', 'virginia': 'VA', 'maryland': 'MD', 'delaware': 'DE', 'new jersey': 'NJ', 'new york': 'NY', 'connecticut': 'CT', 'rhode island': 'RI', 'massachusetts': 'MA', 'new hampshire': 'NH', 'maine': 'ME', 'california': 'CA', 'oregon': 'OR', 'washington': 'WA', 'hawaii': 'HI'}
def state_of(lat, lon, tags):
    s = (tags.get('addr:state') or '').strip(); s = ST.get(s.lower(), s.upper() if len(s) == 2 else None)
    if s: return s
    k = math.cos(math.radians(lat)); best, bd = None, 9e9
    for r in reefs:
        d = (r['lat'] - lat) ** 2 + ((r['lon'] - lon) * k) ** 2
        if d < bd: bd, best = d, r['st']
    return best if math.sqrt(bd) * 60 < 120 else None
out = []
for path in merge: out += json.load(open(path))
def near_existing(lat, lon, m=150):
    k = math.cos(math.radians(lat))
    for r in out:
        if abs(r['lat'] - lat) < 0.003 and math.hypot((r['lon'] - lon) * k, r['lat'] - lat) * 111200 < m: return r
    return None
PADDLE = re.compile(r'canoe|kayak|paddle|sup\b', re.I)
for path in args:
    for e in json.load(open(path)).get('elements', []):
        tags = e.get('tags', {}); lat = e.get('lat') or e.get('center', {}).get('lat'); lon = e.get('lon') or e.get('center', {}).get('lon')
        if lat is None: continue
        name = (tags.get('name') or '').strip()
        if not name and '--unnamed' not in sys.argv: continue  # unnamed slipways are mostly backyard and canal-lot ramps: a name is the best public-ramp signal OSM has
        if tags.get('access') in ('private', 'no', 'customers', 'members', 'permit'): continue
        if re.search(r'\bprivate\b', name, re.I) or PADDLE.search(name) or tags.get('canoe') == 'designated' and tags.get('motorboat') == 'no': continue
        st = state_of(lat, lon, tags)
        if not st or st in skip: continue
        hit = near_existing(lat, lon)
        if hit:
            if name and hit['name'] == 'Boat ramp': hit['name'] = name
            continue
        r = {'id': 'R' + str(e['id']), 'name': name or 'Boat ramp', 'lat': round(lat, 5), 'lon': round(lon, 5), 'st': st, 'src': 'OSM'}
        if tags.get('fee') == 'yes': r['fee'] = 1
        if tags.get('operator'): r['op'] = tags['operator'][:60]
        out.append(r)
out.sort(key=lambda r: (r['st'], r['name']))
json.dump(out, open(os.path.join(ROOT, 'ramps.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'ramps', file=sys.stderr)
