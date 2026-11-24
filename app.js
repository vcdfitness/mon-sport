import { db, uid } from './db.js';
import { GROUPS, MUSCLES, SESSION_TYPES, EXERCISES } from './seed.js';
import { computeScore, suggest, applySuggestion, e1rm, scoreLabel } from './score.js';
import { ACTIVITY, GOALS, MEALS, profileErrors, computeTargets, waterTarget, dayKey, keyToDate, addDays, scale, entryMacros, sumMacros, BUILTIN_FOODS, searchFoods, offUrl, offToFood, mealTarget, roleOf, buildPlate, prepIdeas, aiPrompt } from './nutrition.js';

const APP_VERSION = '1.2.0';

// ---------- État ----------
const S = {
  exercises: [], exMap: {}, muscles: [], mMap: {}, videos: [], templates: [], sessions: [],
  active: null, draft: null, sheet: null, timer: null,
  ui: { libMode: 'muscle', libGroup: 'Jambes', libType: 'leg', libQuery: '', expanded: {} },
};

// ---------- Utilitaires ----------
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtNum = (n) => (Math.round((Number(n) || 0) * 10) / 10).toString().replace('.', ',');
const parseNum = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const dFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const dShort = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n, w) => `${fmtNum(n)} ${w}${n > 1 ? 's' : ''}`;

const I = {
  play: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>',
  plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  down: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  up: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>',
  check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
  x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>',
  gear: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  star: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
  link: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/></svg>',
  home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11l8-7 8 7v9H4z"/></svg>',
  dumbbell: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 12h2M19 12h2M7 8v8M17 8v8M7 12h10"/></svg>',
  video: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="4"/><path d="M10 9l5 3-5 3z"/></svg>',
  food: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3v8a3 3 0 0 0 3 3v7M7 3v5M10 3v5M17 3c-2 2-2 6 0 8v10"/></svg>',
  chart: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 18l5-6 4 3 7-9"/></svg>',
};

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg; t.setAttribute('role', 'status');
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

function ring(score, size = 80) {
  const r = size / 2 - 6; const c = 2 * Math.PI * r; const v = Math.max(0, Math.min(100, score)) / 100 * c;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Efficacité ${score} %">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#E6EEFF" stroke-width="9"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#3D6FD8" stroke-width="9" stroke-linecap="round" stroke-dasharray="${v} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="#2E2547" font-size="${size / 4.2}" font-weight="700" font-family="Quicksand, sans-serif">${score} %</text></svg>`;
}

// ---------- Vidéos ----------
function platformOf(url) {
  const u = String(url || '').toLowerCase();
  if (u.includes('instagram.')) return 'Instagram';
  if (u.includes('tiktok.')) return 'TikTok';
  if (u.includes('youtu')) return 'YouTube';
  if (u.includes('pinterest.') || u.includes('pin.it')) return 'Pinterest';
  if (u.includes('facebook.') || u.includes('fb.watch')) return 'Facebook';
  return 'Lien';
}
function ytId(url) {
  const m = String(url || '').match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
function thumbHtml(v, cls = '') {
  const id = v && ytId(v.url);
  if (id) return `<span class="thumb ${cls}"><img src="https://i.ytimg.com/vi/${id}/mqdefault.jpg" alt="" loading="lazy"></span>`;
  return `<span class="thumb ${cls}">${I.play}</span>`;
}
const isUrl = (s) => /^https?:\/\/\S+$/i.test(String(s || '').trim());
const videosOf = (exId) => S.videos.filter((v) => v.exerciseId === exId).sort((a, b) => (b.ref ? 1 : 0) - (a.ref ? 1 : 0));
const inbox = () => S.videos.filter((v) => !v.exerciseId);

// ---------- Historique et records ----------
function sortedSessions() { return [...S.sessions].sort((a, b) => (b.start || '').localeCompare(a.start || '')); }
function performances(exId) {
  const out = [];
  for (const s of sortedSessions()) {
    for (const e of s.entries || []) {
      if (e.exerciseId !== exId) continue;
      const sets = (e.sets || []).filter((x) => x.done && x.type !== 'warmup');
      if (sets.length) out.push({ session: s, sets });
    }
  }
  return out;
}
function records(exId) {
  let maxKg = 0; let best = 0;
  const perf = performances(exId);
  for (const p of perf) for (const st of p.sets) { maxKg = Math.max(maxKg, Number(st.kg) || 0); best = Math.max(best, e1rm(st.kg, st.reps)); }
  return { maxKg, best, count: perf.length };
}
const setsText = (sets) => {
  const kgs = [...new Set(sets.map((s) => fmtNum(s.kg)))];
  if (kgs.length === 1) return `${kgs[0]} kg × ${sets.map((s) => s.reps).join(', ')}`;
  return sets.map((s) => `${fmtNum(s.kg)}×${s.reps}`).join(', ');
};
function lastDone(templateId) {
  const s = sortedSessions().find((x) => x.templateId === templateId);
  return s ? s.start : null;
}
function relDay(iso) {
  if (!iso) return 'jamais faite';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "aujourd'hui";
  if (d === 1) return 'hier';
  if (d < 7) return `il y a ${d} jours`;
  return `le ${dShort.format(new Date(iso))}`;
}
function templateScore(t) { return computeScore(t.lines || [], S.exMap, S.mMap, t.targets, t.targetMinutes); }

// ---------- Chargement ----------
async function load() {
  if (!(await db.getSetting('seeded'))) {
    await db.putMany('muscles', MUSCLES.map((m) => ({ ...m })));
    await db.putMany('exercises', EXERCISES.map((e) => ({ ...e })));
    await db.setSetting('seeded', APP_VERSION);
  }
  [S.exercises, S.muscles, S.videos, S.templates, S.sessions, S.customFoods, S.journal, S.weights, S.daily, S.recipes] = await Promise.all(
    ['exercises', 'muscles', 'videos', 'templates', 'sessions', 'foods', 'journal', 'weights', 'daily', 'recipes'].map((s) => db.all(s)));
  S.foods = [...S.customFoods, ...BUILTIN_FOODS];
  S.foodMap = Object.fromEntries(S.foods.map((f) => [f.id, f]));
  S.weights.sort((a, b) => a.date.localeCompare(b.date));
  S.profile = await db.getSetting('profile');
  S.favs = await db.getSetting('favs', []);
  S.dayTypes = await db.getSetting('dayTypes', {});
  S.fridge = await db.getSetting('fridge', []);
  const order = MUSCLES.map((m) => m.id);
  const rank = (id) => { const i = order.indexOf(id); return i < 0 ? 999 : i; };
  S.muscles.sort((a, b) => rank(a.id) - rank(b.id));
  S.exMap = Object.fromEntries(S.exercises.map((e) => [e.id, e]));
  S.mMap = Object.fromEntries(S.muscles.map((m) => [m.id, m]));
  S.active = await db.getSetting('active');
  S.lastBackup = await db.getSetting('lastBackup');
}
async function reload() { await load(); render(); }
function saveActive() { return db.setSetting('active', S.active); }

// ---------- Routage ----------
function route() {
  const h = location.hash.replace(/^#\/?/, '') || 'aujourdhui';
  const [path, query] = h.split('?');
  const parts = path.split('/');
  return { name: parts[0], id: parts[1] ? decodeURIComponent(parts[1]) : null, query: new URLSearchParams(query || '') };
}
const go = (h) => { location.hash = h; };

function render() {
  const r = route();
  const views = { aujourdhui: vToday, seances: vSeances, exercices: vLibrary, exercice: vExercise, seance: vTemplate, encours: vActive, bilan: vSummary, reglages: vSettings, nutrition: vNutrition, profil: vProfile, corps: vCorps, idees: vIdeas, atester: vATester, recette: vRecipe };
  const v = views[r.name] || vToday;
  $('#app').innerHTML = v(r);
  $('#nav').innerHTML = nav(r.name);
  renderSheet();
  renderTimer();
  afterRender();
}

function nav(name) {
  const tab = { aujourdhui: 'a', seances: 's', seance: 's', encours: 's', bilan: 's', exercices: 'e', exercice: 'e', nutrition: 'n', profil: 'n', idees: 'n', atester: 'n', recette: 'n', corps: 'c', reglages: 'a' }[name] || 'a';
  const it = (k, href, icon, label, pink) => `<a href="#/${href}" class="${tab === k ? 'on' : ''} ${pink ? 'pinkon' : ''}" ${tab === k ? 'aria-current="page"' : ''}>${icon}${label}</a>`;
  return it('a', 'aujourdhui', I.home, "Aujourd'hui") + it('s', S.active ? 'encours' : 'seances', I.dumbbell, 'Séance') + it('e', 'exercices', I.video, 'Exercices') + it('n', 'nutrition', I.food, 'Nutrition', true) + it('c', 'corps', I.chart, 'Corps');
}

// ---------- Vue : Aujourd'hui ----------
function nextTemplate() {
  if (!S.templates.length) return null;
  return [...S.templates].sort((a, b) => (lastDone(a.id) || '').localeCompare(lastDone(b.id) || ''))[0];
}
function vToday() {
  const now = new Date();
  const weekStart = new Date(now); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const week = S.sessions.filter((s) => new Date(s.start) >= weekStart).length;
  const t = nextTemplate();
  const inb = inbox().length;
  const needBackup = S.sessions.length > 0 && (!S.lastBackup || Date.now() - new Date(S.lastBackup).getTime() > 7 * 86400000);
  let main;
  if (S.active) {
    const done = S.active.entries.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
    main = `<div class="card blue"><span class="pill" style="align-self:flex-start;background:#fff">Séance en cours</span>
      <h2>${esc(S.active.name)}</h2><span class="small">${plural(done, 'série')} validée${done > 1 ? 's' : ''}</span>
      <a class="btn" href="#/encours">${I.play} Reprendre</a></div>`;
  } else if (t) {
    const sc = templateScore(t);
    main = `<div class="card blue">
      <div class="between"><span class="pill" style="background:#fff">Séance du jour</span>
        <a class="pill" href="#/seance/${t.id}" style="background:#fff;color:var(--ink)">Efficacité ${sc.score} %</a></div>
      <div class="col" style="gap:2px"><h2>${esc(t.name)}</h2>
        <span class="small" style="color:var(--ink-2)">${t.lines.length} exercices · ${t.lines.reduce((a, l) => a + (Number(l.sets) || 0), 0)} séries · ~${sc.minutes} min · ${relDay(lastDone(t.id))}</span></div>
      <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:8px">
        <button class="btn" data-act="start" data-id="${t.id}">${I.play} Démarrer</button>
        <a class="btn white" href="#/seance/new" style="white-space:nowrap;padding:0 10px">${I.plus} Créer</a></div>
      ${S.templates.length > 1 ? '<a class="small bold" href="#/seances">Choisir une autre séance →</a>' : ''}</div>`;
  } else {
    main = `<div class="card blue"><h2>Bienvenue !</h2>
      <span class="small" style="color:var(--ink-2)">Commence par créer ta première séance : choisis tes exercices, l'app calcule son efficacité.</span>
      <a class="btn" href="#/seance/new">${I.plus} Créer ma séance</a>
      <button class="btn white" data-act="startFree">Séance libre</button></div>`;
  }
  const k = dayKey(); const tg = targetsFor(k); const tot = sumMacros(entriesOf(k));
  const ws = weightStats(); const water = waterOf(k); const wt = waterTarget(currentWeight());
  const nutri = tg ? `<a class="card" href="#/nutrition" style="color:var(--ink)">
      <div class="between"><span class="pill pink">Nutrition</span><span class="tiny muted">${isTrainDay(k) ? "jour d'entraînement" : 'jour de repos'}</span></div>
      ${kcalBlock(tot, tg)}${macroBars(tot, tg)}</a>`
    : `<a class="card pink" href="#/profil"><span class="bold">Calcule tes besoins</span><span class="small" style="color:var(--pink-deep)">1 minute pour obtenir tes calories et tes macros du jour.</span></a>`;
  return `
  <div class="between"><div class="col" style="gap:2px"><span class="small muted">${cap(dFmt.format(now))}</span><h1>Bonjour !</h1></div>
    <a class="icon-btn" href="#/reglages" aria-label="Réglages et sauvegarde">${I.gear}</a></div>
  ${main}
  ${nutri}
  <div class="stat-grid">
    <a class="stat" href="#/corps" style="color:var(--ink)"><span class="tiny muted">Poids (moy. 7 j)</span><b>${ws.now != null ? fmtNum(ws.now) + ' kg' : '—'}</b></a>
    <a class="stat" href="#/nutrition" style="color:var(--ink)"><span class="tiny muted">Eau</span><b>${fmtNum(water / 1000)} / ${fmtNum(wt / 1000)} L</b></a>
    <div class="stat"><span class="tiny muted">Cette semaine</span><b>${plural(week, 'séance')}</b></div>
  </div>
  ${inb ? `<button class="list-item" data-act="openInbox"><span class="thumb pink">${I.video}</span><span class="grow"><span class="li-title">${plural(inb, 'vidéo')} à ranger</span><br><span class="li-sub">Rattache-les à un exercice</span></span>${I.next}</button>` : ''}
  <button class="list-item" data-act="pasteVideo"><span class="thumb">${I.link}</span><span class="grow"><span class="li-title">Coller un lien vidéo</span><br><span class="li-sub">Copié depuis Instagram, TikTok ou YouTube</span></span>${I.plus}</button>
  ${needBackup ? `<a class="card pink" href="#/reglages"><span class="bold">Pense à sauvegarder</span><span class="small" style="color:var(--pink-deep)">${S.lastBackup ? 'Dernière sauvegarde ' + relDay(S.lastBackup) : 'Aucune sauvegarde pour le moment'} — 10 secondes dans Réglages.</span></a>` : ''}`;
}

// ---------- Vue : Séances ----------
function vSeances() {
  const tpl = S.templates.map((t) => {
    const sc = templateScore(t);
    return `<div class="card flat" style="gap:10px">
      <div class="between"><div class="col" style="gap:2px"><h3>${esc(t.name)}</h3><span class="tiny muted">${t.lines.length} exercices · ~${sc.minutes} min · ${relDay(lastDone(t.id))}</span></div>
        <span class="pill">${sc.score} %</span></div>
      <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:8px"><button class="btn small" data-act="start" data-id="${t.id}">${I.play} Démarrer</button><a class="btn small soft" href="#/seance/${t.id}">Modifier</a></div></div>`;
  }).join('');
  const hist = sortedSessions().slice(0, 15).map((s) => {
    const n = s.entries.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
    return `<a class="list-item" href="#/bilan/${s.id}"><span class="thumb">${I.dumbbell}</span><span class="grow"><span class="li-title">${esc(s.name)}</span><br><span class="li-sub">${cap(dFmt.format(new Date(s.start)))} · ${n} séries</span></span>${I.next}</a>`;
  }).join('');
  return `<h1>Séances</h1>
    ${S.active ? `<a class="card blue" href="#/encours"><span class="bold">Séance en cours : ${esc(S.active.name)}</span><span class="small">Touchez pour reprendre</span></a>` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><a class="btn" href="#/seance/new">${I.plus} Créer</a><button class="btn white" data-act="startFree">Séance libre</button></div>
    <span class="label">Mes séances</span>
    ${tpl || '<div class="empty">Aucune séance enregistrée pour le moment.</div>'}
    <span class="label">Historique</span>
    ${hist || '<div class="empty">Tes séances terminées apparaîtront ici.</div>'}`;
}

// ---------- Vue : Bibliothèque ----------
function exRow(e, opts = {}) {
  const vids = videosOf(e.id);
  const rec = records(e.id);
  const act = opts.pick ? `data-act="pick" data-id="${e.id}"` : `data-act="openEx" data-id="${e.id}"`;
  return `<button class="list-item" ${act}>${thumbHtml(vids[0], opts.pink ? 'pink' : '')}
    <span class="grow"><span class="li-title">${esc(e.name)}</span><br><span class="li-sub">${esc(e.equipment)} · ${vids.length ? plural(vids.length, 'vidéo') : 'pas de vidéo'}</span></span>
    ${rec.maxKg ? `<span class="small bold blue" style="padding-right:6px">${fmtNum(rec.maxKg)} kg</span>` : ''}${opts.pick ? `<span class="pill">Choisir</span>` : ''}</button>`;
}
function libraryBody(opts = {}) {
  const q = S.ui.libQuery.trim().toLowerCase();
  if (q) {
    const res = S.exercises.filter((e) => e.name.toLowerCase().includes(q) || e.primary.some((m) => (S.mMap[m]?.name || '').toLowerCase().includes(q)));
    return res.length ? `<div class="col">${res.map((e) => exRow(e, opts)).join('')}</div>` : '<div class="empty">Aucun exercice trouvé.</div>';
  }
  let muscleIds;
  if (S.ui.libMode === 'muscle') muscleIds = S.muscles.filter((m) => m.group === S.ui.libGroup).map((m) => m.id);
  else muscleIds = (SESSION_TYPES.find((t) => t.id === S.ui.libType) || SESSION_TYPES[0]).muscles;
  return muscleIds.map((mid, idx) => {
    const m = S.mMap[mid]; if (!m) return '';
    const list = S.exercises.filter((e) => e.primary.includes(mid)).sort((a, b) => (a.type === 'poly' ? 0 : 1) - (b.type === 'poly' ? 0 : 1) || a.name.localeCompare(b.name));
    const key = S.ui.libMode + ':' + mid;
    const open = S.ui.expanded[key] ?? idx < 2;
    const shown = open ? list : [];
    return `<div class="col">
      <button class="between" data-act="toggleSec" data-key="${key}" style="border:0;background:transparent;padding:4px 0;color:var(--ink)" aria-expanded="${open}">
        <h3>${esc(m.name)}</h3><span class="row"><span class="pill ${idx % 2 ? 'pink' : ''}">${list.length}</span>${open ? I.up : I.down}</span></button>
      ${shown.map((e) => exRow(e, { ...opts, pink: idx % 2 === 1 })).join('')}</div>`;
  }).join('');
}
function libraryControls(prefix = '') {
  const modeSeg = `<div class="seg"><button class="${S.ui.libMode === 'muscle' ? 'on' : ''}" data-act="libMode" data-v="muscle">Par muscle</button><button class="${S.ui.libMode === 'type' ? 'on' : ''}" data-act="libMode" data-v="type">Par séance</button></div>`;
  const chips = S.ui.libMode === 'muscle'
    ? GROUPS.map((g) => `<button class="chip ${S.ui.libGroup === g ? 'on' : ''}" data-act="libGroup" data-v="${g}">${g} · ${S.exercises.filter((e) => e.primary.some((p) => S.mMap[p]?.group === g)).length}</button>`).join('')
    : SESSION_TYPES.map((t) => `<button class="chip ${S.ui.libType === t.id ? 'on' : ''}" data-act="libType" data-v="${t.id}">${t.name}</button>`).join('');
  return `<label class="search">${I.search}<span class="sr">Rechercher</span><input id="${prefix}libq" type="search" placeholder="Rechercher un exercice, un muscle…" value="${esc(S.ui.libQuery)}" data-bind="libQuery" autocomplete="off"></label>
    ${modeSeg}<div class="chips scroll">${chips}</div>`;
}
function vLibrary() {
  const inb = inbox().length;
  return `<div class="between"><h1>Exercices</h1><span class="small muted">${S.exercises.length} exercices · ${S.videos.length} vidéos</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <button class="btn soft" data-act="pasteVideo">${I.link} Coller un lien</button>
      <button class="btn soft-pink" data-act="newExercise">${I.plus} Exercice</button></div>
    ${inb ? `<button class="list-item" data-act="openInbox"><span class="thumb pink">${I.video}</span><span class="grow"><span class="li-title">${plural(inb, 'vidéo')} à ranger</span></span>${I.next}</button>` : ''}
    ${libraryControls()}
    <div id="libbody" class="col" style="gap:14px">${libraryBody()}</div>`;
}

// ---------- Vue : Exercice ----------
function vExercise(r) {
  const e = S.exMap[r.id];
  if (!e) return `<div class="empty">Exercice introuvable.</div><a class="btn" href="#/exercices">Retour</a>`;
  const vids = videosOf(e.id);
  const hero = vids[0];
  const rec = records(e.id);
  const perf = performances(e.id).slice(0, 5);
  const mchips = e.primary.map((m) => `<span class="pill">${esc(S.mMap[m]?.name || m)}</span>`).join('') + (e.secondary || []).map((m) => `<span class="pill grey">${esc(S.mMap[m]?.name || m)}</span>`).join('') + `<span class="pill pink">${esc(e.equipment)}</span>`;
  const heroHtml = hero ? `<a class="video-hero" href="${esc(hero.url)}" target="_blank" rel="noopener">
      ${ytId(hero.url) ? `<img src="https://i.ytimg.com/vi/${ytId(hero.url)}/hqdefault.jpg" alt="">` : ''}
      ${hero.ref ? '<span class="pill pink tag" style="background:var(--pink);color:#fff">Référence</span>' : ''}
      <span class="pill src" style="background:#fff">${esc(hero.platform)}</span><span class="play">${I.play}</span><span class="sr">Ouvrir la vidéo</span></a>
      ${hero.note || hero.at ? `<div class="card flat" style="gap:4px;padding:12px 16px"><span class="tiny bold pink">Ma note${hero.at ? ' · à ' + esc(hero.at) : ''}</span><span class="small">${esc(hero.note)}</span></div>` : ''}` : '';
  const vlist = vids.map((v) => `<div class="list-item" style="align-items:center">${thumbHtml(v, v.ref ? 'pink' : '')}
      <a class="grow" href="${esc(v.url)}" target="_blank" rel="noopener" style="color:var(--ink)"><span class="li-title">${esc(v.title || v.platform)}</span><br><span class="li-sub">${esc(v.platform)}${v.ref ? ' · référence' : ''}${v.note ? ' · ' + esc(v.note.slice(0, 40)) : ''}</span></a>
      <button class="icon-btn" style="background:var(--lilac)" data-act="editVideo" data-id="${v.id}" aria-label="Modifier la vidéo">✎</button></div>`).join('');
  const variants = (e.variants || []).map((id) => S.exMap[id]).filter(Boolean);
  return `<div class="between"><button class="icon-btn" data-act="back" aria-label="Retour">${I.back}</button>
      ${e.custom ? `<button class="btn small white" data-act="editExercise" data-id="${e.id}">Modifier</button>` : ''}</div>
    <div class="col"><h1 style="line-height:1.1">${esc(e.name)}</h1><div class="chips">${mchips}</div></div>
    <div class="between"><span class="label">Vidéos (${vids.length})</span><button class="btn small white" data-act="pasteVideo" data-ex="${e.id}">${I.plus} Coller un lien</button></div>
    ${heroHtml}
    ${vids.length ? `<div class="col">${vlist}</div>` : '<div class="empty" style="padding:12px">Copie le lien d\'une vidéo (Instagram, TikTok, YouTube) puis touche « Coller un lien ».</div>'}
    <span class="label">Mes records</span>
    <div class="stat-grid"><div class="stat"><span class="tiny muted">1RM estimé</span><b>${rec.best ? fmtNum(rec.best) + ' kg' : '—'}</b></div>
      <div class="stat"><span class="tiny muted">Charge max</span><b>${rec.maxKg ? fmtNum(rec.maxKg) + ' kg' : '—'}</b></div>
      <div class="stat"><span class="tiny muted">Séances</span><b>${rec.count}</b></div></div>
    ${perf.length ? `<span class="label">Dernières fois</span><div class="card flat" style="gap:8px">${perf.map((p) => `<div class="between small"><span class="muted">${dShort.format(new Date(p.session.start))}</span><span class="bold">${setsText(p.sets)}</span></div>`).join('')}</div>` : ''}
    <span class="label">Variantes (si la machine est prise)</span>
    <div class="col">${variants.map((v) => `<button class="list-item" data-act="openEx" data-id="${v.id}"><span class="thumb">${I.dumbbell}</span><span class="grow"><span class="li-title">${esc(v.name)}</span><br><span class="li-sub">${esc(v.equipment)}</span></span>${I.next}</button>`).join('')}
      <button class="btn soft" data-act="addVariant" data-id="${e.id}">${I.plus} Ajouter une variante</button></div>
    <label class="field"><span>Mes notes (réglages machine, sensations…)</span><textarea class="input" data-act-change="exNotes" data-id="${e.id}" placeholder="Ex. siège cran 4, coudes serrés">${esc(e.notes)}</textarea></label>`;
}

// ---------- Vue : Créer / modifier une séance ----------
function newDraft() { return { id: uid(), name: '', type: null, targets: [], targetMinutes: 60, lines: [], isNew: true }; }
function vTemplate(r) {
  if (!S.draft || S.draft._for !== r.id) {
    const t = r.id === 'new' ? newDraft() : S.templates.find((x) => x.id === r.id);
    if (!t) return '<div class="empty">Séance introuvable.</div>';
    S.draft = JSON.parse(JSON.stringify(t)); S.draft._for = r.id;
  }
  const d = S.draft;
  const types = SESSION_TYPES.map((t) => `<button class="chip ${d.type === t.id ? 'blue on' : 'blue'}" data-act="tType" data-v="${t.id}">${t.name}</button>`).join('');
  const targetChips = GROUPS.map((g) => S.muscles.filter((m) => m.group === g).map((m) => `<button class="chip ${d.targets.includes(m.id) ? 'on' : ''}" data-act="tTarget" data-v="${m.id}">${esc(m.name)}</button>`).join('')).join('');
  const lines = d.lines.map((l, i) => {
    const ex = S.exMap[l.exerciseId];
    if (!ex) return '';
    const vopts = [...new Set([...(ex.variants || []), ...(l.variantId ? [l.variantId] : [])])].map((id) => S.exMap[id]).filter(Boolean);
    return `<div class="line-card">
      <div class="between"><span class="li-title">${i + 1}. ${esc(ex.name)}</span>
        <span class="row" style="gap:4px"><button class="icon-btn" style="width:36px;height:36px;background:var(--lilac)" data-act="lMove" data-i="${i}" data-d="-1" aria-label="Monter">${I.up}</button>
        <button class="icon-btn" style="width:36px;height:36px;background:var(--lilac)" data-act="lMove" data-i="${i}" data-d="1" aria-label="Descendre">${I.down}</button>
        <button class="icon-btn" style="width:36px;height:36px;background:var(--pink-soft);color:var(--pink-ink)" data-act="lDel" data-i="${i}" aria-label="Retirer">${I.x}</button></span></div>
      <div class="mini-grid">
        <label>Séries<input inputmode="numeric" value="${esc(l.sets)}" data-line="${i}" data-f="sets"></label>
        <label>Rép. min<input inputmode="numeric" value="${esc(l.repMin)}" data-line="${i}" data-f="repMin"></label>
        <label>Rép. max<input inputmode="numeric" value="${esc(l.repMax)}" data-line="${i}" data-f="repMax"></label>
        <label>Repos (s)<input inputmode="numeric" value="${esc(l.rest)}" data-line="${i}" data-f="rest"></label></div>
      <label class="row small" style="gap:8px"><span class="bold blue" style="flex-shrink:0">Si pris →</span>
        <select class="input" style="min-height:40px;padding:0 10px" data-line="${i}" data-f="variantId">
          <option value="">Pas de variante</option>${vopts.map((v) => `<option value="${v.id}" ${l.variantId === v.id ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label></div>`;
  }).join('');
  return `<div class="between"><button class="icon-btn" data-act="back" aria-label="Retour">${I.back}</button><h3>${d.isNew ? 'Nouvelle séance' : 'Ma séance'}</h3>
      <button class="btn small white" data-act="tSave">Enregistrer</button></div>
    <label class="field"><span>Nom</span><input class="input" value="${esc(d.name)}" placeholder="Ex. Leg day — quads & fessiers" data-draft="name"></label>
    <span class="label">Type de séance</span><div class="chips">${types}</div>
    <span class="label">Muscles ciblés</span><div class="chips">${targetChips}</div>
    <label class="field" style="max-width:200px"><span>Durée visée (min)</span><input class="input" inputmode="numeric" value="${esc(d.targetMinutes)}" data-draft="targetMinutes"></label>
    <div class="card" id="scorecard">${scoreCard(d)}</div>
    <span class="label">Exercices</span>
    <div class="col">${lines || '<div class="empty" style="padding:8px">Aucun exercice pour le moment.</div>'}
      <button class="btn soft" data-act="tAdd">${I.plus} Ajouter des exercices</button></div>
    <button class="btn block" data-act="tSaveStart">${I.play} Enregistrer et démarrer</button>
    ${d.isNew ? '' : '<button class="btn danger block" data-act="tDelete">Supprimer cette séance</button>'}`;
}
function scoreCard(d) {
  const sc = computeScore(d.lines, S.exMap, S.mMap, d.targets, d.targetMinutes);
  const sugg = suggest(d, S.exMap, S.mMap, S.exercises);
  const musclesHtml = sc.muscles.map((m) => {
    const pct = Math.min(100, Math.round(m.sets / m.max * 100));
    const pink = m.status !== 'ok';
    const label = m.status === 'ok' ? `${fmtNum(m.sets)} séries ✓` : m.status === 'low' ? `${fmtNum(m.sets)} / ${m.min} séries` : `${fmtNum(m.sets)} séries (max ${m.max})`;
    return `<div style="display:grid;grid-template-columns:96px 1fr 104px;gap:8px;align-items:center" class="small">
      <span class="bold">${esc(m.name)}</span><div class="bar ${pink ? 'pink' : ''}"><div style="width:${pct}%"></div></div>
      <span class="bold ${pink ? 'pink' : 'blue'}" style="text-align:right">${label}</span></div>`;
  }).join('');
  const crit = [
    sc.order < 1 ? 'Ordre : place les exercices polyarticulaires avant l\'isolation.' : '',
    sc.duration < 1 ? `Durée estimée ${sc.minutes} min pour ${sc.targetMinutes} min prévues.` : '',
    sc.focus < 1 ? 'Une partie des séries ne vise pas les muscles ciblés.' : '',
  ].filter(Boolean).map((t) => `<span class="tiny muted">• ${t}</span>`).join('');
  return `<div class="row">${ring(sc.score)}<div class="col" style="gap:2px"><span class="label">Efficacité</span><span class="bold">${d.lines.length ? scoreLabel(sc.score) : 'Ajoute des exercices'}</span><span class="tiny muted">~${sc.minutes} min estimées</span></div></div>
      ${musclesHtml ? `<div class="col">${musclesHtml}</div>` : ''}${crit}
      ${sugg.map((s, i) => `<div class="between" style="padding:10px 10px 10px 14px;border-radius:18px;background:var(--pink-soft)"><span class="small" style="color:var(--pink-deep)">${esc(s.text)} <b>→ ${s.newScore} %</b></span><button class="btn small pink" data-act="tApply" data-i="${i}">Appliquer</button></div>`).join('')}`;
}
function refreshScoreCard() { const c = document.getElementById('scorecard'); if (c && S.draft) c.innerHTML = scoreCard(S.draft); }

// ---------- Séance en cours ----------
function overloadHint(ex, line, last) {
  if (!last || !line) return '';
  const max = Number(line.repMax) || 0;
  if (!max) return '';
  if (last.sets.every((s) => (Number(s.reps) || 0) >= max)) {
    const step = /halt/i.test(ex.equipment) ? 2 : 2.5;
    const kg = Math.max(...last.sets.map((s) => Number(s.kg) || 0));
    return `Haut de la fourchette atteint la dernière fois : essaie ${fmtNum(kg + step)} kg.`;
  }
  return '';
}
function makeEntry(exerciseId, line) {
  const last = performances(exerciseId)[0];
  const n = Number(line?.sets) || (last ? last.sets.length : 3);
  const sets = [];
  for (let i = 0; i < n; i++) {
    const ls = last ? last.sets[Math.min(i, last.sets.length - 1)] : null;
    sets.push({ type: 'work', kg: ls ? ls.kg : '', reps: '', rir: '', done: false, hintReps: ls ? ls.reps : (line?.repMax || '') });
  }
  return { exerciseId, line: line ? { ...line } : null, sets };
}
// Remplacer un exercice : les séries déjà validées sont gardées, seules les séries restantes passent sur le nouvel exercice.
function replaceEntry(ei, ne) {
  const en = S.active.entries[ei];
  const done = en.sets.filter((s) => s.done);
  if (!done.length) { S.active.entries[ei] = ne; return; }
  const remaining = en.sets.filter((s) => !s.done && s.type !== 'warmup').length;
  en.sets = done;
  ne.sets = ne.sets.slice(0, Math.max(1, remaining));
  S.active.entries.splice(ei + 1, 0, ne);
}
async function startSession(templateId) {
  if (S.active && !confirm('Une séance est déjà en cours. La remplacer ?')) return;
  const t = templateId ? S.templates.find((x) => x.id === templateId) : null;
  S.active = { id: uid(), name: t ? t.name : 'Séance libre', templateId: t ? t.id : null, targets: t ? t.targets : [], start: new Date().toISOString(), current: 0, entries: t ? t.lines.filter((l) => S.exMap[l.exerciseId]).map((l) => makeEntry(l.exerciseId, l)) : [] };
  await saveActive();
  requestWakeLock();
  go('/encours');
}
function vActive() {
  const a = S.active;
  if (!a) return `<div class="empty">Pas de séance en cours.</div><a class="btn" href="#/seances">Voir mes séances</a>`;
  const mins = Math.floor((Date.now() - new Date(a.start).getTime()) / 60000);
  const entries = a.entries.map((en, ei) => {
    const ex = S.exMap[en.exerciseId]; if (!ex) return '';
    const last = performances(en.exerciseId)[0];
    const vids = videosOf(ex.id);
    const hint = overloadHint(ex, en.line, last);
    const variant = en.line?.variantId && S.exMap[en.line.variantId];
    const target = en.line ? `${en.line.sets} × ${en.line.repMin || '?'}–${en.line.repMax || '?'}${en.line.rest ? ' · repos ' + Math.round(en.line.rest / 60 * 10) / 10 + ' min' : ''}` : '';
    const rows = en.sets.map((s, si) => `<div class="set-grid set-row ${s.done ? 'done' : ''}">
        <span class="small muted bold">${s.type === 'warmup' ? 'É' : si + 1 - en.sets.slice(0, si).filter((x) => x.type === 'warmup').length}</span>
        <input class="set-input" inputmode="decimal" aria-label="Charge série ${si + 1}" value="${esc(s.kg)}" placeholder="kg" data-set="${ei}:${si}:kg">
        <input class="set-input" inputmode="numeric" aria-label="Répétitions série ${si + 1}" value="${esc(s.reps)}" placeholder="${esc(s.hintReps)}" data-set="${ei}:${si}:reps">
        <input class="set-input" inputmode="numeric" aria-label="RIR série ${si + 1}" value="${esc(s.rir)}" placeholder="–" data-set="${ei}:${si}:rir" style="font-size:15px">
        <button class="check ${s.done ? 'done' : ''}" data-act="setDone" data-e="${ei}" data-s="${si}" aria-label="Valider la série ${si + 1}" aria-pressed="${s.done}">${I.check}</button></div>`).join('');
    return `<div class="card" id="entry-${ei}">
      <div class="row" style="align-items:flex-start">
        ${vids[0] ? `<a href="${esc(vids[0].url)}" target="_blank" rel="noopener" aria-label="Voir la vidéo de référence">${thumbHtml(vids[0])}</a>` : `<span class="thumb">${I.dumbbell}</span>`}
        <div class="col grow" style="gap:2px"><button data-act="openEx" data-id="${ex.id}" style="border:0;background:none;padding:0;text-align:left;color:var(--ink)"><h3>${esc(ex.name)}</h3></button>
          ${target ? `<span class="tiny muted">${target}</span>` : ''}
          ${last ? `<span class="tiny bold blue">Dernière fois : ${setsText(last.sets)}</span>` : '<span class="tiny muted">Première fois sur cet exercice</span>'}</div>
        <button class="icon-btn" style="width:36px;height:36px;background:var(--lilac)" data-act="entryMenu" data-e="${ei}" aria-label="Options de l'exercice">⋯</button></div>
      ${hint ? `<div class="small" style="padding:10px 14px;border-radius:16px;background:var(--pink-soft);color:var(--pink-deep)">${hint}</div>` : ''}
      <div><div class="set-grid head"><span>Série</span><span>kg</span><span>Rép.</span><span>RIR</span><span></span></div>${rows}</div>
      <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn small ghost" data-act="addSet" data-e="${ei}">+ Série</button>
        <button class="btn small ghost" data-act="addWarmup" data-e="${ei}">+ Échauffement</button>
        ${variant ? `<button class="btn small soft" data-act="swapVariant" data-e="${ei}">Machine prise → ${esc(variant.name)}</button>` : `<button class="btn small soft" data-act="swapPick" data-e="${ei}">Remplacer</button>`}</div></div>`;
  }).join('');
  return `<div class="between"><button class="icon-btn" data-act="goHome" aria-label="Accueil">${I.back}</button>
      <div class="col center" style="gap:0"><h3>${esc(a.name)}</h3><span class="tiny muted">commencée il y a ${mins} min</span></div>
      <button class="btn small white" data-act="finish">Terminer</button></div>
    ${entries || '<div class="empty">Ajoute ton premier exercice.</div>'}
    <button class="btn soft block" data-act="sessAdd">${I.plus} Ajouter un exercice</button>
    <label class="field"><span>Notes de séance</span><textarea class="input" data-act-change="sessNotes" placeholder="Forme, douleurs, ressenti…">${esc(a.notes || '')}</textarea></label>
    <button class="btn danger block" data-act="abandon">Abandonner la séance</button>`;
}

// ---------- Minuteur de repos ----------
let timerInt = null; let audioCtx = null;
function startTimer(sec) {
  if (!sec) return;
  S.timer = { end: Date.now() + sec * 1000 };
  renderTimer();
}
function renderTimer() {
  const el = $('#timer');
  if (!S.timer || route().name !== 'encours') { el.innerHTML = ''; clearInterval(timerInt); timerInt = null; return; }
  const left = Math.max(0, Math.round((S.timer.end - Date.now()) / 1000));
  el.innerHTML = `<div class="timer" role="timer" aria-live="off"><div class="col" style="gap:0"><span class="tiny bold">Repos</span><span class="t">${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</span></div>
    <div class="row" style="gap:8px"><button class="plus" data-act="timerPlus">+30 s</button><button class="skip" data-act="timerSkip">Passer</button></div></div>`;
  if (!timerInt) timerInt = setInterval(() => {
    if (!S.timer) return;
    const l = Math.round((S.timer.end - Date.now()) / 1000);
    if (l <= 0) { beep(); S.timer = null; renderTimer(); return; }
    const t = document.querySelector('#timer .t');
    if (t) t.textContent = `${Math.floor(l / 60)}:${String(l % 60).padStart(2, '0')}`;
  }, 500);
}
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((t) => {
      const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.2, audioCtx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + t + 0.2);
      o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.2);
    });
  } catch (e) { /* son indisponible */ }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  toast('Repos terminé, série suivante !');
}
let wakeLock = null;
async function requestWakeLock() {
  try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { /* non supporté */ }
}

// ---------- Bilan ----------
function vSummary(r) {
  const s = S.sessions.find((x) => x.id === r.id);
  if (!s) return '<div class="empty">Séance introuvable.</div>';
  const dur = s.end ? Math.round((new Date(s.end) - new Date(s.start)) / 60000) : null;
  let nSets = 0; let tonnage = 0;
  const lines = [];
  for (const e of s.entries) {
    const done = e.sets.filter((x) => x.done && x.type !== 'warmup');
    nSets += done.length;
    tonnage += done.reduce((a, x) => a + (Number(x.kg) || 0) * (Number(x.reps) || 0), 0);
    if (done.length) lines.push({ exerciseId: e.exerciseId, sets: done.length });
  }
  const sc = computeScore(lines, S.exMap, S.mMap, s.targets, null);
  const ex = s.entries.map((e) => {
    const done = e.sets.filter((x) => x.done && x.type !== 'warmup');
    if (!done.length) return '';
    const rec = (s.records || []).includes(e.exerciseId);
    return `<div class="between small" style="padding:8px 0;border-top:1px solid var(--line)"><span class="bold">${esc(S.exMap[e.exerciseId]?.name || '?')}${rec ? ' <span class="pill pink">Record</span>' : ''}</span><span>${setsText(done)}</span></div>`;
  }).join('');
  return `<div class="between"><button class="icon-btn" data-act="back" aria-label="Retour">${I.back}</button><h3>Bilan</h3><span style="width:44px"></span></div>
    <div class="card blue"><h2>${esc(s.name)}</h2><span class="small">${cap(dFmt.format(new Date(s.start)))}${dur ? ' · ' + dur + ' min' : ''}</span>
      ${(s.records || []).length ? `<span class="bold pink">${plural(s.records.length, 'nouveau record')} !</span>` : ''}</div>
    <div class="stat-grid"><div class="stat"><span class="tiny muted">Séries</span><b>${nSets}</b></div><div class="stat"><span class="tiny muted">Volume</span><b>${Math.round(tonnage).toLocaleString('fr-FR')} kg</b></div><div class="stat"><span class="tiny muted">Efficacité</span><b>${sc.score} %</b></div></div>
    <div class="card flat" style="gap:0">${ex || '<span class="muted small">Aucune série validée.</span>'}</div>
    ${s.notes ? `<div class="card flat"><span class="label">Notes</span><span class="small">${esc(s.notes)}</span></div>` : ''}
    <button class="btn danger block" data-act="delSession" data-id="${s.id}">Supprimer cette séance de l'historique</button>`;
}

// ---------- Réglages ----------
function vSettings() {
  return `<div class="between"><button class="icon-btn" data-act="back" aria-label="Retour">${I.back}</button><h3>Réglages</h3><span style="width:44px"></span></div>
    <div class="card"><h3>Sauvegarde</h3>
      <span class="small muted">Tes données sont enregistrées uniquement sur ce téléphone. Exporte une sauvegarde régulièrement et range-la dans Fichiers (iCloud Drive).</span>
      <span class="small bold">${S.lastBackup ? 'Dernière sauvegarde : ' + relDay(S.lastBackup) : 'Aucune sauvegarde pour le moment.'}</span>
      <button class="btn" data-act="export">Exporter une sauvegarde</button>
      <label class="btn soft" style="position:relative">Restaurer une sauvegarde<input type="file" accept="application/json,.json" data-act-change="import" style="position:absolute;inset:0;opacity:0"></label></div>
    <div class="card"><h3>Installer sur l'iPhone</h3><span class="small muted">Dans Safari : bouton Partager → « Sur l'écran d'accueil ». Utilise ensuite toujours l'icône de l'écran d'accueil : c'est là que tes données sont rangées.</span></div>
    <div class="card"><h3>Ajouter une vidéo rapidement</h3><span class="small muted">Dans Instagram, TikTok ou YouTube : Partager → « Copier le lien ». Ouvre l'app et touche « Coller un lien ». Tu pourras ranger la vidéo tout de suite ou plus tard.</span></div>
    <div class="card"><h3>Stockage</h3><span class="small muted" id="persist">Vérification…</span></div>
    <span class="tiny muted center">Version ${APP_VERSION}</span>`;
}

// ---------- Nutrition : état du jour ----------
const latestWeight = () => (S.weights.length ? S.weights[S.weights.length - 1].kg : null);
const currentWeight = () => latestWeight() || (S.profile && Number(S.profile.weight)) || null;
const entriesOf = (k) => S.journal.filter((e) => e.date === k);
function isTrainDay(k) {
  if (S.dayTypes[k]) return S.dayTypes[k] === 'train';
  if (S.sessions.some((s) => dayKey(new Date(s.start)) === k)) return true;
  if (S.active && dayKey(new Date(S.active.start)) === k) return true;
  const days = (S.profile && S.profile.trainDays) || [];
  return days.includes(keyToDate(k).getDay());
}
function targetsFor(k) {
  if (!S.profile || profileErrors(S.profile).length) return null;
  const type = isTrainDay(k) ? 'train' : 'rest';
  if (S.profile.manual && S.profile.manual[type]) return S.profile.manual[type];
  return computeTargets(S.profile, currentWeight())[type];
}
const waterOf = (k) => { const d = S.daily.find((x) => x.id === k); return d ? Number(d.water) || 0 : 0; };
const r0 = (n) => Math.round(Number(n) || 0);
function dayLabel(k) {
  const t = dayKey();
  if (k === t) return "Aujourd'hui";
  if (k === addDays(t, -1)) return 'Hier';
  if (k === addDays(t, 1)) return 'Demain';
  return cap(new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(keyToDate(k)));
}
function macroBars(tot, tg) {
  const it = (lab, v, t) => `<div class="col" style="gap:5px"><span class="tiny muted">${lab}</span><span class="small bold">${r0(v)}${t ? ' / ' + r0(t) : ''} g</span>
    <div class="bar" style="height:6px"><div style="width:${t ? Math.min(100, v / t * 100) : 0}%;${t && v > t * 1.1 ? 'background:var(--pink)' : ''}"></div></div></div>`;
  return `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">${it('Protéines', tot.p, tg && tg.p)}${it('Glucides', tot.g, tg && tg.g)}${it('Lipides', tot.l, tg && tg.l)}</div>`;
}
function kcalBlock(tot, tg) {
  if (!tg) return `<span class="display" style="font-size:30px">${r0(tot.kcal)} <span class="small muted">kcal</span></span>`;
  const left = tg.kcal - tot.kcal;
  return `<div class="between" style="align-items:baseline"><span class="display" style="font-size:30px">${r0(Math.abs(left)).toLocaleString('fr-FR')} <span class="small muted" style="font-family:Nunito,sans-serif">kcal ${left >= 0 ? 'restantes' : 'en trop'}</span></span>
      <span class="small muted">${r0(tot.kcal)} / ${r0(tg.kcal)}</span></div>
    <div class="bar pink" style="height:10px"><div style="width:${Math.min(100, tot.kcal / tg.kcal * 100)}%"></div></div>`;
}

// ---------- Vue : Nutrition (journal) ----------
function vNutrition(r) {
  const k = r.query.get('d') || dayKey();
  const ents = entriesOf(k);
  const tot = sumMacros(ents);
  const tg = targetsFor(k);
  const train = isTrainDay(k);
  const water = waterOf(k); const wt = waterTarget(currentWeight());
  const setup = !S.profile || profileErrors(S.profile).length;
  const meals = MEALS.filter((m) => !m.train || train || ents.some((e) => e.meal === m.id)).map((m) => {
    const list = ents.filter((e) => e.meal === m.id).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    const mt = sumMacros(list);
    const items = list.map((e) => { const mm = entryMacros(e); return `<button class="between small" data-act="editEntry" data-id="${e.id}" style="border:0;background:none;padding:6px 0;color:var(--ink-2);text-align:left;width:100%">
        <span class="grow">${esc(e.name)}${e.quick ? '' : ` · ${fmtNum(e.grams)} g`}</span><span>${r0(mm.kcal)}</span></button>`; }).join('');
    return `<div class="card flat" style="gap:4px;padding:14px 16px">
      <div class="between"><span class="bold" style="font-size:15px">${m.name}</span><span class="small muted">${list.length ? `${r0(mt.kcal)} kcal · ${r0(mt.p)} g P` : ''}</span></div>
      ${items}
      <button class="btn small ghost" style="align-self:flex-start;color:var(--pink-ink);padding:0" data-act="addFood" data-meal="${m.id}" data-day="${k}">${I.plus} Ajouter</button></div>`;
  }).join('');
  return `<div class="between"><h1>Nutrition</h1>
      <div class="row" style="gap:4px"><a class="icon-btn" href="#/nutrition?d=${addDays(k, -1)}" aria-label="Jour précédent">${I.back}</a>
      <span class="small bold" style="min-width:76px;text-align:center">${dayLabel(k)}</span>
      <a class="icon-btn" href="#/nutrition?d=${addDays(k, 1)}" aria-label="Jour suivant">${I.next}</a></div></div>
    ${nutriSeg('j')}
    ${setup ? `<a class="card pink" href="#/profil"><span class="bold">Calcule tes besoins</span><span class="small" style="color:var(--pink-deep)">Renseigne ton profil (1 minute) : l'app calcule tes calories et tes macros.</span></a>` : ''}
    <div class="card">
      ${kcalBlock(tot, tg)}${macroBars(tot, tg)}
      <div class="between"><button class="pill ${train ? '' : 'pink'}" data-act="toggleDayType" data-day="${k}" style="border:0">${train ? "Jour d'entraînement" : 'Jour de repos'} ⇄</button>
        ${setup ? '' : '<a class="small bold" href="#/profil">Mes objectifs</a>'}</div></div>
    <div class="card flat" style="gap:10px;padding:14px 16px">
      <div class="between"><span class="bold">Eau</span><span class="small muted">${fmtNum(water / 1000)} / ${fmtNum(wt / 1000)} L</span></div>
      <div class="bar"><div style="width:${Math.min(100, water / wt * 100)}%"></div></div>
      <div class="row" style="gap:8px"><button class="btn small soft" data-act="water" data-day="${k}" data-v="250">+ 1 verre</button><button class="btn small soft" data-act="water" data-day="${k}" data-v="500">+ 50 cl</button>
        <button class="btn small ghost" data-act="water" data-day="${k}" data-v="-250" aria-label="Retirer un verre">− 1 verre</button></div></div>
    <div class="col" style="gap:10px">${meals}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button class="btn soft-pink" data-act="copyDay" data-day="${k}">Copier la veille</button><button class="btn soft" data-act="quickAdd" data-day="${k}" data-meal="diner">Saisie rapide</button></div>`;
}

// ---------- Vue : Profil et besoins ----------
function vProfile() {
  if (!S.pdraft) S.pdraft = JSON.parse(JSON.stringify(S.profile || { sex: null, birthYear: '', height: '', activity: 'bureau', goal: 'maintien', trainDays: [1, 3, 5], manual: null }));
  const p = S.pdraft;
  if (!p.weight && currentWeight()) p.weight = currentWeight();
  const days = [[1, 'L'], [2, 'M'], [3, 'M'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']];
  return `<div class="between"><button class="icon-btn" data-act="back" aria-label="Retour">${I.back}</button><h3>Mes besoins</h3><button class="btn small white" data-act="pSave">Enregistrer</button></div>
    <div class="card flat">
      <div class="seg pinkseg"><button class="${p.sex === 'f' ? 'on' : ''}" data-act="pSex" data-v="f">Femme</button><button class="${p.sex === 'h' ? 'on' : ''}" data-act="pSex" data-v="h">Homme</button></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        <label class="field"><span>Née en</span><input class="input" inputmode="numeric" value="${esc(p.birthYear)}" placeholder="1997" data-prof="birthYear"></label>
        <label class="field"><span>Taille (cm)</span><input class="input" inputmode="numeric" value="${esc(p.height)}" placeholder="165" data-prof="height"></label>
        <label class="field"><span>Poids (kg)</span><input class="input" inputmode="decimal" value="${esc(fmtNum(p.weight || 0) === '0' ? '' : fmtNum(p.weight))}" placeholder="60" data-prof="weight"></label></div>
      <label class="field"><span>En dehors de la salle, je suis…</span><select class="input" data-prof="activity">${Object.entries(ACTIVITY).map(([k2, a]) => `<option value="${k2}" ${p.activity === k2 ? 'selected' : ''}>${a.label}</option>`).join('')}</select></label></div>
    <span class="label">Objectif</span>
    <div class="chips">${Object.entries(GOALS).map(([k2, g]) => `<button class="chip ${p.goal === k2 ? 'on' : ''}" data-act="pGoal" data-v="${k2}">${g.label}</button>`).join('')}</div>
    <span class="tiny muted">${esc((GOALS[p.goal] || GOALS.maintien).hint)}</span>
    <span class="label">Mes jours d'entraînement habituels</span>
    <div class="chips">${days.map(([d, l]) => `<button class="chip ${p.trainDays.includes(d) ? 'blue on' : 'blue'}" data-act="pDay" data-v="${d}" style="min-width:44px;justify-content:center">${l}</button>`).join('')}</div>
    <span class="tiny muted">Un jour où tu fais une séance compte toujours comme jour d'entraînement.</span>
    <div class="card" id="profres">${profResult(p)}</div>`;
}
function profResult(p) {
  const err = profileErrors(p);
  if (err.length) return `<span class="bold">Il manque ${err.join(', ')}.</span>`;
  const t = computeTargets(p, p.weight);
  const m = p.manual;
  const col = (key, label, v) => `<div class="col" style="gap:6px;padding:12px;border-radius:18px;background:${key === 'train' ? 'var(--blue-soft)' : 'var(--pink-soft)'}">
      <span class="tiny bold ${key === 'train' ? 'blue' : 'pink'}">${label}</span>
      ${m ? `<label class="tiny muted">kcal<input class="set-input" inputmode="numeric" value="${r0(v.kcal)}" data-man="${key}:kcal"></label>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px">${['p', 'g', 'l'].map((x) => `<label class="tiny muted">${{ p: 'P', g: 'G', l: 'L' }[x]}<input class="set-input" style="font-size:14px" inputmode="numeric" value="${r0(v[x])}" data-man="${key}:${x}"></label>`).join('')}</div>`
    : `<span class="display" style="font-size:24px">${v.kcal.toLocaleString('fr-FR')} kcal</span><span class="small">P ${v.p} g · G ${v.g} g · L ${v.l} g</span>`}</div>`;
  return `<span class="label">Mes objectifs quotidiens</span>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${col('train', "Jour d'entraînement", m ? m.train : t.train)}${col('rest', 'Jour de repos', m ? m.rest : t.rest)}</div>
    <span class="tiny muted">Métabolisme de base ${t.bmr.toLocaleString('fr-FR')} kcal · dépense estimée ${t.maintRest.toLocaleString('fr-FR')} kcal (repos) et ${t.maintTrain.toLocaleString('fr-FR')} kcal (séance). Formule de Mifflin-St Jeor, protéines ${(GOALS[p.goal] || GOALS.maintien).prot} g/kg, lipides 0,9 g/kg, glucides pour le reste.</span>
    <span class="tiny muted">C'est une estimation : si ton poids n'évolue pas comme prévu après 2 à 3 semaines, ajuste de 100 à 200 kcal.</span>
    <label class="row small bold" style="min-height:44px"><input type="checkbox" data-act-change="pManual" ${m ? 'checked' : ''} style="width:22px;height:22px"> Ajuster les chiffres à la main</label>`;
}
function refreshProfRes() { const c = document.getElementById('profres'); if (c && S.pdraft) c.innerHTML = profResult(S.pdraft); }

// ---------- Vue : Corps (poids) ----------
function weightStats() {
  const W = S.weights;
  const avg = (from, to) => { const xs = W.filter((w) => w.date > from && w.date <= to).map((w) => w.kg); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; };
  const t = dayKey();
  return { now: avg(addDays(t, -7), t), prev: avg(addDays(t, -14), addDays(t, -7)) };
}
function weightChart() {
  const t = dayKey(); const from = addDays(t, -60);
  const pts = S.weights.filter((w) => w.date > from);
  if (pts.length < 2) return '<div class="empty" style="padding:12px">La courbe apparaît après 2 pesées.</div>';
  const W = 320; const H = 150;
  const d0 = keyToDate(pts[0].date).getTime(); const d1 = keyToDate(pts[pts.length - 1].date).getTime();
  const span = Math.max(1, d1 - d0);
  const avgAt = (k) => { const xs = S.weights.filter((w) => w.date > addDays(k, -7) && w.date <= k).map((w) => w.kg); return xs.reduce((a, b) => a + b, 0) / xs.length; };
  const avgs = pts.map((p) => avgAt(p.date));
  const all = [...pts.map((p) => p.kg), ...avgs];
  let lo = Math.min(...all); let hi = Math.max(...all); if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
  const x = (k) => 8 + (keyToDate(k).getTime() - d0) / span * (W - 16);
  const y = (v) => 14 + (hi - v) / (hi - lo) * (H - 34);
  const dots = pts.map((p) => `<circle cx="${x(p.date).toFixed(1)}" cy="${y(p.kg).toFixed(1)}" r="3.5" fill="#AFC4F2"/>`).join('');
  const line = pts.map((p, i) => `${x(p.date).toFixed(1)},${y(avgs[i]).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Courbe de poids des 60 derniers jours">
    <text x="0" y="10" fill="#6E6585" font-size="11" font-family="Nunito">${fmtNum(hi)} kg</text>
    <text x="0" y="${H - 22}" fill="#6E6585" font-size="11" font-family="Nunito">${fmtNum(lo)} kg</text>
    ${dots}<polyline points="${line}" fill="none" stroke="#3D6FD8" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="0" y="${H - 4}" fill="#6E6585" font-size="11" font-family="Nunito">${dShort.format(keyToDate(pts[0].date))}</text>
    <text x="${W}" y="${H - 4}" text-anchor="end" fill="#6E6585" font-size="11" font-family="Nunito">${dShort.format(keyToDate(pts[pts.length - 1].date))}</text></svg>
    <div class="row tiny muted" style="gap:14px"><span class="row" style="gap:6px"><span style="width:8px;height:8px;border-radius:4px;background:#AFC4F2"></span>Pesée</span><span class="row" style="gap:6px"><span style="width:14px;height:3px;border-radius:2px;background:#3D6FD8"></span>Moyenne 7 jours</span></div>`;
}
function vCorps() {
  const st = weightStats();
  const today = S.weights.find((w) => w.date === dayKey());
  const delta = st.now != null && st.prev != null ? st.now - st.prev : null;
  const list = [...S.weights].reverse().slice(0, 12).map((w) => `<div class="between small" style="padding:8px 0;border-top:1px solid var(--line)"><span class="muted">${dayLabel(w.date)}</span>
      <span class="row"><b>${fmtNum(w.kg)} kg</b><button class="icon-btn" style="width:34px;height:34px;background:var(--lilac)" data-act="delWeight" data-id="${w.id}" aria-label="Supprimer la pesée">${I.x}</button></span></div>`).join('');
  return `<h1>Poids</h1>
    <div class="card">
      <div class="between" style="align-items:flex-end"><div class="col" style="gap:2px"><span class="tiny muted">Moyenne 7 jours</span><span class="display" style="font-size:38px">${st.now != null ? fmtNum(st.now) + ' <span style="font-size:18px">kg</span>' : '—'}</span></div>
        ${delta != null ? `<span class="small bold blue">${delta >= 0 ? '+' : '−'}${fmtNum(Math.abs(delta))} kg / semaine</span>` : ''}</div>
      ${weightChart()}</div>
    <div class="card pink">
      <span class="bold">${today ? 'Pesée de ce matin : ' + fmtNum(today.kg) + ' kg' : 'Pesée de ce matin'}</span>
      <div class="row"><label class="search grow" style="background:#fff"><span class="sr">Poids en kg</span><input id="w-kg" inputmode="decimal" placeholder="${fmtNum(latestWeight() || 60)}" autocomplete="off"><span class="small muted">kg</span></label>
        <button class="btn pink" data-act="saveWeight">${today ? 'Modifier' : 'Enregistrer'}</button></div>
      <span class="tiny" style="color:var(--pink-deep)">À jeun, après passage aux toilettes, pour des pesées comparables. La moyenne lisse les variations d'eau.</span></div>
    ${list ? `<div class="card flat" style="gap:0"><span class="label" style="padding-bottom:6px">Historique</span>${list}</div>` : ''}`;
}

// ---------- Feuilles nutrition ----------
function recentFoods() {
  const seen = new Set(); const out = [];
  for (const e of [...S.journal].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))) {
    if (e.quick || !e.foodId || seen.has(e.foodId)) continue;
    seen.add(e.foodId);
    const f = S.foodMap[e.foodId] || { id: e.foodId, name: e.name, ...e.per, portionName: e.portionName || null, portionG: e.portionG || null };
    out.push(f); if (out.length >= 12) break;
  }
  return out;
}
const foodRow = (f) => `<button class="list-item" data-act="pickFood" data-id="${esc(f.id)}"><span class="thumb pink" style="width:40px;height:40px;font-size:13px;font-weight:800">${r0(f.kcal)}</span>
  <span class="grow"><span class="li-title" style="font-size:14px">${esc(f.name)}</span><br><span class="li-sub">pour 100 g · P ${fmtNum(f.p)} · G ${fmtNum(f.g)} · L ${fmtNum(f.l)}${f.portionName ? ` · ${esc(f.portionName)} = ${fmtNum(f.portionG)} g` : ''}</span></span>
  ${S.favs.includes(f.id) ? `<span class="pink">${I.star}</span>` : ''}</button>`;
function foodResults(sh) {
  const q = (sh.q || '').trim();
  if (!q) {
    const favs = S.favs.map((id) => S.foodMap[id]).filter(Boolean);
    const rec = recentFoods().filter((f) => !S.favs.includes(f.id));
    return `${favs.length ? `<span class="label">Favoris</span>${favs.map(foodRow).join('')}` : ''}
      ${rec.length ? `<span class="label">Récents</span>${rec.map(foodRow).join('')}` : ''}
      ${!favs.length && !rec.length ? '<div class="empty">Tape le nom d\'un aliment, par exemple « skyr » ou « riz ».</div>' : ''}`;
  }
  const local = searchFoods(S.foods, q);
  const online = sh.online ? sh.online.filter((f) => !S.foodMap[f.id]) : null;
  const barcode = /^\d{8,14}$/.test(q);
  return `${local.map(foodRow).join('')}
    ${!local.length && !barcode ? '<div class="empty" style="padding:8px">Pas dans ta base.</div>' : ''}
    ${sh.loading ? '<div class="empty" style="padding:8px">Recherche en ligne…</div>'
      : online ? (online.length ? `<span class="label">En ligne (Open Food Facts)</span>${online.map(foodRow).join('')}` : `<div class="empty" style="padding:8px">${sh.error ? esc(sh.error) : 'Aucun produit trouvé en ligne.'}</div>`)
      : `<button class="btn soft block" data-act="offSearch">${barcode ? 'Chercher ce code-barres en ligne' : `Chercher « ${esc(q)} » en ligne`}</button>`}
    <button class="btn ghost block" data-act="newFood">${I.plus} Créer « ${esc(q)} »</button>`;
}
function refreshFoodRes() { const c = document.getElementById('foodres'); if (c && S.sheet) c.innerHTML = foodResults(S.sheet); }
function qtyMacros(sh) {
  const m = scale(sh.food, parseNum(sh.grams) || 0);
  return `<div class="between" style="padding:12px 14px;border-radius:16px;background:#fff;font-weight:800"><span>${r0(m.kcal)} kcal</span><span class="blue">${fmtNum(m.p)} g P</span><span>${fmtNum(m.g)} g G</span><span>${fmtNum(m.l)} g L</span></div>`;
}
const mealSelect = (cur, id = 'q-meal') => `<label class="field"><span>Repas</span><select class="input" id="${id}">${MEALS.map((m) => `<option value="${m.id}" ${cur === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}</select></label>`;
function nutriSheet(sh) {
  const close = `<button class="icon-btn" data-act="closeSheet" aria-label="Fermer">${I.x}</button>`;
  if (sh.type === 'food') {
    return `<div class="between"><h2>${sh.target === 'recipe' ? 'Ingrédient' : esc(MEALS.find((m) => m.id === sh.meal).name)}</h2>${close}</div>
      <label class="search">${I.search}<span class="sr">Rechercher un aliment</span><input id="food-q" type="search" placeholder="Aliment, marque ou code-barres…" value="${esc(sh.q)}" data-bind="foodQuery" autocomplete="off"></label>
      <div id="foodres" class="col">${foodResults(sh)}</div>`;
  }
  if (sh.type === 'qty') {
    const f = sh.food;
    const portions = f.portionG ? [1, 2, 3].map((n) => `<button class="chip pink" data-act="qtySet" data-v="${f.portionG * n}">${n === 1 ? esc(f.portionName) : n + ' × ' + esc(String(f.portionName).replace(/^1 /, ''))}</button>`).join('') : '';
    const fav = S.favs.includes(f.id);
    return `<div class="between"><h2 style="font-size:18px">${esc(f.name)}</h2>${close}</div>
      <span class="tiny muted">Pour 100 g : ${r0(f.kcal)} kcal · P ${fmtNum(f.p)} · G ${fmtNum(f.g)} · L ${fmtNum(f.l)}</span>
      ${portions ? `<div class="chips">${portions}</div>` : ''}
      <div class="chips">${[50, 100, 150, 200].map((g) => `<button class="chip" data-act="qtySet" data-v="${g}">${g} g</button>`).join('')}</div>
      <label class="field"><span>Quantité (g)</span><input class="input" id="q-g" inputmode="decimal" value="${esc(sh.grams)}" data-bind="qtyGrams" style="font-size:20px;font-weight:800"></label>
      <div id="qtymac">${qtyMacros(sh)}</div>
      ${sh.target === 'recipe' ? '' : mealSelect(sh.meal)}
      <button class="btn ghost" data-act="toggleFav" style="align-self:flex-start;color:var(--pink-ink)">${I.star} ${fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}</button>
      <button class="btn pink block" data-act="saveEntry">${sh.target === 'recipe' ? 'Ajouter à la recette' : sh.entryId ? 'Enregistrer' : 'Ajouter'}</button>
      ${sh.entryId ? `<button class="btn danger block" data-act="delEntry" data-id="${sh.entryId}">Retirer du journal</button>` : ''}`;
  }
  if (sh.type === 'quick') {
    const e = sh.entry || {};
    return `<div class="between"><h2>Saisie rapide</h2>${close}</div>
      <span class="small muted">Pour un repas au restaurant ou un plat dont tu connais seulement les valeurs.</span>
      <label class="field"><span>Nom</span><input class="input" id="qk-name" value="${esc(e.name || '')}" placeholder="Ex. Poké bowl saumon"></label>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${[['kcal', 'kcal'], ['p', 'Prot. (g)'], ['g', 'Gluc. (g)'], ['l', 'Lip. (g)']].map(([k2, l]) => `<label class="field"><span>${l}</span><input class="input" style="padding:0 8px;text-align:center" inputmode="decimal" id="qk-${k2}" value="${esc(e[k2] != null ? fmtNum(e[k2]) : '')}"></label>`).join('')}</div>
      ${mealSelect(e.meal || sh.meal)}
      <button class="btn pink block" data-act="saveQuick">${sh.entry ? 'Enregistrer' : 'Ajouter'}</button>
      ${sh.entry ? `<button class="btn danger block" data-act="delEntry" data-id="${sh.entry.id}">Retirer du journal</button>` : ''}`;
  }
  if (sh.type === 'recipeLink') {
    return `<div class="between"><h2>Recette en vidéo</h2>${close}</div>
      <span class="small muted">Dans Instagram, TikTok ou YouTube : Partager → Copier le lien, puis colle-le ici.</span>
      <label class="field"><span>Lien</span><input class="input" id="rl-url" inputmode="url" value="${esc(sh.url)}" placeholder="https://www.tiktok.com/…" autocomplete="off"></label>
      <label class="field"><span>Nom</span><input class="input" id="rl-name" placeholder="Ex. Pâtes crémeuses au skyr"></label>
      <button class="btn pink block" data-act="saveRecipeLink">Ajouter aux recettes à tester</button>`;
  }
  if (sh.type === 'promptText') {
    return `<div class="between"><h2>Demande à copier</h2>${close}</div><span class="small muted">Sélectionne le texte, copie-le et colle-le dans l'app Claude.</span>
      <textarea class="input" style="min-height:220px" readonly>${esc(sh.text)}</textarea>`;
  }
  if (sh.type === 'newFood') {
    const f = sh.food || {};
    return `<div class="between"><h2>Nouvel aliment</h2>${close}</div>
      <span class="small muted">Recopie les valeurs pour 100 g indiquées sur l'emballage.</span>
      <label class="field"><span>Nom</span><input class="input" id="nf-name" value="${esc(f.name || '')}"></label>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${[['kcal', 'kcal'], ['p', 'Prot.'], ['g', 'Gluc.'], ['l', 'Lip.']].map(([k2, l]) => `<label class="field"><span>${l}</span><input class="input" style="padding:0 8px;text-align:center" inputmode="decimal" id="nf-${k2}" value="${esc(f[k2] != null ? fmtNum(f[k2]) : '')}"></label>`).join('')}</div>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:8px"><label class="field"><span>Portion (facultatif)</span><input class="input" id="nf-pn" value="${esc(f.portionName || '')}" placeholder="1 pot"></label>
        <label class="field"><span>Grammes</span><input class="input" inputmode="decimal" id="nf-pg" value="${esc(f.portionG || '')}" placeholder="125"></label></div>
      <button class="btn pink block" data-act="saveNewFood">Enregistrer et continuer</button>`;
  }
  return '';
}

// ---------- Recettes ----------
const RSTATUS = { atester: { label: 'À tester', cls: 'pink' }, validee: { label: 'Validée', cls: '' }, bof: { label: 'Pas convaincue', cls: 'grey' } };
const RTAGS = ['Petit-déj', 'Repas', 'Collation', 'Riche en protéines', 'Rapide', 'Batch cooking', 'Sucré'];
const nutriSeg = (on) => `<div class="seg pinkseg"><a class="${on === 'j' ? 'on' : ''}" href="#/nutrition">Journal</a><a class="${on === 'i' ? 'on' : ''}" href="#/idees">Idées recettes</a><a class="${on === 't' ? 'on' : ''}" href="#/atester">À tester</a></div>`;
function recipeTotals(r) {
  const tot = { kcal: 0, p: 0, g: 0, l: 0 };
  for (const i of r.ingredients || []) { const m = scale(i.per, Number(i.grams) || 0); tot.kcal += m.kcal; tot.p += m.p; tot.g += m.g; tot.l += m.l; }
  const n = Math.max(1, Number(r.servings) || 1);
  return { tot, per: { kcal: tot.kcal / n, p: tot.p / n, g: tot.g / n, l: tot.l / n } };
}
function recipeThumb(r, h = 118) {
  const yt = r.url && ytId(r.url);
  const inner = r.image ? `<img src="${r.image}" alt="" style="width:100%;height:100%;object-fit:cover">`
    : yt ? `<img src="https://i.ytimg.com/vi/${yt}/mqdefault.jpg" alt="" style="width:100%;height:100%;object-fit:cover">`
    : `<span style="color:var(--pink-ink)">${r.url ? I.play : I.food}</span>`;
  const badge = r.image ? (r.kind === 'photo' ? 'Photo' : 'Capture') : r.url ? platformOf(r.url) : '';
  return `<div style="height:${h}px;background:var(--pink-soft);position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">${inner}
    ${badge ? `<span class="pill" style="position:absolute;top:8px;left:8px;background:#fff;color:var(--ink);font-size:10px">${esc(badge)}</span>` : ''}</div>`;
}

function recPerHtml(r) {
  const { tot, per } = recipeTotals(r);
  return `<div class="between bold"><span>${Math.round(per.kcal)} kcal</span><span class="blue">${fmtNum(per.p)} g P</span><span>${fmtNum(per.g)} g G</span><span>${fmtNum(per.l)} g L</span></div>
      <span class="tiny" style="color:var(--pink-deep)">Recette entière : ${Math.round(tot.kcal)} kcal</span>`;
}
function vATester() {
  const f = S.ui.recFilter || 'all'; const tag = S.ui.recTag || null;
  const counts = { all: S.recipes.length };
  for (const k of Object.keys(RSTATUS)) counts[k] = S.recipes.filter((r) => r.status === k).length;
  const list = S.recipes.filter((r) => (f === 'all' || r.status === f) && (!tag || (r.tags || []).includes(tag)))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const cards = list.map((r) => `<a href="#/recette/${r.id}" style="background:#fff;border-radius:22px;overflow:hidden;display:flex;flex-direction:column;color:var(--ink)">${recipeThumb(r)}
      <div style="padding:10px 12px 12px;display:flex;flex-direction:column;gap:6px"><span style="font-size:13px;font-weight:800;line-height:1.25">${esc(r.name || 'Sans nom')}</span>
      <span class="pill ${RSTATUS[r.status]?.cls || ''}" style="align-self:flex-start;font-size:11px">${RSTATUS[r.status]?.label || ''}${r.rating ? ' · ' + r.rating + '/5' : ''}</span></div></a>`).join('');
  const fileBtn = (label, icon, capture) => `<label class="btn white" style="min-height:72px;flex-direction:column;gap:6px;border-radius:22px;color:var(--pink-ink);font-size:12px;position:relative;overflow:hidden">${icon}${label}
      <input type="file" accept="image/*" ${capture ? 'capture="environment"' : ''} data-act-change="recipeImage" data-kind="${capture ? 'photo' : 'capture'}" style="position:absolute;inset:0;opacity:0"></label>`;
  return `<h1>Nutrition</h1>${nutriSeg('t')}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
      <button class="btn white" style="min-height:72px;flex-direction:column;gap:6px;border-radius:22px;color:var(--pink-ink);font-size:12px" data-act="recipeLink">${I.link}Lien vidéo</button>
      ${fileBtn('Capture', '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/></svg>', false)}
      ${fileBtn('Photo', '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>', true)}</div>
    <div class="chips scroll">${[['all', 'Toutes'], ...Object.entries(RSTATUS).map(([k, v]) => [k, v.label])].map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-act="recFilter" data-v="${k}">${l} · ${counts[k]}</button>`).join('')}</div>
    <div class="chips scroll">${RTAGS.map((t) => `<button class="chip ${tag === t ? 'pink on' : 'pink'}" data-act="recTag" data-v="${t}">${t}</button>`).join('')}</div>
    ${cards ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${cards}</div>` : `<div class="empty">${S.recipes.length ? 'Aucune recette pour ce filtre.' : 'Ajoute ta première recette repérée sur les réseaux : lien de la vidéo, capture d\'écran ou photo du plat.'}</div>`}`;
}

function vRecipe(r0id) {
  const r = S.recipes.find((x) => x.id === r0id.id);
  if (!r) return `<div class="empty">Recette introuvable.</div><a class="btn" href="#/atester">Retour</a>`;
  const ings = (r.ingredients || []).map((i, idx) => `<div class="row" style="padding:6px 0;border-top:1px solid var(--line)"><span class="grow small bold">${esc(i.name)}</span>
      <input class="set-input" style="width:72px;font-size:15px" inputmode="decimal" value="${esc(fmtNum(i.grams))}" data-ring="${idx}" aria-label="Grammes de ${esc(i.name)}"><span class="tiny muted">g</span>
      <button class="icon-btn" style="width:34px;height:34px;background:var(--pink-soft);color:var(--pink-ink)" data-act="recIngDel" data-i="${idx}" aria-label="Retirer">${I.x}</button></div>`).join('');
  return `<div class="between"><button class="icon-btn" data-act="back" aria-label="Retour">${I.back}</button>
      <div class="row" style="gap:6px">${r.url ? `<a class="btn small white" href="${esc(r.url)}" target="_blank" rel="noopener">${I.play} Voir la vidéo</a>` : ''}</div></div>
    <textarea class="input" rows="2" style="font-family:Quicksand,sans-serif;font-size:22px;font-weight:700;border-color:transparent;background:transparent;padding:0;min-height:0;resize:none" placeholder="Nom de la recette" data-rec="name" aria-label="Nom de la recette">${esc(r.name)}</textarea>
    ${r.image ? `<img src="${r.image}" alt="" style="width:100%;max-height:420px;object-fit:contain;border-radius:22px;background:#fff">` : r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener" style="border-radius:22px;overflow:hidden;display:block">${recipeThumb(r, 180)}</a>` : ''}
    <label class="field"><span>Lien de la vidéo</span><input class="input" inputmode="url" value="${esc(r.url || '')}" placeholder="https://…" data-rec="url"></label>
    <div class="seg pinkseg">${Object.entries(RSTATUS).map(([k, v]) => `<button class="${r.status === k ? 'on' : ''}" data-act="recStatus" data-v="${k}">${v.label}</button>`).join('')}</div>
    ${r.status !== 'atester' ? `<div class="row" style="gap:4px" role="group" aria-label="Note">${[1, 2, 3, 4, 5].map((n) => `<button class="icon-btn" style="background:transparent;color:${(r.rating || 0) >= n ? 'var(--pink)' : '#E4DCEA'}" data-act="recRate" data-v="${n}" aria-label="${n} sur 5">${I.star}</button>`).join('')}</div>` : ''}
    <div class="chips">${RTAGS.map((t) => `<button class="chip ${(r.tags || []).includes(t) ? 'pink on' : 'pink'}" data-act="recTagToggle" data-v="${t}">${t}</button>`).join('')}</div>
    <div class="card flat" style="gap:6px">
      <div class="between"><h3>Ingrédients</h3><label class="row tiny muted" style="gap:6px">Portions<input class="set-input" style="width:56px;font-size:15px" inputmode="numeric" value="${esc(r.servings || 1)}" data-rec="servings"></label></div>
      ${ings || '<span class="small muted">Ajoute les ingrédients pour calculer les macros.</span>'}
      <button class="btn small ghost" style="align-self:flex-start;color:var(--pink-ink);padding:0" data-act="recIngAdd">${I.plus} Ingrédient</button></div>
    ${(r.ingredients || []).length ? `<div class="card pink" style="gap:8px"><span class="label" style="color:var(--pink-deep)">Par portion</span>
      <div id="recper" class="col" style="gap:6px">${recPerHtml(r)}</div>
      <div class="row" style="gap:8px;flex-wrap:wrap">${mealSelect(S.ui.recMeal || 'diner', 'r-meal').replace('class="field"', 'class="field grow"')}
        <label class="field" style="width:96px"><span>Portions</span><input class="input" id="r-n" inputmode="decimal" value="1"></label></div>
      <button class="btn pink block" data-act="recToJournal">Ajouter au journal du jour</button></div>` : ''}
    <label class="field"><span>Étapes</span><textarea class="input" style="min-height:120px" data-rec="steps" placeholder="1. …">${esc(r.steps || '')}</textarea></label>
    <label class="field"><span>Mes notes</span><textarea class="input" data-rec="notes" placeholder="Ce que je changerais, où trouver les ingrédients…">${esc(r.notes || '')}</textarea></label>
    <label class="btn soft-pink" style="position:relative;overflow:hidden">${r.image ? "Changer l'image" : 'Ajouter une image'}<input type="file" accept="image/*" data-act-change="recipeImageSet" style="position:absolute;inset:0;opacity:0"></label>
    <button class="btn danger block" data-act="recDelete">Supprimer la recette</button>`;
}

// ---------- Vue : Idées recettes ----------
function defaultIdeaMeal() { const h = new Date().getHours(); return h < 10 ? 'petitdej' : h < 15 ? 'dejeuner' : h < 18 ? 'collation' : 'diner'; }
function vIdeas() {
  const meal = S.ui.ideaMeal || defaultIdeaMeal();
  const k = dayKey(); const tg = targetsFor(k);
  const eaten = sumMacros(entriesOf(k).filter((e) => e.meal !== meal));
  const mt = mealTarget(meal, tg, eaten);
  const fridge = (S.fridge || []).map((id) => S.foodMap[id]).filter(Boolean);
  const mealName = MEALS.find((m) => m.id === meal).name;
  let results = '';
  if (fridge.length && mt) {
    const plate = buildPlate(fridge, mt);
    const ideas = prepIdeas(plate.groups);
    const t = plate.tot;
    results = `<div class="card">
      <div class="between"><h3>Ton assiette calculée</h3><span class="pill">${mealName}</span></div>
      ${plate.items.map((i) => `<div class="between small" style="padding:4px 0;border-top:1px solid var(--line)"><span>${esc(i.food.name)}</span><b>${i.grams} g</b></div>`).join('')}
      <div class="between bold" style="padding:10px 12px;border-radius:16px;background:var(--bg)"><span>${Math.round(t.kcal)} kcal</span><span class="blue">${Math.round(t.p)} g P</span><span>${Math.round(t.g)} g G</span><span>${Math.round(t.l)} g L</span></div>
      <span class="tiny muted">Objectif du repas : ${mt.kcal} kcal · ${mt.p} g P · ${mt.g} g G · ${mt.l} g L. Les poids sont ceux des aliments tels qu'indiqués (cru ou cuit).</span>
      ${plate.missing.length ? `<span class="small pink bold">Pour un repas complet, il manque ${list2(plate.missing)}.</span>` : ''}
      ${ideas.map((d) => `<div class="col" style="gap:4px;padding:12px 14px;border-radius:18px;background:var(--pink-soft)"><span class="bold" style="color:var(--pink-deep)">${esc(d.name)} · ${d.time}</span><span class="small" style="color:var(--pink-deep)">${esc(d.steps)}</span></div>`).join('')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button class="btn pink" data-act="plateToJournal">Ajouter au ${mealName.toLowerCase()}</button><button class="btn soft-pink" data-act="plateToRecipe">Garder la recette</button></div></div>`;
    const mine = S.recipes.map((r) => ({ r, n: (r.ingredients || []).filter((i) => S.fridge.includes(i.foodId)).length })).filter((x) => x.n).sort((a, b) => b.n - a.n).slice(0, 4);
    if (mine.length) results += `<span class="label">Mes recettes avec ces ingrédients</span>${mine.map(({ r, n }) => { const pr = recipeTotals(r).per; return `<a class="list-item" href="#/recette/${r.id}"><span class="thumb pink">${I.food}</span><span class="grow"><span class="li-title">${esc(r.name)}</span><br><span class="li-sub">${n} ingrédient${n > 1 ? 's' : ''} en commun · ${Math.round(pr.kcal)} kcal · ${Math.round(pr.p)} g P par portion</span></span>${I.next}</a>`; }).join('')}`;
    results += `<div class="card flat"><span class="bold">Envie d'idées plus créatives ?</span><span class="small muted">Copie une demande toute prête avec tes ingrédients et tes macros, puis colle-la dans l'app Claude.</span><button class="btn soft" data-act="copyPrompt">Copier la demande</button></div>`;
  }
  return `<h1>Nutrition</h1>${nutriSeg('i')}
    ${!tg ? `<a class="card pink" href="#/profil"><span class="bold">Calcule d'abord tes besoins</span><span class="small" style="color:var(--pink-deep)">Les portions sont calculées à partir de tes macros du jour.</span></a>` : ''}
    <div class="card">
      <h3>Qu'est-ce que j'ai à la maison ?</h3>
      ${fridge.length ? `<div class="chips">${fridge.map((f) => `<span class="chip pink" style="padding-right:6px">${esc(f.name)}<button data-act="fridgeDel" data-id="${esc(f.id)}" aria-label="Retirer ${esc(f.name)}" style="width:24px;height:24px;border:0;border-radius:12px;background:#fff;color:var(--pink-ink);font-weight:800">×</button></span>`).join('')}</div>` : ''}
      <label class="search" style="border:2px solid var(--line)">${I.search}<span class="sr">Ajouter un ingrédient</span><input id="fridge-q" type="search" placeholder="+ Ajouter un ingrédient" value="${esc(S.ui.fridgeQ || '')}" data-bind="fridgeQ" autocomplete="off"></label>
      <div id="fridgeres" class="col" style="gap:6px">${fridgeResults()}</div>
      <div class="chips">${['petitdej', 'dejeuner', 'collation', 'post', 'diner'].map((m) => `<button class="chip ${meal === m ? 'blue on' : 'blue'}" data-act="ideaMeal" data-v="${m}">${MEALS.find((x) => x.id === m).name}</button>`).join('')}</div>
      ${mt ? `<span class="pill grey" style="align-self:flex-start">Pour ce repas : ${mt.kcal} kcal · ${mt.p} g P</span>` : ''}
      ${fridge.length ? '<button class="btn small ghost" data-act="fridgeClear" style="align-self:flex-start">Tout retirer</button>' : ''}</div>
    ${results || (tg ? '<div class="empty">Ajoute 2 ou 3 ingrédients (par exemple patate douce, poulet, épinards) : l\'app calcule les quantités pour ce repas.</div>' : '')}`;
}
const list2 = (arr) => arr.length <= 1 ? (arr[0] || '') : arr.slice(0, -1).join(', ') + ' et ' + arr[arr.length - 1];
function fridgeResults() {
  const q = (S.ui.fridgeQ || '').trim(); if (!q) return '';
  const res = searchFoods(S.foods, q, 6).filter((f) => !(S.fridge || []).includes(f.id));
  return res.length ? res.map((f) => `<button class="list-item" style="padding:8px 12px" data-act="fridgeAdd" data-id="${esc(f.id)}"><span class="grow li-title" style="font-size:14px">${esc(f.name)}</span><span class="pill pink">Ajouter</span></button>`).join('') : '<span class="small muted">Pas trouvé : crée l\'aliment depuis le journal.</span>';
}
function refreshFridgeRes() { const c = document.getElementById('fridgeres'); if (c) c.innerHTML = fridgeResults(); }

function compressImage(file, max = 1080, q = 0.72) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', q));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')); };
    img.src = url;
  });
}

// ---------- Feuilles (fenêtres du bas) ----------
function renderSheet() {
  const el = $('#sheet');
  if (!S.sheet) { el.innerHTML = ''; document.body.style.overflow = ''; return; }
  document.body.style.overflow = 'hidden';
  const sh = S.sheet;
  let body = '';
  if (sh.type === 'picker') {
    body = `<div class="between"><h2>${esc(sh.title)}</h2><button class="icon-btn" data-act="closeSheet" aria-label="Fermer">${I.x}</button></div>
      ${libraryControls('p')}<div id="libbody" class="col" style="gap:14px">${libraryBody({ pick: true })}</div>`;
  } else if (sh.type === 'video') {
    const v = sh.video;
    const opts = GROUPS.map((g) => `<optgroup label="${g}">${S.exercises.filter((e) => S.mMap[e.primary[0]]?.group === g).sort((a, b) => a.name.localeCompare(b.name)).map((e) => `<option value="${e.id}" ${v.exerciseId === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</optgroup>`).join('');
    body = `<div class="between"><h2>${v.id && !sh.isNew ? 'Modifier la vidéo' : 'Nouvelle vidéo'}</h2><button class="icon-btn" data-act="closeSheet" aria-label="Fermer">${I.x}</button></div>
      <label class="field"><span>Lien</span><input class="input" id="v-url" value="${esc(v.url)}" placeholder="https://www.instagram.com/reel/…" inputmode="url" autocomplete="off"></label>
      <label class="field"><span>Titre (facultatif)</span><input class="input" id="v-title" value="${esc(v.title)}" placeholder="Ex. Hip thrust — placement du banc"></label>
      <label class="field"><span>Exercice</span><select class="input" id="v-ex"><option value="">À ranger plus tard</option>${opts}</select></label>
      <label class="field"><span>Ma note</span><textarea class="input" id="v-note" placeholder="Le point technique à retenir">${esc(v.note)}</textarea></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:end">
        <label class="field"><span>Moment clé</span><input class="input" id="v-at" value="${esc(v.at)}" placeholder="0:42"></label>
        <label class="row bold small" style="min-height:48px"><input type="checkbox" id="v-ref" ${v.ref ? 'checked' : ''} style="width:22px;height:22px"> Vidéo de référence</label></div>
      <button class="btn pink block" data-act="saveVideo">Enregistrer</button>
      ${!sh.isNew ? `<button class="btn danger block" data-act="delVideo" data-id="${v.id}">Supprimer la vidéo</button>` : ''}`;
  } else if (sh.type === 'inbox') {
    const list = inbox();
    body = `<div class="between"><h2>Vidéos à ranger</h2><button class="icon-btn" data-act="closeSheet" aria-label="Fermer">${I.x}</button></div>
      ${list.length ? list.map((v) => `<button class="list-item" data-act="editVideo" data-id="${v.id}">${thumbHtml(v, 'pink')}<span class="grow"><span class="li-title">${esc(v.title || v.platform)}</span><br><span class="li-sub">${esc(v.url.slice(0, 48))}…</span></span><span class="pill pink">Ranger</span></button>`).join('') : '<div class="empty">Tout est rangé !</div>'}`;
  } else if (sh.type === 'exercise') {
    const e = sh.ex;
    const mchips = (field) => GROUPS.map((g) => S.muscles.filter((m) => m.group === g).map((m) => `<button class="chip ${e[field].includes(m.id) ? 'on' : ''}" data-act="exMuscle" data-f="${field}" data-v="${m.id}">${esc(m.name)}</button>`).join('')).join('');
    body = `<div class="between"><h2>${sh.isNew ? 'Nouvel exercice' : 'Modifier l\'exercice'}</h2><button class="icon-btn" data-act="closeSheet" aria-label="Fermer">${I.x}</button></div>
      <label class="field"><span>Nom</span><input class="input" id="e-name" value="${esc(e.name)}" placeholder="Ex. Hip thrust unilatéral"></label>
      <label class="field"><span>Matériel</span><select class="input" id="e-eq">${['Barre', 'Haltère', 'Haltères', 'Machine', 'Poulie', 'Poids du corps', 'Élastique', 'Kettlebell', 'Banc', 'Autre'].map((x) => `<option ${e.equipment === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <div class="seg"><button class="${e.type === 'poly' ? 'on' : ''}" data-act="exType" data-v="poly">Polyarticulaire</button><button class="${e.type === 'iso' ? 'on' : ''}" data-act="exType" data-v="iso">Isolation</button></div>
      <span class="label">Muscles principaux</span><div class="chips">${mchips('primary')}</div>
      <span class="label">Muscles secondaires</span><div class="chips">${mchips('secondary')}</div>
      <button class="btn pink block" data-act="saveExercise">Enregistrer</button>
      ${!sh.isNew ? `<button class="btn danger block" data-act="delExercise">Supprimer l'exercice</button>` : ''}`;
  } else if (sh.type === 'entryMenu') {
    const en = S.active.entries[sh.e];
    body = `<div class="between"><h2>${esc(S.exMap[en.exerciseId]?.name)}</h2><button class="icon-btn" data-act="closeSheet" aria-label="Fermer">${I.x}</button></div>
      <button class="btn soft block" data-act="swapPick" data-e="${sh.e}">Remplacer par un autre exercice</button>
      <button class="btn soft block" data-act="entryMove" data-e="${sh.e}" data-d="-1">Monter</button>
      <button class="btn soft block" data-act="entryMove" data-e="${sh.e}" data-d="1">Descendre</button>
      <button class="btn soft block" data-act="delLastSet" data-e="${sh.e}">Retirer la dernière série</button>
      <button class="btn danger block" data-act="entryDel" data-e="${sh.e}">Retirer l'exercice de la séance</button>`;
  }
  if (!body) body = nutriSheet(sh);
  el.innerHTML = `<div class="sheet-bg" data-act="sheetBg"><div class="sheet" role="dialog" aria-modal="true">${body}</div></div>`;
}
const openSheet = (s) => { if (s.type === 'picker') S.ui.libQuery = ''; S.sheet = s; renderSheet(); };
const closeSheet = () => { if (S.sheet && S.sheet.type === 'picker') S.ui.libQuery = ''; S.sheet = null; renderSheet(); };

function refreshLibBody() {
  const b = document.getElementById('libbody');
  if (b) b.innerHTML = libraryBody({ pick: !!(S.sheet && S.sheet.type === 'picker') });
}

// ---------- Actions ----------
async function openVideoSheet(prefill = {}) {
  openSheet({ type: 'video', isNew: true, video: { id: uid(), url: '', title: '', exerciseId: '', note: '', at: '', ref: false, ...prefill } });
}
const A = {
  back: () => history.length > 1 ? history.back() : go('/aujourdhui'),
  goHome: () => go('/aujourdhui'),
  openEx: (el) => { closeSheet(); go('/exercice/' + encodeURIComponent(el.dataset.id)); },
  toggleSec: (el) => { const k = el.dataset.key; const cur = el.getAttribute('aria-expanded') === 'true'; S.ui.expanded[k] = !cur; refreshLibBody(); },
  libMode: (el) => { S.ui.libMode = el.dataset.v; S.ui.libQuery = ''; S.sheet ? renderSheet() : render(); },
  libGroup: (el) => { S.ui.libGroup = el.dataset.v; S.ui.libQuery = ''; S.sheet ? renderSheet() : render(); },
  libType: (el) => { S.ui.libType = el.dataset.v; S.ui.libQuery = ''; S.sheet ? renderSheet() : render(); },
  closeSheet: () => closeSheet(),
  sheetBg: (el, ev) => { if (ev.target === el) closeSheet(); },

  async pasteVideo(el) {
    let text = '';
    try { if (navigator.clipboard && navigator.clipboard.readText) text = (await navigator.clipboard.readText()).trim(); } catch (e) { /* accès refusé */ }
    const m = text.match(/https?:\/\/\S+/);
    const url = m ? m[0] : '';
    const exId = el.dataset.ex || '';
    await openVideoSheet({ url, exerciseId: exId, ref: exId ? videosOf(exId).length === 0 : false });
    if (!url) { toast('Colle le lien dans le champ'); setTimeout(() => $('#v-url')?.focus(), 50); }
  },
  async saveVideo() {
    const sh = S.sheet; const v = { ...sh.video };
    v.url = $('#v-url').value.trim(); v.title = $('#v-title').value.trim(); v.exerciseId = $('#v-ex').value || null;
    v.note = $('#v-note').value.trim(); v.at = $('#v-at').value.trim(); v.ref = $('#v-ref').checked;
    if (!isUrl(v.url)) { toast('Ce lien ne semble pas valide'); return; }
    v.platform = platformOf(v.url);
    if (v.ref && v.exerciseId) for (const o of S.videos.filter((x) => x.exerciseId === v.exerciseId && x.id !== v.id && x.ref)) await db.put('videos', { ...o, ref: false });
    if (!v.createdAt) v.createdAt = new Date().toISOString();
    await db.put('videos', v);
    closeSheet(); toast(v.exerciseId ? 'Vidéo rangée' : 'Vidéo ajoutée aux vidéos à ranger');
    await reload();
  },
  editVideo: (el) => { const v = S.videos.find((x) => x.id === el.dataset.id); if (v) openSheet({ type: 'video', isNew: false, video: { ...v } }); },
  async delVideo(el) { if (!confirm('Supprimer cette vidéo ?')) return; await db.remove('videos', el.dataset.id); closeSheet(); await reload(); },
  openInbox: () => openSheet({ type: 'inbox' }),

  newExercise: () => openSheet({ type: 'exercise', isNew: true, ex: { id: 'perso-' + uid(), name: '', equipment: 'Haltères', type: 'iso', primary: [], secondary: [], variants: [], notes: '', custom: true } }),
  editExercise: (el) => { const e = S.exMap[el.dataset.id]; openSheet({ type: 'exercise', isNew: false, ex: JSON.parse(JSON.stringify(e)) }); },
  exMuscle: (el) => {
    const e = S.sheet.ex; const f = el.dataset.f; const v = el.dataset.v;
    e.name = $('#e-name').value; e.equipment = $('#e-eq').value;
    e[f] = e[f].includes(v) ? e[f].filter((x) => x !== v) : [...e[f], v];
    const other = f === 'primary' ? 'secondary' : 'primary'; e[other] = e[other].filter((x) => x !== v);
    renderSheet();
  },
  exType: (el) => { const e = S.sheet.ex; e.name = $('#e-name').value; e.equipment = $('#e-eq').value; e.type = el.dataset.v; renderSheet(); },
  async saveExercise() {
    const e = S.sheet.ex; e.name = $('#e-name').value.trim(); e.equipment = $('#e-eq').value;
    if (!e.name) { toast('Donne un nom à l\'exercice'); return; }
    if (!e.primary.length) { toast('Choisis au moins un muscle principal'); return; }
    await db.put('exercises', e); closeSheet(); await reload(); go('/exercice/' + encodeURIComponent(e.id));
  },
  async delExercise() { if (!confirm('Supprimer cet exercice ?')) return; await db.remove('exercises', S.sheet.ex.id); closeSheet(); await reload(); go('/exercices'); },
  addVariant: (el) => openSheet({ type: 'picker', title: 'Choisir une variante', onPick: async (id) => {
    const e = { ...S.exMap[el.dataset.id] }; if (id === e.id) return;
    e.variants = [...new Set([...(e.variants || []), id])]; await db.put('exercises', e); await reload();
  } }),
  async pick(el) { const fn = S.sheet && S.sheet.onPick; closeSheet(); if (fn) await fn(el.dataset.id); },

  // Séance (modèle)
  tType: (el) => {
    const d = S.draft; const t = SESSION_TYPES.find((x) => x.id === el.dataset.v);
    d.type = d.type === t.id ? null : t.id;
    if (d.type && !d.targets.length) d.targets = [...t.muscles];
    if (d.type && !d.name) d.name = t.name;
    render();
  },
  tTarget: (el) => { const d = S.draft; const v = el.dataset.v; d.targets = d.targets.includes(v) ? d.targets.filter((x) => x !== v) : [...d.targets, v]; render(); },
  tAdd: () => openSheet({ type: 'picker', title: 'Ajouter un exercice', onPick: (id) => {
    const ex = S.exMap[id]; const poly = ex.type === 'poly';
    S.draft.lines.push({ exerciseId: id, sets: 3, repMin: poly ? 6 : 10, repMax: poly ? 10 : 15, rir: 2, rest: poly ? 150 : 90, variantId: (ex.variants || [])[0] || null });
    render(); toast(ex.name + ' ajouté');
  } }),
  tApply: (el) => {
    const d = S.draft; const sugg = suggest(d, S.exMap, S.mMap, S.exercises)[Number(el.dataset.i)];
    if (sugg) { d.lines = applySuggestion(d.lines, sugg.apply); render(); toast('Ajustement appliqué'); }
  },
  lMove: (el) => { const i = Number(el.dataset.i); const j = i + Number(el.dataset.d); const L = S.draft.lines; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; render(); },
  lDel: (el) => { S.draft.lines.splice(Number(el.dataset.i), 1); render(); },
  async tSave() { if (await saveDraft()) { toast('Séance enregistrée'); go('/seances'); } },
  async tSaveStart() { const id = await saveDraft(); if (id) await startSession(id); },
  async tDelete() { if (!confirm('Supprimer cette séance ?')) return; await db.remove('templates', S.draft.id); S.draft = null; await reload(); go('/seances'); },

  // Séance en cours
  start: (el) => startSession(el.dataset.id),
  startFree: () => startSession(null),
  async setDone(el) {
    const en = S.active.entries[Number(el.dataset.e)]; const s = en.sets[Number(el.dataset.s)];
    if (!s.done) {
      if (s.reps === '' && s.hintReps !== '') s.reps = s.hintReps;
      if (s.kg === '' || s.reps === '') { toast('Indique la charge et les répétitions'); return; }
      s.done = true;
      if (s.type !== 'warmup') {
        const prev = records(en.exerciseId).best; const now = e1rm(s.kg, s.reps);
        if (prev && now > prev) toast(`Nouveau record ! 1RM estimé ${fmtNum(now)} kg`);
        startTimer(Number(en.line?.rest) || (S.exMap[en.exerciseId]?.type === 'poly' ? 150 : 90));
      }
    } else s.done = false;
    await saveActive(); render();
  },
  async addSet(el) { const en = S.active.entries[Number(el.dataset.e)]; const l = en.sets[en.sets.length - 1]; en.sets.push({ type: 'work', kg: l ? l.kg : '', reps: '', rir: '', done: false, hintReps: l ? (l.reps || l.hintReps) : '' }); await saveActive(); render(); },
  async addWarmup(el) {
    const en = S.active.entries[Number(el.dataset.e)]; const w = en.sets.find((x) => x.type !== 'warmup');
    const kg = w && parseNum(w.kg) ? Math.round(parseNum(w.kg) * 0.5 / 2.5) * 2.5 : '';
    en.sets.unshift({ type: 'warmup', kg, reps: '', rir: '', done: false, hintReps: 10 }); await saveActive(); render();
  },
  async delLastSet(el) { const en = S.active.entries[Number(el.dataset.e)]; if (en.sets.length > 1) en.sets.pop(); closeSheet(); await saveActive(); render(); },
  async swapVariant(el) {
    const ei = Number(el.dataset.e); const en = S.active.entries[ei];
    replaceEntry(ei, makeEntry(en.line.variantId, { ...en.line, variantId: en.exerciseId }));
    await saveActive(); render(); toast('Remplacé par ' + S.exMap[en.line.variantId].name);
  },
  swapPick: (el) => { const ei = Number(el.dataset.e); openSheet({ type: 'picker', title: 'Remplacer par…', onPick: async (id) => {
    const en = S.active.entries[ei]; replaceEntry(ei, makeEntry(id, en.line ? { ...en.line, variantId: en.exerciseId } : null)); await saveActive(); render();
  } }); },
  entryMenu: (el) => openSheet({ type: 'entryMenu', e: Number(el.dataset.e) }),
  async entryMove(el) { const i = Number(el.dataset.e); const j = i + Number(el.dataset.d); const E = S.active.entries; if (j >= 0 && j < E.length) [E[i], E[j]] = [E[j], E[i]]; closeSheet(); await saveActive(); render(); },
  async entryDel(el) { S.active.entries.splice(Number(el.dataset.e), 1); closeSheet(); await saveActive(); render(); },
  sessAdd: () => openSheet({ type: 'picker', title: 'Ajouter un exercice', onPick: async (id) => {
    const ex = S.exMap[id]; const poly = ex.type === 'poly';
    S.active.entries.push(makeEntry(id, { exerciseId: id, sets: 3, repMin: poly ? 6 : 10, repMax: poly ? 10 : 15, rest: poly ? 150 : 90, variantId: (ex.variants || [])[0] || null }));
    await saveActive(); render();
    setTimeout(() => document.getElementById('entry-' + (S.active.entries.length - 1))?.scrollIntoView({ behavior: 'smooth' }), 50);
  } }),
  timerPlus: () => { if (S.timer) S.timer.end += 30000; renderTimer(); },
  timerSkip: () => { S.timer = null; renderTimer(); },
  async finish() {
    const a = S.active;
    const doneCount = a.entries.reduce((n, e) => n + e.sets.filter((x) => x.done).length, 0);
    if (!doneCount) { if (confirm('Aucune série validée. Abandonner la séance ?')) await A.abandon(true); return; }
    if (!confirm('Terminer la séance ?')) return;
    const recs = [];
    for (const e of a.entries) {
      const prev = records(e.exerciseId).best;
      const best = Math.max(0, ...e.sets.filter((x) => x.done && x.type !== 'warmup').map((x) => e1rm(x.kg, x.reps)));
      if (prev && best > prev) recs.push(e.exerciseId);
    }
    const session = {
      id: a.id, name: a.name, templateId: a.templateId, targets: a.targets, start: a.start, end: new Date().toISOString(), notes: a.notes || '', records: recs,
      entries: a.entries.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.filter((x) => x.done).map((x) => ({ type: x.type, kg: parseNum(x.kg) ?? 0, reps: parseNum(x.reps) ?? 0, rir: parseNum(x.rir), done: true })) })).filter((e) => e.sets.length),
    };
    await db.put('sessions', session);
    S.active = null; S.timer = null; await db.setSetting('active', null);
    if (wakeLock) { try { await wakeLock.release(); } catch (e) { /* */ } }
    await reload(); go('/bilan/' + session.id);
  },
  async abandon(skipConfirm) {
    if (skipConfirm !== true && !confirm('Abandonner la séance ? Les séries ne seront pas enregistrées.')) return;
    S.active = null; S.timer = null; await db.setSetting('active', null); go('/aujourdhui'); render();
  },
  async delSession(el) { if (!confirm('Supprimer cette séance de l\'historique ?')) return; await db.remove('sessions', el.dataset.id); await reload(); go('/seances'); },

  // Sauvegarde
  async export() {
    // Le fichier est préparé à l'ouverture des Réglages : iOS exige que le partage parte directement du toucher.
    const prep = S.exportPrep || await buildExport();
    S.exportPrep = null;
    const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(prep.blob); a.download = prep.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
    try {
      if (navigator.canShare && navigator.canShare({ files: [prep.file] })) await navigator.share({ files: [prep.file], title: prep.name });
      else download();
    } catch (e) {
      if (e.name === 'AbortError') { S.exportPrep = await buildExport(); return; }
      download();
    }
    await db.setSetting('lastBackup', new Date().toISOString()); await reload(); toast('Sauvegarde créée');
  },
};

async function buildExport() {
  const dump = await db.exportAll();
  const name = `sauvegarde-sport-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(dump)], { type: 'application/json' });
  return { name, blob, file: new File([blob], name, { type: 'application/json' }) };
}

async function saveDraft() {
  const d = S.draft;
  if (!d.name.trim()) { toast('Donne un nom à ta séance'); return null; }
  if (!d.lines.length) { toast('Ajoute au moins un exercice'); return null; }
  const t = { ...d }; delete t._for; delete t.isNew;
  t.lines = t.lines.map((l) => ({ ...l, sets: parseNum(l.sets) || 1, repMin: parseNum(l.repMin), repMax: parseNum(l.repMax), rest: parseNum(l.rest) }));
  t.targetMinutes = parseNum(t.targetMinutes);
  await db.put('templates', t); S.draft = null; await reload();
  return t.id;
}

const CHANGE = {
  async exNotes(el) { const e = { ...S.exMap[el.dataset.id], notes: el.value }; await db.put('exercises', e); S.exMap[e.id] = e; toast('Note enregistrée'); },
  async sessNotes(el) { S.active.notes = el.value; await saveActive(); },
  async import(el) {
    const f = el.files && el.files[0]; if (!f) return;
    if (!confirm('Restaurer cette sauvegarde ? Les données actuelles seront remplacées.')) { el.value = ''; return; }
    try { await db.importAll(JSON.parse(await f.text())); await reload(); toast('Sauvegarde restaurée'); } catch (e) { toast('Restauration impossible : ' + e.message); }
  },
};


// ---------- Actions nutrition ----------
Object.assign(A, {
  addFood: (el) => { openSheet({ type: 'food', meal: el.dataset.meal, day: el.dataset.day, q: '', online: null }); setTimeout(() => document.getElementById('food-q')?.focus(), 80); },
  async pickFood(el) {
    const sh = S.sheet; const id = el.dataset.id;
    let food = S.foodMap[id] || (sh.online || []).find((f) => f.id === id) || recentFoods().find((f) => f.id === id);
    if (!food) return;
    if (!S.foodMap[id] && food.origin === 'off') { await db.put('foods', { ...food }); await load(); }
    openSheet({ type: 'qty', food, meal: sh.meal, day: sh.day, grams: food.portionG || 100, target: sh.target, recipeId: sh.recipeId });
  },
  qtySet: (el) => { S.sheet.grams = el.dataset.v; const i = $('#q-g'); if (i) i.value = el.dataset.v; $('#qtymac').innerHTML = qtyMacros(S.sheet); },
  async toggleFav() {
    const id = S.sheet.food.id;
    S.favs = S.favs.includes(id) ? S.favs.filter((x) => x !== id) : [id, ...S.favs];
    await db.setSetting('favs', S.favs); if ($('#q-meal')) S.sheet.meal = $('#q-meal').value; renderSheet();
  },
  async saveEntry() {
    const sh = S.sheet; const grams = parseNum(sh.grams);
    if (!(grams > 0)) { toast('Indique une quantité'); return; }
    if (sh.target === 'recipe') {
      const r = S.recipes.find((x) => x.id === sh.recipeId); const f2 = sh.food;
      await saveRecipe({ ...r, ingredients: [...(r.ingredients || []), { foodId: f2.id, name: f2.name, grams, per: { kcal: f2.kcal, p: f2.p, g: f2.g, l: f2.l } }] }, false);
      closeSheet(); render(); toast(f2.name + ' ajouté'); return;
    }
    const old = sh.entryId ? S.journal.find((e) => e.id === sh.entryId) : null;
    const f = sh.food;
    const e = { ...(old || { id: uid(), date: sh.day, createdAt: new Date().toISOString() }), meal: $('#q-meal').value, foodId: f.id, name: f.name, grams,
      per: { kcal: f.kcal, p: f.p, g: f.g, l: f.l }, portionName: f.portionName || null, portionG: f.portionG || null, quick: false };
    await db.put('journal', e); closeSheet(); await reload(); toast(old ? 'Modifié' : `${f.name} ajouté`);
  },
  editEntry: (el) => {
    const e = S.journal.find((x) => x.id === el.dataset.id); if (!e) return;
    if (e.quick) { openSheet({ type: 'quick', entry: e, day: e.date, meal: e.meal }); return; }
    const food = S.foodMap[e.foodId] || { id: e.foodId, name: e.name, ...e.per, portionName: e.portionName, portionG: e.portionG };
    openSheet({ type: 'qty', food, meal: e.meal, day: e.date, grams: e.grams, entryId: e.id });
  },
  async delEntry(el) { await db.remove('journal', el.dataset.id); closeSheet(); await reload(); toast('Retiré'); },
  quickAdd: (el) => openSheet({ type: 'quick', day: el.dataset.day, meal: el.dataset.meal }),
  async saveQuick() {
    const sh = S.sheet; const v = (k) => parseNum($('#qk-' + k).value);
    const kcal = v('kcal');
    if (!(kcal >= 0) || kcal === null) { toast('Indique au moins les calories'); return; }
    const e = { ...(sh.entry || { id: uid(), date: sh.day, createdAt: new Date().toISOString() }), quick: true, name: $('#qk-name').value.trim() || 'Saisie rapide',
      kcal, p: v('p') || 0, g: v('g') || 0, l: v('l') || 0, meal: $('#q-meal').value };
    await db.put('journal', e); closeSheet(); await reload(); toast('Ajouté');
  },
  newFood: () => { const sh = S.sheet; openSheet({ type: 'newFood', food: { name: sh.q }, meal: sh.meal, day: sh.day, target: sh.target, recipeId: sh.recipeId }); },
  async saveNewFood() {
    const sh = S.sheet; const v = (k) => parseNum($('#nf-' + k).value);
    const name = $('#nf-name').value.trim();
    if (!name) { toast('Donne un nom'); return; }
    if (v('kcal') === null) { toast('Indique les calories pour 100 g'); return; }
    const f = { id: 'perso-' + uid(), name, kcal: v('kcal'), p: v('p') || 0, g: v('g') || 0, l: v('l') || 0,
      portionName: $('#nf-pn').value.trim() || null, portionG: v('pg') || null, origin: 'perso', custom: true };
    if (f.portionName && !f.portionG) f.portionName = null;
    await db.put('foods', f); await load();
    openSheet({ type: 'qty', food: f, meal: sh.meal, day: sh.day, grams: f.portionG || 100, target: sh.target, recipeId: sh.recipeId });
  },
  async offSearch() {
    const sh = S.sheet; const q = sh.q.trim(); if (!q) return;
    sh.loading = true; sh.error = null; refreshFoodRes();
    try {
      const res = await fetch(offUrl(q));
      if (!res.ok && res.status !== 404) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      const list = (j.product ? [j.product] : (j.products || [])).map(offToFood).filter(Boolean);
      if (S.sheet === sh) { sh.online = list; }
    } catch (e) {
      if (S.sheet === sh) { sh.online = []; sh.error = 'Recherche impossible pour le moment (réseau ?). Tu peux créer l\'aliment toi-même.'; }
    }
    sh.loading = false; if (S.sheet === sh) refreshFoodRes();
  },
  async toggleDayType(el) {
    const k = el.dataset.day; S.dayTypes[k] = isTrainDay(k) ? 'rest' : 'train';
    await db.setSetting('dayTypes', S.dayTypes); render();
  },
  async water(el) {
    const k = el.dataset.day; const d = S.daily.find((x) => x.id === k) || { id: k, water: 0 };
    d.water = Math.max(0, (Number(d.water) || 0) + Number(el.dataset.v));
    await db.put('daily', { ...d }); await reload();
  },
  async copyDay(el) {
    const k = el.dataset.day; const prev = entriesOf(addDays(k, -1));
    if (!prev.length) { toast('Rien à copier : la veille est vide'); return; }
    if (!confirm(`Copier les ${prev.length} aliments de la veille sur ce jour ?`)) return;
    const now = new Date().toISOString();
    await db.putMany('journal', prev.map((e, i) => ({ ...e, id: uid(), date: k, createdAt: now + String(i).padStart(3, '0'), updatedAt: now })));
    await reload(); toast('Journée copiée');
  },
  pSex: (el) => { S.pdraft.sex = el.dataset.v; render(); },
  pGoal: (el) => { S.pdraft.goal = el.dataset.v; if (S.pdraft.manual && !confirm('Remplacer tes chiffres manuels par le nouveau calcul ?')) { render(); return; } S.pdraft.manual = null; render(); },
  pDay: (el) => { const d = Number(el.dataset.v); const t = S.pdraft.trainDays; S.pdraft.trainDays = t.includes(d) ? t.filter((x) => x !== d) : [...t, d]; render(); },
  async pSave() {
    const p = { ...S.pdraft, birthYear: parseNum(S.pdraft.birthYear), height: parseNum(S.pdraft.height), weight: parseNum(S.pdraft.weight) };
    const err = profileErrors(p);
    if (err.length) { toast('Il manque ' + err.join(', ')); return; }
    if (p.weight !== latestWeight()) {
      const k = dayKey(); const ex = S.weights.find((w) => w.date === k);
      await db.put('weights', ex ? { ...ex, kg: p.weight } : { id: uid(), date: k, kg: p.weight });
    }
    await db.setSetting('profile', p); S.pdraft = null; await load(); toast('Objectifs enregistrés'); go('/nutrition');
  },
  async saveWeight() {
    const kg = parseNum($('#w-kg').value);
    if (!(kg >= 30 && kg <= 250)) { toast('Indique ton poids en kg'); return; }
    const k = dayKey(); const ex = S.weights.find((w) => w.date === k);
    await db.put('weights', ex ? { ...ex, kg } : { id: uid(), date: k, kg });
    await reload(); toast('Pesée enregistrée');
  },
  async delWeight(el) { if (!confirm('Supprimer cette pesée ?')) return; await db.remove('weights', el.dataset.id); await reload(); },
});
CHANGE.pManual = (el) => {
  const p = S.pdraft;
  if (el.checked && !profileErrors(p).length) { const t = computeTargets(p, p.weight); p.manual = { train: { ...t.train }, rest: { ...t.rest } }; } else p.manual = null;
  refreshProfRes();
};


// ---------- Actions recettes ----------
const curRecipe = () => S.recipes.find((x) => x.id === route().id);
async function saveRecipe(r, rerender = true) { await db.put('recipes', r); const i = S.recipes.findIndex((x) => x.id === r.id); if (i >= 0) S.recipes[i] = r; else S.recipes.push(r); if (rerender) render(); }
Object.assign(A, {
  recFilter: (el) => { S.ui.recFilter = el.dataset.v; render(); },
  recTag: (el) => { S.ui.recTag = S.ui.recTag === el.dataset.v ? null : el.dataset.v; render(); },
  async recipeLink() {
    let text = '';
    try { if (navigator.clipboard && navigator.clipboard.readText) text = (await navigator.clipboard.readText()).trim(); } catch (e) { /* refusé */ }
    const m = text.match(/https?:\/\/\S+/);
    openSheet({ type: 'recipeLink', url: m ? m[0] : '' });
  },
  async saveRecipeLink() {
    const url = $('#rl-url').value.trim(); const name = $('#rl-name').value.trim();
    if (!isUrl(url)) { toast('Ce lien ne semble pas valide'); return; }
    const r = { id: uid(), name: name || 'Recette ' + platformOf(url), url, status: 'atester', tags: [], ingredients: [], servings: 1, createdAt: new Date().toISOString() };
    await saveRecipe(r, false); closeSheet(); toast('Recette ajoutée'); go('/recette/' + r.id);
  },
  recStatus: async (el) => { const r = { ...curRecipe(), status: el.dataset.v }; await saveRecipe(r); },
  recRate: async (el) => { const r = curRecipe(); const v = Number(el.dataset.v); await saveRecipe({ ...r, rating: r.rating === v ? 0 : v }); },
  recTagToggle: async (el) => { const r = curRecipe(); const t = r.tags || []; await saveRecipe({ ...r, tags: t.includes(el.dataset.v) ? t.filter((x) => x !== el.dataset.v) : [...t, el.dataset.v] }); },
  recIngAdd: () => openSheet({ type: 'food', meal: 'diner', day: dayKey(), q: '', online: null, target: 'recipe', recipeId: route().id }),
  recIngDel: async (el) => { const r = curRecipe(); const ing = [...r.ingredients]; ing.splice(Number(el.dataset.i), 1); await saveRecipe({ ...r, ingredients: ing }); },
  async recToJournal() {
    const r = curRecipe(); const n = parseNum($('#r-n').value) || 1; const per = recipeTotals(r).per;
    S.ui.recMeal = $('#r-meal').value;
    await db.put('journal', { id: uid(), date: dayKey(), createdAt: new Date().toISOString(), meal: S.ui.recMeal, quick: true, recipeId: r.id,
      name: `${r.name}${n !== 1 ? ` × ${fmtNum(n)}` : ''}`, kcal: per.kcal * n, p: per.p * n, g: per.g * n, l: per.l * n });
    await reload(); toast('Ajouté au journal');
  },
  async recDelete() { if (!confirm('Supprimer cette recette ?')) return; await db.remove('recipes', route().id); await reload(); go('/atester'); },
  ideaMeal: (el) => { S.ui.ideaMeal = el.dataset.v; render(); },
  async fridgeAdd(el) { S.fridge = [...(S.fridge || []), el.dataset.id]; S.ui.fridgeQ = ''; await db.setSetting('fridge', S.fridge); render(); setTimeout(() => document.getElementById('fridge-q')?.focus(), 30); },
  async fridgeDel(el) { S.fridge = S.fridge.filter((x) => x !== el.dataset.id); await db.setSetting('fridge', S.fridge); render(); },
  async fridgeClear() { S.fridge = []; await db.setSetting('fridge', []); render(); },
  currentPlate() {
    const meal = S.ui.ideaMeal || defaultIdeaMeal(); const k = dayKey();
    const mt = mealTarget(meal, targetsFor(k), sumMacros(entriesOf(k).filter((e) => e.meal !== meal)));
    const foods = S.fridge.map((id) => S.foodMap[id]).filter(Boolean);
    return { meal, plate: buildPlate(foods, mt), mt, foods };
  },
  async plateToJournal() {
    const { meal, plate } = A.currentPlate(); const now = Date.now();
    await db.putMany('journal', plate.items.map((i, n) => ({ id: uid(), date: dayKey(), createdAt: new Date(now + n).toISOString(), updatedAt: new Date().toISOString(), meal, foodId: i.food.id, name: i.food.name, grams: i.grams,
      per: { kcal: i.food.kcal, p: i.food.p, g: i.food.g, l: i.food.l }, portionName: i.food.portionName || null, portionG: i.food.portionG || null, quick: false })));
    await reload(); toast('Ajouté au journal'); go('/nutrition');
  },
  async plateToRecipe() {
    const { plate } = A.currentPlate(); const ideas = prepIdeas(plate.groups);
    const r = { id: uid(), name: (ideas[0] ? ideas[0].name + ' ' : '') + ['prot', 'carb', 'veg'].flatMap((role) => plate.items.filter((i) => roleOf(i.food) === role)).map((i) => i.food.name.replace(/^blanc de /i, '').replace(/ (crus?|crues?|cuits?|cuites?)$/i, '').toLowerCase()).slice(0, 2).join(' & '),
      status: 'validee', tags: ['Repas'], servings: 1, steps: ideas.map((d) => `${d.name} : ${d.steps}`).join('\n\n'), createdAt: new Date().toISOString(),
      ingredients: plate.items.map((i) => ({ foodId: i.food.id, name: i.food.name, grams: i.grams, per: { kcal: i.food.kcal, p: i.food.p, g: i.food.g, l: i.food.l } })) };
    await saveRecipe(r, false); toast('Recette enregistrée'); go('/recette/' + r.id);
  },
  async copyPrompt() {
    const { meal, mt, foods } = A.currentPlate();
    const txt = aiPrompt({ goalLabel: (GOALS[S.profile.goal] || GOALS.maintien).label, mealLabel: MEALS.find((m) => m.id === meal).name, target: mt, foods });
    try { await navigator.clipboard.writeText(txt); toast('Copié : colle-le dans l\'app Claude'); } catch (e) { openSheet({ type: 'promptText', text: txt }); }
  },
});
async function newRecipeFromImage(el, setOnCurrent) {
  const f = el.files && el.files[0]; if (!f) return;
  toast('Préparation de l\'image…');
  const image = await compressImage(f); el.value = '';
  if (setOnCurrent) { await saveRecipe({ ...curRecipe(), image }); return; }
  const r = { id: uid(), name: '', image, kind: el.dataset.kind, status: 'atester', tags: [], ingredients: [], servings: 1, createdAt: new Date().toISOString() };
  await saveRecipe(r, false); go('/recette/' + r.id); setTimeout(() => document.querySelector('[data-rec=name]')?.focus(), 100);
}
CHANGE.recipeImage = (el) => newRecipeFromImage(el, false);
CHANGE.recipeImageSet = (el) => newRecipeFromImage(el, true);

// ---------- Écouteurs ----------
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || !A[el.dataset.act]) return;
  if (el.dataset.act === 'sheetBg' && ev.target !== el) return;
  ev.preventDefault();
  Promise.resolve(A[el.dataset.act](el, ev)).catch((e) => { console.error(e); toast('Oups : ' + e.message); });
});
let saveT = null;
document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset.bind === 'libQuery') { S.ui.libQuery = el.value; refreshLibBody(); return; }
  if (el.dataset.bind === 'fridgeQ') { S.ui.fridgeQ = el.value; refreshFridgeRes(); return; }
  if (el.dataset.rec) { const r = curRecipe(); if (!r) return; const f = el.dataset.rec; r[f] = f === 'servings' ? (parseNum(el.value) || 1) : el.value; clearTimeout(saveT); saveT = setTimeout(() => saveRecipe(r, false), 500); if (f === 'servings') { const c = document.getElementById('recper'); if (c) c.innerHTML = recPerHtml(r); } return; }
  if (el.dataset.ring !== undefined) { const r = curRecipe(); if (!r) return; r.ingredients[Number(el.dataset.ring)].grams = parseNum(el.value) || 0; clearTimeout(saveT); saveT = setTimeout(() => saveRecipe(r, false), 500); const c = document.getElementById('recper'); if (c) c.innerHTML = recPerHtml(r); return; }
  if (el.dataset.bind === 'foodQuery' && S.sheet) { S.sheet.q = el.value; S.sheet.online = null; S.sheet.error = null; refreshFoodRes(); return; }
  if (el.dataset.bind === 'qtyGrams' && S.sheet) { S.sheet.grams = el.value; const m = document.getElementById('qtymac'); if (m) m.innerHTML = qtyMacros(S.sheet); return; }
  if (el.dataset.prof && S.pdraft) { const f = el.dataset.prof; S.pdraft[f] = f === 'activity' ? el.value : (parseNum(el.value) ?? ''); if (!S.pdraft.manual) refreshProfRes(); return; }
  if (el.dataset.man && S.pdraft && S.pdraft.manual) { const [t, f] = el.dataset.man.split(':'); S.pdraft.manual[t][f] = parseNum(el.value) || 0; return; }
  if (el.dataset.set) {
    const [ei, si, f] = el.dataset.set.split(':');
    S.active.entries[Number(ei)].sets[Number(si)][f] = el.value;
    clearTimeout(saveT); saveT = setTimeout(saveActive, 400);
    return;
  }
  if (el.dataset.line !== undefined && S.draft && el.tagName === 'INPUT') {
    S.draft.lines[Number(el.dataset.line)][el.dataset.f] = el.value;
    clearTimeout(saveT); saveT = setTimeout(refreshScoreCard, 300);
    return;
  }
  if (el.dataset.draft && S.draft) {
    S.draft[el.dataset.draft] = el.value;
    if (el.dataset.draft === 'targetMinutes') { clearTimeout(saveT); saveT = setTimeout(refreshScoreCard, 300); }
  }
});
document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.dataset.line !== undefined && S.draft) {
    const l = S.draft.lines[Number(el.dataset.line)];
    l[el.dataset.f] = el.dataset.f === 'variantId' ? (el.value || null) : el.value;
    refreshScoreCard(); return;
  }
  if (el.dataset.actChange && CHANGE[el.dataset.actChange]) Promise.resolve(CHANGE[el.dataset.actChange](el)).catch((e) => toast('Oups : ' + e.message));
});
window.addEventListener('hashchange', () => { if (route().name !== 'seance') S.draft = null; if (route().name !== 'profil') S.pdraft = null; closeSheet(); render(); window.scrollTo(0, 0); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.active) { requestWakeLock(); renderTimer(); } });

async function afterRender() {
  if (route().name === 'reglages') {
    buildExport().then((p) => { S.exportPrep = p; }).catch(() => {});
    const el = document.getElementById('persist');
    if (!el) return;
    try {
      const p = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
      const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
      el.textContent = (p ? 'Stockage protégé par le navigateur.' : 'Stockage standard : pense aux sauvegardes.') + (est ? ` ${(est.usage / 1048576).toFixed(1).replace('.', ',')} Mo utilisés.` : '');
    } catch (e) { el.textContent = 'Informations indisponibles.'; }
  }
}

// ---------- Démarrage ----------
(async function boot() {
  try {
    await load();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    render();
    if (S.active) requestWakeLock();
  } catch (e) {
    $('#app').innerHTML = `<div class="card"><h2>Impossible de démarrer</h2><span class="small">${esc(e.message)}</span></div>`;
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
