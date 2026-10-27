#!/usr/bin/env python3
"""Download species thumbnails from Wikipedia (pageimages API) into img/fish/ and record license credits.
Run from the project root: python3 scripts/fish_images.py. Polite: one batch query + one download per species."""
import json, os, re, sys, time, urllib.parse, urllib.request
UA = 'ReefGo/0.1 (https://alexp-automation.github.io/reefgo/; mail.a.panov@gmail.com)'
API = 'https://en.wikipedia.org/w/api.php'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'img', 'fish'); os.makedirs(OUT, exist_ok=True)
def get(url, binary=False):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r: return r.read() if binary else json.loads(r.read().decode())
def api(**p):
    p.update(action='query', format='json'); return get(API + '?' + urllib.parse.urlencode(p))
fish = json.load(open(os.path.join(ROOT, 'data', 'fish.json')))
sp = fish['species']; titles = [s['wiki'] for s in sp]
pages = {}
for i in range(0, len(titles), 40):
    j = api(prop='pageimages', pithumbsize=480, titles='|'.join(titles[i:i+40]))
    norm = {n['from']: n['to'] for n in j['query'].get('normalized', [])}
    for p in j['query']['pages'].values(): pages[p['title']] = p
    for a, b in norm.items(): pages[a] = pages.get(b)
    time.sleep(2)
credits = {}
for s in sp:
    p = pages.get(s['wiki']); th = p and p.get('thumbnail')
    if not th: print('no image:', s['name']); continue
    fname = p['pageimage']
    ext = os.path.splitext(fname)[1].lower() or '.jpg'
    if ext not in ('.jpg', '.jpeg', '.png', '.webp', '.gif'): ext = '.jpg'
    dest = os.path.join(OUT, s['id'] + ext)
    if not os.path.exists(dest):
        open(dest, 'wb').write(get(th['source'].split('?')[0], binary=True)); time.sleep(2)
    meta = api(prop='imageinfo', iiprop='extmetadata|url', titles='File:' + fname)
    ii = next(iter(meta['query']['pages'].values())).get('imageinfo', [{}])[0]; em = ii.get('extmetadata', {})
    strip = lambda h: re.sub('<[^>]+>', '', h or '').strip()
    credits[s['id']] = {'file': fname, 'page': ii.get('descriptionurl'), 'license': strip(em.get('LicenseShortName', {}).get('value')), 'artist': strip(em.get('Artist', {}).get('value'))[:80]}
    s['img'] = 'img/fish/' + s['id'] + ext; print('ok', s['name'], ext, credits[s['id']]['license']); time.sleep(2)
json.dump(fish, open(os.path.join(ROOT, 'data', 'fish.json'), 'w'), ensure_ascii=False, indent=1)
json.dump(credits, open(os.path.join(ROOT, 'data', 'fish-credits.json'), 'w'), ensure_ascii=False, indent=1)
