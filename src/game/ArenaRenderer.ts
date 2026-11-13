import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ParsedMolecule } from '../chem/smilesEngine';
import { buildArenaStage, type StageBuildResult } from './arenaEnvironments';
import type { ArenaStageId } from './arenaStages';
import {
  FLOOR_Y,
  getFighterBodyScale,
  type ColorSchemeMode,
  type CombatEvent,
  type FighterState,
  type MatchState,
  type PowerUpType,
} from './combatEngine';

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _upVec = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
const _mat4 = new THREE.Matrix4();
const _scaleVec = new THREE.Vector3();
const _color = new THREE.Color();

const CPK_COLORS: Record<string, number> = {
  C: 0x38bdf8,
  N: 0x3b82f6,
  O: 0xf43f5e,
  S: 0xfacc15,
  P: 0xfb923c,
  F: 0x4ade80,
  Cl: 0x22c55e,
  Br: 0xdc2626,
  I: 0xa855f7,
  B: 0xf472b6,
};

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createRadialShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(2, 6, 18, 0.72)');
  grad.addColorStop(0.55, 'rgba(2, 6, 18, 0.34)');
  grad.addColorStop(1, 'rgba(2, 6, 18, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

type BondOrderCategory = 'single' | 'double' | 'triple' | 'aromatic';

interface TaggedBond {
  mesh: THREE.Mesh;
  order: BondOrderCategory;
  heightNorm: number; // 0 (feet) .. 1 (head)
}

interface DecompPart {
  mesh: THREE.Mesh;
  restPos: THREE.Vector3;
  restQuat: THREE.Quaternion;
  restScale: THREE.Vector3;
  scatterVel: THREE.Vector3;
  spinAxis: THREE.Vector3;
  spinSpeed: number;
  delay: number;
}

interface FighterRig {
  group: THREE.Group;
  squashGroup: THREE.Group;
  facingGroup: THREE.Group;
  pelvis: THREE.Group;
  spine: THREE.Group;
  chestHub: THREE.Group;
  coreMesh: THREE.Mesh;
  headGroup: THREE.Group;
  visorMat: THREE.MeshStandardMaterial;
  haloMesh: THREE.Mesh;
  haloMat: THREE.MeshBasicMaterial;
  leftArm: THREE.Group;
  leftForearm: THREE.Group;
  rightArm: THREE.Group;
  rightForearm: THREE.Group;
  weaponMount: THREE.Group;
  leftLeg: THREE.Group;
  leftShin: THREE.Group;
  rightLeg: THREE.Group;
  rightShin: THREE.Group;
  shieldMesh: THREE.Mesh;
  shieldMat: THREE.MeshBasicMaterial;
  floorRingMat: THREE.MeshBasicMaterial;
  shadowDisc: THREE.Mesh;
  shadowMat: THREE.MeshBasicMaterial;
  taggedBonds: TaggedBond[];
  jointMats: THREE.MeshPhysicalMaterial[];
  decompParts: DecompPart[];
  decompTimer: number;
  decompSparkTimer: number;
  weaponGroup: THREE.Group;
  weaponHaloMat: THREE.MeshBasicMaterial | null;
  currentScale: number;
  buffAuraTimer: number;
}

interface ParticleSlot {
  active: boolean;
  px: number;
  py: number;
  pz: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  gravity: number;
  scale: number;
  r: number;
  g: number;
  b: number;
}

const PARTICLE_COUNT = 180;

export class ArenaRenderer {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private frameId = 0;
  private disposed = false;
  private lastTime = 0;
  private elapsed = 0;

  private p1Rig: FighterRig;
  private p2Rig: FighterRig;

  private hemiLight!: THREE.HemisphereLight;
  private keyLight!: THREE.DirectionalLight;
  private p1Rim!: THREE.DirectionalLight;
  private p2Rim!: THREE.DirectionalLight;
  private activeStageId: ArenaStageId = 'cell';
  private activeStage: StageBuildResult | null = null;

  private particleMesh: THREE.InstancedMesh;
  private particles: ParticleSlot[] = [];
  private particleCursor = 0;

  private sharedSphereGeo = new THREE.SphereGeometry(1, 16, 16);
  private sharedCylGeo = new THREE.CylinderGeometry(1, 1, 1, 10);

  private currentState: 'title' | 'playing' | 'paused' | 'gameover' = 'title';
  private colorMode: ColorSchemeMode = 'elemental';
  private latestMatch: MatchState | null = null;
  private p1Mol: ParsedMolecule | null = null;
  private p2Mol: ParsedMolecule | null = null;
  private projectileVisuals = new Map<number, { group: THREE.Group; trailTimer: number; ownerId: 1 | 2 }>();
  private powerUpVisuals = new Map<
    number,
    {
      group: THREE.Group;
      core: THREE.Group;
      ring: THREE.Mesh;
      groundGlow: THREE.Mesh;
      type: PowerUpType;
    }
  >();
  private outroState: {
    active: boolean;
    stage: ArenaStageId;
    winnerId: 1 | 2;
    elapsed: number;
    sparkTimer: number;
    group: THREE.Group | null;
    update: ((elapsed: number, dt: number, victorRig: FighterRig, victor: FighterState) => void) | null;
  } = {
    active: false,
    stage: 'cell',
    winnerId: 1,
    elapsed: 0,
    sparkTimer: 0,
    group: null,
    update: null,
  };
  private celebrationPhase: 'none' | 'round' | 'match' = 'none';
  private celebrationWinner: 1 | 2 | 0 | null = null;
  private victorySparkTimer = 0;
  private camX = 0;
  private camY = 1.15;
  private camZ = 15.8;
  private lookX = 0;
  private lookY = 0.28;

  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement) {
    this.container = container;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    this.renderer.setSize(w, h);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x040914);
    this.scene.fog = new THREE.FogExp2(0x050c1b, 0.021);

    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 140);
    this.camera.position.set(0, 1.15, 15.8);

    // Studio IBL environment map
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.setupLighting();
    this.setStage('cell');

    this.particleMesh = this.buildParticlePool();
    this.scene.add(this.particleMesh);

    const shadowTex = createRadialShadowTexture();
    this.p1Rig = this.createFighterRig(1, shadowTex);
    this.p2Rig = this.createFighterRig(2, shadowTex);
    this.scene.add(this.p1Rig.group);
    this.scene.add(this.p2Rig.group);
    this.scene.add(this.p1Rig.shadowDisc);
    this.scene.add(this.p2Rig.shadowDisc);

    this.applyColorScheme(this.colorMode);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
  }

  private setupLighting(): void {
    this.hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x090f20, 1.05);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff1dc, 2.0);
    this.keyLight.position.set(4, 12, 9);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.left = -13;
    this.keyLight.shadow.camera.right = 13;
    this.keyLight.shadow.camera.top = 8;
    this.keyLight.shadow.camera.bottom = -4;
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 32;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    this.p1Rim = new THREE.DirectionalLight(0x38bdf8, 1.15);
    this.p1Rim.position.set(-10, 4, -5);
    this.scene.add(this.p1Rim);

    this.p2Rim = new THREE.DirectionalLight(0xf43f5e, 1.0);
    this.p2Rim.position.set(10, 4, -5);
    this.scene.add(this.p2Rim);
  }

  public setStage(stageId: ArenaStageId): void {
    if (this.activeStage && this.activeStageId === stageId) {
      return;
    }
    if (this.activeStage) {
      this.scene.remove(this.activeStage.group);
      this.activeStage.dispose();
      this.activeStage = null;
    }

    this.activeStageId = stageId;
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const built = buildArenaStage(stageId, this.isSoftwareGl, maxAniso);
    this.activeStage = built;
    this.scene.add(built.group);

    this.scene.background = new THREE.Color(built.bgHex);
    this.scene.fog = new THREE.FogExp2(built.fogHex, built.fogDensity);
    this.hemiLight.color.setHex(built.hemiSkyHex);
    this.hemiLight.groundColor.setHex(built.hemiGroundHex);
    this.hemiLight.intensity = built.hemiIntensity;
    this.keyLight.color.setHex(built.keyColorHex);
    this.keyLight.intensity = built.keyIntensity;
    this.p1Rim.color.setHex(built.rim1Hex);
    this.p2Rim.color.setHex(built.rim2Hex);
  }

  private buildParticlePool(): THREE.InstancedMesh {
    const geo = new THREE.OctahedronGeometry(0.11, 0);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, PARTICLE_COUNT);
    mesh.frustumCulled = false;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.particles.push({
        active: false,
        px: 0,
        py: -50,
        pz: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        gravity: 14,
        scale: 0,
        r: 1,
        g: 1,
        b: 1,
      });
      _vec3A.set(0, -50, 0);
      _quat.identity();
      _scaleVec.set(0, 0, 0);
      _mat4.compose(_vec3A, _quat, _scaleVec);
      mesh.setMatrixAt(i, _mat4);
      mesh.setColorAt(i, _color.setRGB(1, 1, 1));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }

  private spawnBurst(
    x: number,
    y: number,
    z: number,
    count: number,
    hexColor: number,
    speed: number,
    scale = 1,
    gravity = 14,
    lifeBase = 0.28,
    vyBias = 1.5
  ): void {
    _color.setHex(hexColor);
    for (let i = 0; i < count; i++) {
      const slot = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % PARTICLE_COUNT;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.3) * Math.PI;
      const sp = speed * (0.45 + Math.random() * 0.75);
      slot.active = true;
      slot.px = x;
      slot.py = y;
      slot.pz = z;
      slot.vx = Math.cos(theta) * Math.cos(phi) * sp;
      slot.vy = Math.sin(phi) * sp + vyBias;
      slot.vz = Math.sin(theta) * Math.cos(phi) * sp * 0.5;
      slot.maxLife = lifeBase + Math.random() * lifeBase;
      slot.life = slot.maxLife;
      slot.gravity = gravity;
      slot.scale = scale * (0.6 + Math.random() * 0.8);
      slot.r = _color.r;
      slot.g = _color.g;
      slot.b = _color.b;
    }
  }

  private spawnVictoryFireworks(x: number, y: number, winnerId: 1 | 2 | 0, isMatchEnd: boolean): void {
    const teamCol = winnerId === 1 ? 0x38bdf8 : winnerId === 2 ? 0xf43f5e : 0xe2e8f0;
    const accentCol = winnerId === 1 ? 0x22d3ee : winnerId === 2 ? 0xfb923c : 0x34d399;
    const mult = isMatchEnd ? 1.45 : 1.0;

    // Gold starburst fountain above victor
    this.spawnBurst(x, y, 0.15, Math.round(20 * mult), 0xfacc15, 6.2 * mult, 1.15, 6.4, 0.58, 4.2);
    // Team energy halo cascade
    this.spawnBurst(x, y - 0.2, 0.2, Math.round(18 * mult), teamCol, 5.4 * mult, 1.05, 6.8, 0.55, 3.6);
    // Secondary molecular prism sparks & crisp white highlights
    this.spawnBurst(x, y + 0.25, 0.1, Math.round(10 * mult), accentCol, 4.6 * mult, 0.9, 5.8, 0.62, 4.6);
    this.spawnBurst(x, y + 0.1, 0.25, Math.round(8 * mult), 0xffffff, 4.8, 0.8, 7.2, 0.45, 3.8);
  }

  private makeBondMesh(p1: THREE.Vector3, p2: THREE.Vector3, radius: number, mat: THREE.Material): THREE.Mesh {
    const dist = p1.distanceTo(p2);
    const mesh = new THREE.Mesh(this.sharedCylGeo, mat);
    mesh.scale.set(radius, dist, radius);
    mesh.position.addVectors(p1, p2).multiplyScalar(0.5);
    _vec3B.subVectors(p2, p1).normalize();
    mesh.quaternion.setFromUnitVectors(_upVec, _vec3B);
    mesh.castShadow = !this.isSoftwareGl;
    return mesh;
  }

  private registerDecompPart(decompParts: DecompPart[], mesh: THREE.Mesh, heightHint: number): void {
    const idx = decompParts.length + 1;
    const angle = idx * 2.39996; // Golden-angle distribution
    const horiz = 2.1 + (idx % 5) * 0.55;
    const scatterVel = new THREE.Vector3(
      Math.cos(angle) * horiz,
      1.6 + ((idx * 7) % 5) * 0.65 + heightHint * 1.4,
      Math.sin(angle) * horiz * 0.9
    );
    const spinAxis = new THREE.Vector3(
      Math.sin(idx * 1.7),
      Math.cos(idx * 2.3),
      Math.sin(idx * 3.1 + 0.5)
    ).normalize();
    decompParts.push({
      mesh,
      restPos: mesh.position.clone(),
      restQuat: mesh.quaternion.clone(),
      restScale: mesh.scale.clone(),
      scatterVel,
      spinAxis,
      spinSpeed: 5.5 + (idx % 4) * 2.0,
      delay: 0.01 + (1 - heightHint) * 0.08 + (idx % 3) * 0.02,
    });
  }

  private addMultiBond(
    parent: THREE.Group,
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    order: BondOrderCategory,
    taggedBonds: TaggedBond[],
    decompParts: DecompPart[],
    heightNorm: number,
    baseColor: number
  ): void {
    const makeMat = () =>
      new THREE.MeshPhysicalMaterial({
        color: baseColor,
        roughness: 0.24,
        metalness: 0.55,
        clearcoat: 0.7,
      });

    const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
    const perp = new THREE.Vector3(-dir.y, dir.x, 0);
    if (perp.lengthSq() < 0.001) perp.set(1, 0, 0);
    perp.normalize();

    if (order === 'single') {
      const m = this.makeBondMesh(p1, p2, 0.046, makeMat());
      parent.add(m);
      taggedBonds.push({ mesh: m, order, heightNorm });
      this.registerDecompPart(decompParts, m, heightNorm);
    } else if (order === 'double' || order === 'aromatic') {
      const off = perp.clone().multiplyScalar(0.055);
      const m1 = this.makeBondMesh(p1.clone().add(off), p2.clone().add(off), 0.036, makeMat());
      const m2 = this.makeBondMesh(p1.clone().sub(off), p2.clone().sub(off), 0.036, makeMat());
      parent.add(m1, m2);
      taggedBonds.push({ mesh: m1, order, heightNorm }, { mesh: m2, order, heightNorm });
      this.registerDecompPart(decompParts, m1, heightNorm);
      this.registerDecompPart(decompParts, m2, heightNorm);
    } else {
      const off = perp.clone().multiplyScalar(0.068);
      const m0 = this.makeBondMesh(p1, p2, 0.032, makeMat());
      const m1 = this.makeBondMesh(p1.clone().add(off), p2.clone().add(off), 0.03, makeMat());
      const m2 = this.makeBondMesh(p1.clone().sub(off), p2.clone().sub(off), 0.03, makeMat());
      parent.add(m0, m1, m2);
      taggedBonds.push(
        { mesh: m0, order, heightNorm },
        { mesh: m1, order, heightNorm },
        { mesh: m2, order, heightNorm }
      );
      this.registerDecompPart(decompParts, m0, heightNorm);
      this.registerDecompPart(decompParts, m1, heightNorm);
      this.registerDecompPart(decompParts, m2, heightNorm);
    }
  }

  private addJointAtom(
    parent: THREE.Group,
    pos: THREE.Vector3,
    radius: number,
    jointMats: THREE.MeshPhysicalMaterial[],
    decompParts: DecompPart[],
    heightNorm: number,
    colorHex: number
  ): THREE.Mesh {
    const mat = new THREE.MeshPhysicalMaterial({
      color: colorHex,
      roughness: 0.16,
      metalness: 0.35,
      clearcoat: 0.9,
    });
    jointMats.push(mat);
    const mesh = new THREE.Mesh(this.sharedSphereGeo, mat);
    mesh.scale.setScalar(radius);
    mesh.position.copy(pos);
    mesh.castShadow = !this.isSoftwareGl;
    parent.add(mesh);
    this.registerDecompPart(decompParts, mesh, heightNorm);
    return mesh;
  }

  private createFighterRig(id: 1 | 2, shadowTex: THREE.CanvasTexture): FighterRig {
    const primaryCol = id === 1 ? 0x38bdf8 : 0xf43f5e;
    const jointCol = id === 1 ? 0xe0f2fe : 0xffe4e6;
    const coreCol = id === 1 ? 0x0ea5e9 : 0xe11d48;

    const group = new THREE.Group();
    const squashGroup = new THREE.Group();
    const facingGroup = new THREE.Group();
    group.add(squashGroup);
    squashGroup.add(facingGroup);

    const taggedBonds: TaggedBond[] = [];
    const jointMats: THREE.MeshPhysicalMaterial[] = [];
    const decompParts: DecompPart[] = [];

    // Pelvis sits 1.48 above ground so thigh (0.74) + shin (0.74) lands flush on y = 0 local
    const pelvis = new THREE.Group();
    pelvis.position.set(0, 1.48, 0);
    facingGroup.add(pelvis);
    this.addJointAtom(pelvis, new THREE.Vector3(0, 0, 0), 0.11, jointMats, decompParts, 0.45, jointCol);

    // Spine: Alkyne (-C#C-)
    const spine = new THREE.Group();
    pelvis.add(spine);
    this.addMultiBond(
      spine,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1.15, 0),
      'triple',
      taggedBonds,
      decompParts,
      0.55,
      primaryCol
    );

    // Chest Quaternary Carbon Hub
    const chestHub = new THREE.Group();
    chestHub.position.set(0, 1.15, 0);
    spine.add(chestHub);

    const coreMat = new THREE.MeshStandardMaterial({
      color: coreCol,
      emissive: coreCol,
      emissiveIntensity: 0.9,
      roughness: 0.15,
      metalness: 0.4,
    });
    const coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 1), coreMat);
    chestHub.add(coreMesh);
    this.registerDecompPart(decompParts, coreMesh, 0.72);

    const chestRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.025, 8, 24),
      new THREE.MeshBasicMaterial({ color: primaryCol })
    );
    chestHub.add(chestRing);
    this.registerDecompPart(decompParts, chestRing, 0.72);

    // Head: Benzene / Phenyl Ring + Visor + Electron Halo
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.25, 0);
    chestHub.add(headGroup);

    const neckTop = new THREE.Vector3(0, 0.22, 0);
    this.addMultiBond(headGroup, new THREE.Vector3(0, 0, 0), neckTop, 'single', taggedBonds, decompParts, 0.8, primaryCol);

    const ringR = 0.44;
    const ringCy = 0.22 + ringR;
    const ringPts: THREE.Vector3[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 - Math.PI / 2;
      ringPts.push(new THREE.Vector3(Math.cos(a) * ringR, ringCy + Math.sin(a) * ringR, 0));
    }
    for (let i = 0; i < 6; i++) {
      const pA = ringPts[i];
      const pB = ringPts[(i + 1) % 6];
      this.addMultiBond(
        headGroup,
        pA,
        pB,
        i % 2 === 0 ? 'double' : 'single',
        taggedBonds,
        decompParts,
        0.92,
        primaryCol
      );
      this.addJointAtom(headGroup, pA, 0.075, jointMats, decompParts, 0.92, jointCol);
    }

    // Glowing Visor inside Benzene Ring facing forward (+X in local facingGroup)
    const visorMat = new THREE.MeshStandardMaterial({
      color: id === 1 ? 0x7dd3fc : 0xfda4af,
      emissive: primaryCol,
      emissiveIntensity: 1.4,
      roughness: 0.1,
    });
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.11, 0.14), visorMat);
    visor.position.set(0.1, ringCy + 0.04, 0.06);
    headGroup.add(visor);
    this.registerDecompPart(decompParts, visor, 0.94);

    // Electron orbital halo around head (glows bright when Energy == 100%)
    const haloMat = new THREE.MeshBasicMaterial({
      color: primaryCol,
      transparent: true,
      opacity: 0.35,
    });
    const haloMesh = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.022, 8, 32), haloMat);
    haloMesh.position.set(0, ringCy, 0);
    haloMesh.rotation.x = Math.PI * 0.38;
    headGroup.add(haloMesh);

    // Arms: Upper Alkyne + Forearm Methyl
    const buildArm = (shoulderX: number) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(shoulderX, 0.04, 0);
      chestHub.add(shoulder);
      this.addJointAtom(shoulder, new THREE.Vector3(0, 0, 0), 0.085, jointMats, decompParts, 0.7, jointCol);

      const elbowPos = new THREE.Vector3(0.42, -0.26, 0);
      this.addMultiBond(shoulder, new THREE.Vector3(0, 0, 0), elbowPos, 'triple', taggedBonds, decompParts, 0.68, primaryCol);

      const forearm = new THREE.Group();
      forearm.position.copy(elbowPos);
      shoulder.add(forearm);
      this.addJointAtom(forearm, new THREE.Vector3(0, 0, 0), 0.075, jointMats, decompParts, 0.66, jointCol);

      const handPos = new THREE.Vector3(0.38, 0.08, 0);
      this.addMultiBond(forearm, new THREE.Vector3(0, 0, 0), handPos, 'single', taggedBonds, decompParts, 0.68, primaryCol);
      this.addJointAtom(forearm, handPos, 0.1, jointMats, decompParts, 0.68, primaryCol);

      return { shoulder, forearm, handPos };
    };

    const leftArmParts = buildArm(-0.24);
    const rightArmParts = buildArm(0.24);

    // Weapon Mount on Right Hand
    const weaponMount = new THREE.Group();
    weaponMount.position.copy(rightArmParts.handPos);
    rightArmParts.forearm.add(weaponMount);

    const weaponGroup = new THREE.Group();
    weaponMount.add(weaponGroup);

    // Legs: Conjugated Diene Thigh + Shin + Foot
    const buildLeg = (hipX: number) => {
      const leg = new THREE.Group();
      leg.position.set(hipX, 0, 0);
      pelvis.add(leg);
      this.addJointAtom(leg, new THREE.Vector3(0, 0, 0), 0.085, jointMats, decompParts, 0.42, jointCol);

      const kneePos = new THREE.Vector3(0.08, -0.74, 0);
      this.addMultiBond(leg, new THREE.Vector3(0, 0, 0), kneePos, 'double', taggedBonds, decompParts, 0.34, primaryCol);

      const shin = new THREE.Group();
      shin.position.copy(kneePos);
      leg.add(shin);
      this.addJointAtom(shin, new THREE.Vector3(0, 0, 0), 0.08, jointMats, decompParts, 0.24, jointCol);

      const anklePos = new THREE.Vector3(-0.04, -0.74, 0);
      this.addMultiBond(shin, new THREE.Vector3(0, 0, 0), anklePos, 'double', taggedBonds, decompParts, 0.14, primaryCol);
      this.addJointAtom(shin, anklePos, 0.075, jointMats, decompParts, 0.12, jointCol);

      const toePos = new THREE.Vector3(0.24, -0.74, 0);
      this.addMultiBond(shin, anklePos, toePos, 'single', taggedBonds, decompParts, 0.05, primaryCol);
      this.addJointAtom(shin, toePos, 0.065, jointMats, decompParts, 0.05, primaryCol);

      return { leg, shin };
    };

    const leftLegParts = buildLeg(-0.22);
    const rightLegParts = buildLeg(0.22);

    // Blocking Hex Forcefield Shield
    const shieldMat = new THREE.MeshBasicMaterial({
      color: primaryCol,
      wireframe: true,
      transparent: true,
      opacity: 0,
    });
    const shieldMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.55, 1), shieldMat);
    shieldMesh.position.set(0, 1.55, 0);
    facingGroup.add(shieldMesh);

    // Floor indicator ring under fighter
    const floorRingMat = new THREE.MeshBasicMaterial({
      color: primaryCol,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });
    const floorRing = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.72, 32), floorRingMat);
    floorRing.rotation.x = -Math.PI / 2;
    floorRing.position.y = 0.02;
    group.add(floorRing);

    // Contact shadow disc grounded on FLOOR_Y
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    const shadowDisc = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.3), shadowMat);
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.set(0, FLOOR_Y + 0.015, 0);

    return {
      group,
      squashGroup,
      facingGroup,
      pelvis,
      spine,
      chestHub,
      coreMesh,
      headGroup,
      visorMat,
      haloMesh,
      haloMat,
      leftArm: leftArmParts.shoulder,
      leftForearm: leftArmParts.forearm,
      rightArm: rightArmParts.shoulder,
      rightForearm: rightArmParts.forearm,
      weaponMount,
      leftLeg: leftLegParts.leg,
      leftShin: leftLegParts.shin,
      rightLeg: rightLegParts.leg,
      rightShin: rightLegParts.shin,
      shieldMesh,
      shieldMat,
      floorRingMat,
      shadowDisc,
      shadowMat,
      taggedBonds,
      jointMats,
      decompParts,
      decompTimer: 0,
      decompSparkTimer: 0,
      weaponGroup,
      weaponHaloMat: null,
      currentScale: 1,
      buffAuraTimer: 0,
    };
  }

  private disposeGroupChildren(g: THREE.Group): void {
    while (g.children.length > 0) {
      const child = g.children[0];
      if (child instanceof THREE.Group) {
        this.disposeGroupChildren(child);
      } else if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        if (child.geometry !== this.sharedSphereGeo && child.geometry !== this.sharedCylGeo) {
          child.geometry.dispose();
        }
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
      g.remove(child);
    }
  }

  private populateMoleculeGroup(
    targetGroup: THREE.Group,
    playerId: 1 | 2,
    mol: ParsedMolecule,
    scale: number,
    auraRadius: number,
    auraOpacity: number
  ): THREE.MeshBasicMaterial {
    this.disposeGroupChildren(targetGroup);

    const atomPositions: THREE.Vector3[] = [];
    for (const atom of mol.atoms) {
      const col = CPK_COLORS[atom.elem] ?? 0x94a3b8;
      const mat = new THREE.MeshPhysicalMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 0.25,
        roughness: 0.14,
        metalness: 0.25,
        clearcoat: 1.0,
      });
      const mesh = new THREE.Mesh(this.sharedSphereGeo, mat);
      const radius = atom.elem === 'C' ? 0.105 : 0.135;
      mesh.scale.setScalar(radius);
      const pos = new THREE.Vector3(atom.x * scale, atom.y * scale, atom.z * scale);
      mesh.position.copy(pos);
      mesh.castShadow = !this.isSoftwareGl;
      targetGroup.add(mesh);
      atomPositions.push(pos);
    }

    const bondMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.22,
      metalness: 0.65,
    });

    for (const bond of mol.bonds) {
      const p1 = atomPositions[bond.u];
      const p2 = atomPositions[bond.v];
      if (!p1 || !p2) continue;

      const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
      const perp = new THREE.Vector3(-dir.y, dir.x, 0.25);
      if (perp.lengthSq() < 0.001) perp.set(1, 0, 0);
      perp.normalize();

      if (bond.order >= 2.5) {
        const off = perp.clone().multiplyScalar(0.055);
        targetGroup.add(this.makeBondMesh(p1, p2, 0.025, bondMat));
        targetGroup.add(this.makeBondMesh(p1.clone().add(off), p2.clone().add(off), 0.024, bondMat));
        targetGroup.add(this.makeBondMesh(p1.clone().sub(off), p2.clone().sub(off), 0.024, bondMat));
      } else if (bond.order >= 1.5) {
        const off = perp.clone().multiplyScalar(0.045);
        targetGroup.add(this.makeBondMesh(p1.clone().add(off), p2.clone().add(off), 0.028, bondMat));
        targetGroup.add(this.makeBondMesh(p1.clone().sub(off), p2.clone().sub(off), 0.028, bondMat));
      } else {
        targetGroup.add(this.makeBondMesh(p1, p2, 0.036, bondMat));
      }
    }

    const auraMat = new THREE.MeshBasicMaterial({
      color: playerId === 1 ? 0x38bdf8 : 0xf43f5e,
      wireframe: true,
      transparent: true,
      opacity: auraOpacity,
    });
    const aura = new THREE.Mesh(new THREE.OctahedronGeometry(auraRadius, 1), auraMat);
    targetGroup.add(aura);
    return auraMat;
  }

  public setWeapon(playerId: 1 | 2, mol: ParsedMolecule): void {
    const rig = playerId === 1 ? this.p1Rig : this.p2Rig;
    if (playerId === 1) this.p1Mol = mol;
    else this.p2Mol = mol;
    rig.weaponHaloMat = this.populateMoleculeGroup(rig.weaponGroup, playerId, mol, 1.45, 0.9, 0.22);
  }

  public applyColorScheme(mode: ColorSchemeMode): void {
    this.colorMode = mode;
    const updateRig = (rig: FighterRig, id: 1 | 2) => {
      const teamPrimary = id === 1 ? 0x38bdf8 : 0xf43f5e;
      for (const tb of rig.taggedBonds) {
        const mat = tb.mesh.material as THREE.MeshPhysicalMaterial;
        if (mode === 'elemental') {
          mat.color.setHex(teamPrimary);
          mat.emissive.setHex(teamPrimary);
          mat.emissiveIntensity = 0.14;
        } else if (mode === 'rainbow') {
          const hue =
            id === 1
              ? 0.48 + (1 - tb.heightNorm) * 0.28 // Cyan -> Blue -> Violet for P1
              : 0.96 - (1 - tb.heightNorm) * 0.16; // Crimson -> Coral -> Amber for P2
          mat.color.setHSL((hue + 1) % 1, 0.88, 0.56);
          mat.emissive.setHSL((hue + 1) % 1, 0.85, 0.24);
          mat.emissiveIntensity = 0.26;
        } else {
          // Bond Order / SSE mode
          const col =
            tb.order === 'triple'
              ? id === 1
                ? 0x22d3ee
                : 0xfb7185
              : tb.order === 'double'
              ? 0x34d399
              : 0xcbd5e1;
          mat.color.setHex(col);
          mat.emissive.setHex(col);
          mat.emissiveIntensity = tb.order === 'triple' ? 0.26 : 0.1;
        }
      }
    };

    updateRig(this.p1Rig, 1);
    updateRig(this.p2Rig, 2);
  }

  public syncMatch(
    match: MatchState,
    gameState: 'title' | 'playing' | 'paused' | 'gameover',
    events: CombatEvent[]
  ): void {
    const firstSync = this.latestMatch === null;
    this.latestMatch = match;
    this.currentState = gameState;
    if (firstSync) {
      this.p1Rig.group.position.set(match.p1.x, match.p1.y, 0);
      this.p1Rig.facingGroup.scale.x = match.p1.facing;
      this.p2Rig.group.position.set(match.p2.x, match.p2.y, 0);
      this.p2Rig.facingGroup.scale.x = match.p2.facing;
    }

    if (gameState === 'title' || match.phase === 'round_intro' || match.phase === 'fighting') {
      this.celebrationPhase = 'none';
      this.celebrationWinner = null;
      if (this.outroState.active) {
        this.clearStageOutro();
      }
    } else if (match.phase === 'match_over' || gameState === 'gameover') {
      this.celebrationPhase = 'match';
      this.celebrationWinner = match.matchWinner;
    } else if (match.phase === 'round_ko') {
      this.celebrationPhase = 'round';
      this.celebrationWinner = match.roundWinner;
    }

    for (const ev of events) {
      if (ev.type === 'powerup_spawn') {
        const col = this.powerUpColor(ev.powerUpType);
        this.spawnBurst(ev.x, ev.y, 0.1, 10, col, 3.2, 0.8, 4.0, 0.35, 0.4);
      } else if (ev.type === 'powerup_pickup') {
        const col = this.powerUpColor(ev.powerUpType);
        this.spawnBurst(ev.x, ev.y + 0.4, 0.15, 22, col, 6.2, 1.05, 8.0, 0.45, 2.5);
        this.spawnBurst(ev.x, ev.y + 0.4, 0.18, 8, 0xffffff, 4.8, 0.8, 7.0, 0.35, 2.0);
      } else if (ev.type === 'hit') {
        const col = ev.special ? 0xfacc15 : ev.attackerId === 1 ? 0x38bdf8 : 0xf43f5e;
        this.spawnBurst(ev.x, ev.y, 0.2, ev.special ? 28 : ev.heavy ? 18 : 11, col, ev.special ? 8.5 : 5.8, ev.special ? 1.4 : 1.0);
        this.spawnBurst(ev.x, ev.y, 0.25, 6, 0xffffff, 4.5, 0.75);
      } else if (ev.type === 'block') {
        this.spawnBurst(ev.x, ev.y, 0.2, 10, 0x7dd3fc, 4.4, 0.8);
      } else if (ev.type === 'dash') {
        const col = ev.fighterId === 1 ? 0x38bdf8 : 0xf43f5e;
        this.spawnBurst(ev.x, ev.y, 0, 8, col, 3.2, 0.7);
      } else if (ev.type === 'land') {
        this.spawnBurst(ev.x, ev.y + 0.08, 0, 5, 0x94a3b8, 2.1, 0.55);
      } else if (ev.type === 'special_start') {
        this.spawnBurst(ev.x, ev.y, 0.1, 20, 0xfacc15, 6.2, 1.15);
      } else if (ev.type === 'throw') {
        const col = ev.fighterId === 1 ? 0x38bdf8 : 0xf43f5e;
        this.spawnBurst(ev.x, ev.y, 0.15, 14, col, 4.6, 0.9, 9, 0.3, 0.8);
        this.spawnBurst(ev.x, ev.y, 0.15, 6, 0xffffff, 3.8, 0.65, 10, 0.24, 0.5);
      } else if (ev.type === 'uppercut_start') {
        const col = ev.fighterId === 1 ? 0x22d3ee : 0xfb7185;
        this.spawnBurst(ev.x, ev.y, 0.1, 14, col, 5.2, 0.95, 8, 0.34, 3.5);
      } else if (ev.type === 'lunge_start') {
        const col = ev.fighterId === 1 ? 0x38bdf8 : 0xf43f5e;
        this.spawnBurst(ev.x, ev.y, 0.1, 12, col, 4.8, 0.85, 11, 0.28, 1.2);
      } else if (ev.type === 'projectile_shatter') {
        const col = ev.ownerId === 1 ? 0x38bdf8 : 0xf43f5e;
        this.spawnBurst(ev.x, ev.y, 0.2, 16, col, 5.8, 0.95, 9.5, 0.38, 1.6);
        this.spawnBurst(ev.x, ev.y, 0.2, 8, 0xfacc15, 4.6, 0.8, 8.5, 0.35, 1.8);
        this.spawnBurst(ev.x, ev.y, 0.22, 6, 0xffffff, 4.2, 0.7, 10, 0.28, 1.2);
      } else if (ev.type === 'round_end') {
        if (ev.winnerId === 1 || ev.winnerId === 2) {
          const winner = ev.winnerId === 1 ? match.p1 : match.p2;
          const loser = ev.winnerId === 1 ? match.p2 : match.p1;
          if (ev.reason === 'ko') {
            // Chemical decomposition shatter wave on KO'd loser
            this.spawnBurst(loser.x, loser.y + 1.25, 0.2, 24, 0xffffff, 7.2, 1.15, 7.5, 0.52, 2.8);
            this.spawnBurst(loser.x, loser.y + 1.1, 0.15, 18, 0x38bdf8, 5.8, 1.0, 6.2, 0.58, 2.4);
            this.spawnBurst(loser.x, loser.y + 1.35, 0.15, 14, 0xfacc15, 5.2, 0.95, 5.8, 0.62, 2.8);
          }
          this.spawnVictoryFireworks(winner.x, winner.y + 2.35, ev.winnerId, false);
        } else {
          this.spawnVictoryFireworks(0, FLOOR_Y + 2.2, 0, false);
        }
        this.victorySparkTimer = 0.14;
      } else if (ev.type === 'match_end') {
        if (ev.winnerId === 1 || ev.winnerId === 2) {
          const winner = ev.winnerId === 1 ? match.p1 : match.p2;
          this.spawnVictoryFireworks(winner.x, winner.y + 2.55, ev.winnerId, true);
        } else {
          this.spawnVictoryFireworks(0, FLOOR_Y + 2.4, 0, true);
        }
        this.victorySparkTimer = 0.08;
      }
    }
  }

  private animateRig(
    rig: FighterRig,
    f: FighterState,
    dt: number,
    victoryMode: 'none' | 'round' | 'match' = 'none'
  ): void {
    const targetScale = getFighterBodyScale(f);
    rig.currentScale += (targetScale - rig.currentScale) * (1 - Math.exp(-10 * dt));

    if (!this.outroState.active || this.outroState.winnerId !== f.id) {
      rig.group.position.set(f.x, f.y, 0);
      rig.group.scale.setScalar(rig.currentScale);
      rig.group.rotation.y = 0;
      rig.group.visible = true;
    }
    rig.facingGroup.scale.x = f.facing;
    rig.squashGroup.scale.set(f.squashX, f.squashY, 1);

    const isKo = f.state === 'ko';

    // Contact shadow grounding & height falloff (fades out as loser decomposes)
    const heightAboveFloor = Math.max(0, f.y - FLOOR_Y);
    const shadowScale = Math.max(0.45, 1 - heightAboveFloor * 0.18) * rig.currentScale;
    rig.shadowDisc.position.set(f.x, FLOOR_Y + 0.015, 0);
    rig.shadowDisc.scale.setScalar(shadowScale);
    const decompFade = isKo ? Math.max(0, 1 - rig.decompTimer / 1.15) : 1;
    rig.shadowMat.opacity = Math.max(isKo ? 0 : 0.15, (0.65 - heightAboveFloor * 0.15) * decompFade);

    // Hit flash, chemical decomposition glow, or active buff aura
    const flashing = f.flashTimer > 0;
    const decompFlash = isKo && rig.decompTimer < 0.24;
    const hasFistBuff = (f.buffs?.fist ?? 0) > 0;
    const hasLightningBuff = (f.buffs?.lightning ?? 0) > 0;
    const hasTripleBuff = (f.buffs?.tripleThrow ?? 0) > 0;

    for (const jm of rig.jointMats) {
      if (flashing || decompFlash) {
        jm.emissive.setHex(decompFlash ? 0xfef08a : 0xffffff);
        jm.emissiveIntensity = decompFlash ? 1.85 : 2.0;
      } else if (hasFistBuff) {
        jm.emissive.setHex(0xf97316);
        jm.emissiveIntensity = 0.45 + Math.sin(this.elapsed * 9) * 0.15;
      } else if (hasLightningBuff) {
        jm.emissive.setHex(0xfacc15);
        jm.emissiveIntensity = 0.35 + Math.sin(this.elapsed * 16) * 0.15;
      } else if (hasTripleBuff) {
        jm.emissive.setHex(0xc084fc);
        jm.emissiveIntensity = 0.32;
      } else {
        jm.emissiveIntensity = 0;
      }
    }

    // Periodic ambient aura sparks for active buffs
    if (!isKo && this.currentState === 'playing' && (hasFistBuff || hasLightningBuff || hasTripleBuff || (f.buffs?.giant ?? 0) > 0 || (f.buffs?.shrink ?? 0) > 0)) {
      rig.buffAuraTimer -= dt;
      if (rig.buffAuraTimer <= 0) {
        rig.buffAuraTimer = 0.22;
        const auraCol = hasLightningBuff
          ? 0xfacc15
          : hasFistBuff
          ? 0xf97316
          : hasTripleBuff
          ? 0xc084fc
          : (f.buffs?.giant ?? 0) > 0
          ? 0xf59e0b
          : 0x34d399;
        this.spawnBurst(
          f.x + (Math.random() - 0.5) * 0.7 * rig.currentScale,
          f.y + (0.4 + Math.random() * 1.4) * rig.currentScale,
          0.12,
          2,
          auraCol,
          1.4,
          0.55,
          -1.5,
          0.35,
          0.9
        );
      }
    }

    const t = this.elapsed;
    const isVictor = victoryMode !== 'none' && !isKo;

    // Special ready or victory electron halo speed & brightness
    const ready = f.energy >= 100 || isVictor || hasLightningBuff;
    rig.haloMesh.visible = !isKo;
    rig.shieldMesh.visible = !isKo;
    rig.weaponGroup.visible = f.hasWeaponInHand && !isKo;

    rig.haloMesh.rotation.z += dt * (isVictor ? 8.0 : ready ? 6.5 : 1.6);
    rig.haloMesh.rotation.y += dt * (isVictor ? 4.2 : ready ? 3.2 : 0.9);
    rig.haloMat.opacity = isVictor ? 0.95 : ready ? 0.85 : 0.28;
    rig.coreMesh.rotation.y += dt * (isVictor ? 6.5 : ready ? 5.0 : 1.8);
    if (isVictor) {
      rig.coreMesh.scale.setScalar(1.08 + Math.sin(t * 9.0) * 0.14);
      rig.visorMat.emissiveIntensity = 2.35;
      rig.floorRingMat.opacity = 0.82 + Math.sin(t * 10.0) * 0.18;
    } else if (isKo) {
      rig.visorMat.emissiveIntensity = 1.4 * decompFade;
      rig.floorRingMat.opacity = 0.65 * decompFade;
    } else {
      rig.coreMesh.scale.setScalar(1);
      rig.visorMat.emissiveIntensity = 1.4;
      rig.floorRingMat.opacity = 0.65;
    }

    // Chemical decomposition into small molecular fragments when KO'd
    if (isKo) {
      if (this.currentState !== 'paused') {
        rig.decompTimer += dt;
        rig.decompSparkTimer -= dt;
        if (rig.decompTimer < 1.35 && rig.decompSparkTimer <= 0) {
          rig.decompSparkTimer = 0.085;
          const cpkPool = [0x38bdf8, 0x3b82f6, 0xf43f5e, 0xfacc15, 0x4ade80];
          const colA = cpkPool[Math.floor(Math.random() * cpkPool.length)];
          const colB = cpkPool[Math.floor(Math.random() * cpkPool.length)];
          const sx = f.x + (Math.random() - 0.5) * 1.25;
          const sy = f.y + 0.35 + Math.random() * 1.45;
          this.spawnBurst(sx, sy, (Math.random() - 0.5) * 0.5, 5, colA, 3.2, 0.9, 3.6, 0.68, 2.4);
          this.spawnBurst(sx, sy + 0.2, 0.15, 3, colB, 2.6, 0.76, 2.8, 0.72, 2.6);
        }
      }

      for (let i = 0; i < rig.decompParts.length; i++) {
        const part = rig.decompParts[i];
        if (rig.decompTimer <= part.delay) {
          // Tremor right before bond breaks
          const jit = 0.04;
          part.mesh.position.set(
            part.restPos.x + (Math.random() - 0.5) * jit,
            part.restPos.y + (Math.random() - 0.5) * jit,
            part.restPos.z + (Math.random() - 0.5) * jit
          );
          part.mesh.visible = true;
          continue;
        }
        const localT = rig.decompTimer - part.delay;
        const fadeT = Math.min(1, localT / 1.15);
        const sFactor = Math.max(0, 1 - fadeT * fadeT);
        part.mesh.position.set(
          part.restPos.x + part.scatterVel.x * localT,
          Math.max(-1.25, part.restPos.y + part.scatterVel.y * localT - 3.2 * localT * localT),
          part.restPos.z + part.scatterVel.z * localT
        );
        _quat.setFromAxisAngle(part.spinAxis, localT * part.spinSpeed);
        part.mesh.quaternion.copy(part.restQuat).premultiply(_quat);
        part.mesh.scale.copy(part.restScale).multiplyScalar(sFactor);
        part.mesh.visible = sFactor > 0.04;
      }
    } else if (rig.decompTimer > 0) {
      // Cleanly restore intact fighter rig for next round / rematch / title
      rig.decompTimer = 0;
      rig.decompSparkTimer = 0;
      for (let i = 0; i < rig.decompParts.length; i++) {
        const part = rig.decompParts[i];
        part.mesh.position.copy(part.restPos);
        part.mesh.quaternion.copy(part.restQuat);
        part.mesh.scale.copy(part.restScale);
        part.mesh.visible = true;
      }
    }

    // Rotate 3D molecular weapon smoothly (faster triumph spin on victory)
    rig.weaponGroup.rotation.y += dt * (isVictor ? 5.4 : ready ? 3.6 : 1.4);
    rig.weaponGroup.rotation.z += dt * (isVictor ? 1.6 : 0.8);
    if (rig.weaponHaloMat) {
      rig.weaponHaloMat.opacity = isVictor ? 0.78 : ready ? 0.52 : 0.2;
    }

    // Shield visibility
    const targetShield = f.state === 'block' ? 0.58 : 0;
    rig.shieldMat.opacity += (targetShield - rig.shieldMat.opacity) * (1 - Math.exp(-22 * dt));
    rig.shieldMesh.rotation.y += dt * 2.2;

    // Reset default target pose values before state-specific animation
    let pelvisY = 1.48;
    let spineRotZ = -0.06;
    let headRotZ = 0.05;
    let lArmZ = 0.55;
    let lForeZ = 0.65;
    let rArmZ = -0.35;
    let rForeZ = 0.55;
    let lLegZ = 0.22;
    let lShinZ = -0.22;
    let rLegZ = -0.24;
    let rShinZ = -0.18;
    let rootRotZ = 0;

    const progress = f.stateDuration > 0 ? 1 - f.stateTimer / f.stateDuration : 0;
    const canVictoryPose =
      isVictor &&
      (f.state === 'idle' ||
        f.state === 'walk' ||
        f.state === 'crouch' ||
        f.state === 'block' ||
        f.state === 'punch_recovery' ||
        f.state === 'kick_recovery' ||
        f.state === 'special_recovery');

    if (canVictoryPose) {
      if (victoryMode === 'match') {
        // Grand Match Victory Pose: rhythmic champion hover/bounce & double-arm skyward weapon flourish
        const hop = Math.max(0, Math.sin(t * 3.6)) * 0.22;
        const flourish = Math.sin(t * 6.2);
        pelvisY = 1.52 + hop;
        spineRotZ = 0.1 + Math.sin(t * 3.1) * 0.04;
        headRotZ = -0.08;
        rArmZ = 2.18 + flourish * 0.15;
        rForeZ = -0.14;
        lArmZ = 1.98 - flourish * 0.14;
        lForeZ = 0.36;
        lLegZ = 0.34 + hop * 0.9;
        lShinZ = -0.24 - hop * 1.5;
        rLegZ = -0.34 + hop * 0.4;
        rShinZ = -0.18 - hop * 1.1;
      } else {
        // Round Victory Pose: proud chest-out stance, weapon thrust aloft + off-hand fist pump
        const pump = Math.sin(t * 7.5);
        pelvisY = 1.5 + Math.abs(pump) * 0.055;
        spineRotZ = 0.09;
        headRotZ = -0.06;
        rArmZ = 2.14 + Math.sin(t * 4.8) * 0.1;
        rForeZ = -0.16;
        lArmZ = 1.62 + pump * 0.18;
        lForeZ = 0.98;
        lLegZ = 0.34;
        lShinZ = -0.26;
        rLegZ = -0.36;
        rShinZ = -0.18;
      }
    } else if (f.state === 'idle') {
      const bob = Math.sin(t * 4.2 + f.id) * 0.045;
      pelvisY += bob;
      lArmZ = 0.6 + Math.sin(t * 4.2) * 0.08;
      rArmZ = -0.32 + Math.cos(t * 4.2) * 0.08;
      lLegZ = 0.24;
      lShinZ = -0.28;
      rLegZ = -0.26;
      rShinZ = -0.15;
    } else if (f.state === 'walk') {
      // Distance-synced stride so feet never skate
      const phase = f.walkDistance * 2.8;
      const s = Math.sin(phase);
      const c = Math.cos(phase);
      pelvisY += Math.abs(c) * 0.07;
      spineRotZ = -0.16;
      lLegZ = s * 0.62;
      lShinZ = Math.min(0, -0.35 - c * 0.4);
      rLegZ = -s * 0.62;
      rShinZ = Math.min(0, -0.35 + c * 0.4);
      lArmZ = 0.45 - s * 0.45;
      rArmZ = -0.35 + s * 0.45;
    } else if (f.state === 'jump') {
      pelvisY = 1.56;
      spineRotZ = -0.14;
      lLegZ = 0.55;
      lShinZ = -0.85;
      rLegZ = -0.32;
      rShinZ = -0.55;
      lArmZ = 1.1;
      rArmZ = -0.9;
    } else if (f.state === 'crouch') {
      pelvisY = 1.06;
      spineRotZ = -0.22;
      lLegZ = 0.72;
      lShinZ = -1.25;
      rLegZ = -0.45;
      rShinZ = -0.85;
      lArmZ = 0.85;
      rArmZ = -0.65;
    } else if (f.state === 'dash') {
      spineRotZ = -0.36;
      lLegZ = -0.45;
      rLegZ = 0.55;
      rArmZ = -1.1;
      lArmZ = 1.0;
    } else if (f.state === 'block') {
      pelvisY = 1.38;
      spineRotZ = 0.08;
      lArmZ = 1.25;
      lForeZ = 1.35;
      rArmZ = 0.95;
      rForeZ = 1.25;
    } else if (f.state === 'punch_windup') {
      spineRotZ = 0.24;
      rArmZ = -1.35;
      rForeZ = 0.9;
      lArmZ = 0.8;
    } else if (f.state === 'punch_active') {
      spineRotZ = -0.26;
      rArmZ = 1.15;
      rForeZ = 0.05;
      lArmZ = -0.6;
      rLegZ = -0.42;
      lLegZ = 0.38;
    } else if (f.state === 'punch_recovery') {
      spineRotZ = -0.1 * (1 - progress);
      rArmZ = 0.35;
      rForeZ = 0.4;
    } else if (f.state === 'kick_windup') {
      pelvisY = 1.42;
      spineRotZ = 0.22;
      rLegZ = -0.45;
      rShinZ = -1.1;
    } else if (f.state === 'kick_active') {
      pelvisY = 1.54;
      spineRotZ = 0.36;
      rLegZ = 1.52;
      rShinZ = -0.05;
      lLegZ = -0.18;
      rArmZ = -0.85;
      lArmZ = 0.95;
    } else if (f.state === 'kick_recovery') {
      spineRotZ = 0.14 * (1 - progress);
      rLegZ = 0.4 * (1 - progress);
    } else if (f.state === 'throw_windup') {
      spineRotZ = 0.28;
      rArmZ = 2.35;
      rForeZ = 0.8;
      lArmZ = 0.95;
    } else if (f.state === 'throw_recovery') {
      spineRotZ = -0.32 * (1 - progress * 0.5);
      rArmZ = 1.05;
      rForeZ = -0.05;
      lArmZ = -0.5;
    } else if (f.state === 'uppercut_windup') {
      pelvisY = 1.14;
      spineRotZ = -0.18;
      rArmZ = -1.4;
      rForeZ = 0.95;
    } else if (f.state === 'uppercut_active') {
      pelvisY = 1.6;
      spineRotZ = 0.22;
      rArmZ = 2.25;
      rForeZ = 0.15;
      lArmZ = -0.75;
      lLegZ = 0.45;
      lShinZ = -0.85;
    } else if (f.state === 'uppercut_recovery') {
      spineRotZ = 0.12 * (1 - progress);
      rArmZ = 1.4 * (1 - progress);
    } else if (f.state === 'lunge_windup') {
      pelvisY = 1.26;
      spineRotZ = -0.28;
      rArmZ = -1.35;
      lArmZ = 1.05;
    } else if (f.state === 'lunge_active') {
      spineRotZ = -0.4;
      rArmZ = 1.25;
      rForeZ = 0.0;
      lArmZ = -0.65;
      lLegZ = 0.52;
      rLegZ = -0.52;
    } else if (f.state === 'lunge_recovery') {
      spineRotZ = -0.18 * (1 - progress);
      rArmZ = 0.45 * (1 - progress);
    } else if (f.state === 'special_windup') {
      pelvisY = 1.28;
      spineRotZ = 0.28;
      rArmZ = -1.65;
      lArmZ = 1.45;
    } else if (f.state === 'special_active') {
      spineRotZ = -0.34;
      rArmZ = 1.35;
      rForeZ = 0.0;
      lArmZ = 1.15;
    } else if (f.state === 'hitstun') {
      spineRotZ = 0.38;
      headRotZ = 0.32;
      lArmZ = -0.4;
      rArmZ = -0.9;
    } else if (f.state === 'ko') {
      pelvisY = 1.15;
      rootRotZ = 0.36;
      spineRotZ = 0.22;
      rArmZ = -1.1;
      lArmZ = -0.8;
      lLegZ = 0.35;
    }

    const k = 1 - Math.exp(-22 * dt);
    rig.pelvis.position.y += (pelvisY - rig.pelvis.position.y) * k;
    rig.facingGroup.rotation.z += (rootRotZ - rig.facingGroup.rotation.z) * (1 - Math.exp(-12 * dt));
    rig.spine.rotation.z += (spineRotZ - rig.spine.rotation.z) * k;
    rig.headGroup.rotation.z += (headRotZ - rig.headGroup.rotation.z) * k;
    rig.leftArm.rotation.z += (lArmZ - rig.leftArm.rotation.z) * k;
    rig.leftForearm.rotation.z += (lForeZ - rig.leftForearm.rotation.z) * k;
    rig.rightArm.rotation.z += (rArmZ - rig.rightArm.rotation.z) * k;
    rig.rightForearm.rotation.z += (rForeZ - rig.rightForearm.rotation.z) * k;
    rig.leftLeg.rotation.z += (lLegZ - rig.leftLeg.rotation.z) * k;
    rig.leftShin.rotation.z += (lShinZ - rig.leftShin.rotation.z) * k;
    rig.rightLeg.rotation.z += (rLegZ - rig.rightLeg.rotation.z) * k;
    rig.rightShin.rotation.z += (rShinZ - rig.rightShin.rotation.z) * k;
  }

  private updateParticles(dt: number): void {
    let anyActive = false;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyActive = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _vec3A.set(0, -50, 0);
        _scaleVec.set(0, 0, 0);
        _mat4.compose(_vec3A, _quat, _scaleVec);
        this.particleMesh.setMatrixAt(i, _mat4);
        continue;
      }
      p.vy -= p.gravity * dt;
      p.px += p.vx * dt;
      p.py += p.vy * dt;
      p.pz += p.vz * dt;
      const frac = p.life / p.maxLife;
      const s = p.scale * frac;
      _vec3A.set(p.px, p.py, p.pz);
      _quat.setFromAxisAngle(_upVec, p.life * 8);
      _scaleVec.set(s, s, s);
      _mat4.compose(_vec3A, _quat, _scaleVec);
      this.particleMesh.setMatrixAt(i, _mat4);
      _color.setRGB(p.r, p.g, p.b);
      this.particleMesh.setColorAt(i, _color);
    }
    if (anyActive) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = Math.max(0.001, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05);
    this.elapsed += dt;

    // Ambient stage environment animations
    this.activeStage?.update(this.elapsed, dt);

    // Animate fighters
    if (this.latestMatch) {
      const activeCelem = this.currentState !== 'title' ? this.celebrationPhase : 'none';
      const p1Victory: 'none' | 'round' | 'match' =
        activeCelem !== 'none' && this.celebrationWinner === 1 ? activeCelem : 'none';
      const p2Victory: 'none' | 'round' | 'match' =
        activeCelem !== 'none' && this.celebrationWinner === 2 ? activeCelem : 'none';

      this.animateRig(this.p1Rig, this.latestMatch.p1, dt, p1Victory);
      this.animateRig(this.p2Rig, this.latestMatch.p2, dt, p2Victory);

      // Sync 3D molecular projectiles & falling functional power-ups
      this.syncProjectiles(this.latestMatch, dt);
      this.syncPowerUps(this.latestMatch, dt);

      // Stage-specific 3D victory outro animation
      if (this.outroState.active && this.outroState.update) {
        this.outroState.elapsed += dt;
        const victor = this.outroState.winnerId === 1 ? this.latestMatch.p1 : this.latestMatch.p2;
        const victorRig = this.outroState.winnerId === 1 ? this.p1Rig : this.p2Rig;
        this.outroState.update(this.outroState.elapsed, dt, victorRig, victor);
      }

      // Sustained celebratory spark fountain during round_ko and match_over
      if (activeCelem !== 'none' && this.currentState !== 'paused' && !this.outroState.active) {
        this.victorySparkTimer -= dt;
        if (this.victorySparkTimer <= 0) {
          this.victorySparkTimer = activeCelem === 'match' ? 0.11 : 0.16;
          if (this.celebrationWinner === 1 || this.celebrationWinner === 2) {
            const victor = this.celebrationWinner === 1 ? this.latestMatch.p1 : this.latestMatch.p2;
            const teamCol = this.celebrationWinner === 1 ? 0x38bdf8 : 0xf43f5e;
            const sparkX = victor.x + victor.facing * 0.35;
            const sparkY = victor.y + 2.65;
            this.spawnBurst(sparkX, sparkY, 0.15, activeCelem === 'match' ? 4 : 3, 0xfacc15, 3.6, 0.9, 6.2, 0.55, 3.8);
            this.spawnBurst(sparkX, sparkY, 0.2, activeCelem === 'match' ? 3 : 2, teamCol, 3.2, 0.85, 6.5, 0.5, 3.2);
          } else {
            this.spawnBurst(0, FLOOR_Y + 2.4, 0.15, 3, 0xe2e8f0, 3.0, 0.8, 6.2, 0.48, 3.2);
          }
        }
      }

      // Dynamic camera rig calibrated for the expanded 21.2m arena & cinematic stage outros
      if (this.currentState === 'title') {
        const targetX = Math.sin(this.elapsed * 0.42) * 1.45;
        const targetY = 1.15 + Math.cos(this.elapsed * 0.35) * 0.18;
        const targetZ = 15.6;
        const k = 1 - Math.exp(-3.5 * dt);
        this.camX += (targetX - this.camX) * k;
        this.camY += (targetY - this.camY) * k;
        this.camZ += (targetZ - this.camZ) * k;
        this.lookX += (0 - this.lookX) * k;
        this.lookY += (0.34 - this.lookY) * k;
      } else if (this.outroState.active) {
        const victor = this.outroState.winnerId === 1 ? this.latestMatch.p1 : this.latestMatch.p2;
        const targetX = THREE.MathUtils.clamp(victor.x, -7.2, 7.2);
        const targetY = 1.15 + Math.sin(this.outroState.elapsed * 0.9) * 0.14;
        const targetZ = 8.3;
        const k = 1 - Math.exp(-4.5 * dt);
        this.camX += (targetX - this.camX) * k;
        this.camY += (targetY - this.camY) * k;
        this.camZ += (targetZ - this.camZ) * k;
        this.lookX += (victor.x - this.lookX) * k;
        this.lookY += (0.55 - this.lookY) * k;
      } else if (
        activeCelem !== 'none' &&
        (this.celebrationWinner === 1 || this.celebrationWinner === 2)
      ) {
        const victor = this.celebrationWinner === 1 ? this.latestMatch.p1 : this.latestMatch.p2;
        const midX = (this.latestMatch.p1.x + this.latestMatch.p2.x) * 0.5;
        const sep = Math.abs(this.latestMatch.p1.x - this.latestMatch.p2.x);
        const targetX = THREE.MathUtils.clamp(victor.x * 0.72 + midX * 0.28, -5.6, 5.6);
        const targetZ = THREE.MathUtils.clamp(10.2 + sep * 0.3, 10.2, 15.8);
        const targetY = 1.02 + Math.max(0, victor.y - FLOOR_Y) * 0.25;
        const targetLookX = THREE.MathUtils.clamp(victor.x * 0.54 + midX * 0.46, -5.4, 5.4);
        const k = 1 - Math.exp(-5.5 * dt);
        this.camX += (targetX - this.camX) * k;
        this.camY += (targetY - this.camY) * k;
        this.camZ += (targetZ - this.camZ) * k;
        this.lookX += (targetLookX - this.lookX) * k;
        this.lookY += (0.52 - this.lookY) * k;
      } else {
        const midX = (this.latestMatch.p1.x + this.latestMatch.p2.x) * 0.5;
        const sep = Math.abs(this.latestMatch.p1.x - this.latestMatch.p2.x);
        const targetX = THREE.MathUtils.clamp(midX * 0.72, -5.4, 5.4);
        const targetZ = THREE.MathUtils.clamp(12.2 + sep * 0.44, 12.2, 18.8);
        const targetY = 1.16 + Math.max(this.latestMatch.p1.y - FLOOR_Y, this.latestMatch.p2.y - FLOOR_Y) * 0.25;
        const k = 1 - Math.exp(-7 * dt);
        this.camX += (targetX - this.camX) * k;
        this.camY += (targetY - this.camY) * k;
        this.camZ += (targetZ - this.camZ) * k;
        this.lookX += (midX * 0.56 - this.lookX) * k;
        this.lookY += (0.3 - this.lookY) * k;
      }

      const trauma = this.latestMatch.cameraTrauma;
      const shake = trauma * trauma * 0.38;
      const shakeX = shake > 0.001 ? (Math.random() * 2 - 1) * shake : 0;
      const shakeY = shake > 0.001 ? (Math.random() * 2 - 1) * shake : 0;
      this.camera.position.set(this.camX + shakeX, this.camY + shakeY, this.camZ);
      this.camera.lookAt(this.lookX, this.lookY, 0);
    }

    this.updateParticles(dt);
    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private syncProjectiles(match: MatchState, dt: number): void {
    const activeIds = new Set<number>();
    for (let i = 0; i < match.projectiles.length; i++) {
      const proj = match.projectiles[i];
      activeIds.add(proj.id);

      let vis = this.projectileVisuals.get(proj.id);
      if (!vis) {
        const group = new THREE.Group();
        const mol = proj.ownerId === 1 ? this.p1Mol : this.p2Mol;
        if (mol) {
          this.populateMoleculeGroup(group, proj.ownerId, mol, 1.32, 0.85, 0.55);
        }
        this.scene.add(group);
        vis = { group, trailTimer: 0, ownerId: proj.ownerId };
        this.projectileVisuals.set(proj.id, vis);
      }

      vis.group.position.set(proj.x, proj.y, 0.12);
      vis.group.rotation.z = -proj.spinAngle;
      vis.group.rotation.y = proj.spinAngle * 0.65;

      if (this.currentState !== 'paused') {
        vis.trailTimer -= dt;
        if (vis.trailTimer <= 0) {
          vis.trailTimer = 0.032;
          const col = proj.ownerId === 1 ? 0x38bdf8 : 0xf43f5e;
          this.spawnBurst(proj.x, proj.y, 0.1, 2, col, 1.8, 0.72, 4.0, 0.24, 0.3);
          this.spawnBurst(proj.x, proj.y, 0.12, 1, 0xfacc15, 1.4, 0.55, 3.0, 0.2, 0.2);
        }
      }
    }

    for (const [id, vis] of this.projectileVisuals.entries()) {
      if (!activeIds.has(id)) {
        this.disposeGroupChildren(vis.group);
        this.scene.remove(vis.group);
        this.projectileVisuals.delete(id);
      }
    }
  }

  private powerUpColor(type: PowerUpType): number {
    if (type === 'lightning') return 0xfacc15;
    if (type === 'fist') return 0xf97316;
    if (type === 'shrink') return 0x34d399;
    if (type === 'triple_throw') return 0xc084fc;
    return 0xfbbf24;
  }

  private createPowerUpVisual(type: PowerUpType): {
    group: THREE.Group;
    core: THREE.Group;
    ring: THREE.Mesh;
    groundGlow: THREE.Mesh;
    type: PowerUpType;
  } {
    const group = new THREE.Group();
    const core = new THREE.Group();
    const col = this.powerUpColor(type);

    // Outer translucent capsule orb
    const shell = new THREE.Mesh(
      this.sharedSphereGeo,
      new THREE.MeshPhysicalMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 0.25,
        roughness: 0.15,
        metalness: 0.1,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
      })
    );
    shell.scale.setScalar(0.42);
    core.add(shell);

    // Orbiting glow ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.032, 8, 24),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85 })
    );
    ring.rotation.x = Math.PI / 3;
    core.add(ring);

    const emblemMat = new THREE.MeshStandardMaterial({
      color: col,
      emissive: col,
      emissiveIntensity: 0.9,
      roughness: 0.22,
      metalness: 0.35,
    });

    if (type === 'lightning') {
      // Sharp 3-segment zigzag lightning bolt
      const seg1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.09), emblemMat);
      seg1.position.set(0.05, 0.14, 0);
      seg1.rotation.z = -0.35;
      const seg2 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.09), emblemMat);
      seg2.position.set(0, 0.01, 0);
      seg2.rotation.z = 0.22;
      const seg3 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.09), emblemMat);
      seg3.position.set(-0.05, -0.14, 0);
      seg3.rotation.z = -0.38;
      core.add(seg1, seg2, seg3);
    } else if (type === 'fist') {
      // Stylized Power Fist
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.18), emblemMat);
      palm.position.y = -0.02;
      core.add(palm);
      for (let k = 0; k < 4; k++) {
        const kn = new THREE.Mesh(this.sharedSphereGeo, emblemMat);
        kn.scale.setScalar(0.058);
        kn.position.set(-0.11 + k * 0.075, 0.13, 0);
        core.add(kn);
      }
      const cuff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.13, 0.14, 10),
        new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 0.7 })
      );
      cuff.position.y = -0.18;
      core.add(cuff);
    } else if (type === 'shrink') {
      // Mini Mushroom (Nấm lùn)
      const stalk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.12, 0.22, 12),
        new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.45 })
      );
      stalk.position.y = -0.12;
      const cap = new THREE.Mesh(
        this.sharedSphereGeo,
        new THREE.MeshStandardMaterial({
          color: 0x10b981,
          emissive: 0x059669,
          emissiveIntensity: 0.65,
          roughness: 0.3,
        })
      );
      cap.scale.set(0.28, 0.18, 0.28);
      cap.position.y = 0.06;
      core.add(stalk, cap);
      const spotMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
      for (let s = 0; s < 4; s++) {
        const a = (s * Math.PI) / 2;
        const spot = new THREE.Mesh(this.sharedSphereGeo, spotMat);
        spot.scale.setScalar(0.045);
        spot.position.set(Math.cos(a) * 0.16, 0.13, Math.sin(a) * 0.16);
        core.add(spot);
      }
    } else if (type === 'triple_throw') {
      // Dấu X (Triple J+D Throw multiplier)
      const barA = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.095, 0.095), emblemMat);
      barA.rotation.z = Math.PI / 4;
      const barB = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.095, 0.095), emblemMat);
      barB.rotation.z = -Math.PI / 4;
      core.add(barA, barB);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      for (let d = 0; d < 3; d++) {
        const dot = new THREE.Mesh(this.sharedSphereGeo, dotMat);
        dot.scale.setScalar(0.055);
        dot.position.set((d - 1) * 0.16, 0.24, 0);
        core.add(dot);
      }
    } else {
      // Tăng trưởng (Growth Crystal + Upward Arrow)
      const prism = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), emblemMat);
      prism.scale.set(0.95, 1.35, 0.95);
      const arrowHead = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.22, 6),
        new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x22c55e, emissiveIntensity: 0.85 })
      );
      arrowHead.position.y = 0.24;
      core.add(prism, arrowHead);
    }

    group.add(core);

    // Ground beacon ring directly on arena floor
    const groundGlow = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.44, 24),
      new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    groundGlow.rotation.x = -Math.PI / 2;
    group.add(groundGlow);

    return { group, core, ring, groundGlow, type };
  }

  private syncPowerUps(match: MatchState, dt: number): void {
    const activeIds = new Set<number>();
    const items = match.powerUps ?? [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      activeIds.add(item.id);
      let vis = this.powerUpVisuals.get(item.id);
      if (!vis) {
        vis = this.createPowerUpVisual(item.type);
        this.scene.add(vis.group);
        this.powerUpVisuals.set(item.id, vis);
      }

      const bob = item.onGround ? Math.sin(this.elapsed * 3.8 + item.bobPhase) * 0.12 : 0;
      vis.group.position.set(item.x, 0, 0);
      vis.core.position.set(0, item.y + bob, 0.1);
      vis.core.rotation.y += dt * 2.2;
      vis.ring.rotation.z += dt * 3.0;

      // Blink gently when about to expire (< 2.2s left)
      const blink = item.life < 2.2 ? (Math.sin(this.elapsed * 22) > 0 ? 1 : 0.3) : 1;
      vis.core.scale.setScalar(blink);

      vis.groundGlow.position.set(0, FLOOR_Y + 0.024, 0.1);
      const pulse = 0.85 + Math.sin(this.elapsed * 5 + item.bobPhase) * 0.15;
      vis.groundGlow.scale.setScalar(pulse);
    }

    for (const [id, vis] of this.powerUpVisuals.entries()) {
      if (!activeIds.has(id)) {
        this.disposeGroupChildren(vis.group);
        this.scene.remove(vis.group);
        this.powerUpVisuals.delete(id);
      }
    }
  }

  public startStageOutro(stage: ArenaStageId, winnerId: 1 | 2): void {
    this.clearStageOutro();
    if (!this.latestMatch) return;

    const victor = winnerId === 1 ? this.latestMatch.p1 : this.latestMatch.p2;
    const vx = victor.x;
    const group = new THREE.Group();
    group.position.set(vx, FLOOR_Y, 0);

    let updateFn: (elapsed: number, dt: number, victorRig: FighterRig, victor: FighterState) => void;

    if (stage === 'bloodstream') {
      // Mạch máu — Được hấp thu vào máu (Crimson arterial plasma vortex + swirling hemoglobin portal)
      const portalRings: THREE.Mesh[] = [];
      const ringCols = [0xf43f5e, 0xfb7185, 0xfbbf24, 0xe11d48];
      for (let i = 0; i < 4; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(1.1 + i * 0.36, 0.055, 12, 42),
          new THREE.MeshBasicMaterial({
            color: ringCols[i],
            transparent: true,
            opacity: 0.78 - i * 0.12,
          })
        );
        ring.position.set(0, 1.65, -0.55 - i * 0.18);
        group.add(ring);
        portalRings.push(ring);
      }

      const plasmaCore = new THREE.Mesh(
        new THREE.CircleGeometry(1.05, 32),
        new THREE.MeshBasicMaterial({
          color: 0xbe123c,
          transparent: true,
          opacity: 0.45,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      plasmaCore.position.set(0, 1.65, -0.58);
      group.add(plasmaCore);

      const streamRibbons: THREE.Mesh[] = [];
      for (let k = 0; k < 14; k++) {
        const droplet = new THREE.Mesh(
          this.sharedSphereGeo,
          new THREE.MeshBasicMaterial({
            color: k % 3 === 0 ? 0xfbbf24 : 0xfb7185,
            transparent: true,
            opacity: 0.85,
          })
        );
        droplet.scale.set(0.11, 0.07, 0.11);
        group.add(droplet);
        streamRibbons.push(droplet);
      }

      updateFn = (elapsed, dt, victorRig) => {
        for (let i = 0; i < portalRings.length; i++) {
          const r = portalRings[i];
          r.rotation.z += dt * (1.8 + i * 0.55) * (i % 2 === 0 ? 1 : -1);
          const s = 0.85 + Math.sin(elapsed * 4 + i) * 0.12;
          r.scale.setScalar(s);
        }
        plasmaCore.scale.setScalar(1 + Math.sin(elapsed * 5) * 0.08);

        for (let k = 0; k < streamRibbons.length; k++) {
          const angle = elapsed * 4.5 + (k * Math.PI * 2) / streamRibbons.length;
          const rad = Math.max(0.15, 1.8 - ((elapsed * 0.65 + k * 0.12) % 1.65));
          streamRibbons[k].position.set(
            Math.cos(angle) * rad,
            1.65 + Math.sin(angle) * rad * 0.8,
            -0.45 + (1.8 - rad) * 0.25
          );
        }

        // Levitate victor and smoothly dissolve/absorb into the arterial bloodstream vortex
        const absorbT = Math.max(0, Math.min(1, (elapsed - 0.85) / 2.2));
        const ease = absorbT * absorbT * (3 - 2 * absorbT);
        victorRig.group.position.set(
          vx,
          FLOOR_Y + 0.55 * Math.min(1, elapsed / 0.7) + ease * 0.85,
          -ease * 0.55
        );
        victorRig.group.rotation.y = elapsed * 2.4;
        victorRig.group.scale.setScalar(Math.max(0.06, victorRig.currentScale * (1 - ease * 0.92)));
        victorRig.shadowDisc.scale.setScalar(Math.max(0.05, 1 - ease));

        this.outroState.sparkTimer -= dt;
        if (this.outroState.sparkTimer <= 0) {
          this.outroState.sparkTimer = 0.09;
          this.spawnBurst(vx, FLOOR_Y + 1.65, 0.1, 4, 0xf43f5e, 3.4, 0.85, -1.2, 0.55, 0.4);
          this.spawnBurst(vx, FLOOR_Y + 1.65, 0.1, 2, 0xfbbf24, 2.8, 0.7, -0.8, 0.5, 0.6);
        }
      };
    } else if (stage === 'flask') {
      // Bình cầu — Kết tinh lấp lánh (Nucleating glowing diamond/teal crystal lattice)
      const crystals: { mesh: THREE.Mesh; maxScale: number; delay: number }[] = [];
      const crystalCols = [0x2dd4bf, 0x99f6e4, 0x38bdf8, 0xfef08a];
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const dist = 0.95 + (i % 3) * 0.35;
        const cMat = new THREE.MeshPhysicalMaterial({
          color: crystalCols[i % crystalCols.length],
          emissive: crystalCols[i % crystalCols.length],
          emissiveIntensity: 0.75,
          roughness: 0.08,
          metalness: 0.25,
          transparent: true,
          opacity: 0.82,
          clearcoat: 1.0,
        });
        const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), cMat);
        shard.scale.set(0.6, 1.85, 0.6);
        shard.position.set(Math.cos(angle) * dist, 0.55 + (i % 2) * 0.35, Math.sin(angle) * dist * 0.75);
        shard.rotation.set((i % 2 === 0 ? 1 : -1) * 0.22, angle, (Math.cos(angle) * -0.25));
        shard.scale.setScalar(0.01);
        group.add(shard);
        crystals.push({ mesh: shard, maxScale: 0.85 + (i % 3) * 0.22, delay: i * 0.07 });
      }

      const prismRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.55, 0.045, 10, 48),
        new THREE.MeshBasicMaterial({ color: 0x99f6e4, transparent: true, opacity: 0.85 })
      );
      prismRing.rotation.x = Math.PI / 2;
      prismRing.position.y = 0.06;
      group.add(prismRing);

      updateFn = (elapsed, dt, victorRig) => {
        for (const c of crystals) {
          const tLocal = Math.max(0, Math.min(1, (elapsed - c.delay) / 0.85));
          const ease = 1 - Math.pow(1 - tLocal, 3);
          const s = Math.max(0.01, c.maxScale * ease);
          c.mesh.scale.set(s * 0.58, s * 1.85, s * 0.58);
          const mat = c.mesh.material as THREE.MeshPhysicalMaterial;
          mat.emissiveIntensity = 0.65 + Math.sin(elapsed * 10 + c.delay * 8) * 0.35;
        }
        prismRing.rotation.z += dt * 2.2;
        victorRig.group.position.set(vx, FLOOR_Y + 0.28 + Math.sin(elapsed * 3) * 0.08, 0);
        victorRig.group.rotation.y = Math.sin(elapsed * 1.8) * 0.35;

        this.outroState.sparkTimer -= dt;
        if (this.outroState.sparkTimer <= 0) {
          this.outroState.sparkTimer = 0.08;
          this.spawnBurst(
            vx + (Math.random() - 0.5) * 2.2,
            FLOOR_Y + 0.5 + Math.random() * 2.3,
            0.3,
            4,
            0xffffff,
            2.6,
            0.9,
            1.2,
            0.52,
            1.4
          );
          this.spawnBurst(
            vx + (Math.random() - 0.5) * 1.8,
            FLOOR_Y + 0.8 + Math.random() * 1.8,
            0.2,
            3,
            0x2dd4bf,
            3.1,
            0.85,
            2.5,
            0.55,
            1.8
          );
        }
      };
    } else if (stage === 'receptor') {
      // Đích tác động — Được gắn vào thụ thể (Golden GPCR lock-and-key binding pocket + signal shockwave)
      const pocketRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.35, 0.1, 14, 48),
        new THREE.MeshStandardMaterial({
          color: 0xfacc15,
          emissive: 0xeab308,
          emissiveIntensity: 0.95,
          metalness: 0.75,
          roughness: 0.2,
        })
      );
      pocketRing.rotation.x = Math.PI / 2;
      pocketRing.position.y = 0.15;
      group.add(pocketRing);

      const lockAura = new THREE.Mesh(
        new THREE.TorusGeometry(1.15, 0.055, 12, 42),
        new THREE.MeshBasicMaterial({ color: 0xc084fc, transparent: true, opacity: 0.88 })
      );
      lockAura.position.set(0, 1.55, 0);
      group.add(lockAura);

      const signalWave = new THREE.Mesh(
        new THREE.TorusGeometry(1.0, 0.06, 10, 48),
        new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.8 })
      );
      signalWave.rotation.x = Math.PI / 2;
      signalWave.position.y = 0.08;
      group.add(signalWave);

      const helices: THREE.Mesh[] = [];
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.18, 2.8, 12),
          new THREE.MeshStandardMaterial({
            color: 0xa855f7,
            emissive: 0x7e22ce,
            emissiveIntensity: 0.7,
            roughness: 0.25,
          })
        );
        pillar.position.set(Math.cos(a) * 1.45, 1.4, Math.sin(a) * 1.15);
        group.add(pillar);
        helices.push(pillar);
      }

      updateFn = (elapsed, dt, victorRig) => {
        const dockT = Math.min(1, elapsed / 1.15);
        const ease = 1 - Math.pow(1 - dockT, 3);
        // Smoothly dock into the golden binding cradle & lock in place
        victorRig.group.position.set(vx, FLOOR_Y + (1 - ease) * 0.75 + 0.06, 0);
        victorRig.group.rotation.y = (1 - ease) * Math.PI * 0.6;

        lockAura.rotation.x = elapsed * 2.2;
        lockAura.rotation.y += dt * 2.8;
        lockAura.scale.setScalar(1.35 - ease * 0.38);

        pocketRing.rotation.z += dt * 1.8;

        // Expanding biological signal transduction wave once locked
        const waveCycle = (elapsed * 0.9) % 1;
        signalWave.scale.setScalar(0.8 + waveCycle * 2.4);
        (signalWave.material as THREE.MeshBasicMaterial).opacity = (1 - waveCycle) * 0.85;

        for (let i = 0; i < helices.length; i++) {
          helices[i].scale.y = 0.75 + ease * 0.3 + Math.sin(elapsed * 4 + i) * 0.05;
        }

        this.outroState.sparkTimer -= dt;
        if (this.outroState.sparkTimer <= 0) {
          this.outroState.sparkTimer = 0.1;
          this.spawnBurst(vx, FLOOR_Y + 1.4, 0.15, 4, 0xfacc15, 3.6, 0.85, 3.2, 0.45, 1.6);
          this.spawnBurst(vx, FLOOR_Y + 1.4, 0.15, 3, 0xc084fc, 3.2, 0.8, 2.5, 0.5, 1.2);
        }
      };
    } else {
      // Tế bào — Được vào nhân để chuyển hoá (Nuclear Pore Complex & glowing Nucleus envelope)
      const nucleusShell = new THREE.Mesh(
        new THREE.SphereGeometry(1.95, 22, 16),
        new THREE.MeshPhysicalMaterial({
          color: 0x0ea5e9,
          emissive: 0x1d4ed8,
          emissiveIntensity: 0.45,
          roughness: 0.18,
          transparent: true,
          opacity: 0.24,
          wireframe: true,
        })
      );
      nucleusShell.position.set(0, 1.55, 0);
      group.add(nucleusShell);

      const poreRingA = new THREE.Mesh(
        new THREE.TorusGeometry(1.45, 0.06, 12, 48),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 })
      );
      poreRingA.position.set(0, 1.55, 0);
      const poreRingB = new THREE.Mesh(
        new THREE.TorusGeometry(1.22, 0.045, 12, 48),
        new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.85 })
      );
      poreRingB.position.set(0, 1.55, 0);
      group.add(poreRingA, poreRingB);

      const enzymeNodes: THREE.Mesh[] = [];
      for (let i = 0; i < 10; i++) {
        const node = new THREE.Mesh(
          this.sharedSphereGeo,
          new THREE.MeshBasicMaterial({
            color: i % 2 === 0 ? 0x34d399 : 0xfacc15,
          })
        );
        node.scale.setScalar(0.095);
        group.add(node);
        enzymeNodes.push(node);
      }

      updateFn = (elapsed, dt, victorRig) => {
        const enterT = Math.min(1, elapsed / 1.2);
        const ease = 1 - Math.pow(1 - enterT, 3);
        nucleusShell.rotation.y += dt * 0.65;
        nucleusShell.scale.setScalar(0.35 + ease * 0.68);
        poreRingA.rotation.x += dt * 1.9;
        poreRingA.rotation.y += dt * 1.2;
        poreRingB.rotation.z -= dt * 2.4;
        poreRingB.rotation.x -= dt * 1.1;

        for (let i = 0; i < enzymeNodes.length; i++) {
          const a = elapsed * 2.8 + (i * Math.PI * 2) / enzymeNodes.length;
          enzymeNodes[i].position.set(
            Math.cos(a) * 1.35,
            1.55 + Math.sin(a * 1.5) * 0.75,
            Math.sin(a) * 1.1
          );
        }

        // Ascend into nucleus core and undergo luminous biotransformation pulse
        victorRig.group.position.set(vx, FLOOR_Y + ease * 0.48 + Math.sin(elapsed * 2.5) * 0.08, 0);
        victorRig.group.rotation.y += dt * 1.6;
        const pulseScale = victorRig.currentScale * (0.94 + Math.sin(elapsed * 6) * 0.06);
        victorRig.group.scale.setScalar(pulseScale);

        this.outroState.sparkTimer -= dt;
        if (this.outroState.sparkTimer <= 0) {
          this.outroState.sparkTimer = 0.095;
          this.spawnBurst(vx, FLOOR_Y + 1.55, 0.2, 4, 0x38bdf8, 3.0, 0.85, -1.0, 0.55, 1.0);
          this.spawnBurst(vx, FLOOR_Y + 1.55, 0.2, 3, 0x34d399, 2.8, 0.8, -0.8, 0.55, 1.2);
        }
      };
    }

    this.scene.add(group);
    this.outroState = {
      active: true,
      stage,
      winnerId,
      elapsed: 0,
      sparkTimer: 0,
      group,
      update: updateFn,
    };
  }

  public clearStageOutro(): void {
    if (this.outroState.group) {
      this.disposeGroupChildren(this.outroState.group);
      this.scene.remove(this.outroState.group);
    }
    this.outroState = {
      active: false,
      stage: this.activeStageId,
      winnerId: 1,
      elapsed: 0,
      sparkTimer: 0,
      group: null,
      update: null,
    };
    this.p1Rig.group.rotation.y = 0;
    this.p2Rig.group.rotation.y = 0;
    this.p1Rig.group.scale.setScalar(1);
    this.p2Rig.group.scale.setScalar(1);
    this.p1Rig.currentScale = 1;
    this.p2Rig.currentScale = 1;
  }

  public projectToScreen(worldX: number, worldY: number): { x: number; y: number } | null {
    _vec3A.set(worldX, worldY, 0).project(this.camera);
    if (_vec3A.z < -1 || _vec3A.z > 1) return null;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    return {
      x: (_vec3A.x * 0.5 + 0.5) * w,
      y: (-_vec3A.y * 0.5 + 0.5) * h,
    };
  }

  private handleResize(): void {
    if (this.disposed) return;
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    this.clearStageOutro();
    if (this.activeStage) {
      this.scene.remove(this.activeStage.group);
      this.activeStage.dispose();
      this.activeStage = null;
    }
    for (const [, vis] of this.projectileVisuals.entries()) {
      this.disposeGroupChildren(vis.group);
      this.scene.remove(vis.group);
    }
    this.projectileVisuals.clear();
    for (const [, vis] of this.powerUpVisuals.entries()) {
      this.disposeGroupChildren(vis.group);
      this.scene.remove(vis.group);
    }
    this.powerUpVisuals.clear();
    this.sharedSphereGeo.dispose();
    this.sharedCylGeo.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
