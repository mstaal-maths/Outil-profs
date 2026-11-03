// Modèle de données d'une classe, calculs de moyennes et données de démonstration.
import { uid, seeded } from './util.js';

export const CLASS_COLORS = [
  { id: 'encre', label: 'Encre', hex: '#2e44c9' },
  { id: 'marge', label: 'Vermillon', hex: '#d93b30' },
  { id: 'sapin', label: 'Sapin', hex: '#1d7f55' },
  { id: 'ocre', label: 'Ocre', hex: '#c27a12' },
  { id: 'prune', label: 'Prune', hex: '#8a3f9e' },
  { id: 'lagon', label: 'Lagon', hex: '#0f8a9c' },
  { id: 'rose', label: 'Framboise', hex: '#c8336f' },
  { id: 'ardoise', label: 'Ardoise', hex: '#4b5563' },
];
export const colorHex = (id) => (CLASS_COLORS.find((c) => c.id === id) || CLASS_COLORS[0]).hex;

/** Année scolaire courante, ex. « 2026-2027 » (bascule au 1er août). */
export function schoolYear(d = new Date()) {
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${y + 1}`;
}

export function periodsOf(cls) {
  return cls.periodMode === 'semestre'
    ? [{ n: 1, label: 'Semestre 1', short: 'S1' }, { n: 2, label: 'Semestre 2', short: 'S2' }]
    : [{ n: 1, label: 'Trimestre 1', short: 'T1' }, { n: 2, label: 'Trimestre 2', short: 'T2' }, { n: 3, label: 'Trimestre 3', short: 'T3' }];
}
export function currentPeriod(cls, d = new Date()) {
  const m = d.getMonth(); // 0 = janvier
  if (cls.periodMode === 'semestre') return m >= 7 || m === 0 ? 1 : 2;
  if (m >= 7 && m <= 10) return 1;
  if (m === 11 || m <= 1) return 2;
  return 3;
}

export function newClass({ name, color = 'encre', periodMode = 'trimestre' }) {
  const now = Date.now();
  return {
    id: uid('c_'), name: name.trim(), color, periodMode, year: schoolYear(),
    createdAt: now, updatedAt: now,
    students: [], evals: [],
    constraints: { apart: [], together: [], front: [] },
    draw: { done: [], absent: [] },
    groups: null, plans: [], activePlan: null,
  };
}
export function newStudent(first, last = '', g = '') {
  return { id: uid('s_'), first: first.trim(), last: last.trim(), g };
}

// ---------- Moyennes ----------
export function studentAverage(cls, sid, period) {
  let sum = 0, w = 0;
  for (const e of cls.evals) {
    if (period && e.period !== period) continue;
    const v = e.grades?.[sid];
    if (typeof v !== 'number') continue;
    const c = e.coef ?? 1;
    sum += (v / (e.max || 20)) * 20 * c;
    w += c;
  }
  return w ? sum / w : null;
}
export function classAverage(cls, period) {
  const avgs = cls.students.map((s) => studentAverage(cls, s.id, period)).filter((v) => v != null);
  return avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
}
export function evalAverage(cls, e) {
  const vs = cls.students.map((s) => e.grades?.[s.id]).filter((v) => typeof v === 'number');
  return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
}
/** Niveau d'un élève (moyenne de la période, ou de l'année, ou moyenne de classe à défaut). */
export function levelMap(cls, period) {
  const ca = classAverage(cls, period) ?? classAverage(cls) ?? 10;
  const m = {};
  for (const s of cls.students) m[s.id] = studentAverage(cls, s.id, period) ?? studentAverage(cls, s.id) ?? ca;
  return m;
}
export function hasGrades(cls, period) {
  return cls.evals.some((e) => (!period || e.period === period) && Object.values(e.grades || {}).some((v) => typeof v === 'number'));
}

// ---------- Démonstration ----------
const DEMO_STUDENTS = [
  ['Inès', 'Bernard', 'f'], ['Lucas', 'Moreau', 'm'], ['Chloé', 'Lefèvre', 'f'], ['Adam', 'Benali', 'm'],
  ['Léa', 'Fontaine', 'f'], ['Noah', 'Girard', 'm'], ['Jade', 'Rousseau', 'f'], ['Ethan', 'Mercier', 'm'],
  ['Manon', 'Dupuis', 'f'], ['Yanis', 'Haddad', 'm'], ['Camille', 'Blanc', 'f'], ['Hugo', 'Chevalier', 'm'],
  ['Lina', 'Traoré', 'f'], ['Sacha', 'Lambert', 'm'], ['Emma', 'Perrin', 'f'], ['Mathis', 'Robin', 'm'],
  ['Zoé', 'Garnier', 'f'], ['Rayan', 'Mansouri', 'm'], ['Louise', 'Faure', 'f'], ['Nathan', 'Guérin', 'm'],
  ['Ambre', 'Marchand', 'f'], ['Théo', 'Lemoine', 'm'], ['Sarah', 'Nguyen', 'f'], ['Gabriel', 'Roux', 'm'],
  ['Maëlys', 'Hoarau', 'f'], ['Ilyes', 'Bouzid', 'm'], ['Romane', 'Leclerc', 'f'], ['Baptiste', 'Morel', 'm'],
  ['Aya', 'Diallo', 'f'], ['Enzo', 'Da Silva', 'm'], ['Nour', 'Khelifi', 'f'], ['Jules', 'Barbier', 'm'],
];

const EXTRA_FIRST = [['Alice', 'f'], ['Malo', 'm'], ['Anaïs', 'f'], ['Kylian', 'm'], ['Clara', 'f'], ['Samuel', 'm'], ['Yasmine', 'f'], ['Tom', 'm'], ['Mila', 'f'], ['Liam', 'm'], ['Fatou', 'f'], ['Mohamed', 'm'], ['Lou', 'f'], ['Arthur', 'm'], ['Eva', 'f'], ['Raphaël', 'm']];
const EXTRA_LAST = ['Petit', 'Durand', 'Lopez', 'Fournier', 'Bonnet', 'Gauthier', 'Picard', 'Renaud', 'Colin', 'Vidal', 'Martin', 'Caron', 'Brunet', 'Kone', 'Rolland', 'Lemaire'];

const DEMO_EVALS = [
  ['Interrogation — fractions', 10, 1, '2026-09-19'],
  ['Devoir maison n°1', 20, 1, '2026-09-30'],
  ['Contrôle — nombres relatifs', 20, 2, '2026-10-10'],
  ['Questions flash', 5, 0.5, '2026-10-15'],
  ['Contrôle — proportionnalité', 20, 2, '2026-11-02'],
];

function demoClass(name, color, count, seed, extra = {}) {
  const rnd = seeded(seed);
  const firsts = DEMO_STUDENTS.map(([f, , g]) => [f, g]).concat(EXTRA_FIRST).sort(() => rnd() - 0.5).slice(0, count);
  const lasts = DEMO_STUDENTS.map(([, l]) => l).concat(EXTRA_LAST).sort(() => rnd() - 0.5);
  const students = firsts.map(([f, g], i) => ({ id: `d${seed}_${i}`, first: f, last: lasts[i], g }));
  const ability = {};
  for (const s of students) ability[s.id] = 6 + rnd() * 12 + (rnd() < 0.15 ? 2 : 0);
  const evals = DEMO_EVALS.map(([title, max, coef, date], k) => {
    const grades = {};
    for (const s of students) {
      if (rnd() < 0.04) { grades[s.id] = 'abs'; continue; }
      let v = ability[s.id] + (rnd() - 0.5) * 6 + k * 0.25;
      v = Math.max(1, Math.min(20, v)) * (max / 20);
      grades[s.id] = Math.round(v * 2) / 2;
    }
    return { id: `e${seed}_${k}`, period: 1, title, max, coef, date, grades };
  });
  const c = {
    id: `demo-${seed}`, name, color, periodMode: 'trimestre', year: schoolYear(), demo: true,
    createdAt: Date.now() - 86400e3 * 60, updatedAt: Date.now() - 3600e3 * (seed % 7 + 1),
    students, evals,
    constraints: {
      apart: [[students[1].id, students[5].id], [students[9].id, students[17].id]],
      together: [],
      front: [students[12].id],
    },
    draw: { done: [], absent: [] },
    groups: null, plans: [], activePlan: null,
    ...extra,
  };
  return c;
}

export function demoClasses() {
  return [
    demoClass('5e E', 'encre', 26, 5),
    demoClass('3e B', 'marge', 24, 3),
    demoClass('6e A', 'sapin', 28, 6),
    demoClass('4e C', 'ocre', 25, 4),
  ];
}
