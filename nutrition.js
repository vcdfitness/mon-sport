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
export function buildPlate(foods, target) {
  const groups = { prot: [], carb: [], veg: [], fat: [] };
  for (const f of foods) groups[roleOf(f)].push(f);
  const items = []; const tot = { kcal: 0, p: 0, g: 0, l: 0 };
  const add = (f, grams) => {
    grams = round5(grams); if (grams <= 0) return;
    items.push({ food: f, grams });
    const m = scale(f, grams); tot.kcal += m.kcal; tot.p += m.p; tot.g += m.g; tot.l += m.l;
  };
  const vegs = groups.veg.slice(0, 3);
  for (const f of vegs) add(f, vegs.length === 1 ? 150 : 100);
  if (groups.prot.length) {
    const need = Math.max(0, target.p - tot.p) * 0.9;
    for (const f of groups.prot) add(f, clamp((need / groups.prot.length) / (f.p / 100), 30, 300));
  }
  if (groups.carb.length) {
    const need = Math.max(0, target.g - tot.g);
    for (const f of groups.carb) add(f, clamp((need / groups.carb.length) / Math.max(1, f.g) * 100, 0, 350));
  }
  if (groups.fat.length) {
    const need = target.l - tot.l;
    if (need > 3) for (const f of groups.fat) add(f, clamp((need / groups.fat.length) / Math.max(1, f.l) * 100, 5, f.kcal > 800 ? 20 : 40));
  }
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
