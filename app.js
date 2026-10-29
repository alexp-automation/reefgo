// ReefGo — nationwide, map first. Data: state reef programs, Open-Meteo (GFS + ECMWF + marine), NWS coastal zones (CWF), NOAA CO-OPS tides, NASA GIBS.
// Verdict rules: Материалы/правила-прогноза-погоды.md

const M2FT = 3.28084, KM = 111.2;
const RIDE_TXT = ['Go', 'Go if you must', 'No-go'];
const DIVE_TXT = ['Dive', 'Only if you really want to', 'No dive'];
const FISH_TXT = ['Fish', 'Choppy at anchor', 'Stay in'];
// what you do on the reef: drives the second verdict and what the card leads with
const ACT = { fish: 'Fishing', spear: 'Spearfishing', dive: 'Diving' };
// fishing-at-anchor thresholds per vessel: [wind go, wind max, wave go ft, wave max ft] (research: small boat ≤10 kt / ≤2 ft / period ≥ 2× height)
const FISH = { pwc: [8, 12, 1.5, 2], kayak: [7, 10, 1.2, 1.8], small: [10, 15, 2, 3], mid: [12, 17, 2.5, 3.5], big: [14, 20, 3, 4.5] };
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_EN = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const GIBS = [['NOAA-20', 'VIIRS_NOAA20_CorrectedReflectance_TrueColor'], ['NOAA-21', 'VIIRS_NOAA21_CorrectedReflectance_TrueColor'], ['SNPP', 'VIIRS_SNPP_CorrectedReflectance_TrueColor'], ['Terra', 'MODIS_Terra_CorrectedReflectance_TrueColor'], ['Aqua', 'MODIS_Aqua_CorrectedReflectance_TrueColor']];
// vessel profiles: [ride wind caution, ride wind no, ride wave caution ft, ride wave no ft]
const VESSELS = { pwc: ['Jet ski', 12, 16, 2.5, 3], kayak: ['Kayak / SUP', 8, 12, 1.5, 2.5], small: ['Boat under 20 ft', 12, 18, 3, 4], mid: ['Boat 20–26 ft', 15, 20, 3.5, 5], big: ['Boat over 26 ft', 18, 25, 4.5, 6] };
const CITIES = [['Tampa, FL', 27.95, -82.46], ['Tarpon Springs, FL', 28.15, -82.76], ['Clearwater, FL', 27.97, -82.8], ['St. Petersburg, FL', 27.77, -82.64], ['Sarasota, FL', 27.34, -82.53], ['Fort Myers, FL', 26.64, -81.87], ['Naples, FL', 26.14, -81.79], ['Key West, FL', 24.56, -81.78], ['Miami, FL', 25.76, -80.19], ['Fort Lauderdale, FL', 26.12, -80.14], ['West Palm Beach, FL', 26.71, -80.05], ['Daytona Beach, FL', 29.21, -81.02], ['Jacksonville, FL', 30.33, -81.66], ['Pensacola, FL', 30.42, -87.22], ['Destin, FL', 30.39, -86.5], ['Panama City, FL', 30.16, -85.66], ['Crystal River, FL', 28.9, -82.59], ['Cedar Key, FL', 29.14, -83.03], ['Mobile, AL', 30.69, -88.04], ['Orange Beach, AL', 30.29, -87.57], ['Biloxi, MS', 30.4, -88.89], ['New Orleans, LA', 29.95, -90.07], ['Venice, LA', 29.28, -89.35], ['Galveston, TX', 29.3, -94.8], ['Freeport, TX', 28.95, -95.36], ['Corpus Christi, TX', 27.8, -97.4], ['Port Aransas, TX', 27.83, -97.06], ['South Padre Island, TX', 26.1, -97.17], ['Savannah, GA', 32.08, -81.1], ['Brunswick, GA', 31.15, -81.49], ['Charleston, SC', 32.78, -79.93], ['Myrtle Beach, SC', 33.69, -78.89], ['Wilmington, NC', 34.23, -77.94], ['Morehead City, NC', 34.72, -76.73], ['Nags Head, NC', 35.96, -75.63], ['Virginia Beach, VA', 36.85, -75.98], ['Ocean City, MD', 38.34, -75.08], ['Cape May, NJ', 38.94, -74.91], ['Atlantic City, NJ', 39.36, -74.42], ['New York, NY', 40.71, -74.01], ['Montauk, NY', 41.04, -71.95], ['Boston, MA', 42.36, -71.06], ['San Diego, CA', 32.72, -117.16], ['Los Angeles, CA', 33.94, -118.4], ['San Francisco, CA', 37.77, -122.42], ['Seattle, WA', 47.6, -122.33], ['Honolulu, HI', 21.31, -157.86]];
const STATES = { FL: 'Florida', AL: 'Alabama', MS: 'Mississippi', LA: 'Louisiana', TX: 'Texas', GA: 'Georgia', SC: 'South Carolina', NC: 'North Carolina', VA: 'Virginia', MD: 'Maryland', DE: 'Delaware', NJ: 'New Jersey', NY: 'New York', CA: 'California', OR: 'Oregon', WA: 'Washington', HI: 'Hawaii' };

// ?fresh in the URL wipes this phone's saved settings (vessel, map view, onboarding flag, alerts) to replay the first launch.
if (/[?&]fresh\b/.test(location.search)) { try { Object.keys(localStorage).filter(k => k.startsWith('rg.')).forEach(k => localStorage.removeItem(k)); } catch (e) {} history.replaceState(null, '', location.pathname); }
// Time windows for the verdict: [label, start hour, end hour]; end 'set' = sunset, start 'rise' = sunrise (from the forecast's daily data).
const WIN = { am: ['Morning', 7, 12], mid: ['Midday', 11, 16], pm: ['Evening', 15, 'set'], day: ['All day', 'rise', 'set'] };
const S = { reefs: [], tides: [], buoys: [], win: 'am', act: 'fish', solunar: false, fish: null, kd: null, cells: {}, cellPending: {}, buoysAt: null, reef: null, day: 0, days: [], fc: {}, cwf: {}, zone: {}, tideCache: {}, area: null, areaKey: '', vessel: 'pwc', sat: { on: false, date: null, layer: GIBS[0][1] } };
try { S.vessel = localStorage.getItem('rg.vessel') || 'pwc'; S.win = WIN[localStorage.getItem('rg.win')] ? localStorage.getItem('rg.win') : 'am'; S.act = ACT[localStorage.getItem('rg.act')] ? localStorage.getItem('rg.act') : 'fish'; S.solunar = localStorage.getItem('rg.solunar') === '1'; } catch (e) {}
// language: rg.lang, else the phone's language; English strings are the keys, see i18n.js
S.lang = 'en'; try { const l = localStorage.getItem('rg.lang') || (navigator.language || 'en').slice(0, 2); S.lang = I18N[l] ? l : 'en'; } catch (e) {}
const t = (k, v) => { let s = (S.lang !== 'en' && I18N[S.lang] && I18N[S.lang][k]) || k; if (v) for (const x in v) s = s.split('{' + x + '}').join(v[x]); return s; };
document.documentElement.lang = S.lang;
const $ = id => document.getElementById(id);
const f1 = x => x == null ? '—' : String(Math.round(x * 10) / 10);
const f0 = x => x == null ? '—' : String(Math.round(x));
const dirTxt = d => d == null ? '' : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(d / 45) % 8];
const dirWord = d => d == null ? '' : t(['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'][Math.round(d / 45) % 8]);
const F = c => c == null ? null : c * 9 / 5 + 32;
const todayKey = () => new Date().toLocaleDateString('en-CA');
const addDays = (k, n) => { const d = new Date(k + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dowOf = k => new Date(k + 'T12:00:00Z').getUTCDay();
const dayLower = k => { const i = S.days.indexOf(k); return i <= 1 && i >= 0 ? dayName(k).toLowerCase() : dayName(k); };
const dayName = k => { const i = S.days.indexOf(k); return i === 0 ? t('Today') : i === 1 ? t('Tomorrow') : `${t(DOW[dowOf(k)])} ${t(MON[+k.slice(5, 7) - 1])} ${+k.slice(8)}`; };
const agoTxt = n => n === 0 ? t('today') : n === 1 ? t('yesterday') : t('{n} days ago', { n });
const nm = (a, b) => { const R = 3440.065, p = Math.PI / 180, dl = (b.lat - a.lat) * p, dn = (b.lon - a.lon) * p; const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * p) * Math.cos(b.lat * p) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const overall = v => v.ride === 2 ? 2 : (v.ride === 0 && v.dive === 0 ? 0 : 1);
const secTxt = () => S.act === 'fish' ? FISH_TXT : DIVE_TXT;
const secName = () => t(S.act === 'fish' ? 'Fish' : 'Dive');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- data ----------
async function getJSON(u, opt) { const r = await fetch(u, opt); if (!r.ok) throw new Error(r.status); return r.json(); }
const NWS = { headers: { 'Accept': 'application/geo+json' } };
async function forecastAt(lat, lon) {
  const key = lat.toFixed(3) + ',' + lon.toFixed(3); if (S.fc[key]) return S.fc[key];
  const H = 'wind_speed_10m,wind_gusts_10m,wind_direction_10m,temperature_2m,precipitation_probability,pressure_msl';
  const base = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${H}&daily=sunrise,sunset&wind_speed_unit=kn&timezone=auto&past_days=7&forecast_days=7`;
  const [g, e, m] = await Promise.all([getJSON(base + '&models=gfs_seamless'), getJSON(base + '&models=ecmwf_ifs025').catch(() => null),
    getJSON(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=wave_height,wave_period,sea_surface_temperature&timezone=auto&past_days=1&forecast_days=7`).catch(() => null)]);
  return S.fc[key] = { g: g.hourly, e: e ? e.hourly : g.hourly, m: m ? m.hourly : { time: [], wave_height: [], wave_period: [], sea_surface_temperature: [] }, d: g.daily, tz: g.timezone };
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
function ago(ts) { const m = Math.round((Date.now() - new Date(ts)) / 6e4); return m < 60 ? t('{m} min ago', { m }) : t('{h} h ago', { h: Math.round(m / 60) }); }
function buoyHTML(lat, lon) {
  const { wind, wave } = nearestBuoys(lat, lon); if (!wind && !wave) return '';
  const rows = [];
  if (wind) rows.push(`<span>${t('Wind · {id}, {d} nm', { id: wind.b.id, d: f0(wind.d) })}</span><b>${dirTxt(wind.b.wdir)} ${f0(wind.b.wspd)} kt${wind.b.gst ? t(', gusts {g}', { g: f0(wind.b.gst) }) : ''}</b>`);
  if (wave) rows.push(`<span>${t('Seas · {id}, {d} nm', { id: wave.b.id, d: f0(wave.d) })}</span><b>${f1(wave.b.wvht)} ft / ${f0(wave.b.dpd)} s</b>`);
  const wt = (wave && wave.b.wtmp != null ? wave.b : wind && wind.b.wtmp != null ? wind.b : null); if (wt) rows.push(`<span>${t('Water')}</span><b>${f0(F(wt.wtmp))}°F</b>`);
  const ts = (wind || wave).b.t; return `<div class="card"><h3>${t('Right now · buoys')}</h3><div class="kv">${rows.join('')}</div><p class="muted" style="margin:6px 0 0;font-size:12px">${t('NOAA NDBC, {ago}. Buoys measure, models guess: when they differ, trust the buoy.', { ago: ago(ts) })}</p></div>`;
}
function nearestTide(lat, lon) { let best = null, bd = 1e9; for (const s of S.tides) { const d = (s.lat - lat) ** 2 + ((s.lon - lon) * Math.cos(lat * Math.PI / 180)) ** 2; if (d < bd) { bd = d; best = s; } } return best && Math.sqrt(bd) * KM < 80 ? best : null; }
async function tidesFor(st) {
  if (!st) return []; if (S.tideCache[st.id]) return S.tideCache[st.id];
  try { const j = await getJSON(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=${st.id}&product=predictions&datum=MLLW&interval=hilo&units=english&time_zone=lst_ldt&format=json&begin_date=${todayKey().replace(/-/g, '')}&range=192`); return S.tideCache[st.id] = j.predictions || []; } catch (e) { return []; }
}

// ---------- satellite water clarity ----------
// Kd490 (NOAA CoastWatch VIIRS, via kd.json from the GitHub Action) → Kd(PAR) (Morel 2007) → Secchi depth 1.7/Kd(PAR) (Poole–Atkins)
// → horizontal diver visibility = 0.7 × Secchi (Alexey's 30% rule), shown as a ±15% range. To be calibrated against real dives.
function clarity(r) {
  const k = S.kd && S.kd.v && S.kd.v[r.id]; if (!k) return null; const kd = k[0]; if (!(kd > 0)) return null;
  const kpar = Math.max(0.03, 0.0864 + 0.884 * kd - 0.00137 / kd); const vis = 0.7 * 1.7 / kpar;
  const ft = vis * M2FT; const lo = Math.max(1, Math.floor(ft * 0.85)), hi = Math.min(100, Math.ceil(ft * 1.15));
  const age = Math.round((new Date(todayKey() + 'T12:00:00Z') - new Date(k[1] + 'T12:00:00Z')) / 864e5);
  const sat = { N21: 'NOAA-21 VIIRS', N20: 'NOAA-20 VIIRS', NPP: 'S-NPP VIIRS 4 km' }[k[2]] || 'VIIRS';
  return { kd, date: k[1], age, sat, visM: vis, lo, hi, loM: lo / M2FT, hiM: hi / M2FT };
}
function windSince(fc, dateKey) { let mx = 0; const from = dateKey + 'T23:59'; fc.g.time.forEach((t, i) => { if (t > from && t <= todayKey() + 'T23:59') mx = Math.max(mx, fc.g.wind_speed_10m[i] ?? 0, fc.e.wind_speed_10m[i] ?? 0); }); return mx; }
function clarityHTML(r, fc) {
  if (!S.kd) return ''; const c = clarity(r);
  if (!c) return `<div class="card"><h3>${t('Water clarity · satellite')}</h3><p style="margin:0;font-size:14px" class="muted">${t('No cloud-free satellite pass over this reef in the last 10 days.')}</p></div>`;
  const ws = windSince(fc, c.date); const notes = [];
  notes.push(ws > 15 ? t('Wind up to {w} kt since the pass: expect worse than this.', { w: f0(ws) }) : ws > 10 ? t('Wind up to {w} kt since the pass: may be a bit worse.', { w: f0(ws) }) : t('No strong wind since the pass.'));
  if (r.depth && r.depth < 15) notes.push(t('Shallow bright bottom can make the satellite read murkier than it is.'));
  if (r.depth && r.depth > 40) notes.push(t('Surface-layer reading. Deeper water can differ.'));
  const when = `${t(MON[+c.date.slice(5, 7) - 1])} ${+c.date.slice(8)}`;
  return `<div class="card clar"><h3>${t('Water clarity · satellite')}</h3>
    <div class="big"><b>${c.lo}–${c.hi} ft</b><span>${c.hiM < 3 ? f1(c.loM) + '–' + f1(c.hiM) : f0(c.loM) + '–' + f0(c.hiM)} ${t('m · estimated visibility')}</span></div>
    <div class="kv"><span>${t('Satellite pass')}</span><b>${when} · ${agoTxt(c.age)}</b><span>${t('Sensor')}</span><b>${c.sat}</b><span>${t('Light attenuation Kd490')}</span><b>${c.kd.toFixed(2)} /m</b></div>
    <ul class="why" style="margin-top:8px">${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
    <p class="muted" style="margin:8px 0 0;font-size:12px">${t('Estimate from satellite light attenuation, cut by 30% for horizontal visibility. Not a measurement: valid for the moment of the pass, surface layer, clouds hide the water. Being calibrated against real dives.')}</p></div>`;
}

// ---------- verdict ----------
// window hours for a day: sunrise rounded down, sunset rounded up (daily data from Open-Meteo), fallback 7 / 19
function winHours(fc, key) {
  const w = WIN[S.win]; let rise = 7, set = 19;
  if (fc.d && fc.d.time) { const i = fc.d.time.indexOf(key); if (i >= 0 && fc.d.sunrise[i]) { rise = +fc.d.sunrise[i].slice(11, 13); set = +fc.d.sunset[i].slice(11, 13) + (+fc.d.sunset[i].slice(14, 16) > 0 ? 1 : 0); } }
  const a = w[1] === 'rise' ? rise : w[1], b = w[2] === 'set' ? Math.max(set, a + 2) : w[2]; return [a, Math.min(b, 23)];
}
function winLabel(fc, key) { const [a, b] = winHours(fc, key); const h = x => x === 12 ? '12 pm' : x > 12 ? (x - 12) + ' pm' : x + ' am'; return `${t(WIN[S.win][0]).toLowerCase()} ${h(a)}–${h(b)}`; }
function dayStats(fc, key) {
  const [wa, wb] = winHours(fc, key);
  const idx = []; fc.g.time.forEach((t, i) => { const h = +t.slice(11, 13); if (t.startsWith(key) && h >= wa && h <= wb) idx.push(i); });
  if (!idx.length) return null;
  const g = fc.g, e = fc.e, m = fc.m; const mi = {}; m.time.forEach((t, i) => mi[t] = i);
  const w = idx.map(i => Math.max(g.wind_speed_10m[i] ?? 0, e.wind_speed_10m[i] ?? 0));
  const gu = idx.map(i => Math.max(g.wind_gusts_10m[i] ?? 0, e.wind_gusts_10m[i] ?? 0));
  const pick = k => idx.map(i => mi[g.time[i]] != null ? m[k][mi[g.time[i]]] : null).filter(x => x != null);
  const wv = pick('wave_height'), pe = pick('wave_period'), sst = pick('sea_surface_temperature');
  const mid = idx[Math.floor(idx.length / 2)]; const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  let last = null; const t7 = key + 'T' + String(wa).padStart(2, '0') + ':00';
  g.time.forEach((t, i) => { if (t < t7 && Math.max(g.wind_speed_10m[i] ?? 0, e.wind_speed_10m[i] ?? 0) > 15) last = t; });
  const since = last ? (new Date(t7) - new Date(last)) / 864e5 : 9;
  return { windAvg: avg(w), windMax: Math.max(...w), gust: Math.max(...gu), dir: g.wind_direction_10m[mid], wave: wv.length ? Math.max(...wv) : null, period: pe.length ? Math.min(...pe) : null,
    wa, wb, pres: g.pressure_msl ? g.pressure_msl[idx[0]] : null, pTrend: g.pressure_msl && idx[0] >= 6 ? g.pressure_msl[idx[0]] - g.pressure_msl[idx[0] - 6] : null, sst: sst.length ? sst[0] : null, tmax: Math.max(...idx.map(i => g.temperature_2m[i])), rain: Math.max(...idx.map(i => g.precipitation_probability[i] ?? 0)), since, gAvg: avg(idx.map(i => g.wind_speed_10m[i] ?? 0)), eAvg: avg(idx.map(i => e.wind_speed_10m[i] ?? 0)) };
}
function verdicts(s, cl) {
  const V = VESSELS[S.vessel]; let ride = 0, dive = 0; const why = [];
  const wf = s.wave != null ? s.wave * M2FT : 0, p = s.period ?? 9;
  const vn = t(V[0]).toLowerCase();
  if (s.windAvg > V[2]) { ride = 2; why.push(t('Wind {w} kt is too much for a {v}', { w: f0(s.windAvg), v: vn })); } else if (s.windAvg > V[1]) { ride = 1; why.push(t('Wind {w} kt: on the edge', { w: f0(s.windAvg) })); }
  if (wf > V[4]) { ride = 2; why.push(t('Seas {h} ft: hard to get there', { h: f1(wf) })); } else if (wf > V[3]) { ride = Math.max(ride, 1); why.push(t('Seas {h} ft: rough ride', { h: f1(wf) })); } else if (wf > V[3] - 0.5 && p < 5) { ride = Math.max(ride, 1); why.push(t('Seas {h} ft at a short {p} s period: it will pound', { h: f1(wf), p: f0(p) })); }
  if (S.act === 'fish') { // fishing at anchor: comfort and holding, not visibility
    const F = FISH[S.vessel];
    if (s.windAvg > F[1]) { dive = 2; why.push(t('Wind {w} kt: no holding at anchor on a {v}', { w: f0(s.windAvg), v: vn })); } else if (s.windAvg > F[0]) { dive = 1; why.push(t('Wind {w} kt: bumpy at anchor', { w: f0(s.windAvg) })); }
    if (s.gust > F[1] + 5) { dive = 2; why.push(t('Gusts to {g} kt', { g: f0(s.gust) })); } else if (s.gust > F[0] + 5) { dive = Math.max(dive, 1); }
    if (wf > F[3]) { dive = 2; why.push(t('Seas {h} ft: too much to sit on the reef', { h: f1(wf) })); }
    else if (wf > F[2]) { if (p >= 6) { dive = Math.max(dive, 1); why.push(t('Seas {h} ft at a long {p} s period: rolly but fishable', { h: f1(wf), p: f0(p) })); } else { dive = 2; why.push(t('Seas {h} ft at a short {p} s period: steep chop at anchor', { h: f1(wf), p: f0(p) })); } }
    else if (wf >= 1.5 && p < 2 * wf) { dive = Math.max(dive, 1); why.push(t('Short chop ({h} ft every {p} s): expect a bumpy anchor and heavy sinkers', { h: f1(wf), p: f0(p) })); }
    if (s.rain > 60) { dive = Math.max(dive, 1); why.push(t('Rain {r}%: squalls and lightning risk', { r: f0(s.rain) })); }
    if (s.pTrend != null && s.pTrend < -3) why.push(t('Pressure falling: a front is coming, check the wind'));
  } else {
  if (s.windAvg > 15) dive = 2; else if (s.windAvg > 10) dive = 1;
  if (wf > 2.5) dive = 2; else if (wf > 2) { dive = Math.max(dive, 1); why.push(t('Seas over 2 ft hide the boat from a diver at the surface')); } else if (wf > 1.5 && p <= 4) { dive = Math.max(dive, 1); why.push(t('Short chop: hard to see the boat from the water')); }
  if (s.since < 2) { dive = Math.max(dive, 1); why.push(s.since < 1 ? t('Water is stirred up: strong wind less than a day ago') : t('Water still clearing: strong wind {d} days ago', { d: f1(s.since) })); }
  if (cl && cl.hi < 10) { dive = Math.max(dive, 1); why.push(t('Satellite saw murky water (about {lo}–{hi} ft) {when}', { lo: cl.lo, hi: cl.hi, when: agoTxt(Math.max(1, cl.age)) })); }
  }
  if (s.windAvg < 8 && (S.win === 'am' || S.win === 'day')) why.push(t('Calm morning. Expect a sea breeze of 8–10 kt after 3 pm; be on the reef early'));
  if (Math.abs(s.gAvg - s.eAvg) > 5) why.push(t('Models disagree (GFS {g}, ECMWF {e} kt); the worse one is used', { g: f0(s.gAvg), e: f0(s.eAvg) }));
  return { ride, dive, why };
}
function headline(v) {
  const fish = S.act === 'fish';
  if (v.ride === 2) return t('No-go');
  if (v.ride === 1) return t(v.dive === 2 ? (fish ? 'Go if you must, no fishing' : 'Go if you must, no dive') : 'Go if you must');
  if (fish) return t(v.dive === 0 ? 'Go and fish' : v.dive === 1 ? 'Go. Choppy at anchor' : 'Go, but not to fish');
  return t(v.dive === 0 ? 'Go and dive' : v.dive === 1 ? 'Go. Dive only if you really want to' : 'Go, but no dive');
}
function clearDay(fc) { let last = null; fc.g.time.forEach((t, i) => { if (Math.max(fc.g.wind_speed_10m[i] ?? 0, fc.e.wind_speed_10m[i] ?? 0) > 15) last = t; }); if (!last) return { clear: true }; const d = new Date(last); d.setDate(d.getDate() + 2); const k = d.toISOString().slice(0, 10); return { clear: k <= todayKey(), key: k, still: last >= todayKey() }; }
function lead(s, v, z, fc) {
  let txt = t('{dir} wind {w} kt, seas {h} ft every {p} s.', { dir: S.lang === 'en' ? dirWord(s.dir) : dirWord(s.dir).toLowerCase(), w: f0(s.windAvg), h: f1((s.wave || 0) * M2FT), p: f0(s.period) });
  if (z && z.sca && S.day <= 1) txt += ` ${z.sca.toLowerCase().replace(/(^|\s)(\w)/g, (a, b, c) => b + c.toUpperCase()).replace(/ (In|Effect|Through|Until|From|For|The|And|Of) /g, m => m.toLowerCase())}.`;
  if (S.act !== 'fish' && v.ride < 2 && v.dive > 0 && s.since < 2) { const cd = clearDay(fc); txt += cd && !cd.clear ? t(' Water should clear by {day}.', { day: dayLower(cd.key) }) : t(' Water is still murky.'); }
  return txt;
}

// ---------- fish & rules ----------
// Region: FL splits into Gulf and Atlantic (Atlantic counties + Monroe); other states use the state code. Rules exist for FL only; other states get the species list + a link.
const FL_ATL = new Set(['Nassau', 'Duval', 'St. Johns', 'Flagler', 'Volusia', 'Brevard', 'Indian River', 'St. Lucie', 'Martin', 'Palm Beach', 'Broward', 'Miami-Dade', 'Monroe']);
function fishRegion(r) { if (r.st === 'FL') return r.county ? (FL_ATL.has(r.county) ? 'fla' : 'flg') : (r.lon > -81.6 ? 'fla' : 'flg'); return S.fish && S.fish.regions[r.st] ? r.st : null; }
// state-waters limit and whether the reef sits in federal waters (reefs.json nm = distance to shore)
function stateLimit(r, reg) { return reg === 'flg' || r.st === 'TX' ? 9 : 3; }
function isFederal(r, reg) { return r.nm != null && r.nm > stateLimit(r, reg); }
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
  const fed = isFederal(r, reg) && (grp === 'gulf' || grp === 'satl'); const fedKey = grp === 'gulf' ? 'fedg' : 'feds';
  const list = S.fish.species.filter(sp => sp.groups.includes(grp) && (d == null || sp.minDepth <= d + 5)).map(sp => {
    const stateRule = fl ? (sp.rules[reg] || sp.rules.fl) : null;
    let rule = stateRule, src = fl ? 'state' : null;
    if (fed) { let fr = sp.rules[fedKey];
      if (fr && fr.states) fr = fr.states[r.st] ? Object.assign({}, fr, fr.states[r.st]) : sp.id === 'redsnapper' && r.st === 'FL' && stateRule ? Object.assign({}, stateRule, { note: "Florida's season applies in federal waters off Florida" }) : fr;
      if (fr && fr.managed !== false) { rule = fr; src = 'fed'; } else if (fr && fr.managed === false) { src = fl ? 'state' : null; } else { rule = null; src = null; } }
    let st = sp.protected ? 'protected' : !rule ? 'rules' : seasonStatus(rule.season, key);
    return { sp, rule, st, src };
  });
  const order = { open: 0, check: 1, closed: 2, protected: 3, rules: 0 };
  list.sort((a, b) => order[a.st] - order[b.st] || a.sp.minDepth - b.sp.minDepth);
  const fedReg = fed ? S.fish.regions[fedKey] : null;
  return { reg, fl, fed, hasRules: fl || fed, list, url: fed && fedReg ? fedReg.url : S.fish.regions[reg].url, name: fed && fedReg ? fedReg.name : S.fish.regions[reg].name };
}
const PILL = { open: 'Open', closed: 'Closed', check: 'Check season', protected: 'Protected', rules: 'See rules' }; // translated with t() at render
function fishHTML(r, key, s) {
  if (!S.fish) return ''; const f = fishList(r, key); if (!f || !f.list.length) return '';
  const n = f.list.filter(x => x.st === 'open').length, c = f.list.filter(x => x.st === 'closed' || x.st === 'protected').length;
  const head = f.hasRules ? t('Fish here · {n} open {day}, {c} closed', { n, day: dayName(key).toLowerCase(), c }) : t('{n} species · {name} rules', { n: f.list.length, name: esc(f.name) });
  const row = x => `<div class="fr">${x.sp.img ? `<img src="${x.sp.img}" alt="" loading="lazy">` : '<i class="noimg"></i>'}<div class="ft"><b>${esc(x.sp.name)}</b><span>${x.rule ? esc([x.rule.size !== 'none' && x.rule.size !== '—' ? t('min ') + x.rule.size : null, t('bag ') + x.rule.bag].filter(Boolean).join(' · ')) : `<i>${esc(x.sp.sci)}</i>`}</span>${x.rule && x.rule.note ? `<small>${esc(x.rule.note)}${x.rule.verify ? t(' · verify') : ''}</small>` : x.rule && x.rule.verify ? `<small>${t('Verify on myfwc.com')}</small>` : ''}${f.fed && x.src === 'state' ? `<small>${t('Not federally managed: state rule shown')}</small>` : ''}</div><em class="pill ${x.st}">${t(PILL[x.st])}</em></div>`;
  const first = f.list.slice(0, 7), rest = f.list.slice(7);
  return `<div class="card fish"><h3>${f.hasRules ? head : t('Fish here · {n} open {day}, {c} closed').split(' · ')[0] + ' · ' + head}</h3>${s ? tempHintHTML(r, s) : ''}<div class="fl">${first.map(row).join('')}</div>${rest.length ? `<div class="fl more" hidden>${rest.map(row).join('')}</div><button class="link" data-more>${t('Show {n} more', { n: rest.length })}</button>` : ''}
    <p class="muted" style="margin:8px 0 0;font-size:12px">${f.hasRules ? t('Open: season open on this day in these waters, with the minimum size and daily bag. Closed: no harvest that day. Protected: never. ') + (S.act === 'spear' && f.fl ? esc(t(S.fish.flNoSpear)) : '') + (f.fed ? t(' Snapshot of federal NOAA rules for these waters; seasons change yearly. ') : t(' Snapshot of FWC rules; seasons change yearly. ')) : t('Size, bag and season limits are set by {name}. ', { name: esc(f.name) })}<a href="${f.url}" target="_blank" rel="noopener">${f.fed ? t('NOAA federal rules') : f.fl ? t('FWC rules') : t('{name} rules', { name: esc(f.name) })}</a>${t('. Species guessed from reef depth{d}, not a survey.', { d: r.depth ? ` (${f0(r.depth)} ft)` : '' })}</p>${watersHTML(r, f)}</div>`;
}

// ---------- angler extras: best bite, moon, pressure, solunar ----------
const hm = m => `${Math.floor(((m % 1440) + 1440) % 1440 / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}`;
function sunMin(fc, key) { if (!fc.d || !fc.d.time) return null; const i = fc.d.time.indexOf(key); if (i < 0 || !fc.d.sunrise[i]) return null; const m = t => +t.slice(11, 13) * 60 + +t.slice(14, 16); return [m(fc.d.sunrise[i]), m(fc.d.sunset[i])]; }
// Best bite = the hour before and after a tide turn, best when it overlaps the hour around sunrise or sunset. Real CO-OPS turns and real sun, nothing invented.
function bestBite(td, fc, key, wa, wb) {
  const sun = sunMin(fc, key); const W0 = wa * 60, W1 = wb * 60 + 59;
  const turns = td.filter(p => p.t.startsWith(key)).map(p => ({ m: +p.t.slice(11, 13) * 60 + +p.t.slice(14, 16), type: p.type === 'H' ? 'High' : 'Low' }));
  const lights = sun ? [[sun[0] - 60, sun[0] + 60, 'sunrise'], [sun[1] - 60, sun[1] + 60, 'sunset']] : [];
  let best = null;
  for (const tn of turns) { const a = Math.max(tn.m - 60, W0), b = Math.min(tn.m + 60, W1); if (b - a < 30) continue;
    const L = lights.find(l => a < l[1] && b > l[0]); const score = L ? 2 : 1;
    if (!best || score > best.score) best = { score, a, b, why: L ? t('tide turn + {light}', { light: t(L[2]) }) : t('{type} tide {t}', { type: t(tn.type.toLowerCase()), t: hm(tn.m) }) }; }
  if (!best) for (const l of lights) { const a = Math.max(l[0], W0), b = Math.min(l[1], W1); if (b - a >= 30) { best = { score: 0, a, b, why: t(l[2] === 'sunrise' ? 'first light' : 'last light') }; break; } }
  return best ? { from: hm(best.a), to: hm(best.b), why: best.why } : null;
}
function moonPhase(d) { const days = (d - Date.UTC(2000, 0, 6, 18, 14)) / 864e5; return ((days / 29.530588853) % 1 + 1) % 1; }
function moonTxt(key) { const ph = moonPhase(new Date(key + 'T12:00:00Z')); const strong = ph < 0.08 || ph > 0.92 || Math.abs(ph - 0.5) < 0.08; const name = ph < 0.03 || ph > 0.97 ? 'new moon' : ph < 0.22 ? 'waxing crescent' : ph < 0.28 ? 'first quarter' : ph < 0.47 ? 'waxing gibbous' : ph < 0.53 ? 'full moon' : ph < 0.72 ? 'waning gibbous' : ph < 0.78 ? 'last quarter' : 'waning crescent'; return { ph, strong, name }; }
function pressTxt(s) { if (s.pres == null) return ''; const inHg = (s.pres * 0.02953).toFixed(2); const tr = s.pTrend == null ? '' : t(s.pTrend < -2 ? ', falling' : s.pTrend > 2 ? ', rising' : ', steady'); return `${inHg} inHg${tr}`; }
// Solunar (off by default, unproven): moon transit ≈ 12:00 + phase × 24 h local; majors = transit and anti-transit ± 1 h, minors = ± 6 h ± 30 min.
function solunarTxt(key) { const ph = moonPhase(new Date(key + 'T12:00:00Z')); const tr = (12 * 60 + ph * 1440) % 1440; const w = (c, h) => `${hm(c - h)}–${hm(c + h)}`; return t('Majors {a}, {b} · minors {c}, {d}', { a: w(tr, 60), b: w(tr + 720, 60), c: w(tr + 360, 30), d: w(tr - 360, 30) }); }
function biteHTML(r, fc, key, s, tst, td) {
  if (S.act !== 'fish') return '';
  const bb = bestBite(td, fc, key, s.wa, s.wb); const mo = moonTxt(key); const sun = sunMin(fc, key);
  const todayTides = td.filter(p => p.t.startsWith(key)); const now = key === todayKey() ? new Date().getHours() * 60 + new Date().getMinutes() : s.wa * 60;
  const next = todayTides.map(p => ({ m: +p.t.slice(11, 13) * 60 + +p.t.slice(14, 16), type: p.type === 'H' ? 'High' : 'Low' })).find(p => p.m >= now);
  const rows = [];
  if (bb) rows.push(`<span>${t('Best bite')}</span><b>${bb.from}–${bb.to} · ${esc(bb.why)}</b>`);
  if (next) rows.push(`<span>${t('Next tide')}</span><b>${t(next.type)} ${hm(next.m)} → ${t(next.type === 'High' ? 'falling' : 'rising')}</b>`); else if (!tst) rows.push(`<span>${t('Tide')}</span><b>${t('no station within 80 nm')}</b>`);
  if (sun) rows.push(`<span>${t('Daylight')}</span><b>${hm(sun[0])} · ${hm(sun[1])}</b>`);
  rows.push(`<span>${t('Moon')}</span><b>${esc(t(mo.name))}${mo.strong ? t(' · strong tides') : ''}</b>`);
  const pt = pressTxt(s); if (pt) rows.push(`<span>${t('Pressure')}</span><b>${pt}</b>`);
  const notes = []; if (mo.strong) notes.push(t('Big tides this week: stronger current, heavier sinkers, harder to hold at anchor.'));
  if (tst) notes.push(t('Tide turn times are for {st}; offshore the current turns 30–60 min later.', { st: esc(tst.n) }));
  if (S.solunar) notes.push(t('Solunar (unproven): {s}.', { s: solunarTxt(key) }));
  return `<div class="card"><h3>${t('When to fish')}</h3><div class="kv">${rows.join('')}</div>${notes.length ? `<p class="muted" style="margin:6px 0 0;font-size:12px">${notes.join(' ')}</p>` : ''}</div>`;
}
// state vs federal waters by distance from shore: FL Gulf and TX 9 nm, everywhere else 3 nm
function watersHTML(r, f) {
  if (r.nm == null) return ''; const limit = stateLimit(r, f ? f.reg : ''); const state = r.nm <= limit;
  const gulf = f && S.fish.groups.gulf.includes(f.reg);
  const txt = state ? t('<b>state waters</b> (limit {l} nm), the rules above apply.', { l: limit }) : f && f.fed ? t('<b>federal waters</b> (state limit {l} nm): the federal rules above apply.', { l: limit }) : t('<b>federal waters</b> (state limit {l} nm): federal seasons and limits apply and differ from the state rules above. Check before you go.', { l: limit });
  return `<p class="muted" style="margin:8px 0 0;font-size:12px">${t('{nm} nm from shore: ', { nm: f0(r.nm) })}${txt}${gulf ? t(' Reef fish: keep a descending device or venting tool on board. Florida requires it; the federal Gulf rule lapsed in Jan 2026 and is being renewed.') : ''}</p>`;
}
function tempHintHTML(r, s) {
  if (S.act !== 'fish' || s.sst == null || !S.fish) return ''; const f = fishList(r, S.days[S.day]); if (!f) return ''; const F = Math.round(s.sst * 9 / 5 + 32);
  const hits = f.list.map(x => x.sp).filter(sp => sp.temp && F >= sp.temp[0] && F <= sp.temp[1]).slice(0, 4);
  return hits.length ? `<p style="margin:0 0 6px;font-size:13px">${t('Water {t}°F: ', { t: F })}${hits.map(sp => `${esc(sp.name.replace(/ \(.*\)/, ''))} ${esc(t(sp.temp[2]))}`).join(', ')}.</p>` : '';
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
  iconCreateFunction: c => { let worst = -1; for (const m of c.getAllChildMarkers()) { const x = m.reef && m.reef.c; if (x === 0 || x === 1 || x === 2) worst = Math.max(worst, x); }
    return L.divIcon({ html: `<div>${c.getChildCount()}</div>`, className: 'marker-cluster k' + (worst < 0 ? 'x' : worst), iconSize: [34, 34] }); } });
map.addLayer(cluster);
const mkIcon = (c, sel) => L.divIcon({ className: '', html: `<div class="mk c${c == null ? 'x' : c}${sel ? ' sel' : ''}"></div>`, iconSize: [22, 22], iconAnchor: [11, 11] });
const reefClass = r => r.c == null ? 'x' : r.c;
function loadReefs(list) {
  S.reefs = list; const ms = list.map(r => { const m = L.marker([r.lat, r.lon], { icon: mkIcon('x', false) }); m.reef = r; m.bindTooltip(r.name || r.id, { direction: 'top', offset: [0, -10] }); m.on('click', () => openReef(r)); r.m = m; return m; });
  cluster.addLayers(ms);
}
// Per-cell forecasts: reefs in view are grouped into grid cells (size by zoom), one batched Open-Meteo request per 40 cells, each reef colored by its own cell for the selected day.
function cellSize() { const z = map.getZoom(); return z >= 10 ? 0.25 : z >= 8 ? 0.5 : z >= 6 ? 1 : 2; }
async function fetchCells(cells) {
  cells.forEach(c => S.cellPending[c.key] = true);
  try {
    const lat = cells.map(c => c.lat.toFixed(3)).join(','), lon = cells.map(c => c.lon.toFixed(3)).join(',');
    const H = 'wind_speed_10m,wind_gusts_10m,wind_direction_10m,temperature_2m,precipitation_probability';
    const base = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${H}&daily=sunrise,sunset&wind_speed_unit=kn&timezone=auto&past_days=2&forecast_days=7`;
    const arr = x => x == null ? null : Array.isArray(x) ? x : [x];
    const [g, e, m] = await Promise.all([getJSON(base + '&models=gfs_seamless').then(arr), getJSON(base + '&models=ecmwf_ifs025').then(arr).catch(() => null),
      getJSON(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=wave_height,wave_period,sea_surface_temperature&timezone=auto&forecast_days=7`).then(arr).catch(() => null)]);
    cells.forEach((c, i) => { if (!g[i]) return; S.cells[c.key] = { g: g[i].hourly, e: e && e[i] ? e[i].hourly : g[i].hourly, m: m && m[i] ? m[i].hourly : { time: [], wave_height: [], wave_period: [], sea_surface_temperature: [] }, d: g[i].daily }; });
  } catch (err) {}
  cells.forEach(c => delete S.cellPending[c.key]);
}
function paintCells(cells) {
  const kday = S.days[S.day];
  cells.forEach(c => { const fc = S.cells[c.key]; if (!fc) return; // still loading: keep the color from the coarser cell
    let cls = null; const st = dayStats(fc, kday); if (st) cls = overall(verdicts(st));
    c.rs.forEach(r => { if (r.c !== cls) { r.c = cls; r.m.setIcon(mkIcon(cls, r === S.reef)); } }); });
  cluster.refreshClusters();
}
let colorGen = 0;
async function colorReefs() {
  const size = cellSize(), b = map.getBounds().pad(.3), groups = {};
  S.reefs.forEach(r => { if (!b.contains([r.lat, r.lon])) return; const k = `${size}:${Math.floor(r.lat / size)}:${Math.floor(r.lon / size)}`; (groups[k] || (groups[k] = { key: k, rs: [], lat: 0, lon: 0 })).rs.push(r); });
  const cells = Object.values(groups); cells.forEach(c => { c.lat = c.rs.reduce((a, r) => a + r.lat, 0) / c.rs.length; c.lon = c.rs.reduce((a, r) => a + r.lon, 0) / c.rs.length; });
  paintCells(cells);
  const missing = cells.filter(c => !S.cells[c.key] && !S.cellPending[c.key]); if (!missing.length) return;
  const gen = ++colorGen;
  for (let i = 0; i < missing.length; i += 40) { await fetchCells(missing.slice(i, i + 40)); if (gen !== colorGen) return; paintCells(cells); }
}
let areaTimer = null;
map.on('moveend', () => { try { const c = map.getCenter(); localStorage.setItem('rg.view', JSON.stringify({ lat: c.lat, lon: c.lng, z: map.getZoom() })); } catch (e) {} clearTimeout(areaTimer); areaTimer = setTimeout(() => { updateArea(); colorReefs(); if (S.sat.on) probeSat(); }, 400); });
async function updateArea() {
  const z = map.getZoom(); if (z < 7) { $('area').hidden = true; return; }
  const c = map.getCenter(); const key = c.lat.toFixed(1) + ',' + c.lng.toFixed(1); if (key === S.areaKey && S.area) { $('area').hidden = false; return; }
  S.areaKey = key; $('area').hidden = false; $('areaH').textContent = t('Checking conditions…'); $('areaS').textContent = ''; $('areaDot').className = 'v';
  try { const fc = await forecastAt(c.lat, c.lng); if (key !== S.areaKey) return; const kday = S.days[S.day]; const s = dayStats(fc, kday); const v = verdicts(s); const cls = overall(v);
    S.area = { c: cls, s, v }; $('areaDot').className = 'v c' + cls; $('areaLbl').textContent = t('Conditions here · {day} · {win}', { day: dayLower(kday), win: t(WIN[S.win][0]).toLowerCase() }); $('areaH').textContent = headline(v);
    const nx = nextWindow(fc); $('areaN').hidden = cls === 0; $('areaN').className = 'next ' + (nx ? 'n' + nx.cls : 'n2');
    if (cls !== 0) $('areaN').textContent = !nx ? t('No window in the next 7 days') : t(nx.cls === 0 ? 'Next window: {day} · {h}' : 'Best this week: {day} · {h}', { day: dayName(nx.key), h: headline(nx.v) });
    if (nx && nx.cls === 0) maybeNotify(nx, c);
    $('areaS').textContent = t('{dir} {w} kt · seas {h} ft / {p} s · water {t}°F', { dir: dirTxt(s.dir), w: f0(s.windAvg), h: f1((s.wave || 0) * M2FT), p: f0(s.period), t: f0(F(s.sst)) }); }
  catch (e) { $('areaH').textContent = t('No forecast for this spot'); $('areaS').textContent = t('Move the map over coastal water'); }
}
$('area').onclick = () => { const c = map.getCenter(); let best = null, bd = 1e9; S.reefs.forEach(r => { const d = (r.lat - c.lat) ** 2 + (r.lon - c.lng) ** 2; if (d < bd) { bd = d; best = r; } }); if (best) openReef(best); };

// satellite
function satUrl() { return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${S.sat.layer}/default/${S.sat.date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`; }
function applySat() { if (satLayer) { satLayer.remove(); satLayer = null; } if (!S.sat.on) return; satLayer = L.tileLayer(satUrl(), { maxNativeZoom: 9, maxZoom: 18, opacity: .9, attribution: 'NASA GIBS', zIndex: 5 }).addTo(map); probeSat(); }
// Probe one z7 tile at the map center for every sensor: GIBS returns a black tile when the sensor had no pass or no data there. Dim those chips and switch to a sensor that has an image.
S.sat.avail = {}; let probeGen = 0;
function tileXY(lat, lon, z) { const n = 2 ** z; const x = Math.floor((lon + 180) / 360 * n); const r = lat * Math.PI / 180; const y = Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n); return { x, y }; }
function tileMean(url) { return new Promise(ok => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { try { const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 16, 16); const p = x.getImageData(0, 0, 16, 16).data; let t = 0; for (let i = 0; i < p.length; i += 4) t += p[i] + p[i + 1] + p[i + 2]; ok(t / (p.length / 4) / 3); } catch (e) { ok(null); } }; im.onerror = () => ok(0); im.src = url; }); }
async function probeSat() {
  const gen = ++probeGen; const c = map.getCenter(); const { x, y } = tileXY(c.lat, c.lng, 7); const d = S.sat.date;
  const res = await Promise.all(GIBS.map(async ([n, id]) => { const key = `${id}|${d}|${x}|${y}`; if (S.sat.avail[key] === undefined) S.sat.avail[key] = await tileMean(`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${id}/default/${d}/GoogleMapsCompatible_Level9/7/${y}/${x}.jpg`); return [n, id, S.sat.avail[key]]; }));
  if (gen !== probeGen || !S.sat.on) return;
  const ok = res.filter(r => r[2] === null || r[2] > 8); const cur = res.find(r => r[1] === S.sat.layer); const dayTxt = d === todayKey() ? t('today') : d === addDays(todayKey(), -1) ? t('yesterday') : `${t(MON[+d.slice(5, 7) - 1])} ${+d.slice(8)}`;
  let hint = t('True-color photo, one pass per sensor per day. Black or blank: no pass or clouds here. Try another sensor or day.');
  if (cur && cur[2] !== null && cur[2] <= 8) { if (ok.length) { hint = t('{s} has no image here for {day}. Showing {o} instead.', { s: cur[0], day: dayTxt, o: ok[0][0] }); S.sat.layer = ok[0][1]; S.sat.note = [d + S.sat.layer, hint]; if (satLayer) satLayer.setUrl(satUrl()); } else hint = t('No sensor has an image here for {day}. Try another day.', { day: dayTxt }); }
  else if (S.sat.note && S.sat.note[0] === d + S.sat.layer) hint = S.sat.note[1];
  S.sat.off = new Set(res.filter(r => r[2] !== null && r[2] <= 8).map(r => r[1])); buildSat(); $('satbar').querySelector('.sathint').textContent = hint;
}
function buildSat() { const tk = todayKey(); const bar = $('satbar'); bar.innerHTML = '';
  const row = label => { const r = document.createElement('div'); r.className = 'satrow'; const l = document.createElement('span'); l.className = 'satlbl'; l.textContent = label; r.appendChild(l); bar.appendChild(r); return r; };
  const days = row(t('Day'));
  for (let i = 0; i < 7; i++) { const k = addDays(tk, -i); const b = document.createElement('button'); b.className = 'chip' + (k === S.sat.date ? ' on' : ''); b.textContent = i === 0 ? t('Today') : i === 1 ? t('Yesterday') : `${t(MON[+k.slice(5, 7) - 1])} ${+k.slice(8)}`; b.onclick = () => { S.sat.date = k; S.sat.off = null; buildSat(); applySat(); }; days.appendChild(b); }
  const sens = row(t('Sensor'));
  const q = document.createElement('button'); q.className = 'chip help'; q.textContent = '?'; q.title = t('How to read the satellite photo'); q.onclick = () => $('satHelp').classList.add('on'); sens.appendChild(q);
  GIBS.forEach(([n, id]) => { const b = document.createElement('button'); b.className = 'chip' + (id === S.sat.layer ? ' on' : '') + (S.sat.off && S.sat.off.has(id) ? ' off' : ''); b.textContent = n; b.title = S.sat.off && S.sat.off.has(id) ? t('No image here for this day') : ''; b.onclick = () => { S.sat.layer = id; buildSat(); applySat(); }; sens.appendChild(b); });
  const hint = document.createElement('div'); hint.className = 'sathint'; hint.textContent = t('True-color photo, one pass per sensor per day. Black or blank: no pass or clouds here. Try another sensor or day.'); bar.appendChild(hint); }
function toggleSat(force) { S.sat.on = force == null ? !S.sat.on : force; $('satBtn').classList.toggle('on', S.sat.on); $('satbar').classList.toggle('on', S.sat.on); applySat();
  // first time the satellite layer is turned on: open the reading guide once, then it lives behind the ? chip
  if (S.sat.on) { let seen = false; try { seen = localStorage.getItem('rg.sathelp') === '1'; } catch (e) {} if (!seen) { $('satHelp').classList.add('on'); try { localStorage.setItem('rg.sathelp', '1'); } catch (e) {} } } }
$('satBtn').onclick = () => toggleSat();
$('satHelpClose').onclick = () => $('satHelp').classList.remove('on'); $('satHelp').onclick = e => { if (e.target === $('satHelp')) $('satHelp').classList.remove('on'); };
S.sat.date = addDays(todayKey(), -1); buildSat();

// brand → home: close everything, drop the satellite layer, fly to your location if known, else to the last map view
function goHome() { closeReef(); $('settings').classList.remove('on'); if (S.sat.on) toggleSat(false); if (meDot) map.setView(meDot.getLatLng(), 10); }
$('brand').onclick = goHome;
// location + search
// "You are here": blue dot with an accuracy circle, kept on the map and refreshed on every tap
let meDot = null, meRing = null;
function showMe(p, zoomTo) { const ll = [p.coords.latitude, p.coords.longitude];
  if (!meDot) { meRing = L.circle(ll, { radius: p.coords.accuracy || 50, color: '#1a73e8', weight: 1, opacity: .5, fillColor: '#1a73e8', fillOpacity: .12, interactive: false }).addTo(map);
    meDot = L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }), interactive: false, zIndexOffset: 1000 }).addTo(map); }
  else { meRing.setLatLng(ll).setRadius(p.coords.accuracy || 50); meDot.setLatLng(ll); }
  if (zoomTo) map.setView(ll, Math.max(map.getZoom(), 10)); }
function locate(zoomTo) { if (!navigator.geolocation) return; $('locBtn').classList.add('busy');
  navigator.geolocation.getCurrentPosition(p => { $('locBtn').classList.remove('busy'); $('locBtn').classList.add('on'); showMe(p, zoomTo); }, () => { $('locBtn').classList.remove('busy'); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }); }
$('locBtn').onclick = () => locate(true);
const q = $('q'), sug = $('sug');
q.oninput = () => { const t = q.value.trim().toLowerCase(); sug.innerHTML = ''; if (t.length < 2) { sug.classList.remove('on'); return; }
  const res = [];
  Object.entries(STATES).forEach(([k, n]) => { if (n.toLowerCase().startsWith(t) || k.toLowerCase() === t) res.push({ n, s: t('state'), go: () => { const rs = S.reefs.filter(r => r.st === k); if (rs.length) map.fitBounds(L.latLngBounds(rs.map(r => [r.lat, r.lon])).pad(.1)); } }); });
  CITIES.forEach(([n, la, lo]) => { if (n.toLowerCase().includes(t)) res.push({ n, s: t('city'), go: () => map.setView([la, lo], 10) }); });
  S.reefs.forEach(r => { if (res.length < 12 && (r.name || '').toLowerCase().includes(t)) res.push({ n: r.name, s: r.st + (r.depth ? ` · ${f0(r.depth)} ft` : ''), go: () => { map.setView([r.lat, r.lon], 13); openReef(r); } }); });
  res.slice(0, 10).forEach(x => { const b = document.createElement('button'); b.innerHTML = `<b>${esc(x.n)}</b><span>${esc(x.s)}</span>`; b.onclick = () => { sug.classList.remove('on'); q.value = ''; q.blur(); x.go(); }; sug.appendChild(b); });
  sug.classList.toggle('on', res.length > 0); };
q.onblur = () => setTimeout(() => sug.classList.remove('on'), 200);

// ---------- reef sheet ----------
function weekHTML(fc, cl) { return `<div class="week">` + S.days.map((k, i) => { const s = dayStats(fc, k); const c = s ? overall(verdicts(s, i <= 1 ? cl : null)) : null; return `<button class="${i === S.day ? 'sel' : ''}" data-day="${i}">${i === 0 ? t('Now') : t(DOW[dowOf(k)])}<em>${+k.slice(8)}</em><i class="${c == null ? '' : 'c' + c}"></i></button>`; }).join('') + '</div>'; }
async function openReef(r) {
  if (S.reef && S.reef.m) S.reef.m.setIcon(mkIcon(reefClass(S.reef), false)); S.reef = r; r.m.setIcon(mkIcon(reefClass(r), true));
  const sh = $('sheet'), el = $('sheetIn'); sh.classList.add('on'); $('area').hidden = true;
  el.innerHTML = `<div class="hero"><div class="eyebrow">${esc(r.st)} · ${esc(r.src)}</div><h1>${esc(r.name || r.id)}</h1><p class="lead muted">${t('Loading forecast…')}</p><button class="x" id="xBtn" aria-label="${t('Close')}">×</button></div>`;
  $('xBtn').onclick = closeReef;
  try {
    const [fc, zone, tst] = await Promise.all([forecastAt(r.lat, r.lon), zoneAt(r.lat, r.lon), Promise.resolve(nearestTide(r.lat, r.lon))]);
    const [cwf, td] = await Promise.all([zone ? cwfFor(zone.office) : null, tidesFor(tst)]);
    if (S.reef !== r) return; renderReef(r, fc, zone, cwf, tst, td);
  } catch (e) { el.querySelector('.lead').textContent = t('Could not load the forecast. Check your connection.'); }
}
function renderReef(r, fc, zone, cwf, tst, td) {
  const key = S.days[S.day]; const s = dayStats(fc, key); const el = $('sheetIn');
  if (!s) { el.innerHTML = `<div class="hero"><h1>${esc(r.name)}</h1><p class="lead">${t('No forecast for this day.')}</p><button class="x" id="xBtn">×</button></div>`; $('xBtn').onclick = closeReef; return; }
  const cl = clarity(r); const v = verdicts(s, S.day <= 1 ? cl : null); const hc = overall(v); const z = zoneBlock(cwf, zone ? zone.id : ''); const dn = DOW_EN[dowOf(key)];
  const per = z ? z.periods.filter(p => S.day === 0 ? /TODAY|THIS AFTERNOON|TONIGHT/.test(p.name) : p.name === dn || p.name === dn + ' NIGHT') : [];
  const tides = td.filter(p => p.t.startsWith(key)).map(p => { const [hh, mm] = p.t.slice(11, 16).split(':').map(Number); const w = x => `${String(((hh + x) + 24) % 24).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; return { h: p.t.slice(11, 16), type: t(p.type === 'H' ? 'High' : 'Low'), slack: `${w(-1)}–${w(1)}` }; });
  const g = fc.g, e = fc.e, m = fc.m; const mi = {}; m.time.forEach((t, i) => mi[t] = i); let rows = '';
  g.time.forEach((t, i) => { const hh = +t.slice(11, 13); if (!t.startsWith(key) || hh < 5 || hh > 21) return; const j = mi[t]; rows += `<tr class="${hh >= s.wa && hh <= s.wb ? 'inwin' : ''}"><td>${hh}:00</td><td>${f0(g.wind_speed_10m[i])} / ${f0(e.wind_speed_10m[i])} ${dirTxt(g.wind_direction_10m[i])}</td><td>${f0(Math.max(g.wind_gusts_10m[i] ?? 0, e.wind_gusts_10m[i] ?? 0))}</td><td>${j != null && m.wave_height[j] != null ? f1(m.wave_height[j] * M2FT) + ' ft / ' + f0(m.wave_period[j]) + ' s' : '—'}</td></tr>`; });
  const meta = [r.depth ? t('{d} ft deep', { d: f0(r.depth) }) : null, r.relief ? t('{r} ft relief', { r: f0(r.relief) }) : null, r.mat, r.date && !/^00/.test(r.date) ? t('deployed {d}', { d: r.date }) : null].filter(Boolean).join(' · ');
  el.innerHTML = `
    <div class="hero v${hc}"><div class="eyebrow">${esc(r.st)} · ${dayName(key)} · ${esc(winLabel(fc, key))}</div><h1>${headline(v)}</h1><p class="lead">${lead(s, v, z, fc)}</p>
      <div class="two"><div><b>${t('Go')}</b><span class="t${v.ride}">${t(RIDE_TXT[v.ride])}</span></div><div><b>${secName()}</b><span class="t${v.dive}">${t(secTxt()[v.dive])}</span></div></div>
      <div class="facts"><div><b>${f0(s.windAvg)} kt</b><small>${t('wind {dir}', { dir: dirTxt(s.dir) })}</small></div><div><b>${f0(s.gust)} kt</b><small>${t('gusts')}</small></div><div><b>${f1((s.wave || 0) * M2FT)} ft</b><small>${t('seas · {p} s', { p: f0(s.period) })}</small></div><div><b>${f0(F(s.sst))}°</b><small>${t('water °F')}</small></div></div>
      <button class="x" id="xBtn" aria-label="${t('Close')}">×</button></div>
    ${weekHTML(fc, cl)}
    <div class="wins">${Object.entries(WIN).map(([k, w]) => `<button class="${k === S.win ? 'on' : ''}" data-win="${k}">${t(w[0])}</button>`).join('')}</div>
    <div class="card"><h3>${esc(r.name || r.id)}</h3><p style="margin:0;font-size:14px">${esc(r.desc || '')}${meta ? `<br><span class="muted">${esc(meta)}</span>` : ''}</p></div>
    ${buoyHTML(r.lat, r.lon)}
    ${S.act === 'fish' ? '' : clarityHTML(r, fc)}
    ${v.why.length ? `<div class="card"><h3>${t('Why this verdict')}</h3><ul class="why">${v.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
    ${biteHTML(r, fc, key, s, tst, td)}
    ${fishHTML(r, key, s)}
    ${S.act === 'fish' ? clarityHTML(r, fc) : ''}
    ${tides.length ? `<div class="card"><h3>${t('Tide · {st}', { st: esc(tst.n) })}</h3><div class="kv">${tides.map(x => `<span>${x.type} ${x.h}</span><b>${t('slack {w}', { w: x.slack })}</b>`).join('')}</div><p class="muted" style="margin:6px 0 0;font-size:12px">${t('Slack water is the easy window to launch and retrieve.')}</p></div>` : ''}
    <details><summary>${t('Hour by hour')}</summary><div class="d"><table><tr><th>${t('Hour')}</th><th>${t('Wind, US / EU model')}</th><th>${t('Gusts')}</th><th>${t('Seas')}</th></tr>${rows}</table><p class="muted" style="font-size:12px">${t('Knots. Two weather models, the American GFS and the European ECMWF; the worse one drives the verdict. Highlighted rows are your {win} window. Air {t}°F, rain {r}%.', { win: esc(winLabel(fc, key)), t: f0(F(s.tmax)), r: f0(s.rain) })}</p></div></details>
    ${z ? `<details><summary>${t('Official NWS forecast · {z}', { z: esc(zone.id) })}</summary><div class="d">${z.sca ? `<p style="margin:0 0 8px;color:var(--no);font-weight:700">${esc(z.sca)}</p>` : ''}<pre class="cwf">${esc(per.length ? per.map(p => p.name + ': ' + p.text).join('\n\n') : t('This day is not yet in the NWS marine forecast.'))}</pre><p class="muted" style="font-size:12px">${esc(zone.name)}</p></div></details>` : ''}
    <div class="row"><button class="btn" id="satGo">${t('Satellite view')}</button><a class="btn" target="_blank" rel="noopener" href="https://maps.apple.com/?ll=${r.lat},${r.lon}&q=${encodeURIComponent(r.name || 'Reef')}">${t('Open in Maps')}</a></div>
    <p class="muted" style="font-size:11px;text-align:center;margin:0">${t('Forecast estimate. Conditions can differ on site. Not for navigation.')} ${r.lat.toFixed(4)}, ${r.lon.toFixed(4)}</p>`;
  $('xBtn').onclick = closeReef;
  el.querySelectorAll('[data-win]').forEach(b => b.onclick = () => { S.win = b.dataset.win; try { localStorage.setItem('rg.win', S.win); } catch (e) {} renderReef(r, fc, zone, cwf, tst, td); S.area = null; S.areaKey = ''; colorReefs(); });
  el.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { S.day = +b.dataset.day; renderReef(r, fc, zone, cwf, tst, td); S.area = null; S.areaKey = ''; colorReefs(); });
  const more = el.querySelector('[data-more]'); if (more) more.onclick = () => { el.querySelector('.fl.more').hidden = false; more.remove(); };
  $('satGo').onclick = () => { closeReef(); map.setView([r.lat, r.lon], Math.max(map.getZoom(), 9)); toggleSat(true); };
}
function closeReef() { $('sheet').classList.remove('on'); if (S.reef && S.reef.m) S.reef.m.setIcon(mkIcon(reefClass(S.reef), false)); S.reef = null; updateArea(); }
$('grip').onclick = closeReef;
map.on('click', () => { if ($('sheet').classList.contains('on')) closeReef(); });

// ---------- next window + alerts ----------
// best day ahead: first green day, else the first yellow; cls tells which
function nextWindow(fc) { let best = null; for (let i = 1; i < S.days.length; i++) { const st = dayStats(fc, S.days[i]); if (!st) continue; const v = verdicts(st); const c = overall(v); if (c === 0) return { key: S.days[i], s: st, v, cls: 0 }; if (c === 1 && !best) best = { key: S.days[i], s: st, v, cls: 1 }; } return best; }
function notifyOn() { try { return localStorage.getItem('rg.notify') === '1'; } catch (e) { return false; } }
function maybeNotify(nx, c) {
  if (!notifyOn() || !('Notification' in window) || Notification.permission !== 'granted') return;
  const tag = nx.key + '@' + c.lat.toFixed(1) + ',' + c.lng.toFixed(1); let last = null; try { last = localStorage.getItem('rg.notified'); } catch (e) {}
  if (last === tag) return; try { localStorage.setItem('rg.notified', tag); } catch (e) {}
  try { new Notification(t('ReefGo: window opens {day}', { day: dayName(nx.key) }), { body: t('{h}. Wind {w} kt, seas {s} ft.', { h: headline(nx.v), w: f0(nx.s.windAvg), s: f1((nx.s.wave || 0) * M2FT) }), icon: 'icon.svg', tag }); } catch (e) {}
}
function buildNotify() { const cb = $('notifyOn'); const ok = 'Notification' in window; cb.disabled = !ok; cb.checked = ok && notifyOn() && Notification.permission === 'granted';
  $('notifyHint').classList.toggle('warn', !ok);
  if (!ok) $('notifyHint').textContent = t('Alerts are off in this browser. On iPhone they work only from the Home Screen: tap Share in Safari, choose “Add to Home Screen”, then open ReefGo from that icon and turn this on.');
  cb.onchange = async () => { if (cb.checked) { const p = await Notification.requestPermission(); if (p !== 'granted') { cb.checked = false; return; } try { localStorage.setItem('rg.notify', '1'); } catch (e) {} S.areaKey = ''; updateArea(); } else { try { localStorage.setItem('rg.notify', '0'); } catch (e) {} } }; }

// ---------- night mode ----------
// Auto: dark from sunset to sunrise at the map center (NOAA sunrise equation, no network); or forced light / dark.
const THEMES = { auto: 'Auto (sunset)', light: 'Light', dark: 'Dark' };
S.theme = 'auto'; try { S.theme = THEMES[localStorage.getItem('rg.theme')] ? localStorage.getItem('rg.theme') : 'auto'; } catch (e) {}
function sunTimes(lat, lon, date) { // returns [sunriseUTCh, sunsetUTCh] in fractional hours, or null in polar cases
  const rad = Math.PI / 180, d0 = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()); const n = (d0 - Date.UTC(2000, 0, 1, 12)) / 864e5;
  const M = (357.5291 + 0.98560028 * n) % 360, C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lam = (M + C + 180 + 102.9372) % 360, dec = Math.asin(Math.sin(lam * rad) * Math.sin(23.4397 * rad));
  const cosH = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(dec)) / (Math.cos(lat * rad) * Math.cos(dec)); if (cosH < -1 || cosH > 1) return null;
  const H = Math.acos(cosH) / rad; const eot = 7.53 * Math.cos(M * rad) + 1.5 * Math.sin(M * rad) - 2.5 * Math.sin(2 * lam * rad); // minutes, approx
  const noon = 12 - lon / 15 - eot / 60; return [noon - H / 15, noon + H / 15];
}
function isNight() { const c = map.getCenter(); const now = new Date(); const st = sunTimes(c.lat, c.lng, now); if (!st) return false; const h = now.getUTCHours() + now.getUTCMinutes() / 60; const [r, s] = st.map(x => ((x % 24) + 24) % 24); return r < s ? (h < r || h > s) : (h > s && h < r); }
function applyTheme() { const t = S.theme === 'auto' ? (isNight() ? 'dark' : 'light') : S.theme; document.documentElement.dataset.theme = t; const m = document.querySelector('meta[name=theme-color]:not([media])'); if (m) m.content = t === 'dark' ? '#0b1620' : '#f4f7f9'; }
function buildTheme() { const el = $('theme'); el.innerHTML = ''; Object.entries(THEMES).forEach(([k, n]) => { const b = document.createElement('button'); b.textContent = t(n); b.className = k === S.theme ? 'on' : ''; b.onclick = () => { S.theme = k; try { localStorage.setItem('rg.theme', k); } catch (e) {} buildTheme(); applyTheme(); }; el.appendChild(b); }); }
applyTheme(); setInterval(applyTheme, 5 * 60e3); map.on('moveend', applyTheme);

// activity profile
function buildAct() { const el = $('act'); el.innerHTML = ''; Object.entries(ACT).forEach(([k, n]) => { const b = document.createElement('button'); b.textContent = t(n); b.className = k === S.act ? 'on' : ''; b.onclick = () => { S.act = k; try { localStorage.setItem('rg.act', k); } catch (e) {} buildAct(); S.area = null; S.areaKey = ''; closeReef(); colorReefs(); $('solunarRow').hidden = k !== 'fish'; }; el.appendChild(b); }); $('solunarRow').hidden = S.act !== 'fish';
  const cb = $('solunarOn'); cb.checked = S.solunar; cb.onchange = () => { S.solunar = cb.checked; try { localStorage.setItem('rg.solunar', cb.checked ? '1' : '0'); } catch (e) {} }; }

// settings
function buildVessel() { const el = $('vessel'); el.innerHTML = ''; Object.entries(VESSELS).forEach(([k, v]) => { const b = document.createElement('button'); b.textContent = t(v[0]); b.className = k === S.vessel ? 'on' : ''; b.onclick = () => { S.vessel = k; try { localStorage.setItem('rg.vessel', k); } catch (e) {} buildVessel(); S.area = null; S.areaKey = ''; updateArea(); colorReefs(); }; el.appendChild(b); }); }
const LANGS = { en: 'English', es: 'Español' };
function buildLang() { const el = $('lang'); el.innerHTML = ''; Object.entries(LANGS).forEach(([k, n]) => { const b = document.createElement('button'); b.textContent = n; b.className = k === S.lang ? 'on' : ''; b.onclick = () => { try { localStorage.setItem('rg.lang', k); } catch (e) {} location.reload(); }; el.appendChild(b); }); }
// static page text: every [data-i18n] element keeps its English innerHTML as the key
function applyStatic() { document.querySelectorAll('[data-i18n]').forEach(el => { const k = el.dataset.en || (el.dataset.en = el.innerHTML.trim()); el.innerHTML = t(k); }); document.querySelectorAll('[data-i18n-attr]').forEach(el => { const [a, k] = el.dataset.i18nAttr.split('|'); el.setAttribute(a, t(k)); }); }
applyStatic();
$('setBtn').onclick = () => { buildAct(); buildVessel(); buildTheme(); buildNotify(); buildLang(); $('settings').classList.add('on'); };
$('setClose').onclick = () => $('settings').classList.remove('on');
$('settings').onclick = e => { if (e.target === $('settings')) $('settings').classList.remove('on'); };

// ---------- onboarding ----------
function buildOnbVessel() { const el = $('onbVessel'); el.innerHTML = ''; Object.entries(VESSELS).forEach(([k, v]) => { const b = document.createElement('button'); b.textContent = t(v[0]); b.className = k === S.vessel ? 'on' : ''; b.onclick = () => { S.vessel = k; try { localStorage.setItem('rg.vessel', k); } catch (e) {} buildOnbVessel(); }; el.appendChild(b); }); }
function onbStep(n) { document.querySelectorAll('#onb .step').forEach(s => s.classList.toggle('on', +s.dataset.step === n)); $('onb').scrollTop = 0; }
function showOnb() { buildOnbVessel(); onbStep(0); $('onb').classList.add('on'); }
function endOnb() { $('onb').classList.remove('on'); try { localStorage.setItem('rg.onb', '1'); } catch (e) {} S.area = null; S.areaKey = ''; updateArea(); colorReefs(); }
document.querySelectorAll('#onb [data-next]').forEach(b => b.onclick = () => onbStep(+b.dataset.next));
$('onbLoc').onclick = () => { if (!navigator.geolocation) { onbStep(2); return; } $('onbLoc').textContent = t('Finding you…');
  navigator.geolocation.getCurrentPosition(p => { showMe(p, true); $('locBtn').classList.add('on'); onbStep(2); }, () => { $('onbLoc').textContent = t('Location unavailable. Continue'); $('onbLoc').onclick = () => onbStep(2); }, { timeout: 8000 }); };
$('onbDone').onclick = endOnb;
$('setIntro').onclick = () => { $('settings').classList.remove('on'); showOnb(); };
let onbDue = false; try { onbDue = !localStorage.getItem('rg.onb'); } catch (e) {}

(async () => {
  const t = todayKey(); S.days = Array.from({ length: 7 }, (_, i) => addDays(t, i));
  const [reefs, tides, nd, fish, kd] = await Promise.all([getJSON('reefs.json'), getJSON('tides.json').catch(() => []), getJSON('ndbc.json?' + Date.now()).catch(() => null), getJSON('data/fish.json').catch(() => null), getJSON('kd.json?' + Date.now()).catch(() => null)]);
  S.fish = fish; S.kd = kd;
  S.tides = tides; S.buoys = nd ? nd.stations : []; loadReefs(reefs); if (onbDue) showOnb(); else { updateArea(); colorReefs(); }
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
