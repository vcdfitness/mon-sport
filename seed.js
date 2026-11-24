// Données de départ : muscles et exercices courants. Tout est modifiable dans l'app.
// min / max = fourchette conseillée de séries effectives par séance pour ce muscle.

export const GROUPS = ['Jambes', 'Fessiers', 'Dos', 'Pecs', 'Épaules', 'Bras', 'Abdos'];

export const MUSCLES = [
  { id: 'quads', name: 'Quadriceps', group: 'Jambes', min: 6, max: 10 },
  { id: 'ischios', name: 'Ischio-jambiers', group: 'Jambes', min: 4, max: 8 },
  { id: 'adducteurs', name: 'Adducteurs', group: 'Jambes', min: 2, max: 6 },
  { id: 'mollets', name: 'Mollets', group: 'Jambes', min: 4, max: 8 },
  { id: 'grand-fessier', name: 'Grand fessier', group: 'Fessiers', min: 6, max: 10 },
  { id: 'moyen-fessier', name: 'Moyen fessier', group: 'Fessiers', min: 3, max: 8 },
  { id: 'dorsaux', name: 'Grand dorsal', group: 'Dos', min: 6, max: 10 },
  { id: 'haut-dos', name: 'Haut du dos', group: 'Dos', min: 4, max: 8 },
  { id: 'lombaires', name: 'Lombaires', group: 'Dos', min: 2, max: 6 },
  { id: 'pecs', name: 'Pectoraux', group: 'Pecs', min: 6, max: 10 },
  { id: 'epaules-avant', name: 'Épaules avant', group: 'Épaules', min: 3, max: 6 },
  { id: 'epaules-lat', name: 'Épaules latérales', group: 'Épaules', min: 4, max: 8 },
  { id: 'epaules-arr', name: 'Épaules arrière', group: 'Épaules', min: 3, max: 6 },
  { id: 'biceps', name: 'Biceps', group: 'Bras', min: 4, max: 8 },
  { id: 'triceps', name: 'Triceps', group: 'Bras', min: 4, max: 8 },
  { id: 'avant-bras', name: 'Avant-bras', group: 'Bras', min: 2, max: 6 },
  { id: 'grand-droit', name: 'Grand droit (abdos)', group: 'Abdos', min: 3, max: 8 },
  { id: 'obliques', name: 'Obliques', group: 'Abdos', min: 2, max: 6 },
  { id: 'gainage', name: 'Gainage profond', group: 'Abdos', min: 2, max: 6 },
];

// Catégories "par séance" : quels muscles regarder pour chaque type de séance.
export const SESSION_TYPES = [
  { id: 'bras', name: 'Bras', muscles: ['biceps', 'triceps', 'avant-bras'] },
  { id: 'abdos', name: 'Abdos', muscles: ['grand-droit', 'obliques', 'gainage'] },
  { id: 'leg', name: 'Leg day', muscles: ['quads', 'ischios', 'grand-fessier', 'adducteurs', 'mollets'] },
  { id: 'fessiers', name: 'Fessiers', muscles: ['grand-fessier', 'moyen-fessier', 'ischios'] },
  { id: 'dos', name: 'Dos', muscles: ['dorsaux', 'haut-dos', 'lombaires', 'epaules-arr'] },
  { id: 'push', name: 'Pecs & épaules', muscles: ['pecs', 'epaules-avant', 'epaules-lat', 'triceps'] },
  { id: 'haut', name: 'Haut du corps', muscles: ['pecs', 'dorsaux', 'haut-dos', 'epaules-lat', 'biceps', 'triceps'] },
  { id: 'full', name: 'Full body', muscles: ['quads', 'grand-fessier', 'dorsaux', 'pecs', 'epaules-lat'] },
];

// e = matériel, t = type (poly = polyarticulaire, iso = isolation), p = muscles principaux, s = secondaires, v = variantes
const E = (id, name, e, t, p, s = [], v = []) => ({ id, name, equipment: e, type: t, primary: p, secondary: s, variants: v, notes: '', custom: false });

export const EXERCISES = [
  // Jambes
  E('squat-barre', 'Squat barre', 'Barre', 'poly', ['quads', 'grand-fessier'], ['adducteurs', 'lombaires'], ['presse', 'hack-squat', 'squat-goblet']),
  E('presse', 'Presse à cuisses', 'Machine', 'poly', ['quads', 'grand-fessier'], ['adducteurs'], ['hack-squat', 'squat-barre']),
  E('hack-squat', 'Hack squat', 'Machine', 'poly', ['quads'], ['grand-fessier'], ['presse', 'squat-goblet']),
  E('squat-goblet', 'Squat goblet', 'Haltère', 'poly', ['quads'], ['grand-fessier'], ['presse']),
  E('fentes-bulgares', 'Fentes bulgares', 'Haltères', 'poly', ['quads', 'grand-fessier'], ['moyen-fessier', 'adducteurs'], ['fentes-marchees', 'step-up']),
  E('fentes-marchees', 'Fentes marchées', 'Haltères', 'poly', ['quads', 'grand-fessier'], ['adducteurs'], ['fentes-bulgares']),
  E('step-up', 'Step-up sur banc', 'Haltères', 'poly', ['quads', 'grand-fessier'], ['moyen-fessier'], ['fentes-bulgares']),
  E('leg-extension', 'Leg extension', 'Machine', 'iso', ['quads'], [], ['sissy-squat']),
  E('sissy-squat', 'Sissy squat', 'Poids du corps', 'iso', ['quads'], [], ['leg-extension']),
  E('rdl', 'Soulevé de terre roumain', 'Barre', 'poly', ['ischios', 'grand-fessier'], ['lombaires', 'haut-dos'], ['rdl-halteres', 'good-morning']),
  E('rdl-halteres', 'Soulevé de terre roumain haltères', 'Haltères', 'poly', ['ischios', 'grand-fessier'], ['lombaires'], ['rdl']),
  E('good-morning', 'Good morning', 'Barre', 'poly', ['ischios'], ['lombaires', 'grand-fessier'], ['rdl']),
  E('leg-curl-allonge', 'Leg curl allongé', 'Machine', 'iso', ['ischios'], ['mollets'], ['leg-curl-assis']),
  E('leg-curl-assis', 'Leg curl assis', 'Machine', 'iso', ['ischios'], [], ['leg-curl-allonge']),
  E('adducteurs-machine', 'Adducteurs machine', 'Machine', 'iso', ['adducteurs'], [], ['copenhague']),
  E('copenhague', 'Planche Copenhague', 'Poids du corps', 'iso', ['adducteurs'], ['obliques'], ['adducteurs-machine']),
  E('mollets-debout', 'Mollets debout', 'Machine', 'iso', ['mollets'], [], ['mollets-presse']),
  E('mollets-presse', 'Mollets à la presse', 'Machine', 'iso', ['mollets'], [], ['mollets-debout']),
  // Fessiers
  E('hip-thrust', 'Hip thrust barre', 'Barre', 'poly', ['grand-fessier'], ['ischios'], ['hip-thrust-machine', 'pont-fessier']),
  E('hip-thrust-machine', 'Hip thrust machine', 'Machine', 'poly', ['grand-fessier'], ['ischios'], ['hip-thrust', 'pont-fessier']),
  E('pont-fessier', 'Pont fessier haltère', 'Haltère', 'poly', ['grand-fessier'], ['ischios'], ['hip-thrust']),
  E('kickback-poulie', 'Kickback à la poulie', 'Poulie', 'iso', ['grand-fessier'], [], ['kickback-machine']),
  E('kickback-machine', 'Kickback machine', 'Machine', 'iso', ['grand-fessier'], [], ['kickback-poulie']),
  E('abducteurs-machine', 'Abducteurs machine', 'Machine', 'iso', ['moyen-fessier'], [], ['abduction-elastique']),
  E('abduction-elastique', 'Abduction élastique', 'Élastique', 'iso', ['moyen-fessier'], [], ['abducteurs-machine']),
  // Dos
  E('tractions', 'Tractions', 'Poids du corps', 'poly', ['dorsaux'], ['biceps', 'haut-dos'], ['tirage-vertical', 'tractions-assistees']),
  E('tractions-assistees', 'Tractions assistées', 'Machine', 'poly', ['dorsaux'], ['biceps'], ['tirage-vertical']),
  E('tirage-vertical', 'Tirage vertical', 'Poulie', 'poly', ['dorsaux'], ['biceps', 'haut-dos'], ['tractions-assistees']),
  E('rowing-barre', 'Rowing barre', 'Barre', 'poly', ['dorsaux', 'haut-dos'], ['biceps', 'lombaires', 'epaules-arr'], ['rowing-haltere', 'tirage-horizontal']),
  E('rowing-haltere', 'Rowing haltère un bras', 'Haltère', 'poly', ['dorsaux', 'haut-dos'], ['biceps'], ['rowing-barre', 'tirage-horizontal']),
  E('tirage-horizontal', 'Tirage horizontal', 'Poulie', 'poly', ['haut-dos', 'dorsaux'], ['biceps', 'epaules-arr'], ['rowing-haltere']),
  E('pullover-poulie', 'Pull-over à la poulie', 'Poulie', 'iso', ['dorsaux'], [], ['tirage-vertical']),
  E('extension-lombaire', 'Extensions lombaires', 'Banc', 'iso', ['lombaires'], ['grand-fessier', 'ischios'], []),
  // Pecs
  E('dc-barre', 'Développé couché barre', 'Barre', 'poly', ['pecs'], ['epaules-avant', 'triceps'], ['dc-halteres', 'chest-press']),
  E('dc-halteres', 'Développé couché haltères', 'Haltères', 'poly', ['pecs'], ['epaules-avant', 'triceps'], ['dc-barre', 'chest-press']),
  E('di-halteres', 'Développé incliné haltères', 'Haltères', 'poly', ['pecs', 'epaules-avant'], ['triceps'], ['di-machine', 'dc-halteres']),
  E('di-machine', 'Développé incliné machine', 'Machine', 'poly', ['pecs', 'epaules-avant'], ['triceps'], ['di-halteres']),
  E('chest-press', 'Chest press', 'Machine', 'poly', ['pecs'], ['triceps', 'epaules-avant'], ['dc-halteres']),
  E('pompes', 'Pompes', 'Poids du corps', 'poly', ['pecs'], ['triceps', 'epaules-avant', 'gainage'], ['dc-halteres']),
  E('ecarte-poulie', 'Écarté à la poulie', 'Poulie', 'iso', ['pecs'], [], ['pec-deck']),
  E('pec-deck', 'Pec deck', 'Machine', 'iso', ['pecs'], [], ['ecarte-poulie']),
  // Épaules
  E('dm-halteres', 'Développé militaire haltères', 'Haltères', 'poly', ['epaules-avant'], ['epaules-lat', 'triceps'], ['dm-machine']),
  E('dm-machine', 'Développé épaules machine', 'Machine', 'poly', ['epaules-avant'], ['epaules-lat', 'triceps'], ['dm-halteres']),
  E('elevations-laterales', 'Élévations latérales', 'Haltères', 'iso', ['epaules-lat'], [], ['elevations-poulie']),
  E('elevations-poulie', 'Élévations latérales poulie', 'Poulie', 'iso', ['epaules-lat'], [], ['elevations-laterales']),
  E('face-pull', 'Face pull', 'Poulie', 'iso', ['epaules-arr', 'haut-dos'], [], ['oiseau']),
  E('oiseau', 'Oiseau haltères', 'Haltères', 'iso', ['epaules-arr'], ['haut-dos'], ['reverse-pec-deck']),
  E('reverse-pec-deck', 'Pec deck inversé', 'Machine', 'iso', ['epaules-arr'], ['haut-dos'], ['oiseau', 'face-pull']),
  // Bras
  E('curl-halteres', 'Curl haltères', 'Haltères', 'iso', ['biceps'], ['avant-bras'], ['curl-barre', 'curl-poulie']),
  E('curl-barre', 'Curl barre EZ', 'Barre', 'iso', ['biceps'], ['avant-bras'], ['curl-halteres']),
  E('curl-marteau', 'Curl marteau', 'Haltères', 'iso', ['biceps', 'avant-bras'], [], ['curl-halteres']),
  E('curl-poulie', 'Curl à la poulie', 'Poulie', 'iso', ['biceps'], [], ['curl-halteres']),
  E('curl-incline', 'Curl incliné', 'Haltères', 'iso', ['biceps'], [], ['curl-halteres']),
  E('extension-poulie', 'Extension triceps poulie', 'Poulie', 'iso', ['triceps'], [], ['barre-front', 'kickback-triceps']),
  E('barre-front', 'Barre au front', 'Barre', 'iso', ['triceps'], [], ['extension-poulie']),
  E('extension-nuque', 'Extension nuque haltère', 'Haltère', 'iso', ['triceps'], [], ['extension-poulie']),
  E('kickback-triceps', 'Kickback triceps', 'Haltère', 'iso', ['triceps'], [], ['extension-poulie']),
  E('dips', 'Dips', 'Poids du corps', 'poly', ['triceps', 'pecs'], ['epaules-avant'], ['dips-machine', 'extension-poulie']),
  E('dips-machine', 'Dips machine', 'Machine', 'poly', ['triceps', 'pecs'], ['epaules-avant'], ['dips']),
  E('curl-poignet', 'Curl poignets', 'Haltères', 'iso', ['avant-bras'], [], []),
  // Abdos
  E('crunch-poulie', 'Crunch à la poulie', 'Poulie', 'iso', ['grand-droit'], [], ['crunch-sol']),
  E('crunch-sol', 'Crunch au sol', 'Poids du corps', 'iso', ['grand-droit'], [], ['crunch-poulie']),
  E('releve-jambes', 'Relevés de jambes suspendu', 'Poids du corps', 'iso', ['grand-droit'], ['obliques'], ['releve-jambes-sol']),
  E('releve-jambes-sol', 'Relevés de jambes au sol', 'Poids du corps', 'iso', ['grand-droit'], [], ['releve-jambes']),
  E('russian-twist', 'Russian twist', 'Poids du corps', 'iso', ['obliques'], ['grand-droit'], ['planche-laterale']),
  E('planche', 'Planche', 'Poids du corps', 'iso', ['gainage'], ['grand-droit'], ['dead-bug']),
  E('planche-laterale', 'Planche latérale', 'Poids du corps', 'iso', ['obliques', 'gainage'], [], ['russian-twist']),
  E('dead-bug', 'Dead bug', 'Poids du corps', 'iso', ['gainage'], ['grand-droit'], ['planche']),
  E('pallof', 'Pallof press', 'Poulie', 'iso', ['obliques', 'gainage'], [], ['planche-laterale']),
];
