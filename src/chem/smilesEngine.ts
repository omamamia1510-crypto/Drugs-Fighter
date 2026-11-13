export interface MolAtom {
  id: number;
  elem: string;
  aromatic: boolean;
  charge: number;
  implicitH: number;
  x: number;
  y: number;
  z: number;
  x2d: number;
  y2d: number;
}

export interface MolBond {
  u: number;
  v: number;
  order: number; // 1, 1.5 (aromatic), 2, 3
  aromatic: boolean;
}

export type WeaponArchetype = 'Catalyst Blade' | 'Aromatic Chakram' | 'Alkaloid Hammer' | 'Bio-Staff';

export interface MoleculeStats {
  mw: number;
  logp: number;
  hbd: number;
  hba: number;
  ringCount: number;
  heavyAtoms: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  crit: number;
  archetype: WeaponArchetype;
}

export interface ParsedMolecule {
  success: true;
  smiles: string;
  name: string;
  formula: string;
  atoms: MolAtom[];
  bonds: MolBond[];
  stats: MoleculeStats;
  svg2d: string;
}

export interface ParseMoleculeError {
  success: false;
  error: string;
}

export type MoleculeParseResult = ParsedMolecule | ParseMoleculeError;

export interface DrugPreset {
  id: string;
  name: string;
  smiles: string;
  category: string;
  description: string;
}

export const DRUG_PRESETS: DrugPreset[] = [
  {
    id: 'aspirin',
    name: 'Aspirin',
    smiles: 'CC(=O)Oc1ccccc1C(=O)O',
    category: 'Analgesic',
    description: 'Balanced aromatic ester blade with crisp reach.',
  },
  {
    id: 'caffeine',
    name: 'Caffeine',
    smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C',
    category: 'Stimulant',
    description: 'High-speed purine core boosting strike tempo.',
  },
  {
    id: 'paracetamol',
    name: 'Paracetamol',
    smiles: 'CC(=O)Nc1ccc(O)cc1',
    category: 'Antipyretic',
    description: 'Steadfast phenolic guard with strong defense.',
  },
  {
    id: 'ibuprofen',
    name: 'Ibuprofen',
    smiles: 'CC(C)Cc1ccc(cc1)C(C)C(=O)O',
    category: 'NSAID',
    description: 'Lipophilic striker with heavy critical power.',
  },
  {
    id: 'morphine',
    name: 'Morphine',
    smiles: 'CN1CCC23C4C1CC5=C2C(=C(C=C5)O)OC3C(C=C4)O',
    category: 'Alkaloid',
    description: 'Dense polycyclic hammer with massive vitality.',
  },
  {
    id: 'penicillin',
    name: 'Penicillin G',
    smiles: 'CC1(C(N2C(S1)C(C2=O)NC(=O)CC3=CC=CC=C3)C(=O)O)C',
    category: 'Antibiotic',
    description: 'Beta-lactam sulfur lattice with high armor.',
  },
  {
    id: 'dopamine',
    name: 'Dopamine',
    smiles: 'NCCc1ccc(O)c(O)c1',
    category: 'Neurotransmitter',
    description: 'Agile catecholamine spur for rapid combos.',
  },
  {
    id: 'nicotine',
    name: 'Nicotine',
    smiles: 'CN1CCCC1c2cccnc2',
    category: 'Alkaloid',
    description: 'Fast twin-ring catalyst with sharp crit rate.',
  },
];

const ATOMIC_WEIGHTS: Record<string, number> = {
  H: 1.008,
  B: 10.81,
  C: 12.011,
  N: 14.007,
  O: 15.999,
  F: 18.998,
  P: 30.974,
  S: 32.06,
  Cl: 35.45,
  Br: 79.904,
  I: 126.904,
};

const DEFAULT_VALENCE: Record<string, number[]> = {
  B: [3],
  C: [4],
  N: [3, 5],
  O: [2],
  F: [1],
  P: [3, 5],
  S: [2, 4, 6],
  Cl: [1],
  Br: [1],
  I: [1],
};

const ELEMENT_COLORS_HEX: Record<string, string> = {
  C: '#38bdf8',
  N: '#60a5fa',
  O: '#f43f5e',
  S: '#facc15',
  P: '#fb923c',
  F: '#4ade80',
  Cl: '#22c55e',
  Br: '#dc2626',
  I: '#a855f7',
};

interface RawAtom {
  id: number;
  elem: string;
  aromatic: boolean;
  charge: number;
  explicitH: number;
}

interface RawBond {
  u: number;
  v: number;
  order: number;
  aromatic: boolean;
}

function tokenizeSmiles(smiles: string): { atoms: RawAtom[]; bonds: RawBond[] } {
  const atoms: RawAtom[] = [];
  const bonds: RawBond[] = [];
  const stack: number[] = [];
  const rings = new Map<string, { atomIdx: number; pendingBond: number | null }>();

  let currentAtom: number | null = null;
  let pendingBond: number | null = null; // 1, 2, 3, 1.5

  let i = 0;
  const n = smiles.length;

  while (i < n) {
    const ch = smiles[i];

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }

    if (ch === '(') {
      if (currentAtom === null) {
        throw new Error('Dấu ngoặc nhánh "(" xuất hiện trước nguyên tử đầu tiên.');
      }
      stack.push(currentAtom);
      i++;
      continue;
    }

    if (ch === ')') {
      if (stack.length === 0) {
        throw new Error('Dấu ngoặc đóng ")" không khớp.');
      }
      currentAtom = stack.pop()!;
      pendingBond = null;
      i++;
      continue;
    }

    if (ch === '.') {
      currentAtom = null;
      pendingBond = null;
      i++;
      continue;
    }

    if (ch === '-') {
      pendingBond = 1;
      i++;
      continue;
    }
    if (ch === '=') {
      pendingBond = 2;
      i++;
      continue;
    }
    if (ch === '#') {
      pendingBond = 3;
      i++;
      continue;
    }
    if (ch === ':') {
      pendingBond = 1.5;
      i++;
      continue;
    }
    if (ch === '/' || ch === '\\') {
      i++;
      continue;
    }

    // Ring closure %nn or single digit 0-9
    if (ch === '%' || (ch >= '0' && ch <= '9')) {
      if (currentAtom === null) {
        throw new Error('Ký hiệu đóng vòng không có nguyên tử gắn kết.');
      }
      let ringKey = ch;
      if (ch === '%') {
        if (i + 2 >= n) throw new Error('Mã vòng % không hợp lệ.');
        ringKey = smiles.slice(i + 1, i + 3);
        if (!/^\d{2}$/.test(ringKey)) throw new Error(`Mã vòng %${ringKey} không hợp lệ.`);
        i += 3;
      } else {
        i++;
      }

      const existing = rings.get(ringKey);
      if (existing) {
        const u = existing.atomIdx;
        const v = currentAtom;
        if (u === v) throw new Error('Vòng tự nối vào chính nó không hợp lệ.');
        const bothAromatic = atoms[u].aromatic && atoms[v].aromatic;
        const order =
          pendingBond ?? existing.pendingBond ?? (bothAromatic ? 1.5 : 1);
        bonds.push({
          u,
          v,
          order,
          aromatic: order === 1.5 || bothAromatic,
        });
        rings.delete(ringKey);
      } else {
        rings.set(ringKey, { atomIdx: currentAtom, pendingBond });
      }
      pendingBond = null;
      continue;
    }

    // Bracket atom [...]
    if (ch === '[') {
      const closeIdx = smiles.indexOf(']', i + 1);
      if (closeIdx === -1) throw new Error('Thiếu dấu "]" đóng nguyên tử.');
      const inside = smiles.slice(i + 1, closeIdx);
      const match = inside.match(/^\d*([A-Za-z][a-z]?)([@]*)(H\d*)?([+-]\d*)?/);
      if (!match) throw new Error(`Nguyên tử trong ngoặc không hợp lệ: [${inside}]`);
      const rawSym = match[1];
      const aromatic = rawSym[0] === rawSym[0].toLowerCase();
      const elem = rawSym[0].toUpperCase() + rawSym.slice(1).toLowerCase();
      const hPart = match[3];
      const explicitH = hPart ? (hPart.length === 1 ? 1 : parseInt(hPart.slice(1), 10)) : 0;
      const cPart = match[4];
      let charge = 0;
      if (cPart) {
        const sign = cPart[0] === '-' ? -1 : 1;
        const mag = cPart.length > 1 ? parseInt(cPart.slice(1), 10) : 1;
        charge = sign * (Number.isNaN(mag) ? 1 : mag);
      }

      const newId = atoms.length;
      atoms.push({ id: newId, elem, aromatic, charge, explicitH });
      if (currentAtom !== null) {
        const bothAromatic = atoms[currentAtom].aromatic && aromatic;
        const order = pendingBond ?? (bothAromatic ? 1.5 : 1);
        bonds.push({
          u: currentAtom,
          v: newId,
          order,
          aromatic: order === 1.5 || bothAromatic,
        });
      }
      currentAtom = newId;
      pendingBond = null;
      i = closeIdx + 1;
      continue;
    }

    // Two-letter organic subset: Cl, Br
    const two = smiles.slice(i, i + 2);
    if (two === 'Cl' || two === 'Br') {
      const newId = atoms.length;
      atoms.push({ id: newId, elem: two, aromatic: false, charge: 0, explicitH: 0 });
      if (currentAtom !== null) {
        const order = pendingBond ?? 1;
        bonds.push({ u: currentAtom, v: newId, order, aromatic: order === 1.5 });
      }
      currentAtom = newId;
      pendingBond = null;
      i += 2;
      continue;
    }

    // Single-letter organic subset
    const organicUpper = new Set(['B', 'C', 'N', 'O', 'P', 'S', 'F', 'I']);
    const organicAromatic = new Set(['b', 'c', 'n', 'o', 'p', 's']);
    if (organicUpper.has(ch) || organicAromatic.has(ch)) {
      const aromatic = organicAromatic.has(ch);
      const elem = ch.toUpperCase();
      const newId = atoms.length;
      atoms.push({ id: newId, elem, aromatic, charge: 0, explicitH: 0 });
      if (currentAtom !== null) {
        const bothAromatic = atoms[currentAtom].aromatic && aromatic;
        const order = pendingBond ?? (bothAromatic ? 1.5 : 1);
        bonds.push({
          u: currentAtom,
          v: newId,
          order,
          aromatic: order === 1.5 || bothAromatic,
        });
      }
      currentAtom = newId;
      pendingBond = null;
      i++;
      continue;
    }

    throw new Error(`Ký tự SMILES không hợp lệ tại vị trí ${i + 1}: "${ch}"`);
  }

  if (stack.length > 0) throw new Error('Thiếu dấu ")" đóng nhánh.');
  if (rings.size > 0) throw new Error(`Vòng đóng chưa hoàn chỉnh: ${Array.from(rings.keys()).join(', ')}`);
  if (atoms.length === 0) throw new Error('Chuỗi SMILES rỗng.');

  return { atoms, bonds };
}

function deterministicHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function layout2DAnd3D(
  rawAtoms: RawAtom[],
  bonds: RawBond[],
  smiles: string
): { pos2d: Array<{ x: number; y: number }>; pos3d: Array<{ x: number; y: number; z: number }> } {
  const n = rawAtoms.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  const bondMap = new Map<string, number>();

  for (const b of bonds) {
    adj[b.u].push(b.v);
    adj[b.v].push(b.u);
    bondMap.set(`${Math.min(b.u, b.v)}-${Math.max(b.u, b.v)}`, b.order);
  }

  // BFS tree placement for clean initial 2D & 3D geometry
  const p2 = Array.from({ length: n }, () => ({ x: 0, y: 0 }));
  const p3 = Array.from({ length: n }, () => ({ x: 0, y: 0, z: 0 }));
  const placed = new Array<boolean>(n).fill(false);
  const incomingAngle = new Array<number>(n).fill(0);

  const seed = deterministicHash(smiles);
  let rngState = seed || 1234567;
  const nextRand = () => {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 4294967296;
  };

  for (let start = 0; start < n; start++) {
    if (placed[start]) continue;
    placed[start] = true;
    p2[start] = { x: start * 2.2, y: 0 };
    p3[start] = { x: start * 2.2, y: 0, z: 0 };

    const queue: number[] = [start];
    while (queue.length > 0) {
      const u = queue.shift()!;
      const neighbors = adj[u].filter((v) => !placed[v]);
      const baseAngle = u === start ? -Math.PI / 6 : incomingAngle[u];
      const count = neighbors.length;

      neighbors.forEach((v, idx) => {
        placed[v] = true;
        const bondOrder = bondMap.get(`${Math.min(u, v)}-${Math.max(u, v)}`) ?? 1;
        let spread = Math.PI / 3;
        if (bondOrder >= 3) spread = 0;
        const angleOffset =
          count === 1
            ? (u === start ? 0 : (idx % 2 === 0 ? 1 : -1) * (bondOrder >= 3 ? 0 : Math.PI / 3))
            : (idx - (count - 1) / 2) * ((2 * Math.PI) / Math.max(count + 1, 3));

        const angle = baseAngle + angleOffset;
        const len = 1.0;
        p2[v] = {
          x: p2[u].x + Math.cos(angle) * len,
          y: p2[u].y + Math.sin(angle) * len,
        };

        // 3D: aromatic atoms stay mostly planar; sp3 atoms get dihedral z-puckering
        const isFlat = rawAtoms[u].aromatic || rawAtoms[v].aromatic || bondOrder >= 2;
        const zJitter = isFlat ? (nextRand() - 0.5) * 0.14 : (idx % 2 === 0 ? 1 : -1) * (0.38 + nextRand() * 0.18);
        const len3 = Math.sqrt(Math.max(0.25, len * len - zJitter * zJitter));
        p3[v] = {
          x: p3[u].x + Math.cos(angle) * len3,
          y: p3[u].y + Math.sin(angle) * len3,
          z: p3[u].z + zJitter,
        };

        incomingAngle[v] = angle;
        queue.push(v);
      });
    }
  }

  // Force-directed relaxation (2D & 3D simultaneously) so rings close cleanly and atoms never overlap
  const targetLen = 1.0;
  const iters = n > 1 ? 120 : 0;
  for (let step = 0; step < iters; step++) {
    const f2 = Array.from({ length: n }, () => ({ x: 0, y: 0 }));
    const f3 = Array.from({ length: n }, () => ({ x: 0, y: 0, z: 0 }));

    // Bond spring forces
    for (const b of bonds) {
      const dx2 = p2[b.v].x - p2[b.u].x;
      const dy2 = p2[b.v].y - p2[b.u].y;
      const d2 = Math.hypot(dx2, dy2) || 0.001;
      const kBond = b.aromatic ? 0.32 : 0.26;
      const pull2 = ((d2 - targetLen) / d2) * kBond;
      f2[b.u].x += dx2 * pull2;
      f2[b.u].y += dy2 * pull2;
      f2[b.v].x -= dx2 * pull2;
      f2[b.v].y -= dy2 * pull2;

      const dx3 = p3[b.v].x - p3[b.u].x;
      const dy3 = p3[b.v].y - p3[b.u].y;
      const dz3 = p3[b.v].z - p3[b.u].z;
      const d3 = Math.hypot(dx3, dy3, dz3) || 0.001;
      const pull3 = ((d3 - targetLen) / d3) * kBond;
      f3[b.u].x += dx3 * pull3;
      f3[b.u].y += dy3 * pull3;
      f3[b.u].z += dz3 * pull3;
      f3[b.v].x -= dx3 * pull3;
      f3[b.v].y -= dy3 * pull3;
      f3[b.v].z -= dz3 * pull3;
    }

    // Non-bonded repulsion & 2-hop angle maintenance
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        const isBonded = bondMap.has(`${a}-${b}`);
        const dx2 = p2[b].x - p2[a].x;
        const dy2 = p2[b].y - p2[a].y;
        const distSq2 = dx2 * dx2 + dy2 * dy2 + 0.02;
        if (!isBonded && distSq2 < 4.5) {
          const rep2 = 0.075 / distSq2;
          f2[a].x -= dx2 * rep2;
          f2[a].y -= dy2 * rep2;
          f2[b].x += dx2 * rep2;
          f2[b].y += dy2 * rep2;
        }

        const dx3 = p3[b].x - p3[a].x;
        const dy3 = p3[b].y - p3[a].y;
        const dz3 = p3[b].z - p3[a].z;
        const distSq3 = dx3 * dx3 + dy3 * dy3 + dz3 * dz3 + 0.02;
        if (!isBonded && distSq3 < 4.5) {
          const rep3 = 0.075 / distSq3;
          f3[a].x -= dx3 * rep3;
          f3[a].y -= dy3 * rep3;
          f3[a].z -= dz3 * rep3;
          f3[b].x += dx3 * rep3;
          f3[b].y += dy3 * rep3;
          f3[b].z += dz3 * rep3;
        }
      }
    }

    // Gentle flattening for aromatic atoms in 3D so benzene rings stay crisp
    for (let a = 0; a < n; a++) {
      if (rawAtoms[a].aromatic) {
        f3[a].z -= p3[a].z * 0.04;
      }
    }

    const damping = 0.85 * (1 - step / (iters * 1.4));
    for (let a = 0; a < n; a++) {
      p2[a].x += Math.max(-0.25, Math.min(0.25, f2[a].x * damping));
      p2[a].y += Math.max(-0.25, Math.min(0.25, f2[a].y * damping));
      p3[a].x += Math.max(-0.25, Math.min(0.25, f3[a].x * damping));
      p3[a].y += Math.max(-0.25, Math.min(0.25, f3[a].y * damping));
      p3[a].z += Math.max(-0.25, Math.min(0.25, f3[a].z * damping));
    }
  }

  return { pos2d: p2, pos3d: p3 };
}

function build2dSvg(atoms: MolAtom[], bonds: MolBond[], accentHex: string): string {
  const size = 160;
  const pad = 22;
  if (atoms.length === 0) return '';

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const a of atoms) {
    if (a.x2d < minX) minX = a.x2d;
    if (a.x2d > maxX) maxX = a.x2d;
    if (a.y2d < minY) minY = a.y2d;
    if (a.y2d > maxY) maxY = a.y2d;
  }

  const spanX = Math.max(maxX - minX, 0.5);
  const spanY = Math.max(maxY - minY, 0.5);
  const scale = (size - pad * 2) / Math.max(spanX, spanY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const mapPt = (x: number, y: number) => ({
    sx: size / 2 + (x - cx) * scale,
    sy: size / 2 - (y - cy) * scale,
  });

  const lines: string[] = [];
  for (const b of bonds) {
    const a1 = atoms[b.u];
    const a2 = atoms[b.v];
    const p1 = mapPt(a1.x2d, a1.y2d);
    const p2 = mapPt(a2.x2d, a2.y2d);
    const dx = p2.sx - p1.sx;
    const dy = p2.sy - p1.sy;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;

    if (b.order === 2) {
      const off = 2.6;
      lines.push(
        `<line x1="${(p1.sx + nx * off).toFixed(1)}" y1="${(p1.sy + ny * off).toFixed(1)}" x2="${(p2.sx + nx * off).toFixed(1)}" y2="${(p2.sy + ny * off).toFixed(1)}" stroke="#e2e8f0" stroke-width="2" stroke-linecap="round"/>`
      );
      lines.push(
        `<line x1="${(p1.sx - nx * off).toFixed(1)}" y1="${(p1.sy - ny * off).toFixed(1)}" x2="${(p2.sx - nx * off).toFixed(1)}" y2="${(p2.sy - ny * off).toFixed(1)}" stroke="${accentHex}" stroke-width="2" stroke-linecap="round"/>`
      );
    } else if (b.order === 3) {
      const off = 3.2;
      lines.push(
        `<line x1="${p1.sx.toFixed(1)}" y1="${p1.sy.toFixed(1)}" x2="${p2.sx.toFixed(1)}" y2="${p2.sy.toFixed(1)}" stroke="#f8fafc" stroke-width="2" stroke-linecap="round"/>`
      );
      lines.push(
        `<line x1="${(p1.sx + nx * off).toFixed(1)}" y1="${(p1.sy + ny * off).toFixed(1)}" x2="${(p2.sx + nx * off).toFixed(1)}" y2="${(p2.sy + ny * off).toFixed(1)}" stroke="${accentHex}" stroke-width="1.6" stroke-linecap="round"/>`
      );
      lines.push(
        `<line x1="${(p1.sx - nx * off).toFixed(1)}" y1="${(p1.sy - ny * off).toFixed(1)}" x2="${(p2.sx - nx * off).toFixed(1)}" y2="${(p2.sy - ny * off).toFixed(1)}" stroke="${accentHex}" stroke-width="1.6" stroke-linecap="round"/>`
      );
    } else if (b.order === 1.5) {
      const off = 2.4;
      lines.push(
        `<line x1="${p1.sx.toFixed(1)}" y1="${p1.sy.toFixed(1)}" x2="${p2.sx.toFixed(1)}" y2="${p2.sy.toFixed(1)}" stroke="#e2e8f0" stroke-width="2" stroke-linecap="round"/>`
      );
      lines.push(
        `<line x1="${(p1.sx + nx * off).toFixed(1)}" y1="${(p1.sy + ny * off).toFixed(1)}" x2="${(p2.sx + nx * off).toFixed(1)}" y2="${(p2.sy + ny * off).toFixed(1)}" stroke="${accentHex}" stroke-width="1.4" stroke-dasharray="3,2.5" stroke-linecap="round"/>`
      );
    } else {
      lines.push(
        `<line x1="${p1.sx.toFixed(1)}" y1="${p1.sy.toFixed(1)}" x2="${p2.sx.toFixed(1)}" y2="${p2.sy.toFixed(1)}" stroke="#cbd5e1" stroke-width="2.1" stroke-linecap="round"/>`
      );
    }
  }

  const labels: string[] = [];
  for (const a of atoms) {
    if (a.elem === 'C') continue;
    const { sx, sy } = mapPt(a.x2d, a.y2d);
    const col = ELEMENT_COLORS_HEX[a.elem] ?? '#f8fafc';
    const text = a.implicitH > 0 && (a.elem === 'O' || a.elem === 'N' || a.elem === 'S')
      ? `${a.elem}${a.implicitH > 1 ? `H${a.implicitH}` : 'H'}`
      : a.elem;
    labels.push(
      `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="7.5" fill="#0b1324"/>` +
        `<text x="${sx.toFixed(1)}" y="${(sy + 3.5).toFixed(1)}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9.5" font-weight="700" fill="${col}">${text}</text>`
    );
  }

  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${lines.join('')}${labels.join('')}</svg>`;
}

export function parseSmilesToWeapon(
  smilesInput: string,
  displayName?: string,
  accentHex = '#38bdf8'
): MoleculeParseResult {
  const smiles = smilesInput.trim();
  if (!smiles) {
    return { success: false, error: 'Vui lòng nhập chuỗi SMILES hợp lệ.' };
  }

  try {
    const { atoms: rawAtoms, bonds } = tokenizeSmiles(smiles);
    const n = rawAtoms.length;

    // Calculate bond order sums per atom for implicit Hs
    const bondOrderSum = new Array<number>(n).fill(0);
    for (const b of bonds) {
      bondOrderSum[b.u] += b.order;
      bondOrderSum[b.v] += b.order;
    }

    const { pos2d, pos3d } = layout2DAnd3D(rawAtoms, bonds, smiles);

    // Normalize 3D coordinates to unit span centered at origin
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (const p of pos3d) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 0.8);
    const normScale = 1.0 / span;

    const elemCounts: Record<string, number> = {};
    let totalH = 0;
    let hbd = 0;
    let hba = 0;
    let logp = 0;
    let aromaticAtoms = 0;

    const atoms: MolAtom[] = rawAtoms.map((ra, idx) => {
      const valences = DEFAULT_VALENCE[ra.elem] ?? [4];
      const used = Math.ceil(bondOrderSum[idx]) + ra.explicitH;
      let targetValence = valences.find((v) => v >= used) ?? valences[valences.length - 1];
      if (ra.charge !== 0) targetValence = Math.max(0, targetValence + ra.charge);
      const implicitH = ra.explicitH > 0 ? ra.explicitH : Math.max(0, targetValence - Math.ceil(bondOrderSum[idx]));

      elemCounts[ra.elem] = (elemCounts[ra.elem] ?? 0) + 1;
      totalH += implicitH;

      if ((ra.elem === 'N' || ra.elem === 'O') && implicitH > 0) hbd++;
      if (ra.elem === 'N' || ra.elem === 'O') hba++;
      if (ra.aromatic) aromaticAtoms++;

      // Wildman-Crippen inspired fragment LogP approximation
      if (ra.elem === 'C') logp += ra.aromatic ? 0.31 : 0.16;
      else if (ra.elem === 'O') logp -= implicitH > 0 ? 0.45 : 0.22;
      else if (ra.elem === 'N') logp -= implicitH > 0 ? 0.55 : 0.28;
      else if (ra.elem === 'S') logp += 0.35;
      else if (ra.elem === 'Cl' || ra.elem === 'Br') logp += 0.65;
      else if (ra.elem === 'F') logp += 0.18;

      return {
        id: idx,
        elem: ra.elem,
        aromatic: ra.aromatic,
        charge: ra.charge,
        implicitH,
        x: (pos3d[idx].x - cx) * normScale,
        y: (pos3d[idx].y - cy) * normScale,
        z: (pos3d[idx].z - cz) * normScale,
        x2d: pos2d[idx].x,
        y2d: pos2d[idx].y,
      };
    });

    if (totalH > 0) elemCounts['H'] = totalH;

    // Hill system formula: C first, H second, then alphabetical
    const formulaParts: string[] = [];
    if (elemCounts['C']) formulaParts.push(`C${elemCounts['C'] > 1 ? elemCounts['C'] : ''}`);
    if (elemCounts['H']) formulaParts.push(`H${elemCounts['H'] > 1 ? elemCounts['H'] : ''}`);
    Object.keys(elemCounts)
      .filter((k) => k !== 'C' && k !== 'H')
      .sort()
      .forEach((k) => {
        const count = elemCounts[k];
        formulaParts.push(`${k}${count > 1 ? count : ''}`);
      });
    const formula = formulaParts.join('');

    let mw = 0;
    for (const [sym, count] of Object.entries(elemCounts)) {
      mw += (ATOMIC_WEIGHTS[sym] ?? 12.0) * count;
    }

    // Cyclomatic number (E - V + 1) = independent ring count
    const ringCount = Math.max(0, bonds.length - atoms.length + 1);

    let archetype: WeaponArchetype = 'Catalyst Blade';
    if (ringCount >= 3 || mw > 260) archetype = 'Alkaloid Hammer';
    else if (aromaticAtoms >= 6) archetype = 'Aromatic Chakram';
    else if (hbd + hba >= 4) archetype = 'Bio-Staff';

    const hp = Math.round(120 + Math.min(mw * 0.16, 70));
    const atk = Math.round(14 + Math.min(Math.max(logp * 3.2, 3), 16));
    const def = Math.round(Math.min(hbd + hba, 12) * 1.5 + ringCount * 2);
    const spd = Math.round(Math.max(85, Math.min(125, 118 - mw * 0.08)));
    const crit = Math.round(Math.min(30, 8 + aromaticAtoms * 1.5 + ringCount * 3));

    const presetMatch = DRUG_PRESETS.find((p) => p.smiles === smiles);
    const resolvedName = displayName || presetMatch?.name || formula;

    const svg2d = build2dSvg(atoms, bonds, accentHex);

    return {
      success: true,
      smiles,
      name: resolvedName,
      formula,
      atoms,
      bonds,
      stats: {
        mw: Math.round(mw * 10) / 10,
        logp: Math.round(logp * 100) / 100,
        hbd,
        hba,
        ringCount,
        heavyAtoms: atoms.length,
        hp,
        atk,
        def,
        spd,
        crit,
        archetype,
      },
      svg2d,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Chuỗi SMILES không hợp lệ.',
    };
  }
}
