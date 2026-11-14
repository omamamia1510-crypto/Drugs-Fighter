import type { MoleculeStats, SmilesSkillId } from '../chem/smilesEngine';
import type { ArenaStageId } from './arenaStages';

export type FighterActionState =
  | 'idle'
  | 'walk'
  | 'jump'
  | 'crouch'
  | 'dash'
  | 'punch_windup'
  | 'punch_active'
  | 'punch_recovery'
  | 'kick_windup'
  | 'kick_active'
  | 'kick_recovery'
  | 'throw_windup'
  | 'throw_recovery'
  | 'uppercut_windup'
  | 'uppercut_active'
  | 'uppercut_recovery'
  | 'lunge_windup'
  | 'lunge_active'
  | 'lunge_recovery'
  | 'special_windup'
  | 'special_active'
  | 'special_recovery'
  | 'skill_windup'
  | 'skill_active'
  | 'skill_recovery'
  | 'block'
  | 'hitstun'
  | 'ko';

export type CpuDifficulty = 'easy' | 'normal' | 'hard';
export type ColorSchemeMode = 'elemental' | 'rainbow' | 'bond';
export type PlayMode = '1p' | '2p';

export type PowerUpType = 'lightning' | 'fist' | 'shrink' | 'triple_throw' | 'giant';

export const POWERUP_TYPES: readonly PowerUpType[] = [
  'lightning',
  'fist',
  'shrink',
  'triple_throw',
  'giant',
];

export interface FighterBuffs {
  lightning: number;    // +55% attack speed
  fist: number;         // +50% damage
  shrink: number;       // 0.68x body scale + nimble speed
  tripleThrow: number;  // 3x molecular projectiles on Forward+Punch (J+D)
  giant: number;        // 1.38x body scale + reach & power boost
}

export interface ArenaPowerUp {
  id: number;
  type: PowerUpType;
  x: number;
  y: number;
  vy: number;
  onGround: boolean;
  life: number;
  maxLife: number;
  bobPhase: number;
}

export type HazardType =
  | 'enzyme_attack'
  | 'stir_bar'
  | 'leukocyte_drop'
  | 'receptor_competition';

export interface ArenaHazard {
  id: number;
  type: HazardType;
  stageId: ArenaStageId;
  phase: 'telegraph' | 'active';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  height: number;
  damage: number;
  timer: number;
  duration: number;
  hitP1: boolean;
  hitP2: boolean;
  seed: number;
}

export interface FighterInput {
  left: boolean;
  right: boolean;
  jumpJustPressed: boolean;
  crouch: boolean;
  punchJustPressed: boolean;
  kickJustPressed: boolean;
  specialJustPressed: boolean;
  skillJustPressed: boolean;
  dashJustPressed: boolean;
  blockHeld: boolean;
}

export interface FighterState {
  id: 1 | 2;
  name: string;
  formula: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  hp: number;
  maxHp: number;
  ghostHp: number;
  energy: number;
  atk: number;
  def: number;
  spd: number;
  crit: number;
  state: FighterActionState;
  stateTimer: number;
  stateDuration: number;
  hitRegistered: boolean;
  dashCooldown: number;
  throwCooldown: number;
  hasWeaponInHand: boolean;
  koElapsed: number;
  flashTimer: number;
  comboCount: number;
  comboResetTimer: number;
  walkDistance: number;
  squashX: number;
  squashY: number;
  roundsWon: number;
  damageDealt: number;
  maxCombo: number;
  hitsLanded: number;
  blocksLanded: number;
  aiThinkTimer: number;
  aiActionCooldown: number;
  aiMoveDir: -1 | 0 | 1;
  buffs: FighterBuffs;
  skillId: SmilesSkillId;
  skillName: string;
  skillColor: string;
  skillCooldown: number;
  skillMaxCooldown: number;
}

export interface MolecularProjectile {
  id: number;
  ownerId: 1 | 2;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  crit: boolean;
  life: number;
  maxLife: number;
  spinAngle: number;
  skillKind?: SmilesSkillId;
}

export type CombatEvent =
  | { type: 'swing'; fighterId: 1 | 2; heavy: boolean; x: number; y: number }
  | { type: 'throw'; fighterId: 1 | 2; x: number; y: number; dir: 1 | -1 }
  | { type: 'uppercut_start'; fighterId: 1 | 2; x: number; y: number }
  | { type: 'lunge_start'; fighterId: 1 | 2; x: number; y: number; dir: 1 | -1 }
  | { type: 'projectile_shatter'; ownerId: 1 | 2; x: number; y: number }
  | {
      type: 'hit';
      attackerId: 1 | 2;
      defenderId: 1 | 2;
      damage: number;
      heavy: boolean;
      crit: boolean;
      special: boolean;
      x: number;
      y: number;
      dir: 1 | -1;
    }
  | { type: 'block'; defenderId: 1 | 2; damage: number; x: number; y: number }
  | { type: 'jump'; fighterId: 1 | 2; x: number; y: number }
  | { type: 'land'; fighterId: 1 | 2; x: number; y: number }
  | { type: 'dash'; fighterId: 1 | 2; x: number; y: number; dir: 1 | -1 }
  | { type: 'special_start'; fighterId: 1 | 2; x: number; y: number }
  | {
      type: 'smiles_skill';
      fighterId: 1 | 2;
      skillId: SmilesSkillId;
      skillName: string;
      color: string;
      healed?: number;
      x: number;
      y: number;
      dir: 1 | -1;
    }
  | { type: 'powerup_spawn'; powerUpType: PowerUpType; x: number; y: number }
  | { type: 'powerup_pickup'; fighterId: 1 | 2; powerUpType: PowerUpType; x: number; y: number }
  | { type: 'hazard_spawn'; hazardType: HazardType; x: number; y: number }
  | { type: 'hazard_trigger'; hazardType: HazardType; x: number; y: number }
  | {
      type: 'hazard_hit';
      hazardType: HazardType;
      fighterId: 1 | 2;
      damage: number;
      blocked: boolean;
      x: number;
      y: number;
    }
  | { type: 'round_end'; winnerId: 1 | 2 | 0; reason: 'ko' | 'timeout' }
  | { type: 'match_end'; winnerId: 1 | 2 | 0 };

export interface MatchState {
  phase: 'round_intro' | 'fighting' | 'round_ko' | 'match_over';
  stageId: ArenaStageId;
  roundNumber: number;
  roundTimer: number;
  phaseTimer: number;
  hitstopTimer: number;
  cameraTrauma: number;
  playMode: PlayMode;
  difficulty: CpuDifficulty;
  p1: FighterState;
  p2: FighterState;
  projectiles: MolecularProjectile[];
  nextProjectileId: number;
  powerUps: ArenaPowerUp[];
  nextPowerUpId: number;
  powerUpSpawnTimer: number;
  hazards: ArenaHazard[];
  nextHazardId: number;
  hazardSpawnTimer: number;
  roundWinner: 1 | 2 | 0 | null;
  matchWinner: 1 | 2 | 0 | null;
}

export const ARENA_HALF_WIDTH = 10.6;
export const FLOOR_Y = -1.2;
export const GRAVITY = -34;
export const JUMP_VELOCITY = 13.6;

export function emptyBuffs(): FighterBuffs {
  return {
    lightning: 0,
    fist: 0,
    shrink: 0,
    tripleThrow: 0,
    giant: 0,
  };
}

export function getFighterBodyScale(f: Pick<FighterState, 'buffs'>): number {
  if (!f.buffs) return 1;
  if (f.buffs.giant > 0) return 1.38;
  if (f.buffs.shrink > 0) return 0.68;
  return 1.0;
}

export function getHealthPowerMultiplier(f: Pick<FighterState, 'hp' | 'maxHp'>): number {
  const maxHp = Math.max(1, f.maxHp);
  const ratio = Math.max(0, Math.min(1, f.hp / maxHp));
  return 0.4 + 0.6 * ratio;
}

export function emptyInput(): FighterInput {
  return {
    left: false,
    right: false,
    jumpJustPressed: false,
    crouch: false,
    punchJustPressed: false,
    kickJustPressed: false,
    specialJustPressed: false,
    skillJustPressed: false,
    dashJustPressed: false,
    blockHeld: false,
  };
}

const DEFAULT_SKILL = {
  id: 'aromatic_burst' as SmilesSkillId,
  name: 'Cộng Hưởng Thơm',
  accentHex: '#38bdf8',
  cooldown: 5.5,
};

export function createFighterState(
  id: 1 | 2,
  name: string,
  formula: string,
  stats: Pick<MoleculeStats, 'hp' | 'atk' | 'def' | 'spd' | 'crit'> & {
    skill?: MoleculeStats['skill'];
  }
): FighterState {
  const skill = stats.skill ?? DEFAULT_SKILL;
  return {
    id,
    name,
    formula,
    x: id === 1 ? -5.2 : 5.2,
    y: FLOOR_Y,
    vx: 0,
    vy: 0,
    facing: id === 1 ? 1 : -1,
    onGround: true,
    hp: stats.hp,
    maxHp: stats.hp,
    ghostHp: stats.hp,
    energy: 10,
    atk: stats.atk,
    def: stats.def,
    spd: stats.spd,
    crit: stats.crit,
    state: 'idle',
    stateTimer: 0,
    stateDuration: 0,
    hitRegistered: false,
    dashCooldown: 0,
    throwCooldown: 0,
    hasWeaponInHand: true,
    koElapsed: 0,
    flashTimer: 0,
    comboCount: 0,
    comboResetTimer: 0,
    walkDistance: 0,
    squashX: 1,
    squashY: 1,
    roundsWon: 0,
    damageDealt: 0,
    maxCombo: 0,
    hitsLanded: 0,
    blocksLanded: 0,
    aiThinkTimer: 0,
    aiActionCooldown: 0.4,
    aiMoveDir: 0,
    buffs: emptyBuffs(),
    skillId: skill.id,
    skillName: skill.name,
    skillColor: skill.accentHex,
    skillCooldown: 0,
    skillMaxCooldown: skill.cooldown,
  };
}

export function createMatchState(
  p1Info: {
    name: string;
    formula: string;
    stats: Pick<MoleculeStats, 'hp' | 'atk' | 'def' | 'spd' | 'crit'> & {
      skill?: MoleculeStats['skill'];
    };
  },
  p2Info: {
    name: string;
    formula: string;
    stats: Pick<MoleculeStats, 'hp' | 'atk' | 'def' | 'spd' | 'crit'> & {
      skill?: MoleculeStats['skill'];
    };
  },
  playMode: PlayMode,
  difficulty: CpuDifficulty,
  stageId: ArenaStageId = 'cell'
): MatchState {
  return {
    phase: 'round_intro',
    stageId,
    roundNumber: 1,
    roundTimer: 99,
    phaseTimer: 1.05,
    hitstopTimer: 0,
    cameraTrauma: 0,
    playMode,
    difficulty,
    p1: createFighterState(1, p1Info.name, p1Info.formula, p1Info.stats),
    p2: createFighterState(2, p2Info.name, p2Info.formula, p2Info.stats),
    projectiles: [],
    nextProjectileId: 1,
    powerUps: [],
    nextPowerUpId: 1,
    powerUpSpawnTimer: 2.4,
    hazards: [],
    nextHazardId: 1,
    hazardSpawnTimer: 4.0,
    roundWinner: null,
    matchWinner: null,
  };
}

export function resetForNextRound(match: MatchState): void {
  const resetFighter = (f: FighterState, id: 1 | 2) => {
    f.x = id === 1 ? -5.2 : 5.2;
    f.y = FLOOR_Y;
    f.vx = 0;
    f.vy = 0;
    f.facing = id === 1 ? 1 : -1;
    f.onGround = true;
    f.hp = f.maxHp;
    f.ghostHp = f.maxHp;
    f.energy = Math.max(10, Math.floor(f.energy * 0.4));
    f.state = 'idle';
    f.stateTimer = 0;
    f.stateDuration = 0;
    f.hitRegistered = false;
    f.dashCooldown = 0;
    f.throwCooldown = 0;
    f.hasWeaponInHand = true;
    f.koElapsed = 0;
    f.flashTimer = 0;
    f.comboCount = 0;
    f.comboResetTimer = 0;
    f.squashX = 1;
    f.squashY = 1;
    f.buffs = emptyBuffs();
    f.skillCooldown = 0;
  };
  resetFighter(match.p1, 1);
  resetFighter(match.p2, 2);
  match.projectiles = [];
  match.powerUps = [];
  match.powerUpSpawnTimer = 2.4;
  match.hazards = [];
  match.hazardSpawnTimer = 4.0;
  match.roundNumber += 1;
  match.roundTimer = 99;
  match.phase = 'round_intro';
  match.phaseTimer = 1.05;
  match.hitstopTimer = 0;
  match.roundWinner = null;
}

function isAttackState(s: FighterActionState): boolean {
  return (
    s === 'punch_windup' ||
    s === 'punch_active' ||
    s === 'punch_recovery' ||
    s === 'kick_windup' ||
    s === 'kick_active' ||
    s === 'kick_recovery' ||
    s === 'throw_windup' ||
    s === 'throw_recovery' ||
    s === 'uppercut_windup' ||
    s === 'uppercut_active' ||
    s === 'uppercut_recovery' ||
    s === 'lunge_windup' ||
    s === 'lunge_active' ||
    s === 'lunge_recovery' ||
    s === 'special_windup' ||
    s === 'special_active' ||
    s === 'special_recovery' ||
    s === 'skill_windup' ||
    s === 'skill_active' ||
    s === 'skill_recovery'
  );
}

function canAcceptAction(f: FighterState): boolean {
  return f.state === 'idle' || f.state === 'walk' || f.state === 'crouch' || f.state === 'jump';
}

export function computeCpuInput(
  bot: FighterState,
  target: FighterState,
  difficulty: CpuDifficulty,
  dt: number,
  rng: () => number = Math.random
): FighterInput {
  const inp = emptyInput();
  const dx = target.x - bot.x;
  const dist = Math.abs(dx);
  const dirToTarget: -1 | 1 = dx >= 0 ? 1 : -1;

  bot.aiThinkTimer -= dt;
  bot.aiActionCooldown = Math.max(0, bot.aiActionCooldown - dt);

  const blockChance = difficulty === 'easy' ? 0.12 : difficulty === 'normal' ? 0.28 : 0.56;
  const aggroRate = difficulty === 'easy' ? 0.34 : difficulty === 'normal' ? 0.56 : 0.82;
  const preferredDist = difficulty === 'easy' ? 2.75 : difficulty === 'normal' ? 2.25 : 1.95;

  // React to opponent's active or windup attack
  if (isAttackState(target.state) && dist < 3.1 && bot.aiActionCooldown <= 0.2) {
    if (rng() < blockChance) {
      inp.blockHeld = true;
      return inp;
    }
  }

  if (bot.aiThinkTimer <= 0) {
    bot.aiThinkTimer = difficulty === 'easy' ? 0.45 : difficulty === 'normal' ? 0.28 : 0.15;
    if (dist > preferredDist + 0.35) {
      bot.aiMoveDir = dirToTarget;
    } else if (dist < 1.5 && rng() < 0.5) {
      bot.aiMoveDir = (dirToTarget * -1) as -1 | 1;
    } else {
      bot.aiMoveDir = rng() < 0.52 ? dirToTarget : 0;
    }

    // Hard AI dashes into range when separated
    if (difficulty !== 'easy' && dist > 4.0 && bot.dashCooldown <= 0 && rng() < (difficulty === 'hard' ? 0.42 : 0.16)) {
      inp.dashJustPressed = true;
    }

    // Occasional jump over pressure or anti-air
    if (bot.onGround && !target.onGround && difficulty === 'hard' && dist < 2.8 && rng() < 0.35) {
      inp.jumpJustPressed = true;
    } else if (bot.onGround && dist > 3.4 && rng() < 0.06) {
      inp.jumpJustPressed = true;
    }
  }

  if (bot.aiMoveDir === -1) inp.left = true;
  if (bot.aiMoveDir === 1) inp.right = true;

  if (bot.aiActionCooldown <= 0 && canAcceptAction(bot)) {
    const roll = rng();
    if (bot.energy >= 100 && dist < 3.5 && roll < (difficulty === 'hard' ? 0.78 : 0.38)) {
      inp.specialJustPressed = true;
      bot.aiActionCooldown = 1.1;
    } else if (
      difficulty !== 'easy' &&
      bot.skillCooldown <= 0 &&
      ((bot.skillId === 'phenol_shield' && bot.hp < bot.maxHp * 0.75) ||
        ((bot.skillId === 'aromatic_burst' ||
          bot.skillId === 'sulfur_cage' ||
          bot.skillId === 'halogen_corrode') &&
          dist >= 2.2 &&
          dist <= 8.5) ||
        ((bot.skillId === 'alkaloid_surge' || bot.skillId === 'carbonyl_chain') && dist <= 4.2)) &&
      roll < (difficulty === 'hard' ? 0.35 : 0.18)
    ) {
      inp.skillJustPressed = true;
      bot.aiActionCooldown = 1.0;
    } else if (
      difficulty !== 'easy' &&
      dist >= 3.2 &&
      dist <= 7.2 &&
      bot.throwCooldown <= 0 &&
      bot.hasWeaponInHand &&
      roll < (difficulty === 'hard' ? 0.32 : 0.16)
    ) {
      // CPU executes Forward + Punch combo to hurl molecular weapon
      inp.left = dirToTarget === -1;
      inp.right = dirToTarget === 1;
      inp.punchJustPressed = true;
      bot.aiActionCooldown = difficulty === 'hard' ? 1.15 : 1.5;
    } else if (dist < 2.85) {
      if (roll < aggroRate) {
        if (dist < 2.4 && rng() < 0.58) {
          inp.punchJustPressed = true;
          bot.aiActionCooldown = difficulty === 'easy' ? 1.15 : difficulty === 'normal' ? 0.74 : 0.44;
        } else {
          inp.kickJustPressed = true;
          bot.aiActionCooldown = difficulty === 'easy' ? 1.32 : difficulty === 'normal' ? 0.88 : 0.54;
        }
      } else {
        bot.aiActionCooldown = difficulty === 'easy' ? 0.55 : 0.36;
      }
    }
  }

  return inp;
}

function setFighterPhase(f: FighterState, state: FighterActionState, duration: number): void {
  f.state = state;
  f.stateTimer = duration;
  f.stateDuration = duration;
}

function stepSingleFighter(
  match: MatchState,
  f: FighterState,
  opp: FighterState,
  input: FighterInput,
  dt: number,
  events: CombatEvent[],
  rng: () => number
): void {
  f.dashCooldown = Math.max(0, f.dashCooldown - dt);
  f.throwCooldown = Math.max(0, f.throwCooldown - dt);
  f.skillCooldown = Math.max(0, f.skillCooldown - dt);
  f.flashTimer = Math.max(0, f.flashTimer - dt);
  if (f.buffs) {
    f.buffs.lightning = Math.max(0, f.buffs.lightning - dt);
    f.buffs.fist = Math.max(0, f.buffs.fist - dt);
    f.buffs.shrink = Math.max(0, f.buffs.shrink - dt);
    f.buffs.tripleThrow = Math.max(0, f.buffs.tripleThrow - dt);
    f.buffs.giant = Math.max(0, f.buffs.giant - dt);
  }
  if (f.comboResetTimer > 0) {
    f.comboResetTimer -= dt;
    if (f.comboResetTimer <= 0) f.comboCount = 0;
  }

  // Trailing damage ghost HP bar
  if (f.ghostHp > f.hp) {
    f.ghostHp = Math.max(f.hp, f.ghostHp - 58 * dt);
  } else {
    f.ghostHp = f.hp;
  }

  // Exponentially relax squash & stretch back to 1.0
  const relax = 1 - Math.exp(-14 * dt);
  f.squashX += (1 - f.squashX) * relax;
  f.squashY += (1 - f.squashY) * relax;

  if (f.state === 'ko') {
    f.koElapsed += dt;
    f.vx *= Math.pow(0.05, dt);
    if (!f.onGround) {
      f.vy += GRAVITY * dt;
      f.y += f.vy * dt;
      if (f.y <= FLOOR_Y) {
        f.y = FLOOR_Y;
        f.vy = 0;
        f.onGround = true;
      }
    }
    return;
  }

  // Face opponent when not locked mid-attack or dashing
  if (canAcceptAction(f) || f.state === 'block') {
    f.facing = f.x <= opp.x ? 1 : -1;
  }

  const isForwardHeld = (f.facing === 1 && input.right) || (f.facing === -1 && input.left);

  // Forgiving chord-upgrade window: if J/K is pressed a few frames before D/S, upgrade windup into combo move
  if (f.state === 'punch_windup' && isForwardHeld && f.throwCooldown <= 0 && f.hasWeaponInHand) {
    f.vx *= 0.25;
    setFighterPhase(f, 'throw_windup', 0.11);
  } else if (f.state === 'kick_windup' && input.crouch) {
    f.vx *= 0.2;
    setFighterPhase(f, 'uppercut_windup', 0.1);
  } else if (f.state === 'kick_windup' && isForwardHeld) {
    f.vx *= 0.3;
    setFighterPhase(f, 'lunge_windup', 0.11);
  }

  const atkSpeedMult = f.buffs?.lightning > 0 ? 1.55 : 1.0;
  const bodyScale = getFighterBodyScale(f);
  const healthPowerMult = getHealthPowerMultiplier(f);
  const dmgBuffMult =
    (f.buffs?.fist > 0 ? 1.5 : 1.0) * (f.buffs?.giant > 0 ? 1.28 : 1.0);
  const oppDefBuffMult = opp.buffs?.giant > 0 ? 0.82 : 1.0;

  // Advance timed state transitions (lightning buff speeds up attack windup/active/recovery)
  if (f.stateTimer > 0) {
    const timerRate = isAttackState(f.state) ? atkSpeedMult : 1.0;
    f.stateTimer -= dt * timerRate;
    if (f.stateTimer <= 0) {
      f.stateTimer = 0;
      if (f.state === 'punch_windup') {
        setFighterPhase(f, 'punch_active', 0.11);
        f.hitRegistered = false;
        events.push({ type: 'swing', fighterId: f.id, heavy: false, x: f.x, y: f.y + 1.1 * bodyScale });
      } else if (f.state === 'punch_active') {
        setFighterPhase(f, 'punch_recovery', 0.13);
      } else if (f.state === 'kick_windup') {
        setFighterPhase(f, 'kick_active', 0.13);
        f.hitRegistered = false;
        events.push({ type: 'swing', fighterId: f.id, heavy: true, x: f.x, y: f.y + 0.8 * bodyScale });
      } else if (f.state === 'kick_active') {
        setFighterPhase(f, 'kick_recovery', 0.18);
      } else if (f.state === 'throw_windup') {
        // Release the 3D molecular weapon from hand as 1 or 3 (if Dấu X buff active) projectiles
        f.hasWeaponInHand = false;
        f.throwCooldown = f.buffs?.lightning > 0 ? 0.65 : 0.95;
        const isCrit = rng() * 100 < f.crit;
        const defMit = 1 - Math.min(0.28, opp.def * 0.008);
        const dmg = Math.max(
          4,
          Math.round(
            f.atk * 1.15 * dmgBuffMult * healthPowerMult * oppDefBuffMult * (isCrit ? 1.35 : 1.0) * defMit
          )
        );
        const projX = f.x + f.facing * (0.95 * bodyScale);
        const projY = f.y + 1.55 * bodyScale;

        if (f.buffs?.tripleThrow > 0) {
          const spreads = [
            { yOff: 0.25, vx: 13.8, vy: 2.5 },
            { yOff: 0.0, vx: 14.8, vy: 0.15 },
            { yOff: -0.25, vx: 13.8, vy: -1.4 },
          ];
          for (const sp of spreads) {
            match.projectiles.push({
              id: match.nextProjectileId++,
              ownerId: f.id,
              x: projX,
              y: Math.max(FLOOR_Y + 0.45, projY + sp.yOff),
              vx: f.facing * sp.vx,
              vy: sp.vy,
              radius: 0.45,
              damage: dmg,
              crit: isCrit,
              life: 1.45,
              maxLife: 1.45,
              spinAngle: 0,
            });
          }
        } else {
          match.projectiles.push({
            id: match.nextProjectileId++,
            ownerId: f.id,
            x: projX,
            y: projY,
            vx: f.facing * 14.2,
            vy: 0,
            radius: 0.45,
            damage: dmg,
            crit: isCrit,
            life: 1.45,
            maxLife: 1.45,
            spinAngle: 0,
          });
        }
        f.squashX = 1.15;
        f.squashY = 0.88;
        setFighterPhase(f, 'throw_recovery', 0.18);
        events.push({ type: 'throw', fighterId: f.id, x: projX, y: projY, dir: f.facing });
      } else if (f.state === 'uppercut_windup') {
        setFighterPhase(f, 'uppercut_active', 0.16);
        f.hitRegistered = false;
        if (f.onGround) {
          f.vy = 6.2;
          f.onGround = false;
        }
        f.vx = f.facing * 2.2;
        events.push({ type: 'uppercut_start', fighterId: f.id, x: f.x, y: f.y + 1.2 });
      } else if (f.state === 'uppercut_active') {
        setFighterPhase(f, 'uppercut_recovery', 0.22);
      } else if (f.state === 'lunge_windup') {
        setFighterPhase(f, 'lunge_active', 0.18);
        f.hitRegistered = false;
        f.vx = f.facing * 11.2;
        events.push({ type: 'lunge_start', fighterId: f.id, x: f.x, y: f.y + 1.0, dir: f.facing });
      } else if (f.state === 'lunge_active') {
        setFighterPhase(f, 'lunge_recovery', 0.2);
        f.vx *= 0.35;
      } else if (f.state === 'special_windup') {
        setFighterPhase(f, 'special_active', 0.22);
        f.hitRegistered = false;
        f.vx = f.facing * 9.5;
        events.push({ type: 'special_start', fighterId: f.id, x: f.x, y: f.y + 1.1 });
      } else if (f.state === 'special_active') {
        setFighterPhase(f, 'special_recovery', 0.24);
        f.vx = 0;
      } else if (f.state === 'skill_windup') {
        setFighterPhase(f, 'skill_active', 0.22);
        f.hitRegistered = false;
        let healed: number | undefined;
        const projX = f.x + f.facing * (0.95 * bodyScale);
        const projY = f.y + 1.45 * bodyScale;
        const isCrit =
          f.skillId === 'aromatic_burst' || rng() * 100 < f.crit;
        const defMit = 1 - Math.min(0.28, opp.def * 0.008);

        if (
          f.skillId === 'aromatic_burst' ||
          f.skillId === 'sulfur_cage' ||
          f.skillId === 'halogen_corrode'
        ) {
          const mult =
            f.skillId === 'aromatic_burst'
              ? 1.48
              : f.skillId === 'halogen_corrode'
              ? 1.4
              : 1.32;
          const speed =
            f.skillId === 'halogen_corrode'
              ? 17.5
              : f.skillId === 'aromatic_burst'
              ? 15.6
              : 13.2;
          const projDmg = Math.max(
            6,
            Math.round(
              f.atk *
                mult *
                dmgBuffMult *
                healthPowerMult *
                oppDefBuffMult *
                (isCrit ? 1.3 : 1.0) *
                defMit
            )
          );
          match.projectiles.push({
            id: match.nextProjectileId++,
            ownerId: f.id,
            x: projX,
            y: projY,
            vx: f.facing * speed,
            vy: 0,
            radius: f.skillId === 'aromatic_burst' ? 0.72 : 0.66,
            damage: projDmg,
            crit: isCrit,
            life: 1.35,
            maxLife: 1.35,
            spinAngle: 0,
            skillKind: f.skillId,
          });
          f.vx = -f.facing * 1.8;
        } else if (f.skillId === 'alkaloid_surge') {
          f.vx = f.facing * 13.5;
          if (!f.buffs) f.buffs = emptyBuffs();
          f.buffs.lightning = Math.max(f.buffs.lightning, 4.0);
        } else if (f.skillId === 'phenol_shield') {
          const prevHp = f.hp;
          f.hp = Math.min(f.maxHp, f.hp + 28);
          healed = Math.max(0, Math.round(f.hp - prevHp));
          f.vx = 0;
        } else {
          // carbonyl_chain
          f.vx = f.facing * 9.2;
        }

        f.squashX = 1.18;
        f.squashY = 0.86;
        events.push({
          type: 'smiles_skill',
          fighterId: f.id,
          skillId: f.skillId,
          skillName: f.skillName,
          color: f.skillColor,
          healed,
          x: f.x,
          y: f.y + 1.4 * bodyScale,
          dir: f.facing,
        });
      } else if (f.state === 'skill_active') {
        setFighterPhase(f, 'skill_recovery', 0.18);
        f.vx *= 0.28;
      } else if (
        f.state === 'punch_recovery' ||
        f.state === 'kick_recovery' ||
        f.state === 'throw_recovery' ||
        f.state === 'uppercut_recovery' ||
        f.state === 'lunge_recovery' ||
        f.state === 'special_recovery' ||
        f.state === 'skill_recovery' ||
        f.state === 'dash' ||
        f.state === 'hitstun'
      ) {
        f.state = f.onGround ? 'idle' : 'jump';
      }
    }
  }

  // Handle player / AI actions when in a cancellable/ready state
  const speedBuffMult =
    (f.buffs?.lightning > 0 ? 1.15 : 1.0) * (f.buffs?.shrink > 0 ? 1.22 : 1.0);
  const moveSpeed = 5.4 * (f.spd / 105) * speedBuffMult;

  if (canAcceptAction(f)) {
    if (input.specialJustPressed && f.energy >= 100) {
      f.energy = 0;
      f.vx = 0;
      setFighterPhase(f, 'special_windup', 0.16);
    } else if (input.skillJustPressed && f.skillCooldown <= 0) {
      f.skillCooldown = f.skillMaxCooldown;
      f.vx *= 0.2;
      setFighterPhase(f, 'skill_windup', 0.11);
    } else if (input.dashJustPressed && f.dashCooldown <= 0) {
      const dashDir: 1 | -1 = input.left ? -1 : input.right ? 1 : f.facing;
      f.vx = dashDir * 13.5;
      f.dashCooldown = 0.65;
      setFighterPhase(f, 'dash', 0.16);
      f.squashX = 1.2;
      f.squashY = 0.84;
      events.push({ type: 'dash', fighterId: f.id, x: f.x, y: f.y + 0.8, dir: dashDir });
    } else if (input.punchJustPressed && isForwardHeld && f.throwCooldown <= 0 && f.hasWeaponInHand) {
      f.vx *= 0.25;
      setFighterPhase(f, 'throw_windup', 0.11);
    } else if (input.punchJustPressed) {
      f.vx *= 0.25;
      setFighterPhase(f, 'punch_windup', 0.08);
    } else if (input.kickJustPressed && input.crouch) {
      f.vx *= 0.2;
      setFighterPhase(f, 'uppercut_windup', 0.1);
    } else if (input.kickJustPressed && isForwardHeld) {
      f.vx *= 0.3;
      setFighterPhase(f, 'lunge_windup', 0.11);
    } else if (input.kickJustPressed) {
      f.vx *= 0.2;
      setFighterPhase(f, 'kick_windup', 0.12);
    } else if (input.blockHeld && f.onGround) {
      f.state = 'block';
      f.vx *= Math.pow(0.015, dt);
    } else if (input.crouch && f.onGround) {
      f.state = 'crouch';
      f.vx *= Math.pow(0.015, dt);
    } else {
      let targetVx = 0;
      if (input.left && !input.right) {
        targetVx = -moveSpeed;
        if (f.onGround) f.state = 'walk';
      } else if (input.right && !input.left) {
        targetVx = moveSpeed;
        if (f.onGround) f.state = 'walk';
      } else {
        if (f.onGround) f.state = 'idle';
      }
      const accelRate = targetVx !== 0 ? 28 : 24;
      f.vx += (targetVx - f.vx) * (1 - Math.exp(-accelRate * dt));
      if (Math.abs(f.vx) < 0.04 && targetVx === 0) f.vx = 0;

      if (input.jumpJustPressed && f.onGround) {
        f.vy = JUMP_VELOCITY;
        f.onGround = false;
        f.state = 'jump';
        f.squashX = 0.82;
        f.squashY = 1.24;
        events.push({ type: 'jump', fighterId: f.id, x: f.x, y: f.y });
      }
    }
  } else if (f.state === 'block') {
    if (!input.blockHeld) {
      f.state = f.onGround ? 'idle' : 'jump';
    }
    f.vx *= Math.pow(0.02, dt);
  } else if (f.state === 'hitstun') {
    f.vx *= Math.pow(0.04, dt);
  } else if (
    isAttackState(f.state) &&
    f.state !== 'special_active' &&
    f.state !== 'lunge_active' &&
    !(f.state === 'skill_active' && (f.skillId === 'alkaloid_surge' || f.skillId === 'carbonyl_chain'))
  ) {
    f.vx *= Math.pow(0.05, dt);
  }

  // Integrate horizontal & vertical physics
  const prevX = f.x;
  f.x += f.vx * dt;
  if (f.onGround && f.state === 'walk') {
    f.walkDistance += Math.abs(f.x - prevX);
  }

  if (!f.onGround) {
    f.vy += GRAVITY * dt;
    f.y += f.vy * dt;
    if (f.y <= FLOOR_Y) {
      f.y = FLOOR_Y;
      f.vy = 0;
      f.onGround = true;
      f.squashX = 1.24;
      f.squashY = 0.78;
      if (f.state === 'jump') f.state = 'idle';
      events.push({ type: 'land', fighterId: f.id, x: f.x, y: FLOOR_Y });
    }
  }

  // Clamp to arena bounds
  f.x = Math.max(-ARENA_HALF_WIDTH, Math.min(ARENA_HALF_WIDTH, f.x));

  // Check active attack hitboxes against opponent
  const activePunch = f.state === 'punch_active';
  const activeKick = f.state === 'kick_active';
  const activeUppercut = f.state === 'uppercut_active';
  const activeLunge = f.state === 'lunge_active';
  const activeSpecial = f.state === 'special_active';
  const activeMeleeSkill =
    f.state === 'skill_active' &&
    (f.skillId === 'alkaloid_surge' ||
      f.skillId === 'phenol_shield' ||
      f.skillId === 'carbonyl_chain');

  if (
    (activePunch ||
      activeKick ||
      activeUppercut ||
      activeLunge ||
      activeSpecial ||
      activeMeleeSkill) &&
    !f.hitRegistered
  ) {
    const baseReach = activeSpecial
      ? 3.2
      : activeMeleeSkill
      ? f.skillId === 'phenol_shield'
        ? 3.1
        : 3.05
      : activeLunge
      ? 2.85
      : activeKick
      ? 2.55
      : activeUppercut
      ? 2.35
      : 2.25;
    const oppScale = getFighterBodyScale(opp);
    const reach = baseReach * (bodyScale >= 1 ? 1 + (bodyScale - 1) * 0.72 : 0.88) + (oppScale - 1) * 0.35;
    const dx = opp.x - f.x;
    const dy = Math.abs(opp.y - f.y);
    const omniSkill = activeMeleeSkill && f.skillId === 'phenol_shield';
    const inFront = omniSkill
      ? Math.abs(dx) <= reach
      : dx * f.facing >= -0.45 && Math.abs(dx) <= reach;
    const vertReach = (activeUppercut || activeMeleeSkill ? 2.75 : 2.2) * (0.7 + oppScale * 0.35);

    if (inFront && dy < vertReach && opp.state !== 'ko') {
      f.hitRegistered = true;
      const isCrit = activeSpecial || rng() * 100 < f.crit;
      const baseMult = activeSpecial
        ? 2.15
        : activeMeleeSkill
        ? f.skillId === 'phenol_shield'
          ? 1.05
          : 1.45
        : activeUppercut
        ? 1.4
        : activeLunge
        ? 1.32
        : activeKick
        ? 1.32
        : 1.0;
      const critMult = isCrit && !activeSpecial ? 1.35 : 1.0;
      const defMitigation = 1 - Math.min(0.28, opp.def * 0.008);
      const rawDmg = Math.max(
        4,
        Math.round(f.atk * baseMult * dmgBuffMult * healthPowerMult * oppDefBuffMult * critMult * defMitigation)
      );

      const isBlocked = opp.state === 'block' && !activeSpecial;
      const hitDir: 1 | -1 = omniSkill ? (dx >= 0 ? 1 : -1) : f.facing;
      if (isBlocked) {
        const chip = Math.max(2, Math.round(rawDmg * 0.22));
        opp.hp = Math.max(0, opp.hp - chip);
        opp.vx = hitDir * 4.2;
        opp.blocksLanded += 1;
        opp.energy = Math.min(100, opp.energy + 10);
        f.energy = Math.min(100, f.energy + 8);
        f.damageDealt += chip;
        events.push({
          type: 'block',
          defenderId: opp.id,
          damage: chip,
          x: (f.x + opp.x) * 0.5,
          y: opp.y + 1.2,
        });
      } else {
        opp.hp = Math.max(0, opp.hp - rawDmg);
        opp.flashTimer = 0.075;
        opp.vx =
          hitDir *
          (activeSpecial
            ? 10.5
            : activeMeleeSkill && f.skillId === 'phenol_shield'
            ? 8.8
            : activeMeleeSkill
            ? 7.2
            : activeLunge
            ? 7.6
            : activeUppercut
            ? 3.5
            : activeKick
            ? 6.8
            : 4.2);
        if (activeSpecial || activeKick || activeUppercut || activeLunge || activeMeleeSkill) {
          opp.vy = activeSpecial
            ? 5.6
            : activeUppercut || (activeMeleeSkill && f.skillId === 'carbonyl_chain')
            ? 8.4
            : activeMeleeSkill
            ? 4.4
            : activeLunge
            ? 3.2
            : 2.8;
          opp.onGround = false;
        }
        opp.squashX = 0.78;
        opp.squashY = 1.22;

        if (opp.hp > 0) {
          setFighterPhase(
            opp,
            'hitstun',
            activeSpecial
              ? 0.34
              : activeMeleeSkill
              ? 0.3
              : activeUppercut
              ? 0.32
              : activeKick || activeLunge
              ? 0.24
              : 0.17
          );
        } else {
          opp.state = 'ko';
          opp.stateTimer = 0;
          opp.koElapsed = 0;
        }

        f.comboCount += 1;
        f.comboResetTimer = 1.65;
        f.maxCombo = Math.max(f.maxCombo, f.comboCount);
        f.hitsLanded += 1;
        f.damageDealt += rawDmg;
        f.energy = Math.min(100, f.energy + (activeSpecial ? 0 : activeKick || activeUppercut || activeLunge || activeMeleeSkill ? 14 : 10));
        opp.energy = Math.min(100, opp.energy + 9);

        events.push({
          type: 'hit',
          attackerId: f.id,
          defenderId: opp.id,
          damage: rawDmg,
          heavy: activeKick || activeUppercut || activeLunge || activeSpecial || activeMeleeSkill,
          crit: isCrit,
          special: activeSpecial,
          x: (f.x + opp.x) * 0.5,
          y: opp.y + 1.25,
          dir: hitDir,
        });
      }
    }
  }
}

function stepProjectiles(match: MatchState, dt: number, events: CombatEvent[]): void {
  const remaining: MolecularProjectile[] = [];
  for (let i = 0; i < match.projectiles.length; i++) {
    const p = match.projectiles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.spinAngle += 14 * dt;

    const owner = p.ownerId === 1 ? match.p1 : match.p2;
    const opp = p.ownerId === 1 ? match.p2 : match.p1;
    const oppScale = getFighterBodyScale(opp);
    const dir: 1 | -1 = p.vx >= 0 ? 1 : -1;

    // Keep fanned low projectile above floor line
    if (p.y < FLOOR_Y + 0.35 && p.vy < 0) {
      p.y = FLOOR_Y + 0.35;
      p.vy = Math.abs(p.vy) * 0.35;
    }

    // Check collision with opposing projectile
    let clashed = false;
    for (let j = i + 1; j < match.projectiles.length; j++) {
      const other = match.projectiles[j];
      if (other.ownerId !== p.ownerId && Math.abs(other.x - p.x) < 0.85 && Math.abs(other.y - p.y) < 0.85) {
        other.life = 0;
        clashed = true;
        events.push({ type: 'projectile_shatter', ownerId: p.ownerId, x: (p.x + other.x) * 0.5, y: p.y });
        break;
      }
    }
    if (clashed) {
      continue;
    }

    // Check hit against opponent (respecting shrink/giant hurtbox)
    const hitX = Math.abs(p.x - opp.x) <= 0.68 * oppScale + p.radius;
    const hitY = p.y >= opp.y + 0.12 && p.y <= opp.y + 2.55 * oppScale;
    if (hitX && hitY && opp.state !== 'ko' && match.phase === 'fighting') {
      const piercesBlock = p.skillKind === 'halogen_corrode';
      if (opp.state === 'block' && !piercesBlock) {
        const chip = Math.max(2, Math.round(p.damage * 0.24));
        opp.hp = Math.max(0, opp.hp - chip);
        opp.vx = dir * 4.2;
        opp.blocksLanded += 1;
        opp.energy = Math.min(100, opp.energy + 10);
        owner.energy = Math.min(100, owner.energy + 6);
        owner.damageDealt += chip;
        events.push({ type: 'block', defenderId: opp.id, damage: chip, x: p.x, y: p.y });
      } else {
        opp.hp = Math.max(0, opp.hp - p.damage);
        opp.flashTimer = 0.08;
        opp.vx = dir * (p.skillKind === 'aromatic_burst' ? 8.2 : 6.4);
        opp.vy = p.skillKind === 'aromatic_burst' ? 3.8 : 2.6;
        opp.onGround = false;
        opp.squashX = 0.78;
        opp.squashY = 1.22;
        if (opp.hp > 0) {
          const stunDuration = p.skillKind === 'sulfur_cage' ? 0.52 : p.skillKind === 'halogen_corrode' ? 0.34 : 0.22;
          setFighterPhase(opp, 'hitstun', stunDuration);
        } else {
          opp.state = 'ko';
          opp.stateTimer = 0;
          opp.koElapsed = 0;
        }
        owner.comboCount += 1;
        owner.comboResetTimer = 1.65;
        owner.maxCombo = Math.max(owner.maxCombo, owner.comboCount);
        owner.hitsLanded += 1;
        owner.damageDealt += p.damage;
        owner.energy = Math.min(100, owner.energy + 12);
        opp.energy = Math.min(100, opp.energy + 8);
        events.push({
          type: 'hit',
          attackerId: owner.id,
          defenderId: opp.id,
          damage: p.damage,
          heavy: true,
          crit: p.crit,
          special: Boolean(p.skillKind),
          x: p.x,
          y: p.y,
          dir,
        });
      }
      events.push({ type: 'projectile_shatter', ownerId: p.ownerId, x: p.x, y: p.y });
      continue;
    }

    if (p.life <= 0 || Math.abs(p.x) > ARENA_HALF_WIDTH + 0.65) {
      events.push({ type: 'projectile_shatter', ownerId: p.ownerId, x: p.x, y: p.y });
      continue;
    }

    remaining.push(p);
  }
  match.projectiles = remaining;

  // Restore weapon in hand once all regular thrown weapon projectiles finish
  for (const fighter of [match.p1, match.p2]) {
    if (
      !fighter.hasWeaponInHand &&
      !match.projectiles.some((pr) => pr.ownerId === fighter.id && !pr.skillKind)
    ) {
      fighter.hasWeaponInHand = true;
    }
  }
}

function applyPowerUpBuff(f: FighterState, type: PowerUpType): void {
  if (!f.buffs) f.buffs = emptyBuffs();
  if (type === 'lightning') {
    f.buffs.lightning = 8.0;
  } else if (type === 'fist') {
    f.buffs.fist = 8.0;
  } else if (type === 'shrink') {
    f.buffs.shrink = 8.0;
    f.buffs.giant = 0;
  } else if (type === 'triple_throw') {
    f.buffs.tripleThrow = 10.0;
  } else if (type === 'giant') {
    f.buffs.giant = 8.0;
    f.buffs.shrink = 0;
  }
}

function stepPowerUps(
  match: MatchState,
  dt: number,
  events: CombatEvent[],
  rng: () => number
): void {
  // Spawn a random functional power-up every 2 to 4 seconds during active fighting
  if (match.phase === 'fighting') {
    match.powerUpSpawnTimer -= dt;
    if (match.powerUpSpawnTimer <= 0) {
      match.powerUpSpawnTimer = 2.0 + rng() * 2.0;
      if (match.powerUps.length < 4) {
        const idx = Math.min(POWERUP_TYPES.length - 1, Math.floor(rng() * POWERUP_TYPES.length));
        const powerUpType = POWERUP_TYPES[idx];
        const spawnX = (rng() * 2 - 1) * (ARENA_HALF_WIDTH - 2.0);
        const spawnY = FLOOR_Y + 7.4;
        match.powerUps.push({
          id: match.nextPowerUpId++,
          type: powerUpType,
          x: spawnX,
          y: spawnY,
          vy: -2.0,
          onGround: false,
          life: 11.0,
          maxLife: 11.0,
          bobPhase: rng() * Math.PI * 2,
        });
        events.push({ type: 'powerup_spawn', powerUpType, x: spawnX, y: spawnY });
      }
    }
  }

  const remaining: ArenaPowerUp[] = [];
  const floorRestY = FLOOR_Y + 0.52;

  for (let i = 0; i < match.powerUps.length; i++) {
    const item = match.powerUps[i];
    item.life -= dt;
    if (item.life <= 0) continue;

    if (!item.onGround) {
      item.vy += GRAVITY * 0.24 * dt;
      item.y += item.vy * dt;
      if (item.y <= floorRestY) {
        item.y = floorRestY;
        if (Math.abs(item.vy) > 2.4) {
          item.vy = Math.abs(item.vy) * 0.34;
        } else {
          item.vy = 0;
          item.onGround = true;
        }
      }
    }

    // Check pickup collision with P1 / P2
    let pickedUp = false;
    if (match.phase === 'fighting') {
      for (const fighter of [match.p1, match.p2]) {
        if (fighter.state === 'ko' || fighter.hp <= 0) continue;
        const scale = getFighterBodyScale(fighter);
        const hitX = Math.abs(fighter.x - item.x) <= 0.85 * scale + 0.45;
        const hitY = item.y >= fighter.y - 0.15 && item.y <= fighter.y + 2.35 * scale + 0.45;
        if (hitX && hitY) {
          applyPowerUpBuff(fighter, item.type);
          events.push({
            type: 'powerup_pickup',
            fighterId: fighter.id,
            powerUpType: item.type,
            x: item.x,
            y: item.y,
          });
          pickedUp = true;
          break;
        }
      }
    }

    if (!pickedUp) {
      remaining.push(item);
    }
  }

  match.powerUps = remaining;
}

export function getHazardTypeForStage(stageId: ArenaStageId): HazardType {
  if (stageId === 'flask') return 'stir_bar';
  if (stageId === 'bloodstream') return 'leukocyte_drop';
  if (stageId === 'receptor') return 'receptor_competition';
  return 'enzyme_attack';
}

function createStageHazard(match: MatchState, rng: () => number): ArenaHazard {
  const id = match.nextHazardId++;
  const type = getHazardTypeForStage(match.stageId);
  const seed = rng();

  if (type === 'stir_bar') {
    // Bình cầu: Cá từ quay dưới chân gây sát thương (nhảy lên để né)
    const target = rng() < 0.5 ? match.p1.x : match.p2.x;
    const jitter = (rng() * 2 - 1) * 1.6;
    const x = Math.max(-ARENA_HALF_WIDTH + 2.0, Math.min(ARENA_HALF_WIDTH - 2.0, target + jitter));
    return {
      id,
      type,
      stageId: match.stageId,
      phase: 'telegraph',
      x,
      y: FLOOR_Y,
      vx: (seed < 0.5 ? 1 : -1) * 3.4,
      vy: 0,
      radius: 1.55,
      height: 0.48,
      damage: 14,
      timer: 0.9,
      duration: 0.9,
      hitP1: false,
      hitP2: false,
      seed,
    };
  }

  if (type === 'leukocyte_drop') {
    // Mạch máu: Bạch cầu từ phía trên lao xuống tấn công
    const target = rng() < 0.5 ? match.p1.x : match.p2.x;
    const jitter = (rng() * 2 - 1) * 1.1;
    const x = Math.max(-ARENA_HALF_WIDTH + 1.4, Math.min(ARENA_HALF_WIDTH - 1.4, target + jitter));
    return {
      id,
      type,
      stageId: match.stageId,
      phase: 'telegraph',
      x,
      y: FLOOR_Y + 5.7,
      vx: 0,
      vy: -9.2,
      radius: 0.86,
      height: 1.35,
      damage: 15,
      timer: 0.82,
      duration: 0.82,
      hitP1: false,
      hitP2: false,
      seed,
    };
  }

  if (type === 'receptor_competition') {
    // Đích tác động: Bị cạnh tranh thụ thể (phân tử đối vận tranh chấp vị trí gắn & đẩy bật)
    const target = rng() < 0.5 ? match.p1.x : match.p2.x;
    const jitter = (rng() * 2 - 1) * 1.3;
    const x = Math.max(-ARENA_HALF_WIDTH + 1.5, Math.min(ARENA_HALF_WIDTH - 1.5, target + jitter));
    return {
      id,
      type,
      stageId: match.stageId,
      phase: 'telegraph',
      x,
      y: FLOOR_Y,
      vx: 0,
      vy: 0,
      radius: 1.28,
      height: 2.75,
      damage: 15,
      timer: 0.92,
      duration: 0.92,
      hitP1: false,
      hitP2: false,
      seed,
    };
  }

  // 'cell' -> Tế bào: Bị enzyme tấn công (quét ngang & lao theo sóng sinh học)
  const fromLeft = rng() < 0.5;
  const x = fromLeft ? -ARENA_HALF_WIDTH + 1.0 : ARENA_HALF_WIDTH - 1.0;
  return {
    id,
    type,
    stageId: match.stageId,
    phase: 'telegraph',
    x,
    y: FLOOR_Y + 0.72,
    vx: fromLeft ? 6.2 : -6.2,
    vy: 0,
    radius: 0.72,
    height: 1.25,
    damage: 13,
    timer: 0.78,
    duration: 0.78,
    hitP1: false,
    hitP2: false,
    seed,
  };
}

function stepHazards(
  match: MatchState,
  dt: number,
  events: CombatEvent[],
  rng: () => number
): void {
  if (match.phase === 'fighting') {
    match.hazardSpawnTimer -= dt;
    if (match.hazardSpawnTimer <= 0) {
      match.hazardSpawnTimer = 4.6 + rng() * 2.4;
      if (match.hazards.length < 3) {
        const h = createStageHazard(match, rng);
        match.hazards.push(h);
        events.push({ type: 'hazard_spawn', hazardType: h.type, x: h.x, y: h.y });
      }
    }
  }

  const remaining: ArenaHazard[] = [];
  for (let i = 0; i < match.hazards.length; i++) {
    const h = match.hazards[i];
    h.timer -= dt;

    if (h.phase === 'telegraph') {
      if (h.timer <= 0) {
        h.phase = 'active';
        const activeDuration =
          h.type === 'enzyme_attack'
            ? 2.85
            : h.type === 'stir_bar'
            ? 1.45
            : h.type === 'leukocyte_drop'
            ? 1.15
            : 0.65;
        h.timer = activeDuration;
        h.duration = activeDuration;
        events.push({ type: 'hazard_trigger', hazardType: h.type, x: h.x, y: h.y });
      }
      remaining.push(h);
      continue;
    }

    // Active hazard motion
    if (h.type === 'enzyme_attack') {
      h.x += h.vx * dt;
      const wave = Math.abs(Math.sin((h.duration - h.timer) * 4.2 + h.seed * 6));
      h.y = FLOOR_Y + 0.58 + wave * 1.15;
      if (h.x < -ARENA_HALF_WIDTH + 0.6) {
        h.x = -ARENA_HALF_WIDTH + 0.6;
        h.vx = Math.abs(h.vx);
      } else if (h.x > ARENA_HALF_WIDTH - 0.6) {
        h.x = ARENA_HALF_WIDTH - 0.6;
        h.vx = -Math.abs(h.vx);
      }
    } else if (h.type === 'stir_bar') {
      // Sweeps & spins beneath fighters' feet on the flask floor
      h.x += h.vx * dt;
      if (h.x < -ARENA_HALF_WIDTH + 1.6) {
        h.x = -ARENA_HALF_WIDTH + 1.6;
        h.vx = Math.abs(h.vx);
      } else if (h.x > ARENA_HALF_WIDTH - 1.6) {
        h.x = ARENA_HALF_WIDTH - 1.6;
        h.vx = -Math.abs(h.vx);
      }
    } else if (h.type === 'leukocyte_drop') {
      // Dives from above down onto the bloodstream floor
      h.y += h.vy * dt;
      if (h.y <= FLOOR_Y + 0.45) {
        h.y = FLOOR_Y + 0.45;
        h.vy = 0;
      }
    }

    // Contact collision with fighters during active phase
    if (match.phase === 'fighting') {
      for (const fighter of [match.p1, match.p2]) {
        if (fighter.state === 'ko' || fighter.hp <= 0) continue;
        const alreadyHit = fighter.id === 1 ? h.hitP1 : h.hitP2;
        if (alreadyHit) continue;

        const scale = getFighterBodyScale(fighter);
        const fHalfW = 0.58 * scale;
        const fHeight = (fighter.state === 'crouch' ? 1.55 : 2.35) * scale;

        const overlapX = Math.abs(fighter.x - h.x) <= fHalfW + h.radius;
        const overlapY =
          fighter.y <= h.y + h.height && fighter.y + fHeight >= h.y - 0.12;

        if (overlapX && overlapY) {
          if (fighter.id === 1) h.hitP1 = true;
          else h.hitP2 = true;

          const blocked = fighter.state === 'block';
          const defMult = fighter.buffs && fighter.buffs.giant > 0 ? 0.82 : 1.0;
          const rawDmg = Math.max(4, Math.round(h.damage * defMult));
          const dmg = blocked ? Math.max(2, Math.round(rawDmg * 0.25)) : rawDmg;

          fighter.hp = Math.max(0, fighter.hp - dmg);
          fighter.flashTimer = 0.09;

          const pushDir: 1 | -1 =
            h.vx !== 0 ? (h.vx > 0 ? 1 : -1) : fighter.x >= h.x ? 1 : -1;

          if (blocked) {
            fighter.vx = pushDir * 3.4;
            fighter.blocksLanded += 1;
            fighter.energy = Math.min(100, fighter.energy + 6);
          } else {
            fighter.vx = pushDir * (h.type === 'receptor_competition' ? 6.8 : 5.4);
            fighter.vy =
              h.type === 'stir_bar'
                ? 4.7
                : h.type === 'receptor_competition'
                ? 4.9
                : 3.9;
            fighter.onGround = false;
            fighter.squashX = 0.78;
            fighter.squashY = 1.24;
            if (fighter.hp > 0) {
              setFighterPhase(fighter, 'hitstun', 0.22);
            } else {
              fighter.state = 'ko';
              fighter.stateTimer = 0;
              fighter.koElapsed = 0;
            }
            match.cameraTrauma = Math.min(1, match.cameraTrauma + 0.34);
          }

          events.push({
            type: 'hazard_hit',
            hazardType: h.type,
            fighterId: fighter.id,
            damage: dmg,
            blocked,
            x: fighter.x,
            y: fighter.y + 1.35 * scale,
          });
        }
      }
    }

    if (h.timer > 0) {
      remaining.push(h);
    }
  }

  match.hazards = remaining;
}

function resolveFighterPushApart(p1: FighterState, p2: FighterState): void {
  if (p1.state === 'ko' || p2.state === 'ko') return;
  const minGap = 1.38;
  const dx = p2.x - p1.x;
  const dy = Math.abs(p2.y - p1.y);
  if (Math.abs(dx) < minGap && dy < 1.6) {
    const push = (minGap - Math.abs(dx)) * 0.5;
    const sign = dx >= 0 ? 1 : -1;
    p1.x = Math.max(-ARENA_HALF_WIDTH, Math.min(ARENA_HALF_WIDTH, p1.x - sign * push));
    p2.x = Math.max(-ARENA_HALF_WIDTH, Math.min(ARENA_HALF_WIDTH, p2.x + sign * push));
  }
}

export function stepMatch(
  match: MatchState,
  p1Input: FighterInput,
  p2RawInput: FighterInput,
  rawDt: number,
  rng: () => number = Math.random
): CombatEvent[] {
  const dt = Math.min(rawDt, 0.05);
  const events: CombatEvent[] = [];

  // Decay camera trauma in real time
  match.cameraTrauma = Math.max(0, match.cameraTrauma - dt * 2.2);

  // Hitstop freezes physics briefly while flashes & trauma decay
  if (match.hitstopTimer > 0) {
    match.hitstopTimer = Math.max(0, match.hitstopTimer - dt);
    match.p1.flashTimer = Math.max(0, match.p1.flashTimer - dt);
    match.p2.flashTimer = Math.max(0, match.p2.flashTimer - dt);
    return events;
  }

  if (match.phase === 'round_intro') {
    match.phaseTimer -= dt;
    if (match.phaseTimer <= 0) {
      match.phase = 'fighting';
      match.phaseTimer = 0;
    }
    return events;
  }

  if (match.phase === 'round_ko') {
    // Still let KO'd fighter decompose/settle and active projectiles expire
    stepSingleFighter(match, match.p1, match.p2, emptyInput(), dt, events, rng);
    stepSingleFighter(match, match.p2, match.p1, emptyInput(), dt, events, rng);
    stepProjectiles(match, dt, events);
    match.phaseTimer -= dt;
    if (match.phaseTimer <= 0) {
      if (match.p1.roundsWon >= 2 || match.p2.roundsWon >= 2 || match.roundNumber >= 3) {
        match.phase = 'match_over';
        match.matchWinner =
          match.p1.roundsWon > match.p2.roundsWon
            ? 1
            : match.p2.roundsWon > match.p1.roundsWon
            ? 2
            : 0;
        events.push({ type: 'match_end', winnerId: match.matchWinner });
      } else {
        resetForNextRound(match);
      }
    }
    return events;
  }

  if (match.phase === 'match_over') {
    // Keep advancing koElapsed so chemical decomposition completes smoothly on gameover
    if (match.p1.state === 'ko') match.p1.koElapsed += dt;
    if (match.p2.state === 'ko') match.p2.koElapsed += dt;
    return events;
  }

  // Active fighting phase
  const p2Input =
    match.playMode === '1p'
      ? computeCpuInput(match.p2, match.p1, match.difficulty, dt, rng)
      : p2RawInput;

  stepSingleFighter(match, match.p1, match.p2, p1Input, dt, events, rng);
  stepSingleFighter(match, match.p2, match.p1, p2Input, dt, events, rng);
  stepProjectiles(match, dt, events);
  stepPowerUps(match, dt, events, rng);
  stepHazards(match, dt, events, rng);
  resolveFighterPushApart(match.p1, match.p2);

  // Hitstop & camera trauma triggers from hit events
  for (const ev of events) {
    if (ev.type === 'hit') {
      match.hitstopTimer = Math.max(match.hitstopTimer, ev.special ? 0.08 : ev.heavy ? 0.055 : 0.032);
      match.cameraTrauma = Math.min(1, match.cameraTrauma + (ev.special ? 0.72 : ev.heavy ? 0.44 : 0.24));
    } else if (ev.type === 'block') {
      match.hitstopTimer = Math.max(match.hitstopTimer, 0.024);
      match.cameraTrauma = Math.min(1, match.cameraTrauma + 0.14);
    }
  }

  // Round timer
  match.roundTimer = Math.max(0, match.roundTimer - dt);

  // Check KO or Timeout
  if (match.p1.hp <= 0 || match.p2.hp <= 0) {
    let winnerId: 1 | 2 | 0 = 0;
    if (match.p1.hp <= 0 && match.p2.hp > 0) {
      winnerId = 2;
      match.p2.roundsWon += 1;
    } else if (match.p2.hp <= 0 && match.p1.hp > 0) {
      winnerId = 1;
      match.p1.roundsWon += 1;
    }
    match.roundWinner = winnerId;
    match.phase = 'round_ko';
    match.phaseTimer = 1.65;
    match.hitstopTimer = 0.09;
    match.cameraTrauma = 0.85;
    events.push({ type: 'round_end', winnerId, reason: 'ko' });
  } else if (match.roundTimer <= 0) {
    const p1Pct = match.p1.hp / match.p1.maxHp;
    const p2Pct = match.p2.hp / match.p2.maxHp;
    const winnerId: 1 | 2 | 0 = p1Pct > p2Pct ? 1 : p2Pct > p1Pct ? 2 : 0;
    if (winnerId === 1) match.p1.roundsWon += 1;
    else if (winnerId === 2) match.p2.roundsWon += 1;
    match.roundWinner = winnerId;
    match.phase = 'round_ko';
    match.phaseTimer = 1.5;
    events.push({ type: 'round_end', winnerId, reason: 'timeout' });
  }

  return events;
}
