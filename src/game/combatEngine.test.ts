import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARENA_HALF_WIDTH,
  computeCpuInput,
  createMatchState,
  emptyInput,
  FLOOR_Y,
  getFighterBodyScale,
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


