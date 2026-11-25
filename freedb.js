// Import de free-exercise-db (github.com/yuhonas/free-exercise-db), base d'exercices du domaine public (Unlicense).
// Les données sont téléchargées par le téléphone ; les images restent hébergées sur GitHub.
export const FREEDB_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
export const FREEDB_IMG = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
export const FREEDB_CREDIT = 'Images et consignes : free-exercise-db (domaine public)';

const SKIP_CATEGORIES = ['stretching', 'cardio'];
const EQUIP = {
  barbell: 'Barre', dumbbell: 'Haltères', cable: 'Poulie', machine: 'Machine', 'body only': 'Poids du corps',
  kettlebells: 'Kettlebell', bands: 'Élastique', 'medicine ball': 'Médecine-ball', 'exercise ball': 'Swiss ball',
  'e-z curl bar': 'Barre EZ', 'foam roll': 'Rouleau', other: 'Autre',
};
export const LEVEL = { beginner: 'Débutant', intermediate: 'Intermédiaire', expert: 'Avancé' };

function shoulderPart(name) {
  const n = name.toLowerCase();
  if (/rear|reverse fly|reverse flye|face pull|bent.over.*(raise|fly)|posterior/.test(n)) return 'epaules-arr';
  if (/lateral|side raise|upright row/.test(n)) return 'epaules-lat';
  if (/press|front raise|push/.test(n)) return 'epaules-avant';
  return 'epaules-lat';
}
function muscleId(m, name) {
  const map = {
    abdominals: 'grand-droit', abductors: 'moyen-fessier', adductors: 'adducteurs', biceps: 'biceps', calves: 'mollets',
    chest: 'pecs', forearms: 'avant-bras', glutes: 'grand-fessier', hamstrings: 'ischios', lats: 'dorsaux',
    'lower back': 'lombaires', 'middle back': 'haut-dos', neck: 'haut-dos', traps: 'haut-dos', quadriceps: 'quads', triceps: 'triceps',
  };
  if (m === 'shoulders') return shoulderPart(name);
  return map[m] || null;
}

export function mapFreeDb(list) {
  const out = [];
  for (const x of list || []) {
    if (!x || !x.id || !x.name || SKIP_CATEGORIES.includes(x.category)) continue;
    const primary = [...new Set((x.primaryMuscles || []).map((m) => muscleId(m, x.name)).filter(Boolean))];
    if (!primary.length) continue;
    const secondary = [...new Set((x.secondaryMuscles || []).map((m) => muscleId(m, x.name)).filter((m) => m && !primary.includes(m)))];
    const type = x.mechanic === 'isolation' ? 'iso' : x.mechanic === 'compound' ? 'poly' : (primary.length + secondary.length > 1 ? 'poly' : 'iso');
    out.push({
      id: 'fe-' + x.id, name: x.name, equipment: EQUIP[x.equipment] || 'Autre', type, primary, secondary, variants: [], notes: '', custom: false,
      source: 'freedb', level: x.level || null, instructions: Array.isArray(x.instructions) ? x.instructions : [],
      images: (x.images || []).slice(0, 2).map((p) => FREEDB_IMG + p),
    });
  }
  // Variantes : même muscle principal, même type, autre matériel en priorité.
  const byMuscle = {};
  for (const e of out) (byMuscle[e.primary[0]] = byMuscle[e.primary[0]] || []).push(e);
  for (const e of out) {
    const pool = byMuscle[e.primary[0]].filter((o) => o !== e && o.type === e.type);
    pool.sort((a, b) => (a.equipment === e.equipment ? 1 : 0) - (b.equipment === e.equipment ? 1 : 0) || (a.level === 'beginner' ? 0 : 1) - (b.level === 'beginner' ? 0 : 1));
    e.variants = pool.slice(0, 3).map((o) => o.id);
  }
  return out;
}
