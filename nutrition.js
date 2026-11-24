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
