import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARENA_HALF_WIDTH,
  computeCpuInput,
  createMatchState,
  emptyInput,
  FLOOR_Y,
  stepMatch,
} from './combatEngine';

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
