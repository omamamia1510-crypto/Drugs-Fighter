import * as THREE from 'three';
import type { ArenaStageId } from './arenaStages';
import { ARENA_HALF_WIDTH, FLOOR_Y } from './combatEngine';

const _vec3A = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scaleVec = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _upVec = new THREE.Vector3(0, 1, 0);

export interface StageBuildResult {
  group: THREE.Group;
  bgHex: number;
  fogHex: number;
  fogDensity: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  keyColorHex: number;
  keyIntensity: number;
  rim1Hex: number;
  rim2Hex: number;
  update: (elapsed: number, dt: number) => void;
  dispose: () => void;
}

const DECK_WIDTH = ARENA_HALF_WIDTH * 2 + 2.6; // 23.8m for ARENA_HALF_WIDTH = 10.6
const DECK_DEPTH = 5.2;
const PILLAR_X = ARENA_HALF_WIDTH + 0.78;

function makeBondMesh(
  sharedCylGeo: THREE.BufferGeometry,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  radius: number,
  mat: THREE.Material,
  castShadow: boolean
): THREE.Mesh {
  const dist = p1.distanceTo(p2);
  const mesh = new THREE.Mesh(sharedCylGeo, mat);
  mesh.scale.set(radius, dist, radius);
  mesh.position.addVectors(p1, p2).multiplyScalar(0.5);
  _vec3A.subVectors(p2, p1).normalize();
  mesh.quaternion.setFromUnitVectors(_upVec, _vec3A);
  mesh.castShadow = castShadow;
  return mesh;
}

function createStageDeckTexture(
  stage: ArenaStageId,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const w = 1536;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;

  if (stage === 'cell') {
    ctx.fillStyle = '#071022';
    ctx.fillRect(0, 0, w, h);

    const rad = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w * 0.48);
    rad.addColorStop(0, 'rgba(56, 189, 248, 0.18)');
    rad.addColorStop(0.6, 'rgba(15, 23, 42, 0.08)');
    rad.addColorStop(1, 'rgba(4, 9, 20, 0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
    ctx.lineWidth = 1.6;
    const r = 28;
    const dx = r * 1.5;
    const dy = r * Math.sqrt(3);
    for (let col = -1; col < w / dx + 2; col++) {
      for (let row = -1; row < h / dy + 2; row++) {
        const cx = col * dx;
        const cy = row * dy + (col % 2 === 0 ? 0 : dy / 2);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const px = cx + Math.cos(a) * (r * 0.86);
          const py = cy + Math.sin(a) * (r * 0.86);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }

    ctx.strokeStyle = 'rgba(125, 211, 252, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w / 2, 36);
    ctx.lineTo(w / 2, h - 36);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 115, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 24, w - 48, h - 48);
  } else if (stage === 'flask') {
    ctx.fillStyle = '#071720';
    ctx.fillRect(0, 0, w, h);

    const rad = ctx.createRadialGradient(w / 2, h / 2, 24, w / 2, h / 2, w * 0.48);
    rad.addColorStop(0, 'rgba(45, 212, 191, 0.22)');
    rad.addColorStop(0.5, 'rgba(13, 148, 136, 0.08)');
    rad.addColorStop(1, 'rgba(4, 13, 22, 0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, w, h);

    // Concentric hotplate / magnetic stirrer heating coil rings
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.22)';
    ctx.lineWidth = 2;
    for (const rr of [60, 110, 165, 220]) {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, rr, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Lab ruler / volumetric calibration ticks along top & bottom edges
    ctx.strokeStyle = 'rgba(94, 234, 212, 0.48)';
    ctx.lineWidth = 2;
    for (let x = 60; x <= w - 60; x += 24) {
      const major = (x - 60) % 120 === 0;
      const len = major ? 26 : 13;
      ctx.beginPath();
      ctx.moveTo(x, 24);
      ctx.lineTo(x, 24 + len);
      ctx.moveTo(x, h - 24);
      ctx.lineTo(x, h - 24 - len);
      ctx.stroke();
    }

    // Precision grid lines
    ctx.strokeStyle = 'rgba(45, 212, 191, 0.09)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 24, w - 48, h - 48);
  } else if (stage === 'bloodstream') {
    ctx.fillStyle = '#240710';
    ctx.fillRect(0, 0, w, h);

    const rad = ctx.createRadialGradient(w / 2, h / 2, 30, w / 2, h / 2, w * 0.5);
    rad.addColorStop(0, 'rgba(251, 113, 133, 0.24)');
    rad.addColorStop(0.55, 'rgba(159, 18, 57, 0.14)');
    rad.addColorStop(1, 'rgba(24, 4, 9, 0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, w, h);

    // Organic endothelial Voronoi-like wavy fibrin web lines
    ctx.strokeStyle = 'rgba(253, 164, 175, 0.18)';
    ctx.lineWidth = 2.2;
    for (let band = 0; band < 9; band++) {
      const yBase = 48 + band * 52;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 24) {
        const wy =
          yBase +
          Math.sin(x * 0.015 + band * 1.1) * 14 +
          Math.cos(x * 0.032 - band) * 7;
        if (x === 0) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }

    // Flow direction chevrons along center axis
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.36)';
    ctx.lineWidth = 3;
    for (let cx = 180; cx <= w - 180; cx += 190) {
      ctx.beginPath();
      ctx.moveTo(cx - 24, h / 2 - 36);
      ctx.lineTo(cx + 18, h / 2);
      ctx.lineTo(cx - 24, h / 2 + 36);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(244, 63, 94, 0.65)';
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 24, w - 48, h - 48);
  } else {
    // receptor
    ctx.fillStyle = '#110824';
    ctx.fillRect(0, 0, w, h);

    const rad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w * 0.45);
    rad.addColorStop(0, 'rgba(250, 204, 21, 0.24)');
    rad.addColorStop(0.35, 'rgba(192, 132, 252, 0.18)');
    rad.addColorStop(1, 'rgba(9, 4, 24, 0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, w, h);

    // Electrostatic docking contours
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.28)';
    ctx.lineWidth = 2;
    for (const rr of [46, 95, 150, 215, 290, 380]) {
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, rr * 1.45, rr * 0.56, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Active site crosshairs & binding triad nodes
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(w / 2, 30);
    ctx.lineTo(w / 2, h - 30);
    ctx.moveTo(80, h / 2);
    ctx.lineTo(w - 80, h / 2);
    ctx.stroke();

    for (const px of [w * 0.25, w * 0.5, w * 0.75]) {
      ctx.beginPath();
      ctx.arc(px, h / 2, 22, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(168, 85, 247, 0.72)';
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 24, w - 48, h - 48);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function disposeHierarchy(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
      if (obj.geometry) geometries.add(obj.geometry);
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (!m) continue;
        materials.add(m);
        const std = m as THREE.MeshStandardMaterial;
        if (std.map) textures.add(std.map);
      }
    }
  });

  geometries.forEach((g) => g.dispose());
  textures.forEach((t) => t.dispose());
  materials.forEach((m) => m.dispose());
}

function buildHelixRibbonGeometry(
  radius: number,
  height: number,
  turns: number,
  tubeRadius: number
): THREE.TubeGeometry {
  const points: THREE.Vector3[] = [];
  const segs = 44;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const angle = t * Math.PI * 2 * turns;
    points.push(
      new THREE.Vector3(Math.cos(angle) * radius, t * height, Math.sin(angle) * radius)
    );
  }
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, 52, tubeRadius, 8, false);
}

export function buildArenaStage(
  stage: ArenaStageId,
  isSoftwareGl: boolean,
  maxAnisotropy: number
): StageBuildResult {
  const group = new THREE.Group();
  const sharedSphereGeo = new THREE.SphereGeometry(1, 14, 14);
  const sharedCylGeo = new THREE.CylinderGeometry(1, 1, 1, 10);

  const deckTex = createStageDeckTexture(stage, maxAnisotropy);
  const deckGeo = new THREE.BoxGeometry(DECK_WIDTH, 0.36, DECK_DEPTH);
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: deckTex,
    roughness: stage === 'flask' ? 0.34 : stage === 'bloodstream' ? 0.48 : 0.4,
    metalness: stage === 'flask' ? 0.42 : stage === 'bloodstream' ? 0.25 : 0.36,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.position.set(0, FLOOR_Y - 0.18, 0);
  deck.receiveShadow = !isSoftwareGl;
  group.add(deck);

  if (stage === 'cell') {
    const subDeck = new THREE.Mesh(
      new THREE.BoxGeometry(DECK_WIDTH - 0.5, 0.44, DECK_DEPTH - 0.6),
      new THREE.MeshStandardMaterial({ color: 0x0b162c, roughness: 0.65, metalness: 0.25 })
    );
    subDeck.position.set(0, FLOOR_Y - 0.58, 0);
    group.add(subDeck);

    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(DECK_WIDTH + 0.12, 0.08, DECK_DEPTH + 0.12),
      new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        emissive: 0x0284c7,
        emissiveIntensity: 0.9,
        roughness: 0.2,
        metalness: 0.7,
      })
    );
    rail.position.set(0, FLOOR_Y - 0.11, 0);
    group.add(rail);

    // Instanced Phospholipid Bilayer
    const cols = 52;
    const headCount = cols * 4;
    const headMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.14, 10, 10),
      new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        emissive: 0x0369a1,
        emissiveIntensity: 0.35,
        roughness: 0.18,
        metalness: 0.15,
        clearcoat: 0.85,
      }),
      headCount
    );
    const tailMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.46, 6),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.55, metalness: 0.3 }),
      headCount * 2
    );

    let hIdx = 0;
    let tIdx = 0;
    const edgeZ = DECK_DEPTH * 0.5 - 0.25;
    for (let i = 0; i < cols; i++) {
      const x = -(DECK_WIDTH * 0.5 - 0.45) + (i / (cols - 1)) * (DECK_WIDTH - 0.9);
      for (const zEdge of [edgeZ, -edgeZ]) {
        for (const yLayer of [FLOOR_Y - 0.24, FLOOR_Y - 0.82]) {
          _vec3A.set(x, yLayer, zEdge);
          _quat.identity();
          _scaleVec.set(1, 1, 1);
          _mat4.compose(_vec3A, _quat, _scaleVec);
          headMesh.setMatrixAt(hIdx++, _mat4);
        }
        for (const tOff of [-0.045, 0.045]) {
          _vec3A.set(x + tOff, FLOOR_Y - 0.53, zEdge);
          _quat.identity();
          _scaleVec.set(1, 1, 1);
          _mat4.compose(_vec3A, _quat, _scaleVec);
          tailMesh.setMatrixAt(tIdx++, _mat4);
        }
      }
    }
    headMesh.instanceMatrix.needsUpdate = true;
    headMesh.computeBoundingSphere();
    tailMesh.instanceMatrix.needsUpdate = true;
    tailMesh.computeBoundingSphere();
    group.add(headMesh, tailMesh);

    // Ion-channel boundary pillars
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.65 });
    for (const side of [-1, 1]) {
      const pillar = new THREE.Group();
      pillar.position.set(side * PILLAR_X, FLOOR_Y, 0);
      const col = side === -1 ? 0x38bdf8 : 0xf43f5e;
      const glowMat = new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 0.85,
        roughness: 0.2,
        metalness: 0.3,
      });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.3, 12), baseMat);
      base.position.y = 0.15;
      pillar.add(base);
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + Math.PI / 4;
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 8), baseMat);
        rod.position.set(Math.cos(a) * 0.24, 1.75, Math.sin(a) * 0.24);
        pillar.add(rod);
      }
      const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 10, 24), glowMat);
      ring1.rotation.x = Math.PI / 2;
      ring1.position.y = 1.2;
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.045, 10, 24), glowMat);
      ring2.rotation.x = Math.PI / 2;
      ring2.position.y = 2.6;
      const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), glowMat);
      cap.position.y = 3.45;
      pillar.add(ring1, ring2, cap);
      group.add(pillar);
    }

    // Background DNA Double Helix
    const dnaGroup = new THREE.Group();
    dnaGroup.position.set(0, 1.5, -13.5);
    const strandA = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      roughness: 0.3,
      metalness: 0.5,
    });
    const strandB = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xbe123c,
      emissiveIntensity: 0.45,
      roughness: 0.3,
      metalness: 0.5,
    });
    const rungMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.45, metalness: 0.5 });
    const pA = new THREE.Vector3();
    const pB = new THREE.Vector3();
    for (let i = -9; i <= 9; i++) {
      const y = i * 0.54;
      const theta = i * 0.48;
      const rad = 1.25;
      const x1 = Math.cos(theta) * rad;
      const z1 = Math.sin(theta) * rad;
      const s1 = new THREE.Mesh(sharedSphereGeo, strandA);
      s1.scale.setScalar(0.17);
      s1.position.set(x1, y, z1);
      const s2 = new THREE.Mesh(sharedSphereGeo, strandB);
      s2.scale.setScalar(0.17);
      s2.position.set(-x1, y, -z1);
      dnaGroup.add(s1, s2);
      if (i % 2 === 0) {
        pA.set(x1, y, z1);
        pB.set(-x1, y, -z1);
        dnaGroup.add(makeBondMesh(sharedCylGeo, pA, pB, 0.05, rungMat, false));
      }
    }
    group.add(dnaGroup);

    // Mitochondria left & right
    const makeMito = (x: number, y: number, z: number, rotZ: number) => {
      const mGroup = new THREE.Group();
      mGroup.position.set(x, y, z);
      mGroup.rotation.z = rotZ;
      const shell = new THREE.Mesh(
        new THREE.CapsuleGeometry(1.05, 2.5, 8, 16),
        new THREE.MeshPhysicalMaterial({
          color: 0xb45309,
          emissive: 0x7c2d12,
          emissiveIntensity: 0.28,
          roughness: 0.35,
          metalness: 0.15,
          transparent: true,
          opacity: 0.55,
        })
      );
      shell.rotation.z = Math.PI / 2;
      mGroup.add(shell);
      const cristaeMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.55,
        roughness: 0.4,
      });
      for (let i = -3; i <= 3; i++) {
        const fold = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.06, 8, 16), cristaeMat);
        fold.rotation.y = Math.PI / 2;
        fold.position.x = i * 0.5;
        mGroup.add(fold);
      }
      group.add(mGroup);
      return mGroup;
    };
    const mitoLeft = makeMito(-12.2, 3.85, -10.8, 0.22);
    const mitoRight = makeMito(12.2, 3.75, -10.8, -0.22);

    // Floating ribosomes
    const vCount = 42;
    const vMesh = new THREE.InstancedMesh(
      sharedSphereGeo,
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.3,
        roughness: 0.25,
        metalness: 0.3,
        transparent: true,
        opacity: 0.5,
      }),
      vCount
    );
    vMesh.frustumCulled = false;
    const vBase = Array.from({ length: vCount }, (_, i) => ({
      x: ((i * 73) % 34) - 17,
      y: ((i * 37) % 10) - 2.5,
      z: -4.5 - ((i * 19) % 12),
      speed: 0.5 + (i % 5) * 0.18,
      phase: i * 0.9,
      s: 0.08 + ((i * 13) % 10) * 0.018,
    }));
    group.add(vMesh);

    return {
      group,
      bgHex: 0x040914,
      fogHex: 0x050c1b,
      fogDensity: 0.021,
      hemiSkyHex: 0x7dd3fc,
      hemiGroundHex: 0x090f20,
      hemiIntensity: 1.05,
      keyColorHex: 0xfff1dc,
      keyIntensity: 2.0,
      rim1Hex: 0x38bdf8,
      rim2Hex: 0xf43f5e,
      update: (elapsed, dt) => {
        dnaGroup.rotation.y += dt * 0.35;
        mitoLeft.position.y = 3.85 + Math.sin(elapsed * 0.9) * 0.24;
        mitoRight.position.y = 3.75 + Math.cos(elapsed * 0.85) * 0.24;
        for (let i = 0; i < vBase.length; i++) {
          const vb = vBase[i];
          _vec3A.set(
            vb.x + Math.sin(elapsed * 0.4 + vb.phase) * 0.35,
            vb.y + Math.sin(elapsed * vb.speed + vb.phase) * 0.45,
            vb.z
          );
          _quat.identity();
          _scaleVec.setScalar(vb.s);
          _mat4.compose(_vec3A, _quat, _scaleVec);
          vMesh.setMatrixAt(i, _mat4);
        }
        vMesh.instanceMatrix.needsUpdate = true;
      },
      dispose: () => {
        sharedSphereGeo.dispose();
        sharedCylGeo.dispose();
        disposeHierarchy(group);
      },
    };
  }

  if (stage === 'flask') {
    // Magnetic Stirrer Sub-deck + Brushed Steel Collar
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.26,
      metalness: 0.85,
    });
    const subDeck = new THREE.Mesh(
      new THREE.BoxGeometry(DECK_WIDTH - 0.3, 0.5, DECK_DEPTH - 0.3),
      steelMat
    );
    subDeck.position.set(0, FLOOR_Y - 0.62, 0);
    group.add(subDeck);

    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(DECK_WIDTH + 0.14, 0.08, DECK_DEPTH + 0.14),
      new THREE.MeshStandardMaterial({
        color: 0x2dd4bf,
        emissive: 0x0d9488,
        emissiveIntensity: 0.9,
        roughness: 0.22,
        metalness: 0.65,
      })
    );
    rail.position.set(0, FLOOR_Y - 0.11, 0);
    group.add(rail);

    // Spinning PTFE Magnetic Stir Bar inside glass collar on front/center apron
    const stirBarGroup = new THREE.Group();
    stirBarGroup.position.set(0, FLOOR_Y - 0.56, DECK_DEPTH * 0.5 + 0.42);
    const ptfeMat = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      roughness: 0.18,
      metalness: 0.05,
      clearcoat: 0.9,
    });
    const stirBar = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 1.35, 8, 16), ptfeMat);
    stirBar.rotation.z = Math.PI / 2;
    stirBarGroup.add(stirBar);
    const stirHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.55, 0.14, 24),
      new THREE.MeshStandardMaterial({
        color: 0x14b8a6,
        emissive: 0x0f766e,
        emissiveIntensity: 0.75,
        roughness: 0.3,
        metalness: 0.6,
      })
    );
    stirHub.position.y = -0.18;
    stirBarGroup.add(stirHub);
    group.add(stirBarGroup);

    // Glowing liquid meniscus plane below the arena bridge
    const reagentMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f766e,
      emissive: 0x0d9488,
      emissiveIntensity: 0.35,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.42,
    });
    const reagentPool = new THREE.Mesh(new THREE.CylinderGeometry(16.5, 14.5, 0.4, 48), reagentMat);
    reagentPool.position.set(0, FLOOR_Y - 1.45, -4.5);
    group.add(reagentPool);

    // Borosilicate Flask Curvature Ribs & Graduation Rings framing the fighting stage
    const glassRibMat = new THREE.MeshPhysicalMaterial({
      color: 0x99f6e4,
      emissive: 0x0f766e,
      emissiveIntensity: 0.22,
      roughness: 0.12,
      metalness: 0.15,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });
    for (const rotY of [0, Math.PI / 3, -Math.PI / 3]) {
      const meridian = new THREE.Mesh(new THREE.TorusGeometry(14.8, 0.13, 10, 64), glassRibMat);
      meridian.position.set(0, 2.2, -6.5);
      meridian.rotation.y = rotY;
      group.add(meridian);
    }

    // Volumetric graduation rings
    const gradMat = new THREE.MeshStandardMaterial({
      color: 0x5eead4,
      emissive: 0x14b8a6,
      emissiveIntensity: 0.65,
      roughness: 0.25,
      transparent: true,
      opacity: 0.55,
    });
    for (let g = 0; g < 3; g++) {
      const gradRing = new THREE.Mesh(
        new THREE.TorusGeometry(14.2 - g * 0.6, 0.045, 8, 56),
        gradMat
      );
      gradRing.rotation.x = Math.PI / 2;
      gradRing.position.set(0, FLOOR_Y + 0.5 + g * 2.1, -6.5);
      group.add(gradRing);
    }

    // Rear Reflux Condenser Tower with internal spiral cooling coil
    const condenserGroup = new THREE.Group();
    condenserGroup.position.set(0, 2.6, -13.5);
    const jacket = new THREE.Mesh(
      new THREE.CylinderGeometry(1.45, 1.45, 9.2, 24, 1, true),
      new THREE.MeshPhysicalMaterial({
        color: 0xccfbf1,
        roughness: 0.12,
        metalness: 0.08,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    condenserGroup.add(jacket);

    const coilGeo = buildHelixRibbonGeometry(0.85, 8.2, 5.5, 0.11);
    const coilMesh = new THREE.Mesh(
      coilGeo,
      new THREE.MeshStandardMaterial({
        color: 0x2dd4bf,
        emissive: 0x0d9488,
        emissiveIntensity: 0.72,
        roughness: 0.22,
        metalness: 0.5,
      })
    );
    coilMesh.position.y = -4.1;
    condenserGroup.add(coilMesh);

    const neckCollar = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.16, 12, 32), steelMat);
    neckCollar.rotation.x = Math.PI / 2;
    neckCollar.position.y = -4.55;
    condenserGroup.add(neckCollar);
    group.add(condenserGroup);

    // Left & Right Stopcock & Sensor Boundary Towers
    const amberMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.85,
      roughness: 0.25,
      metalness: 0.3,
    });
    for (const side of [-1, 1]) {
      const tower = new THREE.Group();
      tower.position.set(side * PILLAR_X, FLOOR_Y, 0);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.58, 0.34, 16), steelMat);
      base.position.y = 0.17;
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.2, 16), glassRibMat);
      column.position.y = 1.85;
      const coreRod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.1, 10), amberMat);
      coreRod.position.y = 1.85;
      const valveCross = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.11, 0.14), ptfeMat);
      valveCross.position.y = 2.4;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), amberMat);
      bulb.position.y = 3.65;
      tower.add(base, column, coreRod, valveCross, bulb);
      group.add(tower);
    }

    // Rising Effervescent Reaction Bubbles (InstancedMesh)
    const bCount = 46;
    const bMesh = new THREE.InstancedMesh(
      sharedSphereGeo,
      new THREE.MeshPhysicalMaterial({
        color: 0x99f6e4,
        emissive: 0x2dd4bf,
        emissiveIntensity: 0.45,
        roughness: 0.1,
        metalness: 0.05,
        transparent: true,
        opacity: 0.58,
      }),
      bCount
    );
    bMesh.frustumCulled = false;
    const bubbles = Array.from({ length: bCount }, (_, i) => ({
      x: ((i * 89) % 30) - 15,
      yOffset: (i * 1.37) % 10,
      z: -3.5 - ((i * 23) % 12),
      speed: 0.85 + (i % 6) * 0.28,
      wobble: 0.4 + (i % 4) * 0.2,
      phase: i * 1.1,
      s: 0.07 + ((i * 7) % 8) * 0.022,
    }));
    group.add(bMesh);

    return {
      group,
      bgHex: 0x040d16,
      fogHex: 0x05111c,
      fogDensity: 0.02,
      hemiSkyHex: 0x5eead4,
      hemiGroundHex: 0x081523,
      hemiIntensity: 1.08,
      keyColorHex: 0xfff0d4,
      keyIntensity: 2.0,
      rim1Hex: 0x2dd4bf,
      rim2Hex: 0xf59e0b,
      update: (elapsed, dt) => {
        stirBarGroup.rotation.y += dt * 4.2;
        coilMesh.rotation.y += dt * 0.4;
        for (let i = 0; i < bubbles.length; i++) {
          const b = bubbles[i];
          const y = FLOOR_Y - 1.2 + ((b.yOffset + elapsed * b.speed) % 10.5);
          const x = b.x + Math.sin(elapsed * 1.6 + b.phase) * b.wobble;
          _vec3A.set(x, y, b.z);
          _quat.identity();
          _scaleVec.setScalar(b.s);
          _mat4.compose(_vec3A, _quat, _scaleVec);
          bMesh.setMatrixAt(i, _mat4);
        }
        bMesh.instanceMatrix.needsUpdate = true;
      },
      dispose: () => {
        sharedSphereGeo.dispose();
        sharedCylGeo.dispose();
        disposeHierarchy(group);
      },
    };
  }

  if (stage === 'bloodstream') {
    // Endothelial sub-deck & fibrin muscle rails
    const muscleMat = new THREE.MeshStandardMaterial({
      color: 0x4c0519,
      roughness: 0.6,
      metalness: 0.15,
    });
    const subDeck = new THREE.Mesh(
      new THREE.BoxGeometry(DECK_WIDTH - 0.3, 0.48, DECK_DEPTH - 0.3),
      muscleMat
    );
    subDeck.position.set(0, FLOOR_Y - 0.6, 0);
    group.add(subDeck);

    const railMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xe11d48,
      emissiveIntensity: 0.85,
      roughness: 0.25,
      metalness: 0.3,
    });
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(DECK_WIDTH + 0.12, 0.08, DECK_DEPTH + 0.12),
      railMat
    );
    rail.position.set(0, FLOOR_Y - 0.11, 0);
    group.add(rail);

    // Arterial Lumen Concentric Wall Rings
    const wallRingMat = new THREE.MeshStandardMaterial({
      color: 0x881337,
      emissive: 0x4c0519,
      emissiveIntensity: 0.45,
      roughness: 0.55,
      metalness: 0.1,
    });
    const lumenRings: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(13.2, 0.44, 12, 48), wallRingMat);
      ring.position.set(0, 1.5, -3.5 - i * 3.8);
      group.add(ring);
      lumenRings.push(ring);
    }

    // Venous Valve Boundary Pillars
    const valveLeafMat = new THREE.MeshPhysicalMaterial({
      color: 0xfda4af,
      emissive: 0xbe123c,
      emissiveIntensity: 0.32,
      roughness: 0.3,
      transparent: true,
      opacity: 0.72,
    });
    const pulseCores: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
      const pillar = new THREE.Group();
      pillar.position.set(side * PILLAR_X, FLOOR_Y, 0);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.62, 0.36, 14), muscleMat);
      base.position.y = 0.18;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 3.0, 12), wallRingMat);
      stem.position.y = 1.65;
      const leafL = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.15, 10), valveLeafMat);
      leafL.position.set(-0.22, 2.35, 0);
      leafL.rotation.z = 0.38;
      const leafR = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.15, 10), valveLeafMat);
      leafR.position.set(0.22, 2.35, 0);
      leafR.rotation.z = -0.38;
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 1), railMat);
      core.position.y = 3.4;
      pulseCores.push(core);
      pillar.add(base, stem, leafL, leafR, core);
      group.add(pillar);
    }

    // Biconcave Red Blood Cell (Erythrocyte) LatheGeometry + InstancedMesh
    const rbcProfile: THREE.Vector2[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const r = t * 0.56;
      const y = (0.07 + 0.14 * Math.sin(t * Math.PI) * (0.35 + t * 0.85)) * (i === 14 ? 0 : 1);
      rbcProfile.push(new THREE.Vector2(r, y));
    }
    for (let i = 13; i >= 0; i--) {
      const p = rbcProfile[i];
      rbcProfile.push(new THREE.Vector2(p.x, -p.y));
    }
    const rbcGeo = new THREE.LatheGeometry(rbcProfile, 20);
    const rbcMat = new THREE.MeshPhysicalMaterial({
      color: 0xe11d48,
      emissive: 0x881337,
      emissiveIntensity: 0.32,
      roughness: 0.34,
      metalness: 0.08,
      clearcoat: 0.6,
    });
    const rbcCount = 38;
    const rbcMesh = new THREE.InstancedMesh(rbcGeo, rbcMat, rbcCount);
    rbcMesh.frustumCulled = false;
    const rbcData = Array.from({ length: rbcCount }, (_, i) => ({
      x0: ((i * 79) % 36) - 18,
      y0: ((i * 41) % 9) - 2.0,
      z: -4.2 - ((i * 17) % 14),
      speed: 1.5 + (i % 6) * 0.45,
      rx: (i * 0.6) % 3,
      ry: (i * 1.1) % 3,
      spin: 0.6 + (i % 4) * 0.35,
      s: 0.78 + ((i * 11) % 5) * 0.14,
    }));
    group.add(rbcMesh);

    // 3 Leukocytes (White Blood Cells) floating in deep plasma
    const wbcMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0x94a3b8,
      emissiveIntensity: 0.22,
      roughness: 0.45,
    });
    const wbcs: THREE.Group[] = [];
    for (const cfg of [
      { x: -8.5, y: 3.6, z: -12.5 },
      { x: 0.5, y: 4.5, z: -15.5 },
      { x: 9.2, y: 3.3, z: -12.0 },
    ]) {
      const wbc = new THREE.Group();
      wbc.position.set(cfg.x, cfg.y, cfg.z);
      const body = new THREE.Mesh(sharedSphereGeo, wbcMat);
      body.scale.setScalar(0.92);
      wbc.add(body);
      for (let k = 0; k < 8; k++) {
        const theta = k * 1.15;
        const phi = ((k % 3) - 1) * 0.7;
        const villus = new THREE.Mesh(sharedSphereGeo, wbcMat);
        villus.scale.setScalar(0.24);
        villus.position.set(
          Math.cos(theta) * Math.cos(phi) * 0.9,
          Math.sin(phi) * 0.9,
          Math.sin(theta) * Math.cos(phi) * 0.9
        );
        wbc.add(villus);
      }
      group.add(wbc);
      wbcs.push(wbc);
    }

    return {
      group,
      bgHex: 0x180409,
      fogHex: 0x1b050b,
      fogDensity: 0.022,
      hemiSkyHex: 0xfda4af,
      hemiGroundHex: 0x24060d,
      hemiIntensity: 1.05,
      keyColorHex: 0xffe4d6,
      keyIntensity: 2.0,
      rim1Hex: 0xf43f5e,
      rim2Hex: 0xfbbf24,
      update: (elapsed, dt) => {
        const pulse = 1 + Math.sin(elapsed * 2.6) * 0.035;
        for (let i = 0; i < lumenRings.length; i++) {
          lumenRings[i].scale.set(pulse, pulse, 1);
        }
        const coreScale = 1 + Math.max(0, Math.sin(elapsed * 2.6)) * 0.25;
        for (let i = 0; i < pulseCores.length; i++) {
          pulseCores[i].scale.setScalar(coreScale);
          pulseCores[i].rotation.y += dt * 1.8;
        }
        for (let i = 0; i < rbcData.length; i++) {
          const r = rbcData[i];
          const x = ((r.x0 + elapsed * r.speed + 18) % 36) - 18;
          const y = r.y0 + Math.sin(elapsed * 1.1 + i) * 0.25;
          _vec3A.set(x, y, r.z);
          _euler.set(r.rx + elapsed * r.spin, r.ry + elapsed * r.spin * 0.7, 0);
          _quat.setFromEuler(_euler);
          _scaleVec.setScalar(r.s);
          _mat4.compose(_vec3A, _quat, _scaleVec);
          rbcMesh.setMatrixAt(i, _mat4);
        }
        rbcMesh.instanceMatrix.needsUpdate = true;

        for (let i = 0; i < wbcs.length; i++) {
          wbcs[i].rotation.y += dt * 0.25;
          wbcs[i].position.y += Math.sin(elapsed * 0.8 + i * 1.4) * dt * 0.16;
        }
      },
      dispose: () => {
        sharedSphereGeo.dispose();
        sharedCylGeo.dispose();
        disposeHierarchy(group);
      },
    };
  }

  // 'receptor' — Target Receptor Binding Site
  const pocketBaseMat = new THREE.MeshStandardMaterial({
    color: 0x1e1038,
    roughness: 0.55,
    metalness: 0.35,
  });
  const subDeck = new THREE.Mesh(
    new THREE.BoxGeometry(DECK_WIDTH - 0.3, 0.48, DECK_DEPTH - 0.3),
    pocketBaseMat
  );
  subDeck.position.set(0, FLOOR_Y - 0.6, 0);
  group.add(subDeck);

  const violetRailMat = new THREE.MeshStandardMaterial({
    color: 0xa855f7,
    emissive: 0x7e22ce,
    emissiveIntensity: 0.9,
    roughness: 0.22,
    metalness: 0.65,
  });
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(DECK_WIDTH + 0.12, 0.08, DECK_DEPTH + 0.12),
    violetRailMat
  );
  rail.position.set(0, FLOOR_Y - 0.11, 0);
  group.add(rail);

  // Catalytic Triad Anchor Pads on Pocket Floor (offset cleanly above FLOOR_Y with polygonOffset)
  const goldMat = new THREE.MeshPhysicalMaterial({
    color: 0xfacc15,
    emissive: 0xca8a04,
    emissiveIntensity: 0.65,
    roughness: 0.22,
    metalness: 0.85,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  for (const padX of [-5.8, 0, 5.8]) {
    const pad = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 24), goldMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(padX, FLOOR_Y + 0.03, 0);
    group.add(pad);
  }

  // GPCR Alpha-Helix Boundary Pillars at +/-PILLAR_X
  const helixMat = new THREE.MeshStandardMaterial({
    color: 0xc084fc,
    emissive: 0x6b21a8,
    emissiveIntensity: 0.55,
    roughness: 0.28,
    metalness: 0.45,
  });
  const pillarHelixGeo = buildHelixRibbonGeometry(0.32, 3.2, 2.5, 0.085);
  for (const side of [-1, 1]) {
    const pillar = new THREE.Group();
    pillar.position.set(side * PILLAR_X, FLOOR_Y, 0);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.6, 0.32, 16), pocketBaseMat);
    base.position.y = 0.16;
    const helix = new THREE.Mesh(pillarHelixGeo, helixMat);
    helix.position.y = 0.3;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.3, 10), goldMat);
    core.position.y = 1.95;
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), goldMat);
    gem.position.y = 3.72;
    pillar.add(base, helix, core, gem);
    group.add(pillar);
  }

  // Background 7-Transmembrane Receptor Binding Cathedral (5 colossal helical protein towers + arc)
  const bgHelixGeo = buildHelixRibbonGeometry(0.65, 8.2, 3.5, 0.16);
  const bgHelixPositions = [
    { x: -11.5, y: -1.8, z: -9.5, rotZ: 0.14 },
    { x: -6.2, y: -1.6, z: -12.8, rotZ: 0.06 },
    { x: 0, y: -1.5, z: -14.2, rotZ: 0 },
    { x: 6.2, y: -1.6, z: -12.8, rotZ: -0.06 },
    { x: 11.5, y: -1.8, z: -9.5, rotZ: -0.14 },
  ];
  for (const cfg of bgHelixPositions) {
    const colGroup = new THREE.Group();
    colGroup.position.set(cfg.x, cfg.y, cfg.z);
    colGroup.rotation.z = cfg.rotZ;
    const hMesh = new THREE.Mesh(bgHelixGeo, helixMat);
    const spine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 8.2, 10),
      pocketBaseMat
    );
    spine.position.y = 4.1;
    colGroup.add(hMesh, spine);
    group.add(colGroup);
  }

  // Allosteric Arch connecting outer background protein helices cleanly
  const arch = new THREE.Mesh(
    new THREE.TorusGeometry(11.4, 0.22, 10, 48, Math.PI),
    violetRailMat
  );
  arch.position.set(0, -1.5, -10.0);
  group.add(arch);

  // Hovering Cofactor / ATP Catalyst Crystal above binding pocket
  const catalystGroup = new THREE.Group();
  catalystGroup.position.set(0, 4.4, -10.5);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.95, 0), goldMat);
  const orbitRing1 = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.055, 10, 36), violetRailMat);
  orbitRing1.rotation.x = Math.PI / 3;
  const orbitRing2 = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.045, 10, 36), goldMat);
  orbitRing2.rotation.y = Math.PI / 3;
  catalystGroup.add(crystal, orbitRing1, orbitRing2);
  group.add(catalystGroup);

  // Orbiting Ligand / Neurotransmitter Ions (InstancedMesh)
  const ionCount = 42;
  const ionMesh = new THREE.InstancedMesh(
    sharedSphereGeo,
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xc084fc,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.4,
      transparent: true,
      opacity: 0.72,
    }),
    ionCount
  );
  ionMesh.frustumCulled = false;
  const ions = Array.from({ length: ionCount }, (_, i) => ({
    radius: 3.5 + (i % 9) * 1.35,
    yBase: ((i * 29) % 8) - 1.2,
    zBase: -5.5 - ((i * 13) % 9),
    speed: 0.35 + (i % 5) * 0.14,
    phase: i * 0.75,
    s: 0.075 + (i % 5) * 0.02,
  }));
  group.add(ionMesh);

  return {
    group,
    bgHex: 0x090418,
    fogHex: 0x0c0620,
    fogDensity: 0.021,
    hemiSkyHex: 0xc084fc,
    hemiGroundHex: 0x110826,
    hemiIntensity: 1.1,
    keyColorHex: 0xfff2cf,
    keyIntensity: 2.05,
    rim1Hex: 0xa855f7,
    rim2Hex: 0xfacc15,
    update: (elapsed, dt) => {
      crystal.rotation.y += dt * 0.9;
      crystal.rotation.z = Math.sin(elapsed * 0.7) * 0.15;
      orbitRing1.rotation.z += dt * 1.1;
      orbitRing2.rotation.x -= dt * 0.85;
      catalystGroup.position.y = 4.4 + Math.sin(elapsed * 1.2) * 0.28;

      for (let i = 0; i < ions.length; i++) {
        const ion = ions[i];
        const a = elapsed * ion.speed + ion.phase;
        _vec3A.set(
          Math.cos(a) * ion.radius,
          ion.yBase + Math.sin(elapsed * 1.3 + ion.phase) * 0.45,
          ion.zBase + Math.sin(a) * 1.6
        );
        _quat.identity();
        _scaleVec.setScalar(ion.s);
        _mat4.compose(_vec3A, _quat, _scaleVec);
        ionMesh.setMatrixAt(i, _mat4);
      }
      ionMesh.instanceMatrix.needsUpdate = true;
    },
    dispose: () => {
      sharedSphereGeo.dispose();
      sharedCylGeo.dispose();
      disposeHierarchy(group);
    },
  };
}
