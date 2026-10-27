#!/usr/bin/env python3
"""Fetch NDBC latest observations for all stations and write ndbc.json (US coastal stations only).
Runs on a GitHub Actions schedule; the app reads ndbc.json next to index.html."""
import json, sys, urllib.request, datetime

URL = 'https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt'
MS2KT, M2FT = 1.943844, 3.28084

def num(x):
    try: return float(x)
    except ValueError: return None

raw = urllib.request.urlopen(URL, timeout=60).read().decode('utf-8', 'replace').splitlines()
out = []
for line in raw:
    if line.startswith('#'): continue
    p = line.split()
    if len(p) < 21: continue
    stn, lat, lon = p[0], num(p[1]), num(p[2])
    if lat is None or lon is None or not (-180 < lon < -60 and 17 < lat < 62): continue
    y, mo, d, h, mi = map(int, p[3:8])
    t = datetime.datetime(y, mo, d, h, mi, tzinfo=datetime.timezone.utc).isoformat()
    wdir, wspd, gst, wvht, dpd, apd, mwd, pres, ptdy, atmp, wtmp = (num(x) for x in p[8:19])
    if wspd is None and wvht is None and wtmp is None: continue
    out.append({'id': stn, 'lat': lat, 'lon': lon, 't': t,
                'wdir': wdir, 'wspd': round(wspd * MS2KT, 1) if wspd is not None else None, 'gst': round(gst * MS2KT, 1) if gst is not None else None,
                'wvht': round(wvht * M2FT, 1) if wvht is not None else None, 'dpd': dpd, 'apd': apd, 'mwd': mwd,
                'atmp': atmp, 'wtmp': wtmp})
json.dump({'updated': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'stations': out},
          open(sys.argv[1] if len(sys.argv) > 1 else 'ndbc.json', 'w'), separators=(',', ':'))
print(len(out), 'stations')
