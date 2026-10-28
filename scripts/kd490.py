#!/usr/bin/env python3
"""Satellite water clarity for every reef: Kd490 (diffuse attenuation at 490 nm) from NOAA CoastWatch ERDDAP.
Products: NOAA-21 and NOAA-20 VIIRS 750 m US sector (NRT), fallback S-NPP/NOAA-20 global 4 km. For each reef keep the
most recent cloud-free value within the last 10 days. Usage: python3 scripts/kd490.py kd.json [--seed] (seed = last 7 days)."""
import json, math, os, sys, time, urllib.request, urllib.parse
from datetime import datetime, timezone, timedelta
ERD = 'https://coastwatch.noaa.gov/erddap/griddap/'
P750 = ['noaacwN21VIIRSkd490NSWUSDaily', 'noaacwN20VIIRSkd490NSWUSDaily']
P4K = 'noaacwNPPVIIRSkd490Daily'
SECTOR = (-142.38, -52.39, 0.0, 60.0)  # lon min, lon max, lat min, lat max of the 750 m US sector
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1] if len(sys.argv) > 1 else 'kd.json'; seed = '--seed' in sys.argv
NDAYS = 7 if seed else 3; KEEP = 10

def get(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'ReefGo kd490 (github.com/alexp-automation/reefgo)'})
            with urllib.request.urlopen(req, timeout=120) as r: return json.loads(r.read().decode())
        except Exception as e:
            err = e; time.sleep(3 * (i + 1))
    print('fail', url[:120], err, file=sys.stderr); return None

reefs = json.load(open(os.path.join(ROOT, 'reefs.json')))
old = {}
if os.path.exists(out):
    try: old = json.load(open(out)).get('v', {})
    except Exception: old = {}
today = datetime.now(timezone.utc).date()
cutoff = (today - timedelta(days=KEEP)).isoformat()
v = {k: x for k, x in old.items() if x[1] >= cutoff}

# group reefs into 1° boxes; pad each box by one pixel-neighbourhood
boxes = {}
for r in reefs:
    k = (math.floor(r['lat']), math.floor(r['lon'])); boxes.setdefault(k, []).append(r)
print(len(boxes), 'boxes', file=sys.stderr)

def sample(rows, lat, lon, res):
    """nearest valid pixel; else median of valid pixels within one grid step; rows = list of (lat, lon, kd)"""
    best = None; bd = 9e9; near = []
    for la, lo, kd in rows:
        d = (la - lat) ** 2 + ((lo - lon) * math.cos(math.radians(lat))) ** 2
        if d < bd: bd, best = d, kd
        if abs(la - lat) <= res * 1.6 and abs(lo - lon) <= res * 1.6: near.append(kd)
    if bd > (res * 1.6) ** 2: return None
    if best is not None: return best
    near = sorted(x for x in near if x is not None)
    return near[len(near) // 2] if near else None

def fetch_box(ds, la, lo, stride):
    q = f"kd_490[last-{NDAYS - 1}:1:last][(0.0)][({la - 0.02}):{stride}:({la + 1.02})][({lo - 0.02}):{stride}:({lo + 1.02})]"
    j = get(ERD + ds + '.json?' + urllib.parse.quote(q, safe='()[]:,-.'))
    if not j: return {}
    days = {}
    for t, _, plat, plon, kd in j['table']['rows']:
        days.setdefault(t[:10], []).append((plat, plon, kd if kd is None or kd > 0 else None))
    return days

n = 0
for (la, lo), rs in sorted(boxes.items()):
    in750 = SECTOR[0] < lo + 0.5 < SECTOR[1] and SECTOR[2] < la + 0.5 < SECTOR[3]
    plan = [(p, 2, 0.015, p[6:9]) for p in P750] if in750 else []
    plan.append((P4K, 1, 0.042, 'NPP'))
    for ds, stride, res, tag in plan:
        days = fetch_box(ds, la, lo, stride); n += 1
        for day in sorted(days):
            rows = days[day]
            for r in rs:
                cur = v.get(r['id'])
                if cur and cur[1] >= day: continue  # already have a value from this day or newer
                if cur and tag == 'NPP' and cur[2] != 'NPP' and cur[1] >= (datetime.fromisoformat(day) - timedelta(days=2)).date().isoformat(): continue  # keep 750 m if at most 2 days older than the 4 km pass
                kd = sample(rows, r['lat'], r['lon'], res)
                if kd is not None: v[r['id']] = [round(kd, 3), day, tag]
        time.sleep(0.3)
    if n % 20 == 0: print(n, 'requests', len(v), 'reefs with data', file=sys.stderr)

json.dump({'t': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%MZ'), 'n': len(v), 'v': v}, open(out, 'w'), separators=(',', ':'))
print('done', len(v), 'of', len(reefs), 'reefs have a value', file=sys.stderr)
