import test from 'node:test';
import assert from 'node:assert/strict';
import { DRUG_PRESETS, INTERESTING_COMPOUNDS, parseSmilesToWeapon } from './smilesEngine';

test('all drug presets and interesting compounds parse cleanly with valid 2D SVG and 3D conformer coords', () => {
  for (const preset of [...DRUG_PRESETS, ...INTERESTING_COMPOUNDS]) {
    const res = parseSmilesToWeapon(preset.smiles, preset.name);
    assert.equal(res.success, true, `Preset ${preset.name} failed to parse`);
    if (res.success) {
      assert.ok(res.atoms.length >= 5, `${preset.name} should have >= 5 heavy atoms`);
      assert.ok(res.bonds.length >= 4, `${preset.name} should have >= 4 bonds`);
      assert.ok(res.svg2d.startsWith('<svg'), `${preset.name} should emit SVG`);
      assert.ok(res.stats.hp >= 260 && res.stats.hp <= 420);
      assert.ok(res.stats.atk >= 14);
      for (const atom of res.atoms) {
        assert.ok(Number.isFinite(atom.x) && Number.isFinite(atom.y) && Number.isFinite(atom.z));
        assert.ok(Math.abs(atom.x) <= 1.0 && Math.abs(atom.y) <= 1.0 && Math.abs(atom.z) <= 1.0);
      }
    }
  }
});

test('calculates accurate molecular formulas for key drugs', () => {
  const aspirin = parseSmilesToWeapon('CC(=O)Oc1ccccc1C(=O)O', 'Aspirin');
  assert.equal(aspirin.success, true);
  if (aspirin.success) {
    assert.equal(aspirin.formula, 'C9H8O4');
    assert.ok(aspirin.stats.mw > 179 && aspirin.stats.mw < 181);
    assert.equal(aspirin.stats.ringCount, 1);
  }

  const paracetamol = parseSmilesToWeapon('CC(=O)Nc1ccc(O)cc1', 'Paracetamol');
  assert.equal(paracetamol.success, true);
  if (paracetamol.success) {
    assert.equal(paracetamol.formula, 'C8H9NO2');
    assert.equal(paracetamol.stats.ringCount, 1);
  }

  const caffeine = parseSmilesToWeapon('CN1C=NC2=C1C(=O)N(C(=O)N2C)C', 'Caffeine');
  assert.equal(caffeine.success, true);
  if (caffeine.success) {
    assert.equal(caffeine.formula, 'C8H10N4O2');
    assert.equal(caffeine.stats.ringCount, 2);
  }
});

test('supports triple bonds, two-letter halogens, and bracket atoms', () => {
  const res = parseSmilesToWeapon('CC#CC(=O)Cl');
  assert.equal(res.success, true);
  if (res.success) {
    assert.ok(res.bonds.some((b) => b.order === 3));
    assert.ok(res.atoms.some((a) => a.elem === 'Cl'));
  }

  const bracket = parseSmilesToWeapon('[NH4+].c1ccccc1');
  assert.equal(bracket.success, true);
});

test('rejects invalid or empty SMILES gracefully', () => {
  assert.equal(parseSmilesToWeapon('').success, false);
  assert.equal(parseSmilesToWeapon('CC(=O').success, false);
  assert.equal(parseSmilesToWeapon('c1ccccc').success, false);
  assert.equal(parseSmilesToWeapon('C$C').success, false);
});

test('assigns distinct signature SMILES skills across chemical structure motifs', () => {
  const cases: Array<{ smiles: string; name: string; expectedSkill: string }> = [
    { smiles: 'CC(=O)Oc1ccccc1C(=O)O', name: 'Aspirin', expectedSkill: 'aromatic_burst' },
    { smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C', name: 'Caffeine', expectedSkill: 'alkaloid_surge' },
    { smiles: 'CC(=O)Nc1ccc(O)cc1', name: 'Paracetamol', expectedSkill: 'phenol_shield' },
    { smiles: 'CC1(C(N2C(S1)C(C2=O)NC(=O)CC3=CC=CC=C3)C(=O)O)C', name: 'Penicillin G', expectedSkill: 'sulfur_cage' },
    { smiles: 'Fc1ccccc1', name: 'Fluorobenzene', expectedSkill: 'halogen_corrode' },
    { smiles: 'CC(=O)O', name: 'Acetic Acid', expectedSkill: 'carbonyl_chain' },
  ];

  for (const tc of cases) {
    const parsed = parseSmilesToWeapon(tc.smiles, tc.name);
    assert.equal(parsed.success, true, `${tc.name} should parse`);
    if (parsed.success) {
      assert.equal(
        parsed.stats.skill.id,
        tc.expectedSkill,
        `Expected ${tc.name} (${tc.smiles}) to classify as ${tc.expectedSkill}, got ${parsed.stats.skill.id}`
      );
      assert.ok(parsed.stats.skill.name.length > 0);
      assert.ok(parsed.stats.skill.cooldown >= 4.5);
    }
  }
});
