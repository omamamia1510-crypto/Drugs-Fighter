import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ParsedMolecule } from '../chem/smilesEngine';
import type {
  ColorSchemeMode,
  CombatEvent,
  FighterState,
  MatchState,
} from './combatEngine';
import { ARENA_HALF_WIDTH, FLOOR_Y } from './combatEngine';

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

function createDeckTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#071022';
  ctx.fillRect(0, 0, w, h);

  // Subtle radial arena spotlight gradient
  const rad = ctx.createRadialGradient(w / 2, h / 2, 30, w / 2, h / 2, w * 0.48);
  rad.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
  rad.addColorStop(0.6, 'rgba(15, 23, 42, 0.08)');
  rad.addColorStop(1, 'rgba(4, 9, 20, 0)');
  ctx.fillStyle = rad;
  ctx.fillRect(0, 0, w, h);

  // Hexagonal molecular lattice pattern
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
  ctx.lineWidth = 1.5;
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

  // Center combat boundary lines
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.4)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w / 2, 40);
  ctx.lineTo(w / 2, h - 40);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 110, 0, Math.PI * 2);
  ctx.stroke();

  // P1 & P2 corner markings
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, w - 48, h - 48);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

type BondOrderCategory = 'single' | 'double' | 'triple' | 'aromatic';

interface TaggedBond {
  mesh: THREE.Mesh;
  order: BondOrderCategory;
  heightNorm: number; // 0 (feet) .. 1 (head)
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
  weaponGroup: THREE.Group;
  weaponHaloMat: THREE.MeshBasicMaterial | null;
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

  private dnaGroup: THREE.Group;
  private mitoLeft: THREE.Group;
  private mitoRight: THREE.Group;
  private vesicleMesh: THREE.InstancedMesh;
  private vesicleBase: Array<{ x: number; y: number; z: number; speed: number; phase: number; s: number }> = [];

  private particleMesh: THREE.InstancedMesh;
  private particles: ParticleSlot[] = [];
  private particleCursor = 0;

  private sharedSphereGeo = new THREE.SphereGeometry(1, 16, 16);
  private sharedCylGeo = new THREE.CylinderGeometry(1, 1, 1, 10);

  private currentState: 'title' | 'playing' | 'paused' | 'gameover' = 'title';
  private colorMode: ColorSchemeMode = 'elemental';
  private latestMatch: MatchState | null = null;
  private camX = 0;
  private camY = 1.05;
  private camZ = 13.8;
  private lookX = 0;
  private lookY = 0.25;

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
    this.scene.fog = new THREE.FogExp2(0x050c1b, 0.025);

    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 120);
    this.camera.position.set(0, 1.05, 13.8);

    // Studio IBL environment map
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.setupLighting();
    const { dnaGroup, mitoLeft, mitoRight, vesicleMesh } = this.buildBioArena();
    this.dnaGroup = dnaGroup;
    this.mitoLeft = mitoLeft;
    this.mitoRight = mitoRight;
    this.vesicleMesh = vesicleMesh;

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
    this.tick();
  }

  private setupLighting(): void {
    const hemi = new THREE.HemisphereLight(0x7dd3fc, 0x090f20, 1.05);
    this.scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.0);
    keyLight.position.set(4, 11, 8);
    keyLight.castShadow = !this.isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 7;
    keyLight.shadow.camera.bottom = -4;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 28;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight);

    const p1Rim = new THREE.DirectionalLight(0x38bdf8, 1.15);
    p1Rim.position.set(-8, 4, -5);
    this.scene.add(p1Rim);

    const p2Rim = new THREE.DirectionalLight(0xf43f5e, 1.0);
    p2Rim.position.set(8, 4, -5);
    this.scene.add(p2Rim);
  }

  private buildBioArena() {
    const arenaGroup = new THREE.Group();
    this.scene.add(arenaGroup);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const deckTex = createDeckTexture(maxAniso);

    // 1. Primary Combat Membrane Platform
    const deckGeo = new THREE.BoxGeometry(15.6, 0.36, 4.6);
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: deckTex,
      roughness: 0.34,
      metalness: 0.45,
    });
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.set(0, FLOOR_Y - 0.18, 0);
    deck.receiveShadow = !this.isSoftwareGl;
    arenaGroup.add(deck);

    // Lower hydrophobic core layer
    const subDeckGeo = new THREE.BoxGeometry(15.2, 0.42, 4.1);
    const subDeckMat = new THREE.MeshStandardMaterial({
      color: 0x0b162c,
      roughness: 0.65,
      metalness: 0.25,
    });
    const subDeck = new THREE.Mesh(subDeckGeo, subDeckMat);
    subDeck.position.set(0, FLOOR_Y - 0.58, 0);
    arenaGroup.add(subDeck);

    //Glowing perimeter neon rail
    const railGeo = new THREE.BoxGeometry(15.72, 0.07, 4.72);
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.7,
    });
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set(0, FLOOR_Y - 0.04, 0);
    arenaGroup.add(rail);

    // 2. Instanced Phospholipid Bilayer Heads & Hydrophobic Tails along front and back edge
    const headCount = 34 * 4;
    const headGeo = new THREE.SphereGeometry(0.14, 12, 12);
    const headMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0369a1,
      emissiveIntensity: 0.35,
      roughness: 0.18,
      metalness: 0.15,
      clearcoat: 0.85,
    });
    const headMesh = new THREE.InstancedMesh(headGeo, headMat, headCount);

    const tailGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.46, 6);
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.55,
      metalness: 0.3,
    });
    const tailMesh = new THREE.InstancedMesh(tailGeo, tailMat, headCount * 2);

    let hIdx = 0;
    let tIdx = 0;
    for (let i = 0; i < 34; i++) {
      const x = -7.4 + (i / 33) * 14.8;
      for (const zEdge of [2.15, -2.15]) {
        for (const yLayer of [FLOOR_Y - 0.24, FLOOR_Y - 0.82]) {
          _vec3A.set(x, yLayer, zEdge);
          _quat.identity();
          _scaleVec.set(1, 1, 1);
          _mat4.compose(_vec3A, _quat, _scaleVec);
          headMesh.setMatrixAt(hIdx++, _mat4);
        }
        // Two tails per lipid column
        for (const tOff of [-0.045, 0.045]) {
          _vec3A.set(x + tOff, FLOOR_Y - 0.53, zEdge);
          _quat.setFromAxisAngle(_upVec, 0);
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
    arenaGroup.add(headMesh);
    arenaGroup.add(tailMesh);

    // 3. Left & Right Transmembrane Ion-Channel Boundary Pillars
    for (const side of [-1, 1]) {
      const pillarGroup = new THREE.Group();
      pillarGroup.position.set(side * (ARENA_HALF_WIDTH + 0.72), FLOOR_Y, 0);

      const accentCol = side === -1 ? 0x38bdf8 : 0xf43f5e;
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.4,
        metalness: 0.65,
      });
      const glowMat = new THREE.MeshStandardMaterial({
        color: accentCol,
        emissive: accentCol,
        emissiveIntensity: 0.85,
        roughness: 0.2,
        metalness: 0.3,
      });

      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.3, 12), baseMat);
      base.position.y = 0.15;
      pillarGroup.add(base);

      // 4 alpha-helix barrel rods
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + Math.PI / 4;
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 8), baseMat);
        rod.position.set(Math.cos(a) * 0.24, 1.75, Math.sin(a) * 0.24);
        pillarGroup.add(rod);
      }

      const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 10, 24), glowMat);
      ring1.rotation.x = Math.PI / 2;
      ring1.position.y = 1.2;
      pillarGroup.add(ring1);

      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.045, 10, 24), glowMat);
      ring2.rotation.x = Math.PI / 2;
      ring2.position.y = 2.6;
      pillarGroup.add(ring2);

      const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), glowMat);
      cap.position.y = 3.45;
      pillarGroup.add(cap);

      arenaGroup.add(pillarGroup);
    }

    // 4. Deep Background Vista: DNA Double Helix Monument
    const dnaGroup = new THREE.Group();
    dnaGroup.position.set(0, 1.4, -12.5);
    const strandMatA = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      roughness: 0.3,
      metalness: 0.5,
    });
    const strandMatB = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xbe123c,
      emissiveIntensity: 0.45,
      roughness: 0.3,
      metalness: 0.5,
    });
    const rungMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.45,
      metalness: 0.5,
    });

    for (let i = -9; i <= 9; i++) {
      const y = i * 0.52;
      const theta = i * 0.48;
      const rad = 1.15;
      const x1 = Math.cos(theta) * rad;
      const z1 = Math.sin(theta) * rad;
      const x2 = -x1;
      const z2 = -z1;

      const s1 = new THREE.Mesh(this.sharedSphereGeo, strandMatA);
      s1.scale.setScalar(0.16);
      s1.position.set(x1, y, z1);
      dnaGroup.add(s1);

      const s2 = new THREE.Mesh(this.sharedSphereGeo, strandMatB);
      s2.scale.setScalar(0.16);
      s2.position.set(x2, y, z2);
      dnaGroup.add(s2);

      if (i % 2 === 0) {
        _vec3A.set(x1, y, z1);
        _vec3B.set(x2, y, z2);
        const rung = this.makeBondMesh(_vec3A, _vec3B, 0.05, rungMat);
        dnaGroup.add(rung);
      }
    }
    this.scene.add(dnaGroup);

    // 5. Left & Right 3D Mitochondria Organelles
    const makeMito = (x: number, y: number, z: number, rotZ: number) => {
      const mGroup = new THREE.Group();
      mGroup.position.set(x, y, z);
      mGroup.rotation.z = rotZ;

      const shellMat = new THREE.MeshPhysicalMaterial({
        color: 0xb45309,
        emissive: 0x7c2d12,
        emissiveIntensity: 0.25,
        roughness: 0.35,
        metalness: 0.15,
        transparent: true,
        opacity: 0.55,
      });
      const shell = new THREE.Mesh(new THREE.CapsuleGeometry(0.95, 2.2, 8, 16), shellMat);
      shell.rotation.z = Math.PI / 2;
      mGroup.add(shell);

      const cristaeMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.55,
        roughness: 0.4,
      });
      for (let i = -3; i <= 3; i++) {
        const fold = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.06, 8, 16), cristaeMat);
        fold.rotation.y = Math.PI / 2;
        fold.position.x = i * 0.45;
        mGroup.add(fold);
      }
      this.scene.add(mGroup);
      return mGroup;
    };

    const mitoLeft = makeMito(-10.4, 3.65, -9.8, 0.24);
    const mitoRight = makeMito(10.4, 3.55, -9.8, -0.24);

    // 6. Floating background vesicles / ribosomes (InstancedMesh)
    const vCount = 32;
    const vMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.3,
      roughness: 0.25,
      metalness: 0.3,
      transparent: true,
      opacity: 0.5,
    });
    const vesicleMesh = new THREE.InstancedMesh(this.sharedSphereGeo, vMat, vCount);
    vesicleMesh.frustumCulled = false;

    for (let i = 0; i < vCount; i++) {
      const px = ((i * 73) % 28) - 14;
      const py = ((i * 37) % 10) - 2.5;
      const pz = -4.5 - ((i * 19) % 11);
      const s = 0.08 + ((i * 13) % 10) * 0.018;
      this.vesicleBase.push({
        x: px,
        y: py,
        z: pz,
        speed: 0.5 + (i % 5) * 0.18,
        phase: i * 0.9,
        s,
      });
    }
    this.scene.add(vesicleMesh);

    return { dnaGroup, mitoLeft, mitoRight, vesicleMesh };
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
    scale = 1
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
      slot.vy = Math.sin(phi) * sp + 1.5;
      slot.vz = Math.sin(theta) * Math.cos(phi) * sp * 0.5;
      slot.maxLife = 0.28 + Math.random() * 0.28;
      slot.life = slot.maxLife;
      slot.scale = scale * (0.6 + Math.random() * 0.8);
      slot.r = _color.r;
      slot.g = _color.g;
      slot.b = _color.b;
    }
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

  private addMultiBond(
    parent: THREE.Group,
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    order: BondOrderCategory,
    taggedBonds: TaggedBond[],
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
    } else if (order === 'double' || order === 'aromatic') {
      const off = perp.clone().multiplyScalar(0.055);
      const m1 = this.makeBondMesh(p1.clone().add(off), p2.clone().add(off), 0.036, makeMat());
      const m2 = this.makeBondMesh(p1.clone().sub(off), p2.clone().sub(off), 0.036, makeMat());
      parent.add(m1, m2);
      taggedBonds.push({ mesh: m1, order, heightNorm }, { mesh: m2, order, heightNorm });
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
    }
  }

  private addJointAtom(
    parent: THREE.Group,
    pos: THREE.Vector3,
    radius: number,
    jointMats: THREE.MeshPhysicalMaterial[],
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

    // Pelvis sits 1.48 above ground so thigh (0.74) + shin (0.74) lands flush on y = 0 local
    const pelvis = new THREE.Group();
    pelvis.position.set(0, 1.48, 0);
    facingGroup.add(pelvis);
    this.addJointAtom(pelvis, new THREE.Vector3(0, 0, 0), 0.11, jointMats, jointCol);

    // Spine: Alkyne (-C#C-)
    const spine = new THREE.Group();
    pelvis.add(spine);
    this.addMultiBond(
      spine,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 1.15, 0),
      'triple',
      taggedBonds,
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

    const chestRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.025, 8, 24),
      new THREE.MeshBasicMaterial({ color: primaryCol })
    );
    chestHub.add(chestRing);

    // Head: Benzene / Phenyl Ring + Visor + Electron Halo
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.25, 0);
    chestHub.add(headGroup);

    const neckTop = new THREE.Vector3(0, 0.22, 0);
    this.addMultiBond(headGroup, new THREE.Vector3(0, 0, 0), neckTop, 'single', taggedBonds, 0.8, primaryCol);

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
        0.92,
        primaryCol
      );
      this.addJointAtom(headGroup, pA, 0.075, jointMats, jointCol);
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
      this.addJointAtom(shoulder, new THREE.Vector3(0, 0, 0), 0.085, jointMats, jointCol);

      const elbowPos = new THREE.Vector3(0.42, -0.26, 0);
      this.addMultiBond(shoulder, new THREE.Vector3(0, 0, 0), elbowPos, 'triple', taggedBonds, 0.68, primaryCol);

      const forearm = new THREE.Group();
      forearm.position.copy(elbowPos);
      shoulder.add(forearm);
      this.addJointAtom(forearm, new THREE.Vector3(0, 0, 0), 0.075, jointMats, jointCol);

      const handPos = new THREE.Vector3(0.38, 0.08, 0);
      this.addMultiBond(forearm, new THREE.Vector3(0, 0, 0), handPos, 'single', taggedBonds, 0.68, primaryCol);
      this.addJointAtom(forearm, handPos, 0.1, jointMats, primaryCol);

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
      this.addJointAtom(leg, new THREE.Vector3(0, 0, 0), 0.085, jointMats, jointCol);

      const kneePos = new THREE.Vector3(0.08, -0.74, 0);
      this.addMultiBond(leg, new THREE.Vector3(0, 0, 0), kneePos, 'double', taggedBonds, 0.34, primaryCol);

      const shin = new THREE.Group();
      shin.position.copy(kneePos);
      leg.add(shin);
      this.addJointAtom(shin, new THREE.Vector3(0, 0, 0), 0.08, jointMats, jointCol);

      const anklePos = new THREE.Vector3(-0.04, -0.74, 0);
      this.addMultiBond(shin, new THREE.Vector3(0, 0, 0), anklePos, 'double', taggedBonds, 0.14, primaryCol);
      this.addJointAtom(shin, anklePos, 0.075, jointMats, jointCol);

      const toePos = new THREE.Vector3(0.24, -0.74, 0);
      this.addMultiBond(shin, anklePos, toePos, 'single', taggedBonds, 0.05, primaryCol);
      this.addJointAtom(shin, toePos, 0.065, jointMats, primaryCol);

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
      weaponGroup,
      weaponHaloMat: null,
    };
  }

  public setWeapon(playerId: 1 | 2, mol: ParsedMolecule): void {
    const rig = playerId === 1 ? this.p1Rig : this.p2Rig;
    const wGroup = rig.weaponGroup;

    // Dispose old weapon children
    while (wGroup.children.length > 0) {
      const child = wGroup.children[0];
      if (child instanceof THREE.Mesh) {
        if (child.geometry !== this.sharedSphereGeo && child.geometry !== this.sharedCylGeo) {
          child.geometry.dispose();
        }
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
      wGroup.remove(child);
    }

    const scale = 1.45;
    const atomPositions: THREE.Vector3[] = [];

    for (const atom of mol.atoms) {
      const col = CPK_COLORS[atom.elem] ?? 0x94a3b8;
      const mat = new THREE.MeshPhysicalMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 0.22,
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
      wGroup.add(mesh);
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
        wGroup.add(this.makeBondMesh(p1, p2, 0.025, bondMat));
        wGroup.add(this.makeBondMesh(p1.clone().add(off), p2.clone().add(off), 0.024, bondMat));
        wGroup.add(this.makeBondMesh(p1.clone().sub(off), p2.clone().sub(off), 0.024, bondMat));
      } else if (bond.order >= 1.5) {
        const off = perp.clone().multiplyScalar(0.045);
        wGroup.add(this.makeBondMesh(p1.clone().add(off), p2.clone().add(off), 0.028, bondMat));
        wGroup.add(this.makeBondMesh(p1.clone().sub(off), p2.clone().sub(off), 0.028, bondMat));
      } else {
        wGroup.add(this.makeBondMesh(p1, p2, 0.036, bondMat));
      }
    }

    const auraMat = new THREE.MeshBasicMaterial({
      color: playerId === 1 ? 0x38bdf8 : 0xf43f5e,
      wireframe: true,
      transparent: true,
      opacity: 0.22,
    });
    const aura = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 1), auraMat);
    wGroup.add(aura);
    rig.weaponHaloMat = auraMat;
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
    this.latestMatch = match;
    this.currentState = gameState;

    for (const ev of events) {
      if (ev.type === 'hit') {
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
      }
    }
  }

  private animateRig(rig: FighterRig, f: FighterState, dt: number): void {
    rig.group.position.set(f.x, f.y, 0);
    rig.facingGroup.scale.x = f.facing;
    rig.squashGroup.scale.set(f.squashX, f.squashY, 1);

    // Contact shadow grounding & height falloff
    const heightAboveFloor = Math.max(0, f.y - FLOOR_Y);
    const shadowScale = Math.max(0.45, 1 - heightAboveFloor * 0.18);
    rig.shadowDisc.position.set(f.x, FLOOR_Y + 0.015, 0);
    rig.shadowDisc.scale.setScalar(shadowScale);
    rig.shadowMat.opacity = Math.max(0.15, 0.65 - heightAboveFloor * 0.15);

    // Hit flash (40-75ms bright white emissive pulse)
    const flashing = f.flashTimer > 0;
    for (const jm of rig.jointMats) {
      if (flashing) {
        jm.emissive.setHex(0xffffff);
        jm.emissiveIntensity = 2.0;
      } else {
        jm.emissiveIntensity = 0;
      }
    }

    // Special ready electron halo speed & brightness
    const ready = f.energy >= 100;
    rig.haloMesh.rotation.z += dt * (ready ? 6.5 : 1.6);
    rig.haloMesh.rotation.y += dt * (ready ? 3.2 : 0.9);
    rig.haloMat.opacity = ready ? 0.85 : 0.28;
    rig.coreMesh.rotation.y += dt * (ready ? 5.0 : 1.8);

    // Rotate 3D molecular weapon smoothly
    rig.weaponGroup.rotation.y += dt * (ready ? 3.6 : 1.4);
    rig.weaponGroup.rotation.z += dt * 0.8;
    if (rig.weaponHaloMat) {
      rig.weaponHaloMat.opacity = ready ? 0.52 : 0.2;
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

    const t = this.elapsed;
    const progress = f.stateDuration > 0 ? 1 - f.stateTimer / f.stateDuration : 0;

    if (f.state === 'idle') {
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
      pelvisY = 0.45;
      rootRotZ = 1.48;
      spineRotZ = 0.25;
      rArmZ = -1.2;
      lLegZ = 0.4;
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
      p.vy -= 14 * dt;
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

    // Ambient background organelles
    this.dnaGroup.rotation.y += dt * 0.35;
    this.mitoLeft.position.y = 3.65 + Math.sin(this.elapsed * 0.9) * 0.22;
    this.mitoRight.position.y = 3.55 + Math.cos(this.elapsed * 0.85) * 0.22;

    for (let i = 0; i < this.vesicleBase.length; i++) {
      const vb = this.vesicleBase[i];
      _vec3A.set(
        vb.x + Math.sin(this.elapsed * 0.4 + vb.phase) * 0.35,
        vb.y + Math.sin(this.elapsed * vb.speed + vb.phase) * 0.45,
        vb.z
      );
      _quat.identity();
      _scaleVec.setScalar(vb.s);
      _mat4.compose(_vec3A, _quat, _scaleVec);
      this.vesicleMesh.setMatrixAt(i, _mat4);
    }
    this.vesicleMesh.instanceMatrix.needsUpdate = true;

    // Animate fighters
    if (this.latestMatch) {
      this.animateRig(this.p1Rig, this.latestMatch.p1, dt);
      this.animateRig(this.p2Rig, this.latestMatch.p2, dt);

      // Dynamic camera rig
      if (this.currentState === 'title') {
        const targetX = Math.sin(this.elapsed * 0.42) * 1.15;
        const targetY = 1.05 + Math.cos(this.elapsed * 0.35) * 0.15;
        const targetZ = 12.6;
        const k = 1 - Math.exp(-3.5 * dt);
        this.camX += (targetX - this.camX) * k;
        this.camY += (targetY - this.camY) * k;
        this.camZ += (targetZ - this.camZ) * k;
        this.lookX += (0 - this.lookX) * k;
        this.lookY += (0.32 - this.lookY) * k;
      } else {
        const midX = (this.latestMatch.p1.x + this.latestMatch.p2.x) * 0.5;
        const sep = Math.abs(this.latestMatch.p1.x - this.latestMatch.p2.x);
        const targetX = THREE.MathUtils.clamp(midX * 0.55, -2.5, 2.5);
        const targetZ = THREE.MathUtils.clamp(11.4 + sep * 0.42, 11.4, 15.2);
        const targetY = 1.1 + Math.max(this.latestMatch.p1.y - FLOOR_Y, this.latestMatch.p2.y - FLOOR_Y) * 0.25;
        const k = 1 - Math.exp(-7 * dt);
        this.camX += (targetX - this.camX) * k;
        this.camY += (targetY - this.camY) * k;
        this.camZ += (targetZ - this.camZ) * k;
        this.lookX += (midX * 0.35 - this.lookX) * k;
        this.lookY += (0.28 - this.lookY) * k;
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
    this.sharedSphereGeo.dispose();
    this.sharedCylGeo.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
