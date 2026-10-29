#!/usr/bin/env python3
"""FWC Florida Boat Ramp Inventory (gis.myfwc.com Open_Data, layer 4) → fwc_ramps.json for scripts/ramps_osm.py --merge.
Usage: python3 scripts/ramps_fwc.py page0.geojson [page1.geojson ...] out.json
Source query: .../FWC_Florida_Boat_Ramp_Inventory/MapServer/4/query?where=1%3D1&outFields=*&outSR=4326&f=geojson&resultRecordCount=2000&resultOffset=N
Keeps open, public, trailer ramps on salt or brackish water. salt=1 tells shore_distance.py to keep them regardless of distance to the open coast."""
import json, sys, re
out = []
for p in sys.argv[1:-1]:
    for f in json.load(open(p)).get('features', []):
        a = f['properties']; lon, lat = f['geometry']['coordinates'][:2]
        if a.get('WaterType') != 'Salt or Brackish Water': continue
        if a.get('RampType') not in ('Stand Alone Ramp', 'Boat Ramp Within Marina'): continue
        if a.get('Status') != 'Open for Business' or 'General Public Use' not in (a.get('AccessType') or ''): continue
        name = re.sub(r'\s+', ' ', (a.get('RampName') or '').strip());
        if not name: continue
        r = {'id': 'F' + (a.get('RampID') or str(a['OBJECTID'])), 'name': name, 'lat': round(lat, 5), 'lon': round(lon, 5), 'st': 'FL', 'src': 'FWC', 'salt': 1}
        if a.get('isFeeRequired') == 'Yes': r['fee'] = 1
        if a.get('TotalLanes'): r['lanes'] = int(a['TotalLanes'])
        if a.get('Trailer'): r['trl'] = int(a['Trailer'])
        if a.get('WaterBodyName'): r['wb'] = a['WaterBodyName'][:60]
        if a.get('Hours') and a['Hours'] not in ('Unknown',): r['hours'] = a['Hours'][:40]
        rt = a.get('RestroomType') or ''; r['wc'] = 0 if rt in ('No Toilet', 'No', 'None') else 1 if rt and rt != 'Unknown' else None
        if r['wc'] is None: del r['wc']
        if a.get('City'): r['city'] = a['City'].title()
        if a.get('PrimaryAdminEntity'): r['op'] = a['PrimaryAdminEntity'][:60]
        out.append(r)
json.dump(out, open(sys.argv[-1], 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'FWC saltwater trailer ramps', file=sys.stderr)
