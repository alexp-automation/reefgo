// ReefGo — nationwide, map first. Data: state reef programs, Open-Meteo (GFS + ECMWF + marine), NWS coastal zones (CWF), NOAA CO-OPS tides, NASA GIBS.
// Verdict rules: Материалы/правила-прогноза-погоды.md

const M2FT = 3.28084, KM = 111.2;
const RIDE_TXT = ['Go', 'Go if you must', 'No-go'];
const DIVE_TXT = ['Dive', 'Only if you really want to', 'No dive'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_EN = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const GIBS = [['NOAA-20', 'VIIRS_NOAA20_CorrectedReflectance_TrueColor'], ['NOAA-21', 'VIIRS_NOAA21_CorrectedReflectance_TrueColor'], ['SNPP', 'VIIRS_SNPP_CorrectedReflectance_TrueColor'], ['Terra', 'MODIS_Terra_CorrectedReflectance_TrueColor'], ['Aqua', 'MODIS_Aqua_CorrectedReflectance_TrueColor']];
// vessel profiles: [ride wind caution, ride wind no, ride wave caution ft, ride wave no ft]
const VESSELS = { pwc: ['Jet ski', 12, 16, 2.5, 3], kayak: ['Kayak / SUP', 8, 12, 1.5, 2.5], small: ['Boat under 20 ft', 12, 18, 3, 4], mid: ['Boat 20–26 ft', 15, 20, 3.5, 5], big: ['Boat over 26 ft', 18, 25, 4.5, 6] };
const CITIES = [['Tampa, FL', 27.95, -82.46], ['Tarpon Springs, FL', 28.15, -82.76], ['Clearwater, FL', 27.97, -82.8], ['St. Petersburg, FL', 27.77, -82.64], ['Sarasota, FL', 27.34, -82.53], ['Fort Myers, FL', 26.64, -81.87], ['Naples, FL', 26.14, -81.79], ['Key West, FL', 24.56, -81.78], ['Miami, FL', 25.76, -80.19], ['Fort Lauderdale, FL', 26.12, -80.14], ['West Palm Beach, FL', 26.71, -80.05], ['Daytona Beach, FL', 29.21, -81.02], ['Jacksonville, FL', 30.33, -81.66], ['Pensacola, FL', 30.42, -87.22], ['Destin, FL', 30.39, -86.5], ['Panama City, FL', 30.16, -85.66], ['Crystal River, FL', 28.9, -82.59], ['Cedar Key, FL', 29.14, -83.03], ['Mobile, AL', 30.69, -88.04], ['Orange Beach, AL', 30.29, -87.57], ['Biloxi, MS', 30.4, -88.89], ['New Orleans, LA', 29.95, -90.07], ['Venice, LA', 29.28, -89.35], ['Galveston, TX', 29.3, -94.8], ['Freeport, TX', 28.95, -95.36], ['Corpus Christi, TX', 27.8, -97.4], ['Port Aransas, TX', 27.83, -97.06], ['South Padre Island, TX', 26.1, -97.17], ['Savannah, GA', 32.08, -81.1], ['Brunswick, GA', 31.15, -81.49], ['Charleston, SC', 32.78, -79.93], ['Myrtle Beach, SC', 33.69, -78.89], ['Wilmington, NC', 34.23, -77.94], ['Morehead City, NC', 34.72, -76.73], ['Nags Head, NC', 35.96, -75.63], ['Virginia Beach, VA', 36.85, -75.98], ['Ocean City, MD', 38.34, -75.08], ['Cape May, NJ', 38.94, -74.91], ['Atlantic City, NJ', 39.36, -74.42], ['New York, NY', 40.71, -74.01], ['Montauk, NY', 41.04, -71.95], ['Boston, MA', 42.36, -71.06], ['San Diego, CA', 32.72, -117.16], ['Los Angeles, CA', 33.94, -118.4], ['San Francisco, CA', 37.77, -122.42], ['Seattle, WA', 47.6, -122.33], ['Honolulu, HI', 21.31, -157.86]];
const STATES = { FL: 'Florida', AL: 'Alabama', MS: 'Mississippi', LA: 'Louisiana', TX: 'Texas', GA: 'Georgia', SC: 'South Carolina', NC: 'North Carolina', VA: 'Virginia', MD: 'Maryland', DE: 'Delaware', NJ: 'New Jersey', NY: 'New York', CA: 'California', WA: 'Washington', HI: 'Hawaii' };

const S = { reefs: [], tides: [], buoys: [], fish: null, fishAll: {}, buoysAt: null, reef: null, day: 0, days: [], fc: {}, cwf: {}, zone: {}, tideCache: {}, area: null, areaKey: '', vessel: 'pwc', sat: { on: false, date: null, layer: GIBS[0][1] } };
try { S.vessel = localStorage.getItem('rg.vessel') || 'pwc'; } catch (e) {}
const $ = id => document.getElementById(id);
const f1 = x => x == null ? '—' : String(Math.round(x * 10) / 10);
const f0 = x => x == null ? '—' : String(Math.round(x));
const dirTxt = d => d == null ? '' : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(d / 45) % 8];
const dirWord = d => d == null ? '' : ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'][Math.round(d / 45) % 8];
const F = c => c == null ? null : c * 9 / 5 + 32;
const todayKey = () => new Date().toLocaleDateString('en-CA');
const addDays = (k, n) => { const d = new Date(k + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dowOf = k => new Date(k + 'T12:00:00Z').getUTCDay();
const dayName = k => { const i = S.days.indexOf(k); return i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `${DOW[dowOf(k)]} ${MON[+k.slice(5, 7) - 1]} ${+k.slice(8)}`; };
const nm = (a, b) => { const R = 3440.065, p = Math.PI / 180, dl = (b.lat - a.lat) * p, dn = (b.lon - a.lon) * p; const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * p) * Math.cos(b.lat * p) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const overall = v => v.ride === 2 ? 2 : (v.ride === 0 && v.dive === 0 ? 0 : 1);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- data ----------
async function getJSON(u, opt) { const r = await fetch(u, opt); if (!r.ok) throw new Error(r.status); return r.json(); }
const NWS = { headers: { 'Accept': 'application/geo+json' } };
async function forecastAt(lat, lon) {
  const key = lat.toFixed(3) + ',' + lon.toFixed(3); if (S.fc[key]) return S.fc[key];
  const H = 'wind_speed_10m,wind_gusts_10m,wind_direction_10m,temperature_2m,precipitation_probability';
  const base = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${H}&wind_speed_unit=kn&timezone=auto&past_days=7&forecast_days=7`;
  const [g, e, m] = await Promise.all([getJSON(base + '&models=gfs_seamless'), getJSON(base + '&models=ecmwf_ifs025').catch(() => null),
    getJSON(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=wave_height,wave_period,sea_surface_temperature&timezone=auto&past_days=1&forecast_days=7`).catch(() => null)]);
  return S.fc[key] = { g: g.hourly, e: e ? e.hourly : g.hourly, m: m ? m.hourly : { time: [], wave_height: [], wave_period: [], sea_surface_temperature: [] }, tz: g.timezone };
}
async function zoneAt(lat, lon) {
  const key = lat.toFixed(2) + ',' + lon.toFixed(2); if (S.zone[key] !== undefined) return S.zone[key];
  try { const z = await getJSON(`https://api.weather.gov/zones?type=coastal&point=${lat.toFixed(4)},${lon.toFixed(4)}`, NWS);
    const f = z.features[0]; if (!f) return S.zone[key] = null;
    const office = (f.properties.forecastOffices || [])[0]; return S.zone[key] = { id: f.properties.id, name: f.properties.name, office: office ? office.split('/').pop() : null };
  } catch (e) { return S.zone[key] = null; }
}
async function cwfFor(office) {
  if (!office) return null; if (S.cwf[office] !== undefined) return S.cwf[office];
  try { const list = await getJSON(`https://api.weather.gov/products/types/CWF/locations/${office}`, NWS); const p = await getJSON('https://api.weather.gov/products/' + list['@graph'][0].id, NWS); return S.cwf[office] = p.productText; }
  catch (e) { return S.cwf[office] = null; }
}
function zoneBlock(text, zone) {
  if (!text) return null; const pre = zone.slice(0, 3), num = +zone.slice(3);
  for (const b of text.split('$$')) {
    const head = b.slice(0, 400); const m = head.match(new RegExp(pre + '\\d{3}(?:[->]\\d{3})*(?:-' + pre + '\\d{3}(?:[->]\\d{3})*)*-\\d{6}-'));
    if (!m) continue; const nums = []; const parts = m[0].replace(/-\d{6}-$/, '').split('-').filter(Boolean);
    for (const p of parts) { const s = p.replace(pre, ''); if (s.includes('>')) { const [a, c] = s.split('>').map(Number); for (let i = a; i <= c; i++) nums.push(i); } else nums.push(+s); }
    if (!nums.includes(num)) continue;
    const sca = (b.match(/\.\.\.([^.]*?(?:ADVISORY|WARNING|WATCH)[^.]*?)\.\.\./) || [])[1];
    const periods = [...b.matchAll(/^\.([A-Z ]+)\.\.\.([\s\S]*?)(?=^\.[A-Z ]+\.\.\.|$)/gm)].map(x => ({ name: x[1].trim(), text: x[2].replace(/\s+/g, ' ').trim() }));
    return { sca, periods };
  }
  return null;
}
function nearestBuoys(lat, lon) {
  const d = b => nm({ lat, lon }, b); const list = S.buoys.map(b => ({ b, d: d(b) })).filter(x => x.d < 70).sort((a, b) => a.d - b.d);
  const wind = list.find(x => x.b.wspd != null), wave = list.find(x => x.b.wvht != null); return { wind, wave };
}
function ago(t) { const m = Math.round((Date.now() - new Date(t)) / 6e4); return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`; }
function buoyHTML(lat, lon) {
  const { wind, wave } = nearestBuoys(lat, lon); if (!wind && !wave) return '';
  const rows = [];
  if (wind) rows.push(`<span>Wind · ${wind.b.id}, ${f0(wind.d)} nm</span><b>${dirTxt(wind.b.wdir)} ${f0(wind.b.wspd)} kt${wind.b.gst ? ', gusts ' + f0(wind.b.gst) : ''}</b>`);
  if (wave) rows.push(`<span>Seas · ${wave.b.id}, ${f0(wave.d)} nm</span><b>${f1(wave.b.wvht)} ft / ${f0(wave.b.dpd)} s</b>`);
  const wt = (wave && wave.b.wtmp != null ? wave.b : wind && wind.b.wtmp != null ? wind.b : null); if (wt) rows.push(`<span>Water</span><b>${f0(F(wt.wtmp))}°F</b>`);
  const t = (wind || wave).b.t; return `<div class="card"><h3>Right now · buoys</h3><div class="kv">${rows.join('')}</div><p class="muted" style="margin:6px 0 0;font-size:12px">NOAA NDBC, ${ago(t)}. Buoys measure, models guess: when they differ, trust the buoy.</p></div>`;
}
function nearestTide(lat, lon) { let best = null, bd = 1e9; for (const s of S.tides) { const d = (s.lat - lat) ** 2 + ((s.lon - lon) * Math.cos(lat * Math.PI / 180)) ** 2; if (d < bd) { bd = d; best = s; } } return best && Math.sqrt(bd) * KM < 80 ? best : null; }
async function tidesFor(st) {
  if (!st) return []; if (S.tideCache[st.id]) return S.tideCache[st.id];
  try { const j = await getJSON(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=${st.id}&product=predictions&datum=MLLW&interval=hilo&units=english&time_zone=lst_ldt&format=json&begin_date=${todayKey().replace(/-/g, '')}&range=192`); return S.tideCache[st.id] = j.predictions || []; } catch (e) { return []; }
}

// ---------- verdict ----------
function dayStats(fc, key) {
  const idx = []; fc.g.time.forEach((t, i) => { const h = +t.slice(11, 13); if (t.startsWith(key) && h >= 7 && h <= 15) idx.push(i); });
  if (!idx.length) return null;
  const g = fc.g, e = fc.e, m = fc.m; const mi = {}; m.time.forEach((t, i) => mi[t] = i);
  const w = idx.map(i => Math.max(g.wind_speed_10m[i] ?? 0, e.wind_speed_10m[i] ?? 0));
  const gu = idx.map(i => Math.max(g.wind_gusts_10m[i] ?? 0, e.wind_gusts_10m[i] ?? 0));
  const pick = k => idx.map(i => mi[g.time[i]] != null ? m[k][mi[g.time[i]]] : null).filter(x => x != null);
  const wv = pick('wave_height'), pe = pick('wave_period'), sst = pick('sea_surface_temperature');
  const mid = idx[Math.floor(idx.length / 2)]; const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  let last = null; const t7 = key + 'T07:00';
  g.time.forEach((t, i) => { if (t < t7 && Math.max(g.wind_speed_10m[i] ?? 0, e.wind_speed_10m[i] ?? 0) > 15) last = t; });
  const since = last ? (new Date(t7) - new Date(last)) / 864e5 : 9;
  return { windAvg: avg(w), windMax: Math.max(...w), gust: Math.max(...gu), dir: g.wind_direction_10m[mid], wave: wv.length ? Math.max(...wv) : null, period: pe.length ? Math.min(...pe) : null,
    sst: sst.length ? sst[0] : null, tmax: Math.max(...idx.map(i => g.temperature_2m[i])), rain: Math.max(...idx.map(i => g.precipitation_probability[i] ?? 0)), since, gAvg: avg(idx.map(i => g.wind_speed_10m[i] ?? 0)), eAvg: avg(idx.map(i => e.wind_speed_10m[i] ?? 0)) };
}
function verdicts(s) {
  const V = VESSELS[S.vessel]; let ride = 0, dive = 0; const why = [];
  const wf = s.wave != null ? s.wave * M2FT : 0, p = s.period ?? 9;
  if (s.windAvg > V[2]) { ride = 2; why.push(`Wind ${f0(s.windAvg)} kt is too much for a ${V[0].toLowerCase()}`); } else if (s.windAvg > V[1]) { ride = 1; why.push(`Wind ${f0(s.windAvg)} kt: on the edge`); }
  if (wf > V[4]) { ride = 2; why.push(`Seas ${f1(wf)} ft: hard to get there`); } else if (wf > V[3]) { ride = Math.max(ride, 1); why.push(`Seas ${f1(wf)} ft: rough ride`); } else if (wf > V[3] - 0.5 && p < 5) { ride = Math.max(ride, 1); why.push(`Seas ${f1(wf)} ft at a short ${f0(p)} s period: it will pound`); }
  if (s.windAvg > 15) dive = 2; else if (s.windAvg > 10) dive = 1;
  if (wf > 2.5) dive = 2; else if (wf > 2) { dive = Math.max(dive, 1); why.push('Seas over 2 ft hide the boat from a diver at the surface'); } else if (wf > 1.5 && p <= 4) { dive = Math.max(dive, 1); why.push('Short chop: hard to see the boat from the water'); }
  if (s.since < 2) { dive = Math.max(dive, 1); why.push(s.since < 1 ? 'Water is stirred up: strong wind less than a day ago' : `Water still clearing: strong wind ${f1(s.since)} days ago`); }
  if (s.windAvg < 8) why.push('Calm morning. Expect a sea breeze of 8–10 kt after 3 pm; be on the reef early');
  if (Math.abs(s.gAvg - s.eAvg) > 5) why.push(`Models disagree (GFS ${f0(s.gAvg)}, ECMWF ${f0(s.eAvg)} kt); the worse one is used`);
  return { ride, dive, why };
}
function headline(v) { if (v.ride === 2) return 'No-go'; if (v.ride === 1) return v.dive === 2 ? 'Go if you must, no dive' : 'Go if you must'; return v.dive === 0 ? 'Go and dive' : v.dive === 1 ? 'Go. Dive only if you really want to' : 'Go, but no dive'; }
function clearDay(fc) { let last = null; fc.g.time.forEach((t, i) => { if (Math.max(fc.g.wind_speed_10m[i] ?? 0, fc.e.wind_speed_10m[i] ?? 0) > 15) last = t; }); if (!last) return { clear: true }; const d = new Date(last); d.setDate(d.getDate() + 2); const k = d.toISOString().slice(0, 10); return { clear: k <= todayKey(), key: k, still: last >= todayKey() }; }
function lead(s, v, z, fc) {
  let t = `${dirWord(s.dir)} wind ${f0(s.windAvg)} kt, seas ${f1((s.wave || 0) * M2FT)} ft every ${f0(s.period)} s.`;
  if (z && z.sca && S.day <= 1) t += ` ${z.sca.toLowerCase().replace(/(^|\s)(\w)/g, (a, b, c) => b + c.toUpperCase()).replace(/ (In|Effect|Through|Until|From|For|The|And|Of) /g, m => m.toLowerCase())}.`;
  if (v.ride < 2 && v.dive > 0 && s.since < 2) { const cd = clearDay(fc); t += cd && !cd.clear ? ` Water should clear by ${dayName(cd.key).toLowerCase()}.` : ' Water is still murky.'; }
  return t;
}

// ---------- fish & rules ----------
// Region: FL splits into Gulf and Atlantic (Atlantic counties + Monroe); other states use the state code. Rules exist for FL only; other states get the species list + a link.
const FL_ATL = new Set(['Nassau', 'Duval', 'St. Johns', 'Flagler', 'Volusia', 'Brevard', 'Indian River', 'St. Lucie', 'Martin', 'Palm Beach', 'Broward', 'Miami-Dade', 'Monroe']);
function fishRegion(r) { if (r.st === 'FL') return r.county ? (FL_ATL.has(r.county) ? 'fla' : 'flg') : (r.lon > -81.6 ? 'fla' : 'flg'); return S.fish && S.fish.regions[r.st] ? r.st : null; }
function fishGroup(reg) { for (const [g, list] of Object.entries(S.fish.groups)) if (list.includes(reg)) return g; return null; }
// season → 'open' | 'closed' | 'check'. Entries: YYYY-MM-DD..YYYY-MM-DD (that year only) or MM-DD..MM-DD (every year, may wrap the new year).
function seasonStatus(season, key) {
  if (season === null || season === undefined) return 'open'; if (season === 'closed') return 'closed'; if (season === 'check') return 'check';
  let dated = true, sameYear = false;
  for (const [a, b] of season) {
    if (a.length === 10) { if (a.slice(0, 4) === key.slice(0, 4) || b.slice(0, 4) === key.slice(0, 4)) sameYear = true; if (key >= a && key <= b) return 'open'; }
    else { dated = false; const md = key.slice(5); if (a <= b ? (md >= a && md <= b) : (md >= a || md <= b)) return 'open'; }
  }
  return dated && !sameYear ? 'check' : 'closed';
}
function fishList(r, key) {
  const reg = fishRegion(r); if (!reg) return null; const grp = fishGroup(reg); if (!grp) return null;
  const fl = reg === 'flg' || reg === 'fla'; const d = r.depth;
  const list = S.fish.species.filter(sp => sp.groups.includes(grp) && (d == null || sp.minDepth <= d + 5)).map(sp => {
    const rule = fl ? (sp.rules[reg] || sp.rules.fl) : null;
    let st = sp.protected ? 'protected' : !rule ? 'rules' : seasonStatus(rule.season, key);
    return { sp, rule, st };
  });
  const order = { open: 0, check: 1, closed: 2, protected: 3, rules: 0 };
  list.sort((a, b) => order[a.st] - order[b.st] || a.sp.minDepth - b.sp.minDepth);
  return { reg, fl, list, url: S.fish.regions[reg].url, name: S.fish.regions[reg].name };
}
const PILL = { open: 'Open', closed: 'Closed', check: 'Check season', protected: 'Protected', rules: 'See rules' };
function fishHTML(r, key) {
  if (!S.fish) return ''; const f = fishList(r, key); if (!f || !f.list.length) return '';
  const n = f.list.filter(x => x.st === 'open').length, c = f.list.filter(x => x.st === 'closed' || x.st === 'protected').length;
  const head = f.fl ? `${n} open ${dayName(key).toLowerCase()}, ${c} closed` : `${f.list.length} species · ${esc(f.name)} rules`;
  const row = x => `<div class="fr"><img src="${x.sp.img || ''}" alt="" loading="lazy"><div class="ft"><b>${esc(x.sp.name)}</b><span>${x.rule ? esc([x.rule.size !== 'none' && x.rule.size !== '—' ? 'min ' + x.rule.size : null, 'bag ' + x.rule.bag].filter(Boolean).join(' · ')) : `<i>${esc(x.sp.sci)}</i>`}</span>${x.rule && x.rule.note ? `<small>${esc(x.rule.note)}${x.rule.verify ? ' · verify' : ''}</small>` : x.rule && x.rule.verify ? '<small>Verify on myfwc.com</small>' : ''}</div><em class="pill ${x.st}">${PILL[x.st]}</em></div>`;
  const first = f.list.slice(0, 7), rest = f.list.slice(7);
  return `<div class="card fish"><h3>Fish here · ${head}</h3><div class="fl">${first.map(row).join('')}</div>${rest.length ? `<div class="fl more" hidden>${rest.map(row).join('')}</div><button class="link" data-more>Show ${rest.length} more</button>` : ''}
    <p class="muted" style="margin:8px 0 0;font-size:12px">${f.fl ? esc(S.fish.flNoSpear) + ' Snapshot of FWC rules; seasons change yearly. ' : `Size, bag and season limits are set by ${esc(f.name)}. `}<a href="${f.url}" target="_blank" rel="noopener">${f.fl ? 'FWC rules' : esc(f.name) + ' rules'}</a>. Species guessed from reef depth${r.depth ? ` (${f0(r.depth)} ft)` : ''}, not a survey.</p></div>`;
}

// ---------- map ----------
let view = { lat: 28.2, lon: -82.9, z: 9 }; try { view = JSON.parse(localStorage.getItem('rg.view')) || view; } catch (e) {}
const map = L.map('map', { zoomControl: false, attributionControl: true }).setView([view.lat, view.lon], view.z);
map.attributionControl.setPrefix('');
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 13, maxZoom: 18, attribution: 'Esri, GEBCO, NOAA' }).addTo(map);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 13, maxZoom: 18, pane: 'overlayPane', opacity: .8, zIndex: 6 }).addTo(map);
let satLayer = null, selMarker = null;
const cluster = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 44, spiderfyOnMaxZoom: true, disableClusteringAtZoom: 13, showCoverageOnHover: false,
  iconCreateFunction: c => L.divIcon({ html: `<div>${c.getChildCount()}</div>`, className: 'marker-cluster k' + (S.area ? S.area.c : 'x'), iconSize: [34, 34] }) });
map.addLayer(cluster);
const mkIcon = (c, sel) => L.divIcon({ className: '', html: `<div class="mk c${c}${sel ? ' sel' : ''}"></div>`, iconSize: [22, 22], iconAnchor: [11, 11] });
function areaClass() { return S.area ? S.area.c : 'x'; }
function loadReefs(list) {
  S.reefs = list; const ms = list.map(r => { const m = L.marker([r.lat, r.lon], { icon: mkIcon('x', false) }); m.reef = r; m.bindTooltip(r.name || r.id, { direction: 'top', offset: [0, -10] }); m.on('click', () => openReef(r)); r.m = m; return m; });
  cluster.addLayers(ms);
}
function recolor() { const c = areaClass(); const b = map.getBounds().pad(.5); S.reefs.forEach(r => { if (b.contains([r.lat, r.lon])) r.m.setIcon(mkIcon(c, r === S.reef)); }); cluster.refreshClusters(); }
let areaTimer = null;
map.on('moveend', () => { try { const c = map.getCenter(); localStorage.setItem('rg.view', JSON.stringify({ lat: c.lat, lon: c.lng, z: map.getZoom() })); } catch (e) {} clearTimeout(areaTimer); areaTimer = setTimeout(updateArea, 500); });
async function updateArea() {
  const z = map.getZoom(); if (z < 7) { $('area').hidden = true; return; }
  const c = map.getCenter(); const key = c.lat.toFixed(1) + ',' + c.lng.toFixed(1); if (key === S.areaKey && S.area) { $('area').hidden = false; return; }
  S.areaKey = key; $('area').hidden = false; $('areaH').textContent = 'Checking conditions…'; $('areaS').textContent = ''; $('areaDot').className = 'v';
  try { const fc = await forecastAt(c.lat, c.lng); if (key !== S.areaKey) return; const kday = S.days[S.day]; const s = dayStats(fc, kday); const v = verdicts(s); const cls = overall(v);
    S.area = { c: cls, s, v }; $('areaDot').className = 'v c' + cls; $('areaLbl').textContent = `Conditions here · ${dayName(kday).toLowerCase()}`; $('areaH').textContent = headline(v);
    $('areaS').textContent = `${dirTxt(s.dir)} ${f0(s.windAvg)} kt · seas ${f1((s.wave || 0) * M2FT)} ft / ${f0(s.period)} s · water ${f0(F(s.sst))}°F`; recolor(); }
  catch (e) { $('areaH').textContent = 'No forecast for this spot'; $('areaS').textContent = 'Move the map over coastal water'; }
}
$('area').onclick = () => { const c = map.getCenter(); let best = null, bd = 1e9; S.reefs.forEach(r => { const d = (r.lat - c.lat) ** 2 + (r.lon - c.lng) ** 2; if (d < bd) { bd = d; best = r; } }); if (best) openReef(best); };

// satellite
function satUrl() { return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${S.sat.layer}/default/${S.sat.date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`; }
function applySat() { if (satLayer) { satLayer.remove(); satLayer = null; } if (!S.sat.on) return; satLayer = L.tileLayer(satUrl(), { maxNativeZoom: 9, maxZoom: 18, opacity: .9, attribution: 'NASA GIBS', zIndex: 5 }).addTo(map); }
function buildSat() { const t = todayKey(); const bar = $('satbar'); bar.innerHTML = '';
  for (let i = 0; i < 7; i++) { const k = addDays(t, -i); const b = document.createElement('button'); b.className = 'chip' + (k === S.sat.date ? ' on' : ''); b.textContent = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : `${MON[+k.slice(5, 7) - 1]} ${+k.slice(8)}`; b.onclick = () => { S.sat.date = k; buildSat(); applySat(); }; bar.appendChild(b); }
  GIBS.forEach(([n, id]) => { const b = document.createElement('button'); b.className = 'chip' + (id === S.sat.layer ? ' on' : ''); b.textContent = n; b.onclick = () => { S.sat.layer = id; buildSat(); applySat(); }; bar.appendChild(b); }); }
function toggleSat(force) { S.sat.on = force == null ? !S.sat.on : force; $('satBtn').classList.toggle('on', S.sat.on); $('satbar').classList.toggle('on', S.sat.on); applySat(); }
$('satBtn').onclick = () => toggleSat();
S.sat.date = addDays(todayKey(), -1); buildSat();

// location + search
$('locBtn').onclick = () => { if (!navigator.geolocation) return; navigator.geolocation.getCurrentPosition(p => map.setView([p.coords.latitude, p.coords.longitude], 10), () => {}); };
const q = $('q'), sug = $('sug');
q.oninput = () => { const t = q.value.trim().toLowerCase(); sug.innerHTML = ''; if (t.length < 2) { sug.classList.remove('on'); return; }
  const res = [];
  Object.entries(STATES).forEach(([k, n]) => { if (n.toLowerCase().startsWith(t) || k.toLowerCase() === t) res.push({ n, s: 'state', go: () => { const rs = S.reefs.filter(r => r.st === k); if (rs.length) map.fitBounds(L.latLngBounds(rs.map(r => [r.lat, r.lon])).pad(.1)); } }); });
  CITIES.forEach(([n, la, lo]) => { if (n.toLowerCase().includes(t)) res.push({ n, s: 'city', go: () => map.setView([la, lo], 10) }); });
  S.reefs.forEach(r => { if (res.length < 12 && (r.name || '').toLowerCase().includes(t)) res.push({ n: r.name, s: r.st + (r.depth ? ` · ${f0(r.depth)} ft` : ''), go: () => { map.setView([r.lat, r.lon], 13); openReef(r); } }); });
  res.slice(0, 10).forEach(x => { const b = document.createElement('button'); b.innerHTML = `<b>${esc(x.n)}</b><span>${esc(x.s)}</span>`; b.onclick = () => { sug.classList.remove('on'); q.value = ''; q.blur(); x.go(); }; sug.appendChild(b); });
  sug.classList.toggle('on', res.length > 0); };
q.onblur = () => setTimeout(() => sug.classList.remove('on'), 200);

// ---------- reef sheet ----------
function weekHTML(fc) { return `<div class="week">` + S.days.map((k, i) => { const s = dayStats(fc, k); const c = s ? overall(verdicts(s)) : null; return `<button class="${i === S.day ? 'sel' : ''}" data-day="${i}">${i === 0 ? 'Now' : DOW[dowOf(k)]}<em>${+k.slice(8)}</em><i class="${c == null ? '' : 'c' + c}"></i></button>`; }).join('') + '</div>'; }
async function openReef(r) {
  if (S.reef && S.reef.m) S.reef.m.setIcon(mkIcon(areaClass(), false)); S.reef = r; r.m.setIcon(mkIcon(areaClass(), true));
  const sh = $('sheet'), el = $('sheetIn'); sh.classList.add('on'); $('area').hidden = true;
  el.innerHTML = `<div class="hero"><div class="eyebrow">${esc(r.st)} · ${esc(r.src)}</div><h1>${esc(r.name || r.id)}</h1><p class="lead muted">Loading forecast…</p><button class="x" id="xBtn" aria-label="Close">×</button></div>`;
  $('xBtn').onclick = closeReef;
  try {
    const [fc, zone, tst] = await Promise.all([forecastAt(r.lat, r.lon), zoneAt(r.lat, r.lon), Promise.resolve(nearestTide(r.lat, r.lon))]);
    const [cwf, td] = await Promise.all([zone ? cwfFor(zone.office) : null, tidesFor(tst)]);
    if (S.reef !== r) return; renderReef(r, fc, zone, cwf, tst, td);
  } catch (e) { el.querySelector('.lead').textContent = 'Could not load the forecast. Check your connection.'; }
}
function renderReef(r, fc, zone, cwf, tst, td) {
  const key = S.days[S.day]; const s = dayStats(fc, key); const el = $('sheetIn');
  if (!s) { el.innerHTML = `<div class="hero"><h1>${esc(r.name)}</h1><p class="lead">No forecast for this day.</p><button class="x" id="xBtn">×</button></div>`; $('xBtn').onclick = closeReef; return; }
  const v = verdicts(s); const hc = overall(v); const z = zoneBlock(cwf, zone ? zone.id : ''); const dn = DOW_EN[dowOf(key)];
  const per = z ? z.periods.filter(p => S.day === 0 ? /TODAY|THIS AFTERNOON|TONIGHT/.test(p.name) : p.name === dn || p.name === dn + ' NIGHT') : [];
  const tides = td.filter(p => p.t.startsWith(key)).map(p => { const [hh, mm] = p.t.slice(11, 16).split(':').map(Number); const w = x => `${String(((hh + x) + 24) % 24).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; return { h: p.t.slice(11, 16), type: p.type === 'H' ? 'High' : 'Low', slack: `${w(-1)}–${w(1)}` }; });
  const g = fc.g, e = fc.e, m = fc.m; const mi = {}; m.time.forEach((t, i) => mi[t] = i); let rows = '';
  g.time.forEach((t, i) => { const hh = +t.slice(11, 13); if (!t.startsWith(key) || hh < 6 || hh > 18) return; const j = mi[t]; rows += `<tr><td>${hh}:00</td><td>${f0(g.wind_speed_10m[i])} / ${f0(e.wind_speed_10m[i])} ${dirTxt(g.wind_direction_10m[i])}</td><td>${f0(Math.max(g.wind_gusts_10m[i] ?? 0, e.wind_gusts_10m[i] ?? 0))}</td><td>${j != null && m.wave_height[j] != null ? f1(m.wave_height[j] * M2FT) + ' ft / ' + f0(m.wave_period[j]) + ' s' : '—'}</td></tr>`; });
  const meta = [r.depth ? `${f0(r.depth)} ft deep` : null, r.relief ? `${f0(r.relief)} ft relief` : null, r.mat, r.date && !/^00/.test(r.date) ? `deployed ${r.date}` : null].filter(Boolean).join(' · ');
  el.innerHTML = `
    <div class="hero v${hc}"><div class="eyebrow">${esc(r.st)} · ${dayName(key)}</div><h1>${headline(v)}</h1><p class="lead">${lead(s, v, z, fc)}</p>
      <div class="two"><div><b>Go</b><span class="t${v.ride}">${RIDE_TXT[v.ride]}</span></div><div><b>Dive</b><span class="t${v.dive}">${DIVE_TXT[v.dive]}</span></div></div>
      <div class="facts"><div><b>${f0(s.windAvg)} kt</b><small>wind ${dirTxt(s.dir)}</small></div><div><b>${f0(s.gust)} kt</b><small>gusts</small></div><div><b>${f1((s.wave || 0) * M2FT)} ft</b><small>seas · ${f0(s.period)} s</small></div><div><b>${f0(F(s.sst))}°</b><small>water °F</small></div></div>
      <button class="x" id="xBtn" aria-label="Close">×</button></div>
    ${weekHTML(fc)}
    <div class="card"><h3>${esc(r.name || r.id)}</h3><p style="margin:0;font-size:14px">${esc(r.desc || '')}${meta ? `<br><span class="muted">${esc(meta)}</span>` : ''}</p></div>
    ${buoyHTML(r.lat, r.lon)}
    ${fishHTML(r, key)}
    ${v.why.length ? `<div class="card"><h3>Why</h3><ul class="why">${v.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
    ${tides.length ? `<div class="card"><h3>Tide · ${esc(tst.n)}</h3><div class="kv">${tides.map(t => `<span>${t.type} ${t.h}</span><b>slack ${t.slack}</b>`).join('')}</div><p class="muted" style="margin:6px 0 0;font-size:12px">Slack water is the easy window to launch and retrieve.</p></div>` : ''}
    <details><summary>Hour by hour</summary><div class="d"><table><tr><th>Hour</th><th>Wind GFS / ECMWF</th><th>Gust</th><th>Seas</th></tr>${rows}</table><p class="muted" style="font-size:12px">Knots. The worse of two models drives the verdict. Air ${f0(F(s.tmax))}°F, rain ${f0(s.rain)}%.</p></div></details>
    ${z ? `<details><summary>NWS marine forecast · ${esc(zone.id)}</summary><div class="d">${z.sca ? `<p style="margin:0 0 8px;color:var(--no);font-weight:700">${esc(z.sca)}</p>` : ''}<pre class="cwf">${esc(per.length ? per.map(p => p.name + ': ' + p.text).join('\n\n') : 'This day is not yet in the NWS marine forecast.')}</pre><p class="muted" style="font-size:12px">${esc(zone.name)}</p></div></details>` : ''}
    <div class="row"><button class="btn" id="satGo">Satellite view</button><a class="btn" target="_blank" rel="noopener" href="https://maps.apple.com/?ll=${r.lat},${r.lon}&q=${encodeURIComponent(r.name || 'Reef')}">Open in Maps</a></div>
    <p class="muted" style="font-size:11px;text-align:center;margin:0">Forecast estimate. Conditions can differ on site. Not for navigation. ${r.lat.toFixed(4)}, ${r.lon.toFixed(4)}</p>`;
  $('xBtn').onclick = closeReef;
  el.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { S.day = +b.dataset.day; renderReef(r, fc, zone, cwf, tst, td); S.area = null; S.areaKey = ''; });
  const more = el.querySelector('[data-more]'); if (more) more.onclick = () => { el.querySelector('.fl.more').hidden = false; more.remove(); };
  $('satGo').onclick = () => { closeReef(); map.setView([r.lat, r.lon], Math.max(map.getZoom(), 9)); toggleSat(true); };
}
function closeReef() { $('sheet').classList.remove('on'); if (S.reef && S.reef.m) S.reef.m.setIcon(mkIcon(areaClass(), false)); S.reef = null; updateArea(); }
$('grip').onclick = closeReef;
map.on('click', () => { if ($('sheet').classList.contains('on')) closeReef(); });

// settings
function buildVessel() { const el = $('vessel'); el.innerHTML = ''; Object.entries(VESSELS).forEach(([k, v]) => { const b = document.createElement('button'); b.textContent = v[0]; b.className = k === S.vessel ? 'on' : ''; b.onclick = () => { S.vessel = k; try { localStorage.setItem('rg.vessel', k); } catch (e) {} buildVessel(); S.area = null; S.areaKey = ''; updateArea(); }; el.appendChild(b); }); }
$('setBtn').onclick = () => { buildVessel(); $('settings').classList.add('on'); };
$('setClose').onclick = () => $('settings').classList.remove('on');
$('settings').onclick = e => { if (e.target === $('settings')) $('settings').classList.remove('on'); };

(async () => {
  const t = todayKey(); S.days = Array.from({ length: 7 }, (_, i) => addDays(t, i));
  const [reefs, tides, nd, fish] = await Promise.all([getJSON('reefs.json'), getJSON('tides.json').catch(() => []), getJSON('ndbc.json?' + Date.now()).catch(() => null), getJSON('data/fish.json').catch(() => null)]);
  S.fish = fish;
  S.tides = tides; S.buoys = nd ? nd.stations : []; loadReefs(reefs); updateArea();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
