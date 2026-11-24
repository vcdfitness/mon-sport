// Score d'efficacité d'une séance : règles simples et réglables.
// Poids des critères (total 100) :
export const WEIGHTS = { volume: 60, focus: 10, order: 15, duration: 15 };
const SECONDARY_FACTOR = 0.5; // une série compte pour moitié sur un muscle secondaire
const WORK_SECONDS = 45;       // durée moyenne d'une série
const DEFAULT_REST = { poly: 150, iso: 90 };

export function effectiveSets(lines, exMap) {
  const sets = {};
  for (const l of lines) {
    const ex = exMap[l.exerciseId];
    if (!ex) continue;
    const n = Number(l.sets) || 0;
    for (const m of ex.primary) sets[m] = (sets[m] || 0) + n;
    for (const m of ex.secondary || []) sets[m] = (sets[m] || 0) + n * SECONDARY_FACTOR;
  }
  return sets;
}

function muscleRatio(s, min, max) {
  if (s < min) return min > 0 ? s / min : 1;
  if (s <= max) return 1;
  return Math.max(0.6, 1 - (s - max) / max);
}

export function estimateMinutes(lines, exMap) {
  let sec = 0;
  for (const l of lines) {
    const ex = exMap[l.exerciseId];
    if (!ex) continue;
    const n = Number(l.sets) || 0;
    const rest = Number(l.rest) || DEFAULT_REST[ex.type] || 120;
    sec += n * (WORK_SECONDS + rest);
  }
  return Math.round(sec / 60);
}

export function computeScore(lines, exMap, muscleMap, targets, targetMinutes) {
  const sets = effectiveSets(lines, exMap);
  const tg = (targets && targets.length) ? targets : inferTargets(lines, exMap);

  const muscles = tg.map((id) => {
    const m = muscleMap[id] || { id, name: id, min: 4, max: 8 };
    const s = Math.round((sets[id] || 0) * 10) / 10;
    const status = s < m.min ? 'low' : s > m.max ? 'high' : 'ok';
    return { id, name: m.name, sets: s, min: m.min, max: m.max, status, ratio: muscleRatio(s, m.min, m.max) };
  });
  const volume = muscles.length ? muscles.reduce((a, m) => a + m.ratio, 0) / muscles.length : 0;

  // Part des séries qui visent bien les muscles ciblés.
  let total = 0; let onTarget = 0;
  for (const l of lines) {
    const ex = exMap[l.exerciseId];
    if (!ex) continue;
    const n = Number(l.sets) || 0;
    total += n;
    if (ex.primary.some((p) => tg.includes(p))) onTarget += n;
  }
  const focus = total ? Math.min(1, (onTarget / total) / 0.8) : 0;

  // Ordre : les polyarticulaires avant l'isolation.
  let seenIso = false; let inversions = 0; let compounds = 0; let firstBad = null;
  lines.forEach((l, i) => {
    const ex = exMap[l.exerciseId];
    if (!ex) return;
    if (ex.type === 'iso') seenIso = true;
    if (ex.type === 'poly') {
      compounds++;
      if (seenIso) { inversions++; if (firstBad === null) firstBad = i; }
    }
  });
  const order = compounds ? 1 - inversions / compounds : 1;

  const minutes = estimateMinutes(lines, exMap);
  const tm = Number(targetMinutes) || 0;
  const duration = !tm || minutes <= tm * 1.1 ? 1 : Math.max(0, tm / minutes);

  const raw = lines.length
    ? (WEIGHTS.volume * volume + WEIGHTS.focus * focus + WEIGHTS.order * order + WEIGHTS.duration * duration)
    : 0;
  const score = Math.round(raw);

  return { score, muscles, targets: tg, volume, focus, order, duration, minutes, targetMinutes: tm, firstBadOrder: firstBad };
}

// Sans muscles ciblés choisis : on prend les muscles principaux des exercices.
export function inferTargets(lines, exMap) {
  const t = [];
  for (const l of lines) {
    const ex = exMap[l.exerciseId];
    if (!ex) continue;
    for (const p of ex.primary) if (!t.includes(p)) t.push(p);
  }
  return t;
}

// Suggestions concrètes, chacune avec le score obtenu si on l'applique.
export function suggest(template, exMap, muscleMap, allExercises) {
  const lines = template.lines || [];
  const base = computeScore(lines, exMap, muscleMap, template.targets, template.targetMinutes);
  const out = [];
  const used = new Set(lines.map((l) => l.exerciseId));

  for (const m of base.muscles.filter((x) => x.status === 'low')) {
    const missing = Math.max(1, Math.ceil(m.min - m.sets));
    const already = lines.findIndex((l) => exMap[l.exerciseId] && exMap[l.exerciseId].primary.includes(m.id));
    let newLines; let text; let apply;
    if (already >= 0 && (Number(lines[already].sets) || 0) + missing <= 5) {
      newLines = lines.map((l, i) => (i === already ? { ...l, sets: (Number(l.sets) || 0) + missing } : l));
      text = `+${missing} série${missing > 1 ? 's' : ''} de ${exMap[lines[already].exerciseId].name} pour ${m.name.toLowerCase()}`;
      apply = { kind: 'addSets', index: already, count: missing };
    } else {
      const cand = allExercises
        .filter((e) => e.primary.includes(m.id) && !used.has(e.id))
        .sort((a, b) => (a.type === 'iso' ? 0 : 1) - (b.type === 'iso' ? 0 : 1) || a.primary.length - b.primary.length)[0];
      if (!cand) continue;
      const n = Math.min(4, Math.max(2, missing));
      const line = { exerciseId: cand.id, sets: n, repMin: 10, repMax: 15, rir: 2, rest: DEFAULT_REST[cand.type], variantId: (cand.variants || [])[0] || null };
      newLines = [...lines, line];
      text = `+${n} séries de ${cand.name} pour ${m.name.toLowerCase()}`;
      apply = { kind: 'addLine', line };
    }
    const s = computeScore(newLines, exMap, muscleMap, template.targets, template.targetMinutes).score;
    if (s > base.score) out.push({ text, apply, newScore: s });
  }

  for (const m of base.muscles.filter((x) => x.status === 'high')) {
    const idx = lines.findIndex((l) => exMap[l.exerciseId] && exMap[l.exerciseId].primary.includes(m.id) && (Number(l.sets) || 0) > 2);
    if (idx < 0) continue;
    const newLines = lines.map((l, i) => (i === idx ? { ...l, sets: (Number(l.sets) || 0) - 1 } : l));
    const s = computeScore(newLines, exMap, muscleMap, template.targets, template.targetMinutes).score;
    if (s > base.score) out.push({ text: `−1 série de ${exMap[lines[idx].exerciseId].name} (trop de volume sur ${m.name.toLowerCase()})`, apply: { kind: 'addSets', index: idx, count: -1 }, newScore: s });
  }

  if (base.firstBadOrder !== null) {
    const i = base.firstBadOrder;
    const firstIso = lines.findIndex((l) => exMap[l.exerciseId] && exMap[l.exerciseId].type === 'iso');
    if (firstIso >= 0 && firstIso < i) {
      const newLines = [...lines];
      const [moved] = newLines.splice(i, 1);
      newLines.splice(firstIso, 0, moved);
      const s = computeScore(newLines, exMap, muscleMap, template.targets, template.targetMinutes).score;
      if (s > base.score) out.push({ text: `Faire ${exMap[moved.exerciseId].name} avant les exercices d'isolation`, apply: { kind: 'move', from: i, to: firstIso }, newScore: s });
    }
  }

  return out.sort((a, b) => b.newScore - a.newScore).slice(0, 3);
}

export function applySuggestion(lines, apply) {
  if (apply.kind === 'addSets') return lines.map((l, i) => (i === apply.index ? { ...l, sets: Math.max(1, (Number(l.sets) || 0) + apply.count) } : l));
  if (apply.kind === 'addLine') return [...lines, { ...apply.line }];
  if (apply.kind === 'move') { const n = [...lines]; const [m] = n.splice(apply.from, 1); n.splice(apply.to, 0, m); return n; }
  return lines;
}

// 1RM estimé (formule d'Epley), utilisé pour les records.
export function e1rm(kg, reps) {
  const w = Number(kg) || 0; const r = Number(reps) || 0;
  if (!w || !r) return 0;
  if (r === 1) return w;
  return Math.round(w * (1 + r / 30) * 10) / 10;
}

export function scoreLabel(s) {
  if (s >= 90) return 'Séance très bien construite';
  if (s >= 75) return 'Bonne séance, quelques ajustements possibles';
  if (s >= 55) return 'Correcte, mais à ajuster';
  return 'À retravailler';
}
