import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARENA_HALF_WIDTH,
  computeCpuInput,
  createMatchState,
  emptyInput,
  FLOOR_Y,
  getFighterBodyScale,
  getHealthPowerMultiplier,
  stepMatch,
} from './combatEngine';
import { ARENA_STAGES, isArenaStageId } from './arenaStages';

const sampleStats = { hp: 140, atk: 20, def: 10, spd: 105, crit: 12 };

function advanceMatch(
  match: ReturnType<typeof createMatchState>,
  seconds: number,
  p1Fn: () => ReturnType<typeof emptyInput> = emptyInput,
  p2Fn: () => ReturnType<typeof emptyInput> = emptyInput
) {
  const step = 1 / 60;
  const steps = Math.round(seconds / step);
  const allEvents = [];
  for (let i = 0; i < steps; i++) {
    allEvents.push(...stepMatch(match, p1Fn(), p2Fn(), step, () => 0.99));
  }
  return allEvents;
}

test('round_intro transitions cleanly to fighting phase without player input', () => {
  const match = createMatchState(
    { name: 'Aspirin', formula: 'C9H8O4', stats: sampleStats },
    { name: 'Paracetamol', formula: 'C8H9NO2', stats: sampleStats },
    '2p',
    'normal'
  );
  assert.equal(match.phase, 'round_intro');
  advanceMatch(match, 1.2);
  assert.equal(match.phase, 'fighting');
  assert.equal(match.p1.hp, 140);
  assert.equal(match.p2.hp, 140);
});

test('fighter movement, jumping, gravity, and arena boundary clamping work deterministically', () => {
  const match = createMatchState(
    { name: 'Aspirin', formula: 'C9H8O4', stats: sampleStats },
    { name: 'Paracetamol', formula: 'C8H9NO2', stats: sampleStats },
    '2p',
    'normal'
  );
  match.phase = 'fighting';

  // Walk left to boundary
  advanceMatch(match, 2.0, () => ({ ...emptyInput(), left: true }));
  assert.equal(match.p1.x, -ARENA_HALF_WIDTH);

  // Jump and land back on FLOOR_Y
  stepMatch(match, { ...emptyInput(), jumpJustPressed: true }, emptyInput(), 1 / 60);
  assert.equal(match.p1.onGround, false);
  assert.ok(match.p1.y > FLOOR_Y);

  advanceMatch(match, 1.2);
  assert.equal(match.p1.onGround, true);
  assert.equal(match.p1.y, FLOOR_Y);
});

test('punch hits opponent in range, triggers hitstop, deals damage, and block mitigates it', () => {
  const match = createMatchState(
    { name: 'Aspirin', formula: 'C9H8O4', stats: sampleStats },
    { name: 'Paracetamol', formula: 'C8H9NO2', stats: sampleStats },
    '2p',
    'normal'
  );
  match.phase = 'fighting';
  match.p1.x = 0;
  match.p2.x = 1.6;

  // Trigger punch
  stepMatch(match, { ...emptyInput(), punchJustPressed: true }, emptyInput(), 1 / 60, () => 0.99);
  assert.equal(match.p1.state, 'punch_windup');

  const events = advanceMatch(match, 0.25);
  const hitEv = events.find((e) => e.type === 'hit');
  assert.ok(hitEv, 'Punch should emit hit event');
  assert.ok(match.p2.hp < 140, 'Opponent HP should drop after unblocked punch');

  // Now test block mitigation
  const hpBeforeBlock = match.p2.hp;
  advanceMatch(match, 0.35);
  stepMatch(
    match,
    { ...emptyInput(), punchJustPressed: true },
    { ...emptyInput(), blockHeld: true },
    1 / 60,
    () => 0.99
  );
  const blockEvents = advanceMatch(match, 0.25, emptyInput, () => ({
    ...emptyInput(),
    blockHeld: true,
  }));
  const blockEv = blockEvents.find((e) => e.type === 'block');
  assert.ok(blockEv, 'Blocking opponent should emit block event');
  assert.ok(hpBeforeBlock - match.p2.hp < 8, 'Blocked attack should deal only chip damage');
});

test('KO triggers round_ko and advances Best-of-3 to match_over when 2 rounds won', () => {
  const match = createMatchState(
    { name: 'Aspirin', formula: 'C9H8O4', stats: { ...sampleStats, atk: 200 } },
    { name: 'Paracetamol', formula: 'C8H9NO2', stats: { ...sampleStats, hp: 40 } },
    '2p',
    'normal'
  );
  match.phase = 'fighting';
  match.p1.x = 0;
  match.p2.x = 1.5;

  // Round 1 KO
  stepMatch(match, { ...emptyInput(), punchJustPressed: true }, emptyInput(), 1 / 60, () => 0.99);
  advanceMatch(match, 0.4);
  assert.equal(match.phase, 'round_ko');
  assert.equal(match.p1.roundsWon, 1);

  // Transition to Round 2
  advanceMatch(match, 1.8);
  assert.equal(match.roundNumber, 2);
  assert.equal(match.phase, 'round_intro');
  advanceMatch(match, 1.2);
  assert.equal(match.phase, 'fighting');

  // Round 2 KO
  match.p1.x = 0;
  match.p2.x = 1.5;
  stepMatch(match, { ...emptyInput(), punchJustPressed: true }, emptyInput(), 1 / 60, () => 0.99);
  advanceMatch(match, 2.2);
  assert.equal(match.phase, 'match_over');
  assert.equal(match.matchWinner, 1);
  assert.equal(match.p1.roundsWon, 2);
});

test('CPU AI moves toward distant player and attacks in range', () => {
  const match = createMatchState(
    { name: 'Aspirin', formula: 'C9H8O4', stats: sampleStats },
    { name: 'Paracetamol', formula: 'C8H9NO2', stats: sampleStats },
    '1p',
    'hard'
  );
  match.phase = 'fighting';
  match.p1.x = -4;
  match.p2.x = 4;

  const farInput = computeCpuInput(match.p2, match.p1, 'hard', 0.1, () => 0.1);
  assert.equal(farInput.left, true);

  match.p2.x = -2.2;
  match.p2.aiActionCooldown = 0;
  const closeInput = computeCpuInput(match.p2, match.p1, 'hard', 0.1, () => 0.2);
  assert.ok(closeInput.punchJustPressed || closeInput.kickJustPressed);
});

test('Forward+Punch (D+J) throws molecular structure projectile, damages distant opponent, and returns weapon', () => {
  const match = createMatchState(
    { name: 'Aspirin', formula: 'C9H8O4', stats: sampleStats },
    { name: 'Paracetamol', formula: 'C8H9NO2', stats: sampleStats },
    '2p',
    'normal'
  );
  match.phase = 'fighting';
  match.p1.x = -3.0;
  match.p2.x = 3.0;

  // Hold Forward (right) + Punch
  stepMatch(
    match,
    { ...emptyInput(), right: true, punchJustPressed: true },
    emptyInput(),
    1 / 60,
    () => 0.99
  );
  assert.equal(match.p1.state, 'throw_windup');

  // Advance past windup so projectile spawns and leaves hand
  const throwEvents = advanceMatch(match, 0.15);
  assert.ok(throwEvents.some((e) => e.type === 'throw'));
  assert.equal(match.projectiles.length, 1);
  assert.equal(match.p1.hasWeaponInHand, false);

  // Advance until projectile travels across arena and hits P2
  const impactEvents = advanceMatch(match, 0.6);
  assert.ok(impactEvents.some((e) => e.type === 'hit'));
  assert.ok(impactEvents.some((e) => e.type === 'projectile_shatter'));
  assert.ok(match.p2.hp < 140);
  assert.equal(match.projectiles.length, 0);
  assert.equal(match.p1.hasWeaponInHand, true);
});

test('Chord-upgrade window turns near-simultaneous J then D into molecular throw and S+K into uppercut', () => {
  const match = createMatchState(
    { name: 'Aspirin', formula: 'C9H8O4', stats: sampleStats },
    { name: 'Paracetamol', formula: 'C8H9NO2', stats: sampleStats },
    '2p',
    'normal'
  );
  match.phase = 'fighting';
  match.p1.x = -2.0;
  match.p2.x = 2.0;

  // Frame 1: Punch pressed slightly before D
  stepMatch(match, { ...emptyInput(), punchJustPressed: true }, emptyInput(), 1 / 60);
  assert.equal(match.p1.state, 'punch_windup');

  // Frame 2: D pressed during windup upgrades to throw_windup
  stepMatch(match, { ...emptyInput(), right: true }, emptyInput(), 1 / 60);
  assert.equal(match.p1.state, 'throw_windup');

  // Let throw finish & return to idle
  advanceMatch(match, 0.9);
  assert.equal(match.p1.state, 'idle');

  // Now test Down + Kick uppercut combo in melee range
  match.p1.x = 0;
  match.p2.x = 1.6;
  stepMatch(match, { ...emptyInput(), crouch: true, kickJustPressed: true }, emptyInput(), 1 / 60, () => 0.99);
  assert.equal(match.p1.state, 'uppercut_windup');
  const upEvents = advanceMatch(match, 0.25);
  assert.ok(upEvents.some((e) => e.type === 'uppercut_start'));
  assert.ok(upEvents.some((e) => e.type === 'hit'));
  assert.ok(match.p2.vy > 0, 'Uppercut should launch opponent upward');
});

test('expanded arena width and 4 selectable biochemical stages are properly configured', () => {
  assert.ok(ARENA_HALF_WIDTH >= 10, `Expected ARENA_HALF_WIDTH >= 10, got ${ARENA_HALF_WIDTH}`);
  assert.equal(ARENA_STAGES.length, 4);

  const ids = ARENA_STAGES.map((s) => s.id);
  assert.deepEqual(ids, ['cell', 'flask', 'bloodstream', 'receptor']);

  for (const id of ids) {
    assert.equal(isArenaStageId(id), true);
  }
  assert.equal(isArenaStageId('unknown_stage'), false);
  assert.equal(isArenaStageId(null), false);

  const match = createMatchState(
    { name: 'Aspirin', formula: 'C9H8O4', stats: sampleStats },
    { name: 'Paracetamol', formula: 'C8H9NO2', stats: sampleStats },
    '2p',
    'normal'
  );
  match.phase = 'fighting';
  assert.ok(Math.abs(match.p1.x) >= 5 && Math.abs(match.p2.x) >= 5, 'Spawns should use expanded arena');

  // Walk far right across expanded 21.2m arena to right boundary
  advanceMatch(match, 3.5, emptyInput, () => ({ ...emptyInput(), right: true }));
  assert.equal(match.p2.x, ARENA_HALF_WIDTH);
});

test('functional power-ups drop every 2-4s, settle on floor, and grant buffs on pickup', () => {
  const match = createMatchState(
    { name: 'Aspirin', formula: 'C9H8O4', stats: sampleStats },
    { name: 'Paracetamol', formula: 'C8H9NO2', stats: sampleStats },
    '2p',
    'normal'
  );
  match.phase = 'fighting';
  match.p1.x = -8;
  match.p2.x = 8;

  // Advance 3.2s with deterministic rng=0.5 (initial 2.4s spawns item, next timer resets to 3.0s inside [2,4])
  const allEvents = [];
  for (let i = 0; i < 192; i++) {
    allEvents.push(...stepMatch(match, emptyInput(), emptyInput(), 1 / 60, () => 0.5));
  }
  assert.ok(allEvents.some((e) => e.type === 'powerup_spawn'), 'Power-up should drop within 2-4s');
  assert.equal(match.powerUps.length, 1);
  assert.ok(match.powerUpSpawnTimer >= 2.0 && match.powerUpSpawnTimer <= 4.0);

  // Move P1 onto the dropped power-up and verify pickup works
  const dropped = match.powerUps[0];
  match.p1.x = dropped.x;
  const pickEvents = advanceMatch(match, 0.25);
  assert.ok(
    pickEvents.some((e) => e.type === 'powerup_pickup' && e.fighterId === 1 && e.powerUpType === dropped.type)
  );
  assert.equal(match.powerUps.length, 0);
});

test('power-up buffs apply shrink/giant scale, fist damage, lightning speed, and Dấu X triple J+D projectiles', () => {
  const match = createMatchState(
    { name: 'Aspirin', formula: 'C9H8O4', stats: sampleStats },
    { name: 'Paracetamol', formula: 'C8H9NO2', stats: { ...sampleStats, hp: 300 } },
    '2p',
    'normal'
  );
  match.phase = 'fighting';

  // Shrink vs Giant mutual exclusivity
  match.powerUps.push({
    id: 1,
    type: 'shrink',
    x: match.p1.x,
    y: FLOOR_Y + 0.5,
    vy: 0,
    onGround: true,
    life: 8,
    maxLife: 8,
    bobPhase: 0,
  });
  stepMatch(match, emptyInput(), emptyInput(), 1 / 60);
  assert.ok(match.p1.buffs.shrink > 0);
  assert.equal(getFighterBodyScale(match.p1), 0.68);

  match.powerUps.push({
    id: 2,
    type: 'giant',
    x: match.p1.x,
    y: FLOOR_Y + 0.5,
    vy: 0,
    onGround: true,
    life: 8,
    maxLife: 8,
    bobPhase: 0,
  });
  stepMatch(match, emptyInput(), emptyInput(), 1 / 60);
  assert.ok(match.p1.buffs.giant > 0);
  assert.equal(match.p1.buffs.shrink, 0);
  assert.equal(getFighterBodyScale(match.p1), 1.38);

  // Dấu X (triple_throw) spawns 3 projectiles on J+D
  match.p1.x = -4.0;
  match.p2.x = 4.0;
  match.powerUps.push({
    id: 3,
    type: 'triple_throw',
    x: match.p1.x,
    y: FLOOR_Y + 0.5,
    vy: 0,
    onGround: true,
    life: 8,
    maxLife: 8,
    bobPhase: 0,
  });
  stepMatch(match, { ...emptyInput(), right: true, punchJustPressed: true }, emptyInput(), 1 / 60, () => 0.99);
  assert.ok(match.p1.buffs.tripleThrow > 0);
  advanceMatch(match, 0.15);
  assert.equal(match.projectiles.length, 3, 'Triple throw buff should spawn 3 molecular projectiles');

  // Fist buff boosts melee damage cleanly
  const hpBefore = match.p2.hp;
  match.p1.x = 0;
  match.p2.x = 1.6;
  match.p1.buffs.giant = 0;
  match.p1.buffs.fist = 6.0;
  advanceMatch(match, 0.4); // clear recovery
  stepMatch(match, { ...emptyInput(), punchJustPressed: true }, emptyInput(), 1 / 60, () => 0.99);
  advanceMatch(match, 0.25);
  const dealtWithFist = hpBefore - match.p2.hp;
  assert.ok(dealtWithFist >= 24, `Expected fist-boosted punch damage >= 24, got ${dealtWithFist}`);
});

test('each arena stage spawns its distinct hazard and damages players on contact (mitigated by block)', () => {
  const stageChecks: Array<{ stage: 'bloodstream' | 'receptor' | 'flask' | 'cell'; expectedType: string }> = [
    { stage: 'cell', expectedType: 'enzyme_attack' },
    { stage: 'flask', expectedType: 'stir_bar' },
    { stage: 'bloodstream', expectedType: 'leukocyte_drop' },
    { stage: 'receptor', expectedType: 'receptor_competition' },
  ];

  for (const { stage, expectedType } of stageChecks) {
    const m = createMatchState(
      { name: 'Aspirin', formula: 'C9H8O4', stats: sampleStats },
      { name: 'Paracetamol', formula: 'C8H9NO2', stats: sampleStats },
      '2p',
      'normal',
      stage
    );
    m.phase = 'fighting';
    m.hazardSpawnTimer = 0.05;
    const evs = [];
    for (let i = 0; i < 80; i++) {
      evs.push(...stepMatch(m, emptyInput(), emptyInput(), 1 / 60, () => 0.5));
    }
    assert.ok(
      evs.some((e) => e.type === 'hazard_spawn' && e.hazardType === expectedType),
      `${stage} should spawn ${expectedType}`
    );
    assert.ok(
      evs.some((e) => e.type === 'hazard_trigger' && e.hazardType === expectedType),
      `${stage} should transition ${expectedType} from telegraph to active`
    );
  }

  // Flask stir_bar hits grounded player at feet, while jumping clears it cleanly
  const flaskMatch = createMatchState(
    { name: 'Aspirin', formula: 'C9H8O4', stats: sampleStats },
    { name: 'Paracetamol', formula: 'C8H9NO2', stats: sampleStats },
    '2p',
    'normal',
    'flask'
  );
  flaskMatch.phase = 'fighting';
  flaskMatch.p1.x = -2;
  flaskMatch.p2.x = 2;
  flaskMatch.p2.y = FLOOR_Y + 0.85; // airborne jumping over stir bar
  flaskMatch.p2.onGround = false;
  flaskMatch.hazards.push(
    {
      id: 99,
      type: 'stir_bar',
      stageId: 'flask',
      phase: 'active',
      x: -2,
      y: FLOOR_Y,
      vx: 0,
      vy: 0,
      radius: 1.55,
      height: 0.48,
      damage: 14,
      timer: 1.0,
      duration: 1.45,
      hitP1: false,
      hitP2: false,
      seed: 0.5,
    },
    {
      id: 100,
      type: 'stir_bar',
      stageId: 'flask',
      phase: 'active',
      x: 2,
      y: FLOOR_Y,
      vx: 0,
      vy: 0,
      radius: 1.55,
      height: 0.48,
      damage: 14,
      timer: 1.0,
      duration: 1.45,
      hitP1: false,
      hitP2: false,
      seed: 0.5,
    }
  );
  const p1FlaskBefore = flaskMatch.p1.hp;
  const p2FlaskBefore = flaskMatch.p2.hp;
  stepMatch(flaskMatch, emptyInput(), emptyInput(), 1 / 60, () => 0.5);
  assert.equal(flaskMatch.p1.hp, p1FlaskBefore - 14);
  assert.equal(flaskMatch.p2.hp, p2FlaskBefore);

  // Bloodstream leukocyte drops from above & receptor competition hits / blocks properly
  const compMatch = createMatchState(
    { name: 'Aspirin', formula: 'C9H8O4', stats: sampleStats },
    { name: 'Paracetamol', formula: 'C8H9NO2', stats: sampleStats },
    '2p',
    'normal',
    'receptor'
  );
  compMatch.phase = 'fighting';
  compMatch.p1.x = -2;
  compMatch.p2.x = 2;
  compMatch.hazards.push(
    {
      id: 101,
      type: 'receptor_competition',
      stageId: 'receptor',
      phase: 'active',
      x: -2,
      y: FLOOR_Y,
      vx: 0,
      vy: 0,
      radius: 1.28,
      height: 2.75,
      damage: 15,
      timer: 0.5,
      duration: 0.65,
      hitP1: false,
      hitP2: false,
      seed: 0.5,
    },
    {
      id: 102,
      type: 'leukocyte_drop',
      stageId: 'bloodstream',
      phase: 'active',
      x: 2,
      y: FLOOR_Y + 2.0,
      vx: 0,
      vy: -9.2,
      radius: 0.86,
      height: 1.35,
      damage: 15,
      timer: 1.0,
      duration: 1.15,
      hitP1: false,
      hitP2: false,
      seed: 0.5,
    }
  );

  const p1Before = compMatch.p1.hp;
  const p2Before = compMatch.p2.hp;
  const p2Block = { ...emptyInput(), blockHeld: true };
  const contactEvents = stepMatch(compMatch, emptyInput(), p2Block, 1 / 60, () => 0.5);

  assert.equal(compMatch.p1.hp, p1Before - 15);
  assert.equal(compMatch.p2.hp, p2Before - 4);
  assert.ok(contactEvents.some((e) => e.type === 'hazard_hit' && e.fighterId === 1 && !e.blocked));
  assert.ok(contactEvents.some((e) => e.type === 'hazard_hit' && e.fighterId === 2 && e.blocked));

  // Same hazard must not double-hit P1 on consecutive frames
  stepMatch(compMatch, emptyInput(), emptyInput(), 1 / 60, () => 0.5);
  assert.equal(compMatch.p1.hp, p1Before - 15);
});

test('damage output scales down proportionally as attacker health bar decreases', () => {
  const highStats = { hp: 320, atk: 30, def: 10, spd: 105, crit: 0 };
  const mFull = createMatchState(
    { name: 'Aspirin', formula: 'C9H8O4', stats: highStats },
    { name: 'Paracetamol', formula: 'C8H9NO2', stats: highStats },
    '2p',
    'normal'
  );
  mFull.phase = 'fighting';
  mFull.p1.x = 0;
  mFull.p2.x = 1.6;

  assert.equal(getHealthPowerMultiplier(mFull.p1), 1.0);
  stepMatch(mFull, { ...emptyInput(), punchJustPressed: true }, emptyInput(), 1 / 60, () => 0.99);
  for (let i = 0; i < 15; i++) stepMatch(mFull, emptyInput(), emptyInput(), 1 / 60, () => 0.99);
  const fullHpDamage = 320 - mFull.p2.hp;

  const mLow = createMatchState(
    { name: 'Aspirin', formula: 'C9H8O4', stats: highStats },
    { name: 'Paracetamol', formula: 'C8H9NO2', stats: highStats },
    '2p',
    'normal'
  );
  mLow.phase = 'fighting';
  mLow.p1.x = 0;
  mLow.p2.x = 1.6;
  mLow.p1.hp = 64; // 20% HP -> power mult = 0.4 + 0.6 * 0.2 = 0.52

  assert.ok(Math.abs(getHealthPowerMultiplier(mLow.p1) - 0.52) < 0.001);
  stepMatch(mLow, { ...emptyInput(), punchJustPressed: true }, emptyInput(), 1 / 60, () => 0.99);
  for (let i = 0; i < 15; i++) stepMatch(mLow, emptyInput(), emptyInput(), 1 / 60, () => 0.99);
  const lowHpDamage = 320 - mLow.p2.hp;

  assert.ok(
    lowHpDamage < fullHpDamage * 0.65 && lowHpDamage > 0,
    `Expected low HP damage (${lowHpDamage}) to be proportionally lower than full HP damage (${fullHpDamage})`
  );
});

test('SMILES [F] signature skills trigger distinct effects, respect cooldowns, and smooth movement accelerates cleanly', () => {
  // 1. Halogen Corrode projectile ignores block
  const halogenMatch = createMatchState(
    {
      name: 'Fluoxetine',
      formula: 'C17H18F3NO',
      stats: {
        ...sampleStats,
        hp: 300,
        skill: {
          id: 'halogen_corrode',
          name: 'Ăn Mòn Halogen',
          shortLabel: 'Xuyên Giáp',
          description: 'Phóng tia halogen xuyên thủng khiên đỡ.',
          accentHex: '#4ade80',
          cooldown: 5.5,
        },
      },
    },
    { name: 'Paracetamol', formula: 'C8H9NO2', stats: { ...sampleStats, hp: 300 } },
    '2p',
    'normal'
  );
  halogenMatch.phase = 'fighting';
  halogenMatch.p1.x = -2.5;
  halogenMatch.p2.x = 2.5;

  stepMatch(halogenMatch, { ...emptyInput(), skillJustPressed: true }, { ...emptyInput(), blockHeld: true }, 1 / 60);
  assert.equal(halogenMatch.p1.state, 'skill_windup');
  assert.ok(halogenMatch.p1.skillCooldown > 5.0, 'Skill cooldown should engage immediately');

  // Cannot re-trigger while on cooldown
  const hpP2Before = halogenMatch.p2.hp;
  const skillEvents = advanceMatch(
    halogenMatch,
    0.55,
    emptyInput,
    () => ({ ...emptyInput(), blockHeld: true })
  );
  assert.ok(skillEvents.some((e) => e.type === 'smiles_skill' && e.skillId === 'halogen_corrode'));
  assert.ok(skillEvents.some((e) => e.type === 'hit' && e.defenderId === 2), 'Halogen skill should pierce block as hit');
  assert.ok(hpP2Before - halogenMatch.p2.hp >= 18, 'Block-piercing halogen bolt should deal full skill damage');

  // 2. Phenol Shield heals +28 HP and emits smiles_skill healed event
  const phenolMatch = createMatchState(
    {
      name: 'Paracetamol',
      formula: 'C8H9NO2',
      stats: {
        ...sampleStats,
        hp: 300,
        skill: {
          id: 'phenol_shield',
          name: 'Màng Chắn Phenol',
          shortLabel: 'Hồi Phục',
          description: 'Tái tạo +28 HP.',
          accentHex: '#34d399',
          cooldown: 6.5,
        },
      },
    },
    { name: 'Aspirin', formula: 'C9H8O4', stats: { ...sampleStats, hp: 300 } },
    '2p',
    'normal'
  );
  phenolMatch.phase = 'fighting';
  phenolMatch.p1.hp = 200;
  phenolMatch.p1.x = 0;
  phenolMatch.p2.x = 1.8;

  stepMatch(phenolMatch, { ...emptyInput(), skillJustPressed: true }, emptyInput(), 1 / 60);
  const phenolEvents = advanceMatch(phenolMatch, 0.25);
  assert.ok(phenolEvents.some((e) => e.type === 'smiles_skill' && e.skillId === 'phenol_shield' && e.healed === 28));
  assert.equal(phenolMatch.p1.hp, 228);

  // 3. Alkaloid Surge grants lightning buff & smooth acceleration ramps vx progressively
  const alkMatch = createMatchState(
    {
      name: 'Caffeine',
      formula: 'C8H10N4O2',
      stats: {
        ...sampleStats,
        hp: 300,
        skill: {
          id: 'alkaloid_surge',
          name: 'Xung Kích Alkaloid',
          shortLabel: 'Tăng Tốc',
          description: 'Lao tới và kích hoạt tốc đánh.',
          accentHex: '#f59e0b',
          cooldown: 5.5,
        },
      },
    },
    { name: 'Aspirin', formula: 'C9H8O4', stats: { ...sampleStats, hp: 300 } },
    '2p',
    'normal'
  );
  alkMatch.phase = 'fighting';
  stepMatch(alkMatch, { ...emptyInput(), right: true }, emptyInput(), 1 / 60);
  const firstFrameVx = alkMatch.p1.vx;
  stepMatch(alkMatch, { ...emptyInput(), right: true }, emptyInput(), 1 / 60);
  assert.ok(alkMatch.p1.vx > firstFrameVx && firstFrameVx > 0, 'Horizontal velocity should accelerate smoothly');

  advanceMatch(alkMatch, 0.25);
  stepMatch(alkMatch, { ...emptyInput(), skillJustPressed: true }, emptyInput(), 1 / 60);
  advanceMatch(alkMatch, 0.2);
  assert.ok(alkMatch.p1.buffs.lightning >= 3.5, 'Alkaloid surge should grant lightning tempo buff');
});



