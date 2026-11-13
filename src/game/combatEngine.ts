import type { MoleculeStats } from '../chem/smilesEngine';

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
  | 'special_windup'
  | 'special_active'
  | 'special_recovery'
  | 'block'
  | 'hitstun'
  | 'ko';

export type CpuDifficulty = 'easy' | 'normal' | 'hard';
export type ColorSchemeMode = 'elemental' | 'rainbow' | 'bond';
export type PlayMode = '1p' | '2p';

export interface FighterInput {
  left: boolean;
  right: boolean;
  jumpJustPressed: boolean;
  crouch: boolean;
  punchJustPressed: boolean;
  kickJustPressed: boolean;
  specialJustPressed: boolean;
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
}

export type CombatEvent =
  | { type: 'swing'; fighterId: 1 | 2; heavy: boolean; x: number; y: number }
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
  | { type: 'round_end'; winnerId: 1 | 2 | 0; reason: 'ko' | 'timeout' }
  | { type: 'match_end'; winnerId: 1 | 2 | 0 };

export interface MatchState {
  phase: 'round_intro' | 'fighting' | 'round_ko' | 'match_over';
  roundNumber: number;
  roundTimer: number;
  phaseTimer: number;
  hitstopTimer: number;
  cameraTrauma: number;
  playMode: PlayMode;
  difficulty: CpuDifficulty;
  p1: FighterState;
  p2: FighterState;
  roundWinner: 1 | 2 | 0 | null;
  matchWinner: 1 | 2 | 0 | null;
}

export const ARENA_HALF_WIDTH = 6.8;
export const FLOOR_Y = -1.2;
export const GRAVITY = -34;
export const JUMP_VELOCITY = 13.6;

export function emptyInput(): FighterInput {
  return {
    left: false,
    right: false,
    jumpJustPressed: false,
    crouch: false,
    punchJustPressed: false,
    kickJustPressed: false,
    specialJustPressed: false,
    dashJustPressed: false,
    blockHeld: false,
  };
}

export function createFighterState(
  id: 1 | 2,
  name: string,
  formula: string,
  stats: Pick<MoleculeStats, 'hp' | 'atk' | 'def' | 'spd' | 'crit'>
): FighterState {
  return {
    id,
    name,
    formula,
    x: id === 1 ? -4.2 : 4.2,
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
  };
}

export function createMatchState(
  p1Info: { name: string; formula: string; stats: Pick<MoleculeStats, 'hp' | 'atk' | 'def' | 'spd' | 'crit'> },
  p2Info: { name: string; formula: string; stats: Pick<MoleculeStats, 'hp' | 'atk' | 'def' | 'spd' | 'crit'> },
  playMode: PlayMode,
  difficulty: CpuDifficulty
): MatchState {
  return {
    phase: 'round_intro',
    roundNumber: 1,
    roundTimer: 99,
    phaseTimer: 1.05,
    hitstopTimer: 0,
    cameraTrauma: 0,
    playMode,
    difficulty,
    p1: createFighterState(1, p1Info.name, p1Info.formula, p1Info.stats),
    p2: createFighterState(2, p2Info.name, p2Info.formula, p2Info.stats),
    roundWinner: null,
    matchWinner: null,
  };
}

export function resetForNextRound(match: MatchState): void {
  const resetFighter = (f: FighterState, id: 1 | 2) => {
    f.x = id === 1 ? -4.2 : 4.2;
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
    f.flashTimer = 0;
    f.comboCount = 0;
    f.comboResetTimer = 0;
    f.squashX = 1;
    f.squashY = 1;
  };
  resetFighter(match.p1, 1);
  resetFighter(match.p2, 2);
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
    s === 'special_windup' ||
    s === 'special_active' ||
    s === 'special_recovery'
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

  if (bot.aiActionCooldown <= 0 && dist < 2.85 && canAcceptAction(bot)) {
    const roll = rng();
    if (bot.energy >= 100 && dist < 3.5 && roll < (difficulty === 'hard' ? 0.78 : 0.38)) {
      inp.specialJustPressed = true;
      bot.aiActionCooldown = 1.1;
    } else if (roll < aggroRate) {
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

  return inp;
}

function setFighterPhase(f: FighterState, state: FighterActionState, duration: number): void {
  f.state = state;
  f.stateTimer = duration;
  f.stateDuration = duration;
}

function stepSingleFighter(
  f: FighterState,
  opp: FighterState,
  input: FighterInput,
  dt: number,
  events: CombatEvent[],
  rng: () => number
): void {
  f.dashCooldown = Math.max(0, f.dashCooldown - dt);
  f.flashTimer = Math.max(0, f.flashTimer - dt);
  if (f.comboResetTimer > 0) {
    f.comboResetTimer -= dt;
    if (f.comboResetTimer <= 0) f.comboCount = 0;
  }

  // Trailing damage ghost HP bar
  if (f.ghostHp > f.hp) {
    f.ghostHp = Math.max(f.hp, f.ghostHp - 38 * dt);
  } else {
    f.ghostHp = f.hp;
  }

  // Exponentially relax squash & stretch back to 1.0
  const relax = 1 - Math.exp(-14 * dt);
  f.squashX += (1 - f.squashX) * relax;
  f.squashY += (1 - f.squashY) * relax;

  if (f.state === 'ko') {
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

  // Advance timed state transitions
  if (f.stateTimer > 0) {
    f.stateTimer -= dt;
    if (f.stateTimer <= 0) {
      f.stateTimer = 0;
      if (f.state === 'punch_windup') {
        setFighterPhase(f, 'punch_active', 0.11);
        f.hitRegistered = false;
        events.push({ type: 'swing', fighterId: f.id, heavy: false, x: f.x, y: f.y + 1.1 });
      } else if (f.state === 'punch_active') {
        setFighterPhase(f, 'punch_recovery', 0.13);
      } else if (f.state === 'kick_windup') {
        setFighterPhase(f, 'kick_active', 0.13);
        f.hitRegistered = false;
        events.push({ type: 'swing', fighterId: f.id, heavy: true, x: f.x, y: f.y + 0.8 });
      } else if (f.state === 'kick_active') {
        setFighterPhase(f, 'kick_recovery', 0.18);
      } else if (f.state === 'special_windup') {
        setFighterPhase(f, 'special_active', 0.22);
        f.hitRegistered = false;
        f.vx = f.facing * 9.5;
        events.push({ type: 'special_start', fighterId: f.id, x: f.x, y: f.y + 1.1 });
      } else if (f.state === 'special_active') {
        setFighterPhase(f, 'special_recovery', 0.24);
        f.vx = 0;
      } else if (
        f.state === 'punch_recovery' ||
        f.state === 'kick_recovery' ||
        f.state === 'special_recovery' ||
        f.state === 'dash' ||
        f.state === 'hitstun'
      ) {
        f.state = f.onGround ? 'idle' : 'jump';
      }
    }
  }

  // Handle player / AI actions when in a cancellable/ready state
  const moveSpeed = 5.4 * (f.spd / 105);

  if (canAcceptAction(f)) {
    if (input.specialJustPressed && f.energy >= 100) {
      f.energy = 0;
      f.vx = 0;
      setFighterPhase(f, 'special_windup', 0.16);
    } else if (input.dashJustPressed && f.dashCooldown <= 0) {
      const dashDir: 1 | -1 = input.left ? -1 : input.right ? 1 : f.facing;
      f.vx = dashDir * 13.5;
      f.dashCooldown = 0.65;
      setFighterPhase(f, 'dash', 0.16);
      f.squashX = 1.2;
      f.squashY = 0.84;
      events.push({ type: 'dash', fighterId: f.id, x: f.x, y: f.y + 0.8, dir: dashDir });
    } else if (input.punchJustPressed) {
      f.vx *= 0.25;
      setFighterPhase(f, 'punch_windup', 0.08);
    } else if (input.kickJustPressed) {
      f.vx *= 0.2;
      setFighterPhase(f, 'kick_windup', 0.12);
    } else if (input.blockHeld && f.onGround) {
      f.state = 'block';
      f.vx = 0;
    } else if (input.crouch && f.onGround) {
      f.state = 'crouch';
      f.vx = 0;
    } else {
      if (input.left && !input.right) {
        f.vx = -moveSpeed;
        if (f.onGround) f.state = 'walk';
      } else if (input.right && !input.left) {
        f.vx = moveSpeed;
        if (f.onGround) f.state = 'walk';
      } else {
        f.vx = 0;
        if (f.onGround) f.state = 'idle';
      }

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
  } else if (isAttackState(f.state) && f.state !== 'special_active') {
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
  const activeSpecial = f.state === 'special_active';

  if ((activePunch || activeKick || activeSpecial) && !f.hitRegistered) {
    const reach = activeSpecial ? 3.2 : activeKick ? 2.55 : 2.25;
    const dx = opp.x - f.x;
    const dy = Math.abs(opp.y - f.y);
    const inFront = dx * f.facing >= -0.45 && Math.abs(dx) <= reach;

    if (inFront && dy < 2.2 && opp.state !== 'ko') {
      f.hitRegistered = true;
      const isCrit = activeSpecial || rng() * 100 < f.crit;
      const baseMult = activeSpecial ? 2.15 : activeKick ? 1.32 : 1.0;
      const critMult = isCrit && !activeSpecial ? 1.35 : 1.0;
      const defMitigation = 1 - Math.min(0.28, opp.def * 0.008);
      const rawDmg = Math.max(4, Math.round(f.atk * baseMult * critMult * defMitigation));

      const isBlocked = opp.state === 'block' && !activeSpecial;
      if (isBlocked) {
        const chip = Math.max(2, Math.round(rawDmg * 0.22));
        opp.hp = Math.max(0, opp.hp - chip);
        opp.vx = f.facing * 3.8;
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
        opp.vx = f.facing * (activeSpecial ? 10.5 : activeKick ? 6.8 : 4.2);
        if (activeSpecial || activeKick) {
          opp.vy = activeSpecial ? 5.6 : 2.8;
          opp.onGround = false;
        }
        opp.squashX = 0.78;
        opp.squashY = 1.22;

        if (opp.hp > 0) {
          setFighterPhase(opp, 'hitstun', activeSpecial ? 0.34 : activeKick ? 0.24 : 0.17);
        } else {
          opp.state = 'ko';
          opp.stateTimer = 0;
        }

        f.comboCount += 1;
        f.comboResetTimer = 1.65;
        f.maxCombo = Math.max(f.maxCombo, f.comboCount);
        f.hitsLanded += 1;
        f.damageDealt += rawDmg;
        f.energy = Math.min(100, f.energy + (activeSpecial ? 0 : activeKick ? 14 : 10));
        opp.energy = Math.min(100, opp.energy + 9);

        events.push({
          type: 'hit',
          attackerId: f.id,
          defenderId: opp.id,
          damage: rawDmg,
          heavy: activeKick || activeSpecial,
          crit: isCrit,
          special: activeSpecial,
          x: (f.x + opp.x) * 0.5,
          y: opp.y + 1.25,
          dir: f.facing,
        });
      }
    }
  }
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
    // Still let KO'd fighter fall/settle
    stepSingleFighter(match.p1, match.p2, emptyInput(), dt, events, rng);
    stepSingleFighter(match.p2, match.p1, emptyInput(), dt, events, rng);
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
    return events;
  }

  // Active fighting phase
  const p2Input =
    match.playMode === '1p'
      ? computeCpuInput(match.p2, match.p1, match.difficulty, dt, rng)
      : p2RawInput;

  stepSingleFighter(match.p1, match.p2, p1Input, dt, events, rng);
  stepSingleFighter(match.p2, match.p1, p2Input, dt, events, rng);
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
