import React, { useCallback, useEffect, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { DRUG_PRESETS, parseSmilesToWeapon, type ParsedMolecule } from './chem/smilesEngine';
import { GameHud, type FloatingCallout } from './components/GameHud';
import { SmilesModal } from './components/SmilesModal';
import { StatusModal } from './components/StatusModal';
import { TitleScreen } from './components/TitleScreen';
import { ArenaRenderer } from './game/ArenaRenderer';
import {
  createMatchState,
  emptyInput,
  stepMatch,
  type ColorSchemeMode,
  type CpuDifficulty,
  type FighterInput,
  type MatchState,
  type PlayMode,
} from './game/combatEngine';

type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

function getInitialWeapon(presetIndex: number, accentHex: string): ParsedMolecule {
  const preset = DRUG_PRESETS[presetIndex];
  const parsed = parseSmilesToWeapon(preset.smiles, preset.name, accentHex);
  if (!parsed.success) {
    throw new Error('Failed to parse default preset molecule');
  }
  return parsed;
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const arenaRef = useRef<ArenaRenderer | null>(null);

  const [p1Weapon, setP1Weapon] = useState<ParsedMolecule>(() => getInitialWeapon(0, '#38bdf8'));
  const [p2Weapon, setP2Weapon] = useState<ParsedMolecule>(() => getInitialWeapon(2, '#f43f5e'));

  const [playMode, setPlayMode] = useState<PlayMode>('1p');
  const [difficulty, setDifficulty] = useState<CpuDifficulty>('normal');
  const [colorMode, setColorMode] = useState<ColorSchemeMode>('elemental');
  const [muted, setMuted] = useState(false);

  const [gamePhase, setGamePhase] = useState<GamePhase>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') return 'playing';
    }
    return 'title';
  });

  const [smilesModalTarget, setSmilesModalTarget] = useState<1 | 2 | null>(null);
  const [callouts, setCallouts] = useState<FloatingCallout[]>([]);

  const matchRef = useRef<MatchState>(
    createMatchState(
      { name: p1Weapon.name, formula: p1Weapon.formula, stats: p1Weapon.stats },
      { name: p2Weapon.name, formula: p2Weapon.formula, stats: p2Weapon.stats },
      playMode,
      difficulty
    )
  );
  const [hudSnapshot, setHudSnapshot] = useState<MatchState>(() => ({
    ...matchRef.current,
    p1: { ...matchRef.current.p1 },
    p2: { ...matchRef.current.p2 },
  }));

  const gamePhaseRef = useRef<GamePhase>(gamePhase);
  gamePhaseRef.current = gamePhase;

  const heldKeysRef = useRef<Set<string>>(new Set());
  const justPressedRef = useRef<Set<string>>(new Set());
  const calloutIdRef = useRef(1);
  const smilesOpenRef = useRef(false);
  smilesOpenRef.current = smilesModalTarget !== null;

  // Sync document.body.dataset.state
  useEffect(() => {
    document.body.dataset.state = gamePhase;
  }, [gamePhase]);

  const syncSnapshotNow = useCallback(() => {
    const m = matchRef.current;
    setHudSnapshot({
      ...m,
      p1: { ...m.p1 },
      p2: { ...m.p2 },
    });
  }, []);

  const rebuildMatch = useCallback(
    (w1: ParsedMolecule, w2: ParsedMolecule, mode: PlayMode, diff: CpuDifficulty) => {
      matchRef.current = createMatchState(
        { name: w1.name, formula: w1.formula, stats: w1.stats },
        { name: w2.name, formula: w2.formula, stats: w2.stats },
        mode,
        diff
      );
      syncSnapshotNow();
    },
    [syncSnapshotNow]
  );

  const handleStartFight = useCallback(() => {
    soundEngine.playRoundStart();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    heldKeysRef.current.clear();
    justPressedRef.current.clear();
    setCallouts([]);
    rebuildMatch(p1Weapon, p2Weapon, playMode, difficulty);
    document.body.dataset.state = 'playing';
    setGamePhase('playing');
  }, [difficulty, p1Weapon, p2Weapon, playMode, rebuildMatch]);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const handleSelectPreset = useCallback(
    (playerId: 1 | 2, smiles: string, name: string) => {
      soundEngine.playUiClick();
      const accent = playerId === 1 ? '#38bdf8' : '#f43f5e';
      const parsed = parseSmilesToWeapon(smiles, name, accent);
      if (!parsed.success) return;

      if (playerId === 1) {
        setP1Weapon(parsed);
        arenaRef.current?.setWeapon(1, parsed);
        rebuildMatch(parsed, p2Weapon, playMode, difficulty);
      } else {
        setP2Weapon(parsed);
        arenaRef.current?.setWeapon(2, parsed);
        rebuildMatch(p1Weapon, parsed, playMode, difficulty);
      }
    },
    [difficulty, p1Weapon, p2Weapon, playMode, rebuildMatch]
  );

  const handleEquipCustomWeapon = useCallback(
    (playerId: 1 | 2, mol: ParsedMolecule) => {
      soundEngine.playUiClick();
      if (playerId === 1) {
        setP1Weapon(mol);
        arenaRef.current?.setWeapon(1, mol);
        rebuildMatch(mol, p2Weapon, playMode, difficulty);
      } else {
        setP2Weapon(mol);
        arenaRef.current?.setWeapon(2, mol);
        rebuildMatch(p1Weapon, mol, playMode, difficulty);
      }
    },
    [difficulty, p1Weapon, p2Weapon, playMode, rebuildMatch]
  );

  // Initialize Three.js Arena once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const renderer = new ArenaRenderer(mount);
    arenaRef.current = renderer;
    renderer.setWeapon(1, p1Weapon);
    renderer.setWeapon(2, p2Weapon);
    renderer.applyColorScheme(colorMode);
    renderer.syncMatch(matchRef.current, gamePhaseRef.current, []);

    return () => {
      renderer.dispose();
      arenaRef.current = null;
    };
    // Intentionally mounted once so HUD updates never reset the WebGL canvas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update 3D color mode live
  useEffect(() => {
    arenaRef.current?.applyColorScheme(colorMode);
  }, [colorMode]);

  // Unified Window Input Hub
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (smilesOpenRef.current) {
        if (e.key === 'Escape') setSmilesModalTarget(null);
        return;
      }

      const key = e.key.toLowerCase();
      if (
        ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key) &&
        gamePhaseRef.current !== 'title'
      ) {
        e.preventDefault();
      }

      if (gamePhaseRef.current === 'title') {
        if (key === 'enter' || key === ' ') {
          e.preventDefault();
          handleStartFight();
          return;
        }
      }

      if (key === 'escape' || (key === 'p' && gamePhaseRef.current !== 'title')) {
        if (gamePhaseRef.current === 'playing') {
          heldKeysRef.current.clear();
          justPressedRef.current.clear();
          setGamePhase('paused');
          return;
        }
        if (gamePhaseRef.current === 'paused') {
          heldKeysRef.current.clear();
          justPressedRef.current.clear();
          setGamePhase('playing');
          return;
        }
      }

      if (key === 'm' && !(gamePhaseRef.current === 'playing' && matchRef.current.playMode === '2p')) {
        if (!e.repeat) handleToggleMute();
      }

      if (!e.repeat) {
        justPressedRef.current.add(key);
      }
      heldKeysRef.current.add(key);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldKeysRef.current.delete(e.key.toLowerCase());
    };

    const clearInputs = () => {
      heldKeysRef.current.clear();
      justPressedRef.current.clear();
    };

    const onVisChange = () => {
      if (document.hidden) clearInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    document.addEventListener('visibilitychange', onVisChange);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [handleStartFight, handleToggleMute]);

  // 60Hz Simulation Loop decoupled from React
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let hudAccumulator = 0;

    const stepLoop = (now: number) => {
      rafId = requestAnimationFrame(stepLoop);
      const rawDt = Math.max(0.001, (now - lastTime) / 1000);
      lastTime = now;

      const phase = gamePhaseRef.current;
      const arena = arenaRef.current;
      const match = matchRef.current;

      if (phase === 'title') {
        arena?.syncMatch(match, 'title', []);
        return;
      }

      if (phase === 'paused' || phase === 'gameover') {
        arena?.syncMatch(match, phase, []);
        return;
      }

      // Build edge-triggered & held inputs
      const held = heldKeysRef.current;
      const just = justPressedRef.current;

      const p1Input: FighterInput = {
        left: held.has('a'),
        right: held.has('d'),
        jumpJustPressed: just.has('w'),
        crouch: held.has('s'),
        punchJustPressed: just.has('f') || just.has('j'),
        kickJustPressed: just.has('g') || just.has('k'),
        blockHeld: held.has('h') || held.has('l'),
        specialJustPressed: just.has('r') || just.has('u'),
        dashJustPressed: just.has('shift'),
      };

      const p2Input: FighterInput =
        match.playMode === '2p'
          ? {
              left: held.has('arrowleft'),
              right: held.has('arrowright'),
              jumpJustPressed: just.has('arrowup'),
              crouch: held.has('arrowdown'),
              punchJustPressed: just.has(','),
              kickJustPressed: just.has('.'),
              blockHeld: held.has('/'),
              specialJustPressed: just.has('m'),
              dashJustPressed: just.has('control') || just.has(' '),
            }
          : emptyInput();

      just.clear();

      const prevPhase = match.phase;
      const events = stepMatch(match, p1Input, p2Input, rawDt);

      // Process sound + floating callouts for combat events
      const newCallouts: FloatingCallout[] = [];
      for (const ev of events) {
        if (ev.type === 'swing') {
          soundEngine.playSwing(ev.heavy);
        } else if (ev.type === 'hit') {
          soundEngine.playHit(ev.heavy, ev.crit);
          const screen = arena?.projectToScreen(ev.x, ev.y);
          if (screen) {
            newCallouts.push({
              id: calloutIdRef.current++,
              x: screen.x,
              y: screen.y,
              text: ev.special
                ? `BURST -${ev.damage}!`
                : ev.crit
                ? `CRIT -${ev.damage}!`
                : `-${ev.damage}`,
              color: ev.special ? '#facc15' : ev.crit ? '#fbbf24' : '#f8fafc',
            });
          }
        } else if (ev.type === 'block') {
          soundEngine.playBlock();
          const screen = arena?.projectToScreen(ev.x, ev.y);
          if (screen) {
            newCallouts.push({
              id: calloutIdRef.current++,
              x: screen.x,
              y: screen.y,
              text: `ĐỠ -${ev.damage}`,
              color: '#7dd3fc',
            });
          }
        } else if (ev.type === 'jump') {
          soundEngine.playJump();
        } else if (ev.type === 'land') {
          soundEngine.playLand();
        } else if (ev.type === 'dash') {
          soundEngine.playDash();
        } else if (ev.type === 'special_start') {
          soundEngine.playSpecial();
        } else if (ev.type === 'round_end') {
          soundEngine.playKO();
        } else if (ev.type === 'match_end') {
          soundEngine.playVictory();
          setGamePhase('gameover');
          document.body.dataset.state = 'gameover';
        }
      }

      if (prevPhase === 'round_intro' && match.phase === 'fighting') {
        soundEngine.playRoundStart();
      }

      if (newCallouts.length > 0) {
        setCallouts((prev) => [...prev.slice(-8), ...newCallouts]);
      }

      arena?.syncMatch(match, 'playing', events);

      // Throttle React HUD updates to ~20Hz or immediate on events/phase transitions
      hudAccumulator += rawDt;
      if (hudAccumulator >= 0.05 || events.length > 0 || prevPhase !== match.phase) {
        hudAccumulator = 0;
        syncSnapshotNow();
      }
    };

    rafId = requestAnimationFrame(stepLoop);
    return () => cancelAnimationFrame(rafId);
  }, [syncSnapshotNow]);

  // Clean up expired floating callouts periodically
  useEffect(() => {
    if (callouts.length === 0) return;
    const timer = window.setTimeout(() => {
      setCallouts((prev) => prev.slice(1));
    }, 750);
    return () => clearTimeout(timer);
  }, [callouts]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#040914]">
      {/* Isolated WebGL Canvas Container */}
      <div
        ref={canvasMountRef}
        data-testid="arena-canvas"
        className="fixed inset-0 z-0 h-full w-full"
      />

      {gamePhase === 'title' && (
        <TitleScreen
          p1Weapon={p1Weapon}
          p2Weapon={p2Weapon}
          playMode={playMode}
          difficulty={difficulty}
          colorMode={colorMode}
          muted={muted}
          onSelectPreset={handleSelectPreset}
          onOpenCustomSmiles={(pid) => {
            soundEngine.playUiClick();
            setSmilesModalTarget(pid);
          }}
          onChangePlayMode={(mode) => {
            soundEngine.playUiClick();
            setPlayMode(mode);
            rebuildMatch(p1Weapon, p2Weapon, mode, difficulty);
          }}
          onChangeDifficulty={(diff) => {
            soundEngine.playUiClick();
            setDifficulty(diff);
            rebuildMatch(p1Weapon, p2Weapon, playMode, diff);
          }}
          onChangeColorMode={(mode) => {
            soundEngine.playUiClick();
            setColorMode(mode);
          }}
          onToggleMute={handleToggleMute}
          onStart={handleStartFight}
        />
      )}

      {gamePhase !== 'title' && (
        <GameHud
          match={hudSnapshot}
          p1Weapon={p1Weapon}
          p2Weapon={p2Weapon}
          muted={muted}
          callouts={callouts}
          onToggleMute={handleToggleMute}
          onPause={() => {
            heldKeysRef.current.clear();
            justPressedRef.current.clear();
            setGamePhase('paused');
          }}
        />
      )}

      {(gamePhase === 'paused' || gamePhase === 'gameover') && (
        <StatusModal
          mode={gamePhase}
          match={hudSnapshot}
          onResume={() => {
            heldKeysRef.current.clear();
            justPressedRef.current.clear();
            setGamePhase('playing');
          }}
          onRematch={handleStartFight}
          onReturnToTitle={() => {
            soundEngine.playUiClick();
            heldKeysRef.current.clear();
            justPressedRef.current.clear();
            rebuildMatch(p1Weapon, p2Weapon, playMode, difficulty);
            setGamePhase('title');
          }}
        />
      )}

      <SmilesModal
        open={smilesModalTarget !== null}
        playerId={smilesModalTarget ?? 1}
        currentSmiles={smilesModalTarget === 2 ? p2Weapon.smiles : p1Weapon.smiles}
        onClose={() => setSmilesModalTarget(null)}
        onEquip={handleEquipCustomWeapon}
      />
    </main>
  );
}
