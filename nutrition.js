// Calculs nutrition : besoins, macros, aliments. Aucune donnée n'est envoyée ailleurs.
import { FOODS } from './foods.js';

// Activité hors salle : multiplie le métabolisme de base.
export const ACTIVITY = {
  bureau: { f: 1.25, label: 'Assise la plupart du temps' },
  debout: { f: 1.4, label: 'Souvent debout, je marche beaucoup' },
  physique: { f: 1.6, label: 'Métier physique' },
};
// k = ajustement des calories par rapport à la dépense ; prot = g de protéines par kg.
export const GOALS = {
  masse: { label: 'Prise de masse', k: 1.1, prot: 2.0, hint: 'Surplus léger (+10 %) pour limiter la prise de gras.' },
  recompo: { label: 'Recomposition', k: 0.97, prot: 2.2, hint: 'Proche de la maintenance, beaucoup de protéines.' },
  maintien: { label: 'Maintien', k: 1, prot: 1.8, hint: 'Calories égales à la dépense estimée.' },
  seche: { label: 'Sèche', k: 0.82, prot: 2.2, hint: 'Déficit modéré (−18 %) pour préserver le muscle.' },
};
export const TRAIN_KCAL = 300; // dépense moyenne ajoutée un jour de séance
const FAT_PER_KG = 0.9;

export const MEALS = [
  { id: 'petitdej', name: 'Petit-déjeuner' },
  { id: 'dejeuner', name: 'Déjeuner' },
  { id: 'collation', name: 'Collations' },
  { id: 'pre', name: 'Pré-entraînement', train: true },
  { id: 'post', name: 'Post-entraînement', train: true },
  { id: 'diner', name: 'Dîner' },
];

export function profileErrors(p) {
  const e = [];
  const year = new Date().getFullYear();
  if (!p || !p.sex) e.push('le sexe');
  const age = year - Number(p && p.birthYear);
  if (!(age >= 14 && age <= 90)) e.push("l'année de naissance");
  if (!(Number(p && p.height) >= 120 && Number(p.height) <= 230)) e.push('la taille');
  if (!(Number(p && p.weight) >= 30 && Number(p.weight) <= 250)) e.push('le poids');
  return e;
}

// Formule de Mifflin-St Jeor, puis activité, objectif et répartition des macros.
export function computeTargets(p, weight) {
  const w = Number(weight || p.weight);
  const h = Number(p.height);
  const age = new Date().getFullYear() - Number(p.birthYear);
  const bmr = 10 * w + 6.25 * h - 5 * age + (p.sex === 'h' ? 5 : -161);
  const act = (ACTIVITY[p.activity] || ACTIVITY.bureau).f;
  const goal = GOALS[p.goal] || GOALS.maintien;
  const maintRest = bmr * act;
  const maintTrain = maintRest + TRAIN_KCAL;
  const prot = Math.round(w * goal.prot);
  const fat = Math.round(w * FAT_PER_KG);
  const mk = (maint) => {
    const kcal = Math.round((maint * goal.k) / 10) * 10;
    const g = Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4));
    return { kcal, p: prot, g, l: fat };
  };
  return { bmr: Math.round(bmr), maintRest: Math.round(maintRest), maintTrain: Math.round(maintTrain), train: mk(maintTrain), rest: mk(maintRest) };
}

export const waterTarget = (w) => Math.max(1500, Math.round((Number(w) || 60) * 35 / 250) * 250);

// Dates locales au format AAAA-MM-JJ
const pad2 = (n) => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const keyToDate = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (k, n) => { const d = keyToDate(k); d.setDate(d.getDate() + n); return dayKey(d); };

export const scale = (per, grams) => ({ kcal: per.kcal * grams / 100, p: per.p * grams / 100, g: per.g * grams / 100, l: per.l * grams / 100 });
export const entryMacros = (en) => (en.quick ? { kcal: +en.kcal || 0, p: +en.p || 0, g: +en.g || 0, l: +en.l || 0 } : scale(en.per, +en.grams || 0));
export function sumMacros(entries) {
  const t = { kcal: 0, p: 0, g: 0, l: 0 };
  for (const e of entries) { const m = entryMacros(e); t.kcal += m.kcal; t.p += m.p; t.g += m.g; t.l += m.l; }
  return t;
}

export const norm = (s) => String(s || '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '');
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const BUILTIN_FOODS = FOODS.map(([name, kcal, p, g, l, portionName, portionG]) => ({
  id: 'b-' + slug(name), name, kcal, p, g, l, portionName: portionName || null, portionG: portionG || null, origin: 'base',
}));

export function searchFoods(foods, q, limit = 40) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return foods
    .map((f) => ({ f, n: norm(f.name) }))
    .filter((x) => words.every((w) => x.n.includes(w)))
    .sort((a, b) => (a.n.startsWith(words[0]) ? 0 : 1) - (b.n.startsWith(words[0]) ? 0 : 1) || a.n.length - b.n.length)
    .slice(0, limit)
    .map((x) => x.f);
}

// Open Food Facts : base collaborative de produits du commerce (recherche faite depuis le téléphone).
const OFF_FIELDS = 'code,product_name,product_name_fr,brands,nutriments,serving_quantity';
export function offUrl(q) {
  if (/^\d{8,14}$/.test(q.trim())) return `https://world.openfoodfacts.org/api/v2/product/${q.trim()}.json?fields=${OFF_FIELDS}`;
  return `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&fields=${OFF_FIELDS}`;
}
export function offToFood(pr) {
  if (!pr) return null;
  const n = pr.nutriments || {};
  let kcal = n['energy-kcal_100g'];
  if (kcal == null && n.energy_100g != null) kcal = n.energy_100g / 4.184;
  const name = String(pr.product_name_fr || pr.product_name || '').trim();
  if (kcal == null || !name || !pr.code) return null;
  const brand = pr.brands ? String(pr.brands).split(',')[0].trim() : '';
  const r1 = (x) => Math.round((Number(x) || 0) * 10) / 10;
  const sq = Number(pr.serving_quantity);
  return {
    id: 'off-' + pr.code, name: brand ? `${name} — ${brand}` : name,
    kcal: Math.round(kcal), p: r1(n.proteins_100g), g: r1(n.carbohydrates_100g), l: r1(n.fat_100g),
    portionName: sq > 0 ? '1 portion' : null, portionG: sq > 0 ? sq : null, origin: 'off', code: pr.code, custom: true,
  };
}

// ---------- Idées de repas à partir des ingrédients disponibles ----------
// Part de l'objectif du jour visée par chaque repas (le dîner prend ce qui reste, 45 % du jour au plus).
export const MEAL_SHARE = { petitdej: 0.25, dejeuner: 0.35, collation: 0.12, pre: 0.12, post: 0.15, diner: null };

export function mealTarget(meal, dayTarget, eaten) {
  if (!dayTarget) return null;
  const left = { kcal: dayTarget.kcal - eaten.kcal, p: dayTarget.p - eaten.p, g: dayTarget.g - eaten.g, l: dayTarget.l - eaten.l };
  const share = MEAL_SHARE[meal];
  const cap = (x, part) => Math.min(dayTarget[x] * part, left[x]);
  const t = share == null ? { kcal: cap('kcal', 0.45), p: cap('p', 0.45), g: cap('g', 0.45), l: cap('l', 0.45) } : {
    kcal: Math.min(dayTarget.kcal * share, left.kcal), p: Math.min(dayTarget.p * share, left.p),
    g: Math.min(dayTarget.g * share, left.g), l: Math.min(dayTarget.l * share, left.l),
  };
  return { kcal: Math.max(0, Math.round(t.kcal)), p: Math.max(0, Math.round(t.p)), g: Math.max(0, Math.round(t.g)), l: Math.max(0, Math.round(t.l)) };
}

// Classe un aliment selon ce qu'il apporte surtout.
export function roleOf(f) {
  const kcal = Math.max(1, f.kcal);
  const pP = f.p * 4 / kcal; const gP = f.g * 4 / kcal; const lP = f.l * 9 / kcal;
  if (pP >= 0.3 && f.p >= 5) return 'prot';
  if (f.kcal <= 60) return 'veg';
  if (gP >= 0.5) return 'carb';
  if (lP >= 0.6) return 'fat';
  return f.g >= f.l ? 'carb' : 'fat';
}

const round5 = (x) => Math.max(0, Math.round(x / 5) * 5);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// Calcule les grammes de chaque ingrédient pour approcher l'objectif du repas.
// locks = { idAliment: grammes } : quantités choisies par l'utilisatrice, gardées telles quelles ;
// les autres ingrédients sont ajustés autour.
export function buildPlate(foods, target, locks = {}) {
  const groups = { prot: [], carb: [], veg: [], fat: [] };
  for (const f of foods) groups[roleOf(f)].push(f);
  const items = []; const tot = { kcal: 0, p: 0, g: 0, l: 0 };
  const add = (f, grams, locked = false) => {
    grams = locked ? Math.max(0, Number(grams) || 0) : round5(grams); if (grams <= 0 && !locked) return;
    items.push({ food: f, grams, locked });
    const m = scale(f, grams); tot.kcal += m.kcal; tot.p += m.p; tot.g += m.g; tot.l += m.l;
  };
  const isLocked = (f) => Object.prototype.hasOwnProperty.call(locks, f.id);
  for (const f of foods) if (isLocked(f)) add(f, locks[f.id], true);
  const free = (role) => groups[role].filter((f) => !isLocked(f));
  const vegs = free('veg').slice(0, 3);
  for (const f of vegs) add(f, vegs.length === 1 ? 150 : 100);
  const prot = free('prot');
  if (prot.length) {
    const need = Math.max(0, target.p - tot.p) * 0.9;
    for (const f of prot) add(f, clamp((need / prot.length) / (f.p / 100), 30, 300));
  }
  const carb = free('carb');
  if (carb.length) {
    const need = Math.max(0, target.g - tot.g);
    for (const f of carb) add(f, clamp((need / carb.length) / Math.max(1, f.g) * 100, 0, 350));
  }
  const fat = free('fat');
  if (fat.length) {
    const need = target.l - tot.l;
    if (need > 3) for (const f of fat) add(f, clamp((need / fat.length) / Math.max(1, f.l) * 100, 5, f.kcal > 800 ? 20 : 40));
  }
  const order = foods.map((f) => f.id);
  items.sort((a, b) => order.indexOf(a.food.id) - order.indexOf(b.food.id));
  const missing = [];
  if (!groups.prot.length) missing.push('une source de protéines (poulet, œuf, skyr, tofu…)');
  if (!groups.carb.length && target.g > 30) missing.push('un féculent (riz, pâtes, pomme de terre…)');
  if (!groups.veg.length) missing.push('des légumes');
  return { items, tot, groups, missing };
}

const shortName = (f) => f.name.replace(/ (cru|crue|cuit|cuite|crus|cuits)$/i, '').toLowerCase();
const list = (arr) => arr.length <= 1 ? (arr[0] || '') : arr.slice(0, -1).join(', ') + ' et ' + arr[arr.length - 1];

// Idées de préparation selon les ingrédients.
export function prepIdeas(groups) {
  const P = list(groups.prot.map(shortName)); const C = list(groups.carb.map(shortName));
  const V = list(groups.veg.map(shortName)); const F = groups.fat[0] ? shortName(groups.fat[0]) : "un filet d'huile";
  const ideas = [];
  const roastable = groups.carb.some((f) => /patate|pomme de terre/i.test(f.name));
  const raw = groups.prot.some((f) => /(cru|crue)$/i.test(f.name) || /steak|escalope|blanc de poulet|cabillaud|saumon cru|tofu/i.test(f.name));
  const leafy = groups.veg.filter((f) => /épinard|salade|roquette|mâche/i.test(f.name));
  const VR = list(groups.veg.filter((f) => !leafy.includes(f)).map(shortName)); const VL = list(leafy.map(shortName));
  if (roastable) ideas.push({ name: 'Plaque au four', time: '35 min', steps: `Préchauffe le four à 200 °C. Coupe ${C}${VR ? ' et ' + VR : ''} en cubes, mélange avec ${F}, sel, paprika et ail. Enfourne 25 min${P ? `, ajoute ${P} en morceaux à mi-cuisson` : ''} et termine 10 à 12 min.${VL ? ` Sers sur un lit de ${VL}.` : ''}` });
  if (P || C) ideas.push({ name: 'Bowl', time: '20 min', steps: `${C ? `Fais cuire ${C}. ` : ''}${P ? `Saisis ${P} à la poêle avec ${F}, 6 à 8 min${raw ? ' (bien cuit à cœur)' : ''}. ` : ''}${V ? `Ajoute ${V}, crus ou poêlés 3 min. ` : ''}Dresse dans un bol avec une sauce yaourt-citron ou soja-sésame.` });
  if (P && V) ideas.push({ name: 'Poêlée express', time: '15 min', steps: `Coupe ${P} en lanières et fais-les revenir dans ${F}. Ajoute ${V}${C ? ` puis ${C} déjà cuit` : ''}, épices au choix (curry, herbes de Provence), 5 min à feu vif.` });
  if (!ideas.length) ideas.push({ name: 'Assiette simple', time: '10 min', steps: 'Assemble les ingrédients, assaisonne, et complète avec ce qui te manque pour équilibrer le repas.' });
  return ideas.slice(0, 2);
}

export function aiPrompt({ goalLabel, mealLabel, target, foods }) {
  return `Je suis en ${goalLabel.toLowerCase()}. Pour mon ${mealLabel.toLowerCase()}, il me reste environ ${target.kcal} kcal, ${target.p} g de protéines, ${target.g} g de glucides et ${target.l} g de lipides.
J'ai à la maison : ${foods.map((f) => f.name.toLowerCase()).join(', ')}.
Propose-moi 3 recettes simples (30 min maximum) avec ces ingrédients (et éventuellement des basiques du placard : épices, sauce soja, ail…). Pour chacune : les quantités en grammes pour rentrer dans ces macros, les étapes courtes, et le total kcal / protéines / glucides / lipides.`;
}

// ---------- Ma journée type : prises de repas, optimisation et conseils ----------
// Rythme décrit par l'utilisatrice : petit-déjeuner très tôt, collation en milieu de matinée,
// un seul vrai repas après la séance de l'après-midi.
export const MY_RHYTHM = [
  { id: 'petitdej', name: 'Petit-déjeuner', time: '07:30' },
  { id: 'collation', name: 'Collation', time: '10:30' },
  { id: 'repas', name: 'Repas après la séance', time: '16:30' },
];
export const CLASSIC_PLAN = [
  { id: 'petitdej', name: 'Petit-déjeuner', time: '07:30' },
  { id: 'dejeuner', name: 'Déjeuner', time: '12:30' },
  { id: 'collation', name: 'Collation', time: '16:30' },
  { id: 'diner', name: 'Dîner', time: '19:30' },
];
export const DEFAULT_TRAINING = { time: '15:00', minutes: 75 };
export const toMin = (t) => { const [h, m] = String(t || '12:00').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
export const fmtTime = (t) => { const [h, m] = String(t || '').split(':'); return `${Number(h)}h${m && m !== '00' ? m : ''}`; };
const fmtDur = (min) => { const h = Math.floor(min / 60); const m = Math.round(min % 60); return h ? `${h} h${m ? ' ' + String(m).padStart(2, '0') : ''}` : `${m} min`; };

// Attribue un rôle à chaque prise selon l'heure et la séance, puis répartit les macros.
export function optimizePlan(meals, { train, training = DEFAULT_TRAINING, targets, weight }) {
  const sorted = [...meals].sort((a, b) => toMin(a.time) - toMin(b.time));
  const tStart = toMin(training.time); const tEnd = tStart + (Number(training.minutes) || 75);
  const info = sorted.map((m, i) => {
    const t = toMin(m.time);
    let role = 'main';
    if (train && t >= tEnd - 20 && t <= tEnd + 150) role = 'post';
    else if (train && t < tStart && t >= tStart - 120) role = 'pre';
    else if (i === 0 && t < 10 * 60) role = 'breakfast';
    else if (/collation|goûter|en-cas|snack/i.test(m.name)) role = 'snack';
    return { ...m, t, role };
  });
  if (!info.length || !targets) return info;
  const W = { post: 4, main: 3, breakfast: 2.4, pre: 1.6, snack: 1.4 };
  const sum = info.reduce((a, x) => a + W[x.role], 0);
  info.forEach((x) => { x.share = W[x.role] / sum; });
  const cw = { post: 1.3, pre: 1.25, breakfast: 1, main: 0.9, snack: 0.95 };
  const fw = { post: 0.7, pre: 0.75, breakfast: 1, main: 1.15, snack: 1.1 };
  const dist = (wmap) => { const raw = info.map((x) => x.share * (train ? wmap[x.role] : 1)); const s = raw.reduce((a, b) => a + b, 0); return raw.map((r) => r / s); };
  const gS = dist(cw); const lS = dist(fw);
  // Protéines : au moins ~0,3 g/kg (20 à 25 g) à chaque prise, le reste au prorata.
  const pmin = Math.min(25, Math.max(15, Math.round(0.3 * (Number(weight) || 60))));
  let pp = info.map((x) => Math.max(pmin, targets.p * x.share));
  const over = pp.reduce((a, b) => a + b, 0) - targets.p;
  if (over > 0) { const flex = pp.map((v) => Math.max(0, v - pmin)); const fs = flex.reduce((a, b) => a + b, 0) || 1; pp = pp.map((v, i) => v - over * flex[i] / fs); }
  info.forEach((x, i) => {
    const p = Math.round(pp[i]); const g = Math.round(targets.g * gS[i]); const l = Math.round(targets.l * lS[i]);
    x.target = { p, g, l, kcal: Math.round(p * 4 + g * 4 + l * 9) };
  });
  return info;
}

export function planInsights(info, { train, training = DEFAULT_TRAINING }) {
  const out = []; if (!info.length) return out;
  const tStart = toMin(training.time); const tEnd = tStart + (Number(training.minutes) || 75);
  const low = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  if (train) {
    const before = info.filter((x) => x.t < tStart); const last = before[before.length - 1];
    if (!last) out.push({ tone: 'tip', text: `Tu t'entraînes à ${fmtTime(training.time)} sans avoir mangé avant : si l'énergie manque, une petite prise 1 à 2 h avant (banane + skyr) aide.` });
    else if (tStart - last.t >= 240) out.push({ tone: 'tip', text: `Entre ${low(last.name)} (${fmtTime(last.time)}) et ta séance (${fmtTime(training.time)}), il se passe ${fmtDur(tStart - last.t)} sans manger. Si tu manques d'énergie à l'entraînement, rends cette prise plus consistante (féculent + protéines) ou décale-la un peu plus tard. Une petite prise avant la séance reste une option pour plus tard.` });
    const post = info.find((x) => x.role === 'post');
    if (post) out.push({ tone: 'ok', text: `${post.name} (${fmtTime(post.time)}) : juste après ta séance, c'est le bon moment pour ton plus gros apport en glucides et en protéines, l'app y place ${post.target ? post.target.g + ' g de glucides et ' + post.target.p + ' g de protéines' : 'la plus grosse part'}.` });
    else {
      const next = info.find((x) => x.t >= tEnd);
      out.push({ tone: 'tip', text: next ? `Après ta séance, ta prochaine prise est ${low(next.name)} à ${fmtTime(next.time)}, soit ${fmtDur(next.t - tEnd)} plus tard. Essaie de manger dans les 2 à 3 h qui suivent la séance.` : 'Rien n\'est prévu après ta séance : ajoute une prise dans les 2 à 3 h qui suivent pour la récupération.' });
    }
  }
  const big = info.filter((x) => x.target && x.target.p > 55);
  if (big.length) out.push({ tone: 'tip', action: 'addEvening', text: `${big[0].name} doit apporter ${big[0].target.p} g de protéines, c'est beaucoup en une fois. Une collation protéinée en soirée (skyr, fromage blanc) répartirait mieux : l'idéal est 3 à 5 prises de 20 à 40 g.` });
  const snack = info.find((x) => x.role === 'snack' && x.target && x.target.p >= 12);
  if (snack) out.push({ tone: 'tip', text: `${snack.name} (${fmtTime(snack.time)}) : une viennoiserie seule apporte surtout glucides et lipides. Ajoute un skyr ou un yaourt grec pour atteindre les ${snack.target.p} g de protéines visés.` });
  if (info[0].role === 'breakfast' && info[0].target) out.push({ tone: 'ok', text: `Petit-déjeuner tôt avec café : vise environ ${info[0].target.p} g de protéines (skyr, œufs, fromage blanc) pour tenir jusqu'à ${info[1] ? fmtTime(info[1].time) : 'midi'}. Le café ne compte presque pas en calories, sauf avec lait et sucre.` });
  const last = info[info.length - 1]; const fast = 24 * 60 - last.t + info[0].t;
  if (fast >= 13 * 60) out.push({ tone: 'info', text: `Ta dernière prise est à ${fmtTime(last.time)} : environ ${fmtDur(fast)} sans manger jusqu'au petit-déjeuner. Ce n'est pas un problème si tu atteins tes objectifs du jour ; sinon, la collation du soir aide.` });
  return out;
}

// Idées de repas par rôle, quantités calculées sur l'objectif de la prise.
const TEMPLATES = {
  breakfast: [['Skyr nature', "Flocons d'avoine", 'Banane'], ['Œuf entier', 'Pain complet', 'Kiwi'], ['Fromage blanc 3 %', 'Granola', 'Fraises']],
  snack: [['Briochette', 'Skyr nature'], ['Skyr nature', 'Pomme', 'Amandes'], ['Barre protéinée', 'Banane'], ['Pain complet', 'Jambon blanc', 'Clémentine']],
  pre: [['Banane', 'Skyr nature'], ['Galette de riz soufflé', 'Blanc de dinde (tranches)', 'Compote sans sucre ajouté']],
  post: [['Blanc de poulet cru', 'Riz basmati cuit', 'Brocoli cuit', "Huile d'olive"], ['Saumon cru', 'Patate douce crue', 'Haricots verts cuits'], ['Steak haché 5 % cru', 'Pâtes cuites', 'Courgette', "Huile d'olive"], ['Escalope de dinde crue', 'Quinoa cuit', 'Poêlée de légumes surgelés', "Huile d'olive"]],
  evening: [['Skyr nature', 'Framboises'], ['Fromage blanc 3 %', 'Noix'], ['Cottage cheese', 'Myrtilles']],
};
TEMPLATES.main = TEMPLATES.post;
export function mealIdeas(role, target, foodByName, offset = 0, n = 2) {
  const list = TEMPLATES[role] || TEMPLATES.main;
  const out = [];
  for (let i = 0; i < Math.min(n, list.length); i++) {
    const names = list[(offset + i) % list.length];
    const foods = names.map((nm) => foodByName[nm]).filter(Boolean);
    const locks = {};
    for (const f of foods) if (f.portionG && roleOf(f) !== 'prot' && !/bol|tranche|portion|c\. à|poignée|verre|dose|pot/.test(f.portionName || '')) locks[f.id] = f.portionG;
    out.push(buildPlate(foods, target, locks));
  }
  return out;
}
