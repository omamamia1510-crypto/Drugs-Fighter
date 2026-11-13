import React, { useCallback, useEffect, useRef, useState } from 'react';
import { soundEngine } from './audio/soundEngine';
import { DRUG_PRESETS, parseSmilesToWeapon, type ParsedMolecule } from './chem/smilesEngine';
import { GameHud, type FloatingCallout } from './components/GameHud';
import { OnlineInviteModal } from './components/OnlineInviteModal';
import { SmilesModal } from './components/SmilesModal';
import { StatusModal } from './components/StatusModal';
import { TitleScreen } from './components/TitleScreen';
import { ArenaRenderer } from './game/ArenaRenderer';
import { isArenaStageId, type ArenaStageId } from './game/arenaStages';
import {
  createMatchState,
  emptyBuffs,
  emptyInput,
  stepMatch,
  type ColorSchemeMode,
  type CombatEvent,
  type CpuDifficulty,
  type FighterInput,
  type FighterState,
  type MatchState,
  type PlayMode,
  type PowerUpType,
} from './game/combatEngine';
import { OnlineClient } from './net/onlineClient';
import type {
  HeldInputState,
  OnlineRoomSnapshot,
  ServerToClientMessage,
  TriggerInputState,
} from './net/onlineProtocol';

type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

function getInitialWeapon(presetIndex: number, accentHex: string): ParsedMolecule {
  const preset = DRUG_PRESETS[presetIndex];
  const parsed = parseSmilesToWeapon(preset.smiles, preset.name, accentHex);
  if (!parsed.success) {
    throw new Error('Failed to parse default preset molecule');
  }
  return parsed;
}

function cloneMatchState(src: MatchState): MatchState {
  return {
    ...src,
    p1: { ...src.p1, buffs: { ...(src.p1.buffs ?? emptyBuffs()) } },
    p2: { ...src.p2, buffs: { ...(src.p2.buffs ?? emptyBuffs()) } },
    projectiles: src.projectiles.map((p) => ({ ...p })),
    powerUps: (src.powerUps ?? []).map((p) => ({ ...p })),
  };
}

const POWERUP_CALLOUT_META: Record<PowerUpType, { text: string; color: string }> = {
  lightning: { text: '+TỐC ĐÁNH!', color: '#facc15' },
  fist: { text: '+SÁT THƯƠNG!', color: '#fb923c' },
  shrink: { text: 'THU NHỎ!', color: '#34d399' },
  triple_throw: { text: 'NÉM x3!', color: '#c084fc' },
  giant: { text: 'PHÓNG TO!', color: '#fbbf24' },
};

function sameHeld(a: HeldInputState | null, b: HeldInputState): boolean {
  if (!a) return false;
  return (
    a.left === b.left &&
    a.right === b.right &&
    a.crouch === b.crouch &&
    a.blockHeld === b.blockHeld
  );
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const arenaRef = useRef<ArenaRenderer | null>(null);

  const [p1Weapon, setP1Weapon] = useState<ParsedMolecule>(() => getInitialWeapon(0, '#38bdf8'));
  const [p2Weapon, setP2Weapon] = useState<ParsedMolecule>(() => getInitialWeapon(2, '#f43f5e'));
  const p1WeaponRef = useRef(p1Weapon);
  p1WeaponRef.current = p1Weapon;
  const p2WeaponRef = useRef(p2Weapon);
  p2WeaponRef.current = p2Weapon;

  const [playMode, setPlayMode] = useState<PlayMode>('1p');
  const [difficulty, setDifficulty] = useState<CpuDifficulty>('normal');
  const [colorMode, setColorMode] = useState<ColorSchemeMode>('elemental');
  const [arenaStage, setArenaStage] = useState<ArenaStageId>(() => {
    if (typeof window !== 'undefined') {
      const s = new URLSearchParams(window.location.search).get('stage');
      if (isArenaStageId(s)) return s;
    }
    return 'cell';
  });
  const arenaStageRef = useRef<ArenaStageId>(arenaStage);
  arenaStageRef.current = arenaStage;
  const [muted, setMuted] = useState(false);

  const [gamePhase, setGamePhase] = useState<GamePhase>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1' && !params.get('room')) return 'playing';
    }
    return 'title';
  });

  const [smilesModalTarget, setSmilesModalTarget] = useState<1 | 2 | null>(null);
  const [callouts, setCallouts] = useState<FloatingCallout[]>([]);
  const [outroWinner, setOutroWinner] = useState<1 | 2 | null>(null);
  const outroWinnerRef = useRef<1 | 2 | null>(null);
  const outroTimeoutRef = useRef<number | null>(null);

  // Online Solo State
  const [onlineRole, setOnlineRole] = useState<1 | 2 | null>(null);
  const [onlineRoom, setOnlineRoom] = useState<OnlineRoomSnapshot | null>(null);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const onlineRoleRef = useRef<1 | 2 | null>(null);
  onlineRoleRef.current = onlineRole;
  const inviteModalOpenRef = useRef(false);
  inviteModalOpenRef.current = inviteModalOpen;

  const onlineClientRef = useRef<OnlineClient | null>(null);
  const onlineTargetMatchRef = useRef<MatchState | null>(null);
  const pendingOnlineEventsRef = useRef<CombatEvent[]>([]);
  const lastSentHeldRef = useRef<HeldInputState | null>(null);

  const matchRef = useRef<MatchState>(
    createMatchState(
      { name: p1Weapon.name, formula: p1Weapon.formula, stats: p1Weapon.stats },
      { name: p2Weapon.name, formula: p2Weapon.formula, stats: p2Weapon.stats },
      playMode,
      difficulty
    )
  );
  const [hudSnapshot, setHudSnapshot] = useState<MatchState>(() => cloneMatchState(matchRef.current));

  const gamePhaseRef = useRef<GamePhase>(gamePhase);
  gamePhaseRef.current = gamePhase;

  const heldKeysRef = useRef<Set<string>>(new Set());
  const justPressedRef = useRef<Set<string>>(new Set());
  const calloutIdRef = useRef(1);
  const smilesOpenRef = useRef(false);
  smilesOpenRef.current = smilesModalTarget !== null;

  useEffect(() => {
    document.body.dataset.state = gamePhase;
  }, [gamePhase]);

  const clearOutroState = useCallback(() => {
    if (outroTimeoutRef.current !== null) {
      window.clearTimeout(outroTimeoutRef.current);
      outroTimeoutRef.current = null;
    }
    outroWinnerRef.current = null;
    setOutroWinner(null);
    arenaRef.current?.clearStageOutro();
  }, []);

  const finishOutro = useCallback(() => {
    if (outroTimeoutRef.current !== null) {
      window.clearTimeout(outroTimeoutRef.current);
      outroTimeoutRef.current = null;
    }
    outroWinnerRef.current = null;
    setOutroWinner(null);
    soundEngine.playVictory();
    document.body.dataset.state = 'gameover';
    setGamePhase('gameover');
  }, []);

  useEffect(() => {
    return () => {
      if (outroTimeoutRef.current !== null) {
        window.clearTimeout(outroTimeoutRef.current);
        outroTimeoutRef.current = null;
      }
    };
  }, []);

  const syncSnapshotNow = useCallback(() => {
    setHudSnapshot(cloneMatchState(matchRef.current));
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

  const processCombatEvents = useCallback(
    (events: CombatEvent[], prevPhase: MatchState['phase'], currPhase: MatchState['phase']) => {
      const arena = arenaRef.current;
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
        } else if (ev.type === 'throw') {
          soundEngine.playThrow();
        } else if (ev.type === 'uppercut_start' || ev.type === 'lunge_start') {
          soundEngine.playSwing(true);
        } else if (ev.type === 'special_start') {
          soundEngine.playSpecial();
        } else if (ev.type === 'powerup_pickup') {
          soundEngine.playPowerUpPickup(ev.powerUpType);
          const screen = arena?.projectToScreen(ev.x, ev.y + 0.9);
          if (screen) {
            const meta = POWERUP_CALLOUT_META[ev.powerUpType];
            newCallouts.push({
              id: calloutIdRef.current++,
              x: screen.x,
              y: screen.y,
              text: meta.text,
              color: meta.color,
            });
          }
        } else if (ev.type === 'round_end') {
          soundEngine.playKO();
          if (ev.reason === 'ko') {
            soundEngine.playDecompose();
          }
        } else if (ev.type === 'match_end') {
          if (ev.winnerId === 1 || ev.winnerId === 2) {
            if (outroWinnerRef.current === null && gamePhaseRef.current !== 'gameover') {
              outroWinnerRef.current = ev.winnerId;
              setOutroWinner(ev.winnerId);
              arena?.startStageOutro(arenaStageRef.current, ev.winnerId);
              soundEngine.playStageOutro(arenaStageRef.current);
              if (outroTimeoutRef.current !== null) {
                window.clearTimeout(outroTimeoutRef.current);
              }
              outroTimeoutRef.current = window.setTimeout(finishOutro, 3800);
            }
          } else {
            soundEngine.playVictory();
            setGamePhase('gameover');
            document.body.dataset.state = 'gameover';
          }
        }
      }

      if (prevPhase === 'round_intro' && currPhase === 'fighting') {
        soundEngine.playRoundStart();
      }

      if (newCallouts.length > 0) {
        setCallouts((prev) => [...prev.slice(-8), ...newCallouts]);
      }
    },
    [finishOutro]
  );

  const applyRoomWeapons = useCallback(
    (room: OnlineRoomSnapshot) => {
      let nextW1 = p1WeaponRef.current;
      let nextW2 = p2WeaponRef.current;
      let changed = false;

      if (
        room.p1.weapon.smiles !== nextW1.smiles ||
        room.p1.weapon.name !== nextW1.name
      ) {
        const parsed1 = parseSmilesToWeapon(room.p1.weapon.smiles, room.p1.weapon.name, '#38bdf8');
        if (parsed1.success) {
          nextW1 = parsed1;
          setP1Weapon(parsed1);
          arenaRef.current?.setWeapon(1, parsed1);
          changed = true;
        }
      }

      if (
        room.p2.weapon.smiles !== nextW2.smiles ||
        room.p2.weapon.name !== nextW2.name
      ) {
        const parsed2 = parseSmilesToWeapon(room.p2.weapon.smiles, room.p2.weapon.name, '#f43f5e');
        if (parsed2.success) {
          nextW2 = parsed2;
          setP2Weapon(parsed2);
          arenaRef.current?.setWeapon(2, parsed2);
          changed = true;
        }
      }

      if (changed && gamePhaseRef.current === 'title') {
        rebuildMatch(nextW1, nextW2, '2p', 'normal');
      }
    },
    [rebuildMatch]
  );

  const handleServerMessage = useCallback(
    (msg: ServerToClientMessage) => {
      if (msg.type === 'room_joined') {
        setOnlineError(null);
        setOnlineRole(msg.role);
        onlineRoleRef.current = msg.role;
        setOnlineRoom(msg.room);
        setArenaStage(msg.room.stage);
        setPlayMode('2p');
        applyRoomWeapons(msg.room);
        if (msg.role === 1) {
          setInviteModalOpen(true);
        } else {
          setInviteModalOpen(false);
          setGamePhase('title');
          document.body.dataset.state = 'title';
        }
      } else if (msg.type === 'room_state') {
        setOnlineRoom(msg.room);
        setArenaStage(msg.room.stage);
        applyRoomWeapons(msg.room);
        if (msg.room.phase === 'lobby' && gamePhaseRef.current !== 'title') {
          clearOutroState();
          heldKeysRef.current.clear();
          justPressedRef.current.clear();
          lastSentHeldRef.current = null;
          onlineTargetMatchRef.current = null;
          pendingOnlineEventsRef.current = [];
          setCallouts([]);
          setGamePhase('title');
          document.body.dataset.state = 'title';
          rebuildMatch(p1WeaponRef.current, p2WeaponRef.current, '2p', 'normal');
        }
      } else if (msg.type === 'match_started') {
        clearOutroState();
        setOnlineError(null);
        setInviteModalOpen(false);
        heldKeysRef.current.clear();
        justPressedRef.current.clear();
        lastSentHeldRef.current = null;
        pendingOnlineEventsRef.current = [];
        setCallouts([]);

        const cloned = cloneMatchState(msg.match);
        matchRef.current = cloned;
        onlineTargetMatchRef.current = cloneMatchState(msg.match);
        syncSnapshotNow();
        soundEngine.playRoundStart();
        document.body.dataset.state = 'playing';
        setGamePhase('playing');
      } else if (msg.type === 'state_sync') {
        const prevPhase = onlineTargetMatchRef.current?.phase ?? matchRef.current.phase;
        onlineTargetMatchRef.current = msg.match;

        const m = matchRef.current;
        const t = msg.match;
        const roundReset =
          prevPhase !== t.phase ||
          Math.abs(t.p1.x - m.p1.x) > 1.8 ||
          Math.abs(t.p2.x - m.p2.x) > 1.8;

        m.phase = t.phase;
        m.phaseTimer = t.phaseTimer;
        m.roundNumber = t.roundNumber;
        m.roundTimer = t.roundTimer;
        m.roundWinner = t.roundWinner;
        m.matchWinner = t.matchWinner;
        m.hitstopTimer = t.hitstopTimer;
        m.cameraTrauma = t.cameraTrauma;
        m.projectiles = t.projectiles.map((p) => ({ ...p }));
        m.powerUps = (t.powerUps ?? []).map((p) => ({ ...p }));

        const syncFighterState = (dst: FighterState, src: FighterState) => {
          const prevX = dst.x;
          const prevY = dst.y;
          Object.assign(dst, src);
          dst.buffs = { ...(src.buffs ?? emptyBuffs()) };
          if (!roundReset) {
            dst.x = prevX;
            dst.y = prevY;
          }
        };

        syncFighterState(m.p1, t.p1);
        syncFighterState(m.p2, t.p2);

        if (msg.events.length > 0) {
          pendingOnlineEventsRef.current.push(...msg.events);
        }
        processCombatEvents(msg.events, prevPhase, t.phase);

        if (msg.events.length > 0 || prevPhase !== t.phase) {
          syncSnapshotNow();
        }
      } else if (msg.type === 'peer_disconnected') {
        clearOutroState();
        setOnlineError(
          msg.role === 2
            ? 'Bạn bè (P2) đã thoát khỏi phòng.'
            : 'Host (P1) đã ngắt kết nối.'
        );
        if (gamePhaseRef.current !== 'title') {
          heldKeysRef.current.clear();
          justPressedRef.current.clear();
          onlineTargetMatchRef.current = null;
          setGamePhase('title');
          document.body.dataset.state = 'title';
        }
      } else if (msg.type === 'error') {
        setOnlineError(msg.message);
      }
    },
    [applyRoomWeapons, clearOutroState, processCombatEvents, rebuildMatch, syncSnapshotNow]
  );

  const ensureOnlineClient = useCallback((): OnlineClient => {
    if (!onlineClientRef.current) {
      const client = new OnlineClient(handleServerMessage, () => {});
      onlineClientRef.current = client;
    }
    onlineClientRef.current.connect();
    return onlineClientRef.current;
  }, [handleServerMessage]);

  // Auto-join room when friend opens ?room=ROOM_ID invite link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam && roomParam.trim().length > 0) {
      const client = ensureOnlineClient();
      client.send({
        type: 'join_room',
        roomId: roomParam.trim().toUpperCase(),
        weapon: {
          smiles: p2WeaponRef.current.smiles,
          name: p2WeaponRef.current.name,
        },
      });
    }

    return () => {
      onlineClientRef.current?.disconnect();
      onlineClientRef.current = null;
    };
  }, [ensureOnlineClient]);

  const handleCreateOnlineRoom = useCallback(() => {
    soundEngine.playUiClick();
    setOnlineError(null);
    const client = ensureOnlineClient();
    client.send({
      type: 'create_room',
      weapon: {
        smiles: p1WeaponRef.current.smiles,
        name: p1WeaponRef.current.name,
      },
      stage: arenaStageRef.current,
    });
  }, [ensureOnlineClient]);

  const handleLeaveOnlineRoom = useCallback(() => {
    soundEngine.playUiClick();
    clearOutroState();
    onlineClientRef.current?.disconnect();
    onlineClientRef.current = null;
    setOnlineRole(null);
    onlineRoleRef.current = null;
    setOnlineRoom(null);
    setOnlineError(null);
    setInviteModalOpen(false);
    onlineTargetMatchRef.current = null;
    pendingOnlineEventsRef.current = [];
    lastSentHeldRef.current = null;

    const url = new URL(window.location.href);
    if (url.searchParams.has('room')) {
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url.pathname + url.search);
    }

    setGamePhase('title');
    document.body.dataset.state = 'title';
    rebuildMatch(p1WeaponRef.current, p2WeaponRef.current, playMode, difficulty);
  }, [clearOutroState, difficulty, playMode, rebuildMatch]);

  const handleToggleReady = useCallback(() => {
    soundEngine.playUiClick();
    if (!onlineRoom || onlineRoleRef.current !== 2) return;
    onlineClientRef.current?.send({
      type: 'set_ready',
      ready: !onlineRoom.p2.ready,
    });
  }, [onlineRoom]);

  const handleStartFight = useCallback(() => {
    if (onlineRoleRef.current === 1) {
      soundEngine.playUiClick();
      onlineClientRef.current?.send({ type: 'start_match' });
      return;
    }
    if (onlineRoleRef.current === 2) {
      return;
    }

    clearOutroState();
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
  }, [clearOutroState, difficulty, p1Weapon, p2Weapon, playMode, rebuildMatch]);

  const handleRematch = useCallback(() => {
    if (onlineRoleRef.current !== null) {
      soundEngine.playUiClick();
      onlineClientRef.current?.send({ type: 'request_rematch' });
      return;
    }
    handleStartFight();
  }, [handleStartFight]);

  const handleReturnToTitle = useCallback(() => {
    soundEngine.playUiClick();
    clearOutroState();
    heldKeysRef.current.clear();
    justPressedRef.current.clear();
    if (onlineRoleRef.current !== null) {
      onlineClientRef.current?.send({ type: 'return_to_lobby' });
      setGamePhase('title');
      document.body.dataset.state = 'title';
      return;
    }
    rebuildMatch(p1Weapon, p2Weapon, playMode, difficulty);
    setGamePhase('title');
  }, [clearOutroState, difficulty, p1Weapon, p2Weapon, playMode, rebuildMatch]);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const handleSelectPreset = useCallback(
    (playerId: 1 | 2, smiles: string, name: string) => {
      if (onlineRoleRef.current !== null && onlineRoleRef.current !== playerId) {
        return;
      }
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

      if (onlineRoleRef.current === playerId) {
        onlineClientRef.current?.send({
          type: 'update_weapon',
          weapon: { smiles: parsed.smiles, name: parsed.name },
        });
      }
    },
    [difficulty, p1Weapon, p2Weapon, playMode, rebuildMatch]
  );

  const handleEquipCustomWeapon = useCallback(
    (playerId: 1 | 2, mol: ParsedMolecule) => {
      if (onlineRoleRef.current !== null && onlineRoleRef.current !== playerId) {
        return;
      }
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

      if (onlineRoleRef.current === playerId) {
        onlineClientRef.current?.send({
          type: 'update_weapon',
          weapon: { smiles: mol.smiles, name: mol.name },
        });
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
    renderer.setStage(arenaStage);
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

  // Update 3D arena stage live
  useEffect(() => {
    arenaRef.current?.setStage(arenaStage);
  }, [arenaStage]);

  // Unified Window Input Hub
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (smilesOpenRef.current) {
        if (e.key === 'Escape') setSmilesModalTarget(null);
        return;
      }

      if (inviteModalOpenRef.current) {
        if (e.key === 'Escape') setInviteModalOpen(false);
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
        if ((key === 'enter' || key === ' ') && onlineRoleRef.current === null) {
          e.preventDefault();
          handleStartFight();
          return;
        }
      }

      if (
        onlineRoleRef.current === null &&
        (key === 'escape' || (key === 'p' && gamePhaseRef.current !== 'title'))
      ) {
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

      if (
        key === 'm' &&
        !(
          gamePhaseRef.current === 'playing' &&
          (matchRef.current.playMode === '2p' || onlineRoleRef.current !== null)
        )
      ) {
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

  // 60Hz Simulation / Render Loop decoupled from React
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

      // Online authoritative mode
      if (onlineRoleRef.current !== null) {
        const held = heldKeysRef.current;
        const just = justPressedRef.current;

        if (phase === 'playing') {
          const allowP2AltKeys = onlineRoleRef.current === 2;
          const nextHeld: HeldInputState = {
            left: held.has('a') || (allowP2AltKeys && held.has('arrowleft')),
            right: held.has('d') || (allowP2AltKeys && held.has('arrowright')),
            crouch: held.has('s') || (allowP2AltKeys && held.has('arrowdown')),
            blockHeld: held.has('h') || held.has('l') || (allowP2AltKeys && held.has('/')),
          };
          const nextTriggers: TriggerInputState = {
            jump: just.has('w') || (allowP2AltKeys && just.has('arrowup')),
            punch: just.has('f') || just.has('j') || (allowP2AltKeys && just.has(',')),
            kick: just.has('g') || just.has('k') || (allowP2AltKeys && just.has('.')),
            special: just.has('r') || just.has('u') || (allowP2AltKeys && just.has('m')),
            dash:
              just.has('shift') ||
              (allowP2AltKeys && (just.has('control') || just.has(' '))),
          };
          just.clear();

          const hasTrigger =
            nextTriggers.jump ||
            nextTriggers.punch ||
            nextTriggers.kick ||
            nextTriggers.special ||
            nextTriggers.dash;

          if (hasTrigger || !sameHeld(lastSentHeldRef.current, nextHeld)) {
            lastSentHeldRef.current = nextHeld;
            onlineClientRef.current?.send({
              type: 'input',
              held: nextHeld,
              triggers: nextTriggers,
            });
          }
        }

        const target = onlineTargetMatchRef.current;
        if (target && phase === 'playing') {
          const alpha = Math.min(1, 1 - Math.exp(-26 * rawDt));
          match.p1.x += (target.p1.x - match.p1.x) * alpha;
          match.p1.y += (target.p1.y - match.p1.y) * alpha;
          match.p2.x += (target.p2.x - match.p2.x) * alpha;
          match.p2.y += (target.p2.y - match.p2.y) * alpha;
        }

        const eventsToRender = pendingOnlineEventsRef.current;
        pendingOnlineEventsRef.current = [];
        arena?.syncMatch(match, phase === 'gameover' ? 'gameover' : 'playing', eventsToRender);

        hudAccumulator += rawDt;
        if (hudAccumulator >= 0.05 && phase === 'playing') {
          hudAccumulator = 0;
          syncSnapshotNow();
        }
        return;
      }

      if (phase === 'paused' || phase === 'gameover') {
        arena?.syncMatch(match, phase, []);
        return;
      }

      // Offline 1P / 2P Local Simulation
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

      processCombatEvents(events, prevPhase, match.phase);
      arena?.syncMatch(match, 'playing', events);

      hudAccumulator += rawDt;
      if (hudAccumulator >= 0.05 || events.length > 0 || prevPhase !== match.phase) {
        hudAccumulator = 0;
        syncSnapshotNow();
      }
    };

    rafId = requestAnimationFrame(stepLoop);
    return () => cancelAnimationFrame(rafId);
  }, [processCombatEvents, syncSnapshotNow]);

  // Clean up expired floating callouts periodically
  useEffect(() => {
    if (callouts.length === 0) return;
    const timer = window.setTimeout(() => {
      setCallouts((prev) => prev.slice(1));
    }, 750);
    return () => clearTimeout(timer);
  }, [callouts]);

  const inviteUrl =
    onlineRoom && typeof window !== 'undefined'
      ? `${window.location.origin}/?room=${onlineRoom.roomId}`
      : '';

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
          arenaStage={arenaStage}
          muted={muted}
          onlineRole={onlineRole}
          onlineRoom={onlineRoom}
          onlineError={onlineError}
          onSelectPreset={handleSelectPreset}
          onOpenCustomSmiles={(pid) => {
            if (onlineRole !== null && onlineRole !== pid) return;
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
          onChangeStage={(stage) => {
            if (onlineRoleRef.current === 2) return;
            soundEngine.playUiClick();
            setArenaStage(stage);
            if (onlineRoleRef.current === 1) {
              onlineClientRef.current?.send({ type: 'update_stage', stage });
            }
          }}
          onToggleMute={handleToggleMute}
          onStart={handleStartFight}
          onCreateOnlineRoom={handleCreateOnlineRoom}
          onOpenInviteModal={() => {
            soundEngine.playUiClick();
            setInviteModalOpen(true);
          }}
          onToggleReady={handleToggleReady}
          onLeaveOnlineRoom={handleLeaveOnlineRoom}
        />
      )}

      {gamePhase !== 'title' && (
        <GameHud
          match={hudSnapshot}
          p1Weapon={p1Weapon}
          p2Weapon={p2Weapon}
          arenaStage={arenaStage}
          muted={muted}
          onlineRole={onlineRole}
          outroWinner={outroWinner}
          callouts={callouts}
          onToggleMute={handleToggleMute}
          onSkipOutro={finishOutro}
          onPause={() => {
            if (onlineRole !== null) {
              handleReturnToTitle();
              return;
            }
            if (outroWinnerRef.current !== null) {
              finishOutro();
              return;
            }
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
          onlineRole={onlineRole}
          onResume={() => {
            heldKeysRef.current.clear();
            justPressedRef.current.clear();
            setGamePhase('playing');
          }}
          onRematch={handleRematch}
          onReturnToTitle={handleReturnToTitle}
        />
      )}

      <OnlineInviteModal
        open={inviteModalOpen && onlineRole === 1}
        room={onlineRoom}
        inviteUrl={inviteUrl}
        onClose={() => setInviteModalOpen(false)}
        onStartMatch={() => {
          setInviteModalOpen(false);
          handleStartFight();
        }}
      />

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
