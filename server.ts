import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer, type WebSocket } from 'ws';
import { DRUG_PRESETS, parseSmilesToWeapon } from './src/chem/smilesEngine.ts';
import {
  createMatchState,
  emptyInput,
  stepMatch,
  type CombatEvent,
  type FighterInput,
  type MatchState,
} from './src/game/combatEngine.ts';
import { isArenaStageId, type ArenaStageId } from './src/game/arenaStages.ts';
import type {
  ClientToServerMessage,
  HeldInputState,
  OnlineRoomSnapshot,
  OnlineWeaponConfig,
  ServerToClientMessage,
  TriggerInputState,
} from './src/net/onlineProtocol.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const DEFAULT_P1_WEAPON: OnlineWeaponConfig = {
  smiles: DRUG_PRESETS[0].smiles,
  name: DRUG_PRESETS[0].name,
};
const DEFAULT_P2_WEAPON: OnlineWeaponConfig = {
  smiles: DRUG_PRESETS[2].smiles,
  name: DRUG_PRESETS[2].name,
};

function emptyHeld(): HeldInputState {
  return { left: false, right: false, crouch: false, blockHeld: false };
}

function emptyTriggers(): TriggerInputState {
  return { jump: false, punch: false, kick: false, special: false, skill: false, dash: false };
}

interface PlayerConn {
  ws: WebSocket | null;
  ready: boolean;
  weapon: OnlineWeaponConfig;
  held: HeldInputState;
  triggers: TriggerInputState;
}

interface Room {
  roomId: string;
  phase: 'lobby' | 'playing' | 'gameover';
  stage: ArenaStageId;
  p1: PlayerConn;
  p2: PlayerConn;
  match: MatchState | null;
  seq: number;
  tickCount: number;
  pendingEvents: CombatEvent[];
  tickTimer: ReturnType<typeof setInterval> | null;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
  lastStepTime: number;
}

interface ClientMeta {
  roomId: string | null;
  role: 1 | 2 | null;
}

const rooms = new Map<string, Room>();
const clientMeta = new WeakMap<WebSocket, ClientMeta>();

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return rooms.has(id) ? generateRoomId() : id;
}

function sendMsg(ws: WebSocket | null, msg: ServerToClientMessage): void {
  if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify(msg));
}

function toSnapshot(room: Room): OnlineRoomSnapshot {
  return {
    roomId: room.roomId,
    phase: room.phase,
    stage: room.stage,
    p1: {
      connected: Boolean(room.p1.ws && room.p1.ws.readyState === 1),
      ready: room.p1.ready,
      weapon: room.p1.weapon,
    },
    p2: {
      connected: Boolean(room.p2.ws && room.p2.ws.readyState === 1),
      ready: room.p2.ready,
      weapon: room.p2.weapon,
    },
  };
}

function broadcastRoomState(room: Room): void {
  const snap = toSnapshot(room);
  sendMsg(room.p1.ws, { type: 'room_state', room: snap });
  sendMsg(room.p2.ws, { type: 'room_state', room: snap });
}

function stopRoomLoop(room: Room): void {
  if (room.tickTimer) {
    clearInterval(room.tickTimer);
    room.tickTimer = null;
  }
}

function consumeFighterInput(conn: PlayerConn): FighterInput {
  const inp: FighterInput = {
    ...emptyInput(),
    left: conn.held.left,
    right: conn.held.right,
    crouch: conn.held.crouch,
    blockHeld: conn.held.blockHeld,
    jumpJustPressed: conn.triggers.jump,
    punchJustPressed: conn.triggers.punch,
    kickJustPressed: conn.triggers.kick,
    specialJustPressed: conn.triggers.special,
    skillJustPressed: conn.triggers.skill,
    dashJustPressed: conn.triggers.dash,
  };
  conn.triggers = emptyTriggers();
  return inp;
}

function startRoomMatch(room: Room): boolean {
  const p1Parsed = parseSmilesToWeapon(room.p1.weapon.smiles, room.p1.weapon.name, '#38bdf8');
  const p2Parsed = parseSmilesToWeapon(room.p2.weapon.smiles, room.p2.weapon.name, '#f43f5e');
  if (!p1Parsed.success || !p2Parsed.success) {
    return false;
  }

  stopRoomLoop(room);
  room.p1.held = emptyHeld();
  room.p2.held = emptyHeld();
  room.p1.triggers = emptyTriggers();
  room.p2.triggers = emptyTriggers();
  room.pendingEvents = [];
  room.tickCount = 0;
  room.seq = 0;
  room.phase = 'playing';
  room.match = createMatchState(
    { name: p1Parsed.name, formula: p1Parsed.formula, stats: p1Parsed.stats },
    { name: p2Parsed.name, formula: p2Parsed.formula, stats: p2Parsed.stats },
    '2p',
    'normal',
    room.stage
  );
  room.lastStepTime = performance.now();

  sendMsg(room.p1.ws, { type: 'match_started', match: room.match });
  sendMsg(room.p2.ws, { type: 'match_started', match: room.match });
  broadcastRoomState(room);

  room.tickTimer = setInterval(() => {
    if (!room.match || room.phase !== 'playing') {
      stopRoomLoop(room);
      return;
    }

    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.005, (now - room.lastStepTime) / 1000));
    room.lastStepTime = now;

    const p1In = consumeFighterInput(room.p1);
    const p2In = consumeFighterInput(room.p2);
    const prevPhase = room.match.phase;
    const events = stepMatch(room.match, p1In, p2In, dt);

    if (events.length > 0) {
      room.pendingEvents.push(...events);
    }
    room.tickCount += 1;

    const phaseChanged = prevPhase !== room.match.phase;
    const isMatchOver = room.match.phase === 'match_over';
    if (isMatchOver) {
      room.phase = 'gameover';
      stopRoomLoop(room);
      broadcastRoomState(room);
    }

    if (room.pendingEvents.length > 0 || phaseChanged || room.tickCount % 2 === 0 || isMatchOver) {
      room.seq += 1;
      const payload: ServerToClientMessage = {
        type: 'state_sync',
        match: room.match,
        events: room.pendingEvents,
        seq: room.seq,
      };
      room.pendingEvents = [];
      sendMsg(room.p1.ws, payload);
      sendMsg(room.p2.ws, payload);
    }
  }, 1000 / 60);

  return true;
}

function detachClient(ws: WebSocket): void {
  const meta = clientMeta.get(ws);
  if (!meta || !meta.roomId || !meta.role) return;

  const room = rooms.get(meta.roomId);
  meta.roomId = null;
  meta.role = null;
  if (!room) return;

  const leftRole = meta.role;
  const p1Open = Boolean(room.p1.ws && room.p1.ws !== ws && room.p1.ws.readyState === 1);
  const p2Open = Boolean(room.p2.ws && room.p2.ws !== ws && room.p2.ws.readyState === 1);

  if (room.p1.ws === ws) {
    room.p1.ws = null;
    room.p1.ready = false;
    room.p1.held = emptyHeld();
  }
  if (room.p2.ws === ws) {
    room.p2.ws = null;
    room.p2.ready = false;
    room.p2.held = emptyHeld();
  }

  stopRoomLoop(room);
  if (room.phase === 'playing' || room.phase === 'gameover') {
    room.phase = 'lobby';
    room.match = null;
  }

  if (p1Open) {
    sendMsg(room.p1.ws, { type: 'peer_disconnected', role: 2 });
    broadcastRoomState(room);
  }
  if (p2Open) {
    sendMsg(room.p2.ws, { type: 'peer_disconnected', role: 1 });
    broadcastRoomState(room);
  }

  if (!p1Open && !p2Open) {
    if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
    room.cleanupTimer = setTimeout(() => {
      const latest = rooms.get(room.roomId);
      if (!latest) return;
      const stillEmpty =
        (!latest.p1.ws || latest.p1.ws.readyState !== 1) &&
        (!latest.p2.ws || latest.p2.ws.readyState !== 1);
      if (stillEmpty) {
        stopRoomLoop(latest);
        rooms.delete(room.roomId);
      }
    }, 30_000);
  }
  void leftRole;
}

async function bootstrap(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
  });

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    clientMeta.set(ws, { roomId: null, role: null });

    ws.on('message', (raw) => {
      let msg: ClientToServerMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientToServerMessage;
      } catch {
        sendMsg(ws, { type: 'error', message: 'Gói tin không hợp lệ.' });
        return;
      }

      if (msg.type === 'ping') {
        sendMsg(ws, { type: 'pong', ts: msg.ts });
        return;
      }

      if (msg.type === 'create_room') {
        detachClient(ws);
        const parsed = parseSmilesToWeapon(msg.weapon.smiles, msg.weapon.name, '#38bdf8');
        const safeWeapon = parsed.success
          ? { smiles: parsed.smiles, name: parsed.name }
          : DEFAULT_P1_WEAPON;

        const roomId = generateRoomId();
        const safeStage: ArenaStageId = isArenaStageId(msg.stage) ? msg.stage : 'cell';
        const room: Room = {
          roomId,
          phase: 'lobby',
          stage: safeStage,
          p1: {
            ws,
            ready: true,
            weapon: safeWeapon,
            held: emptyHeld(),
            triggers: emptyTriggers(),
          },
          p2: {
            ws: null,
            ready: false,
            weapon: DEFAULT_P2_WEAPON,
            held: emptyHeld(),
            triggers: emptyTriggers(),
          },
          match: null,
          seq: 0,
          tickCount: 0,
          pendingEvents: [],
          tickTimer: null,
          cleanupTimer: null,
          lastStepTime: performance.now(),
        };
        rooms.set(roomId, room);
        clientMeta.set(ws, { roomId, role: 1 });
        sendMsg(ws, { type: 'room_joined', role: 1, room: toSnapshot(room) });
        return;
      }

      if (msg.type === 'join_room') {
        detachClient(ws);
        const code = msg.roomId.trim().toUpperCase();
        const room = rooms.get(code);
        if (!room) {
          sendMsg(ws, { type: 'error', message: 'Không tìm thấy phòng đấu hoặc phòng đã đóng.' });
          return;
        }
        if (room.cleanupTimer) {
          clearTimeout(room.cleanupTimer);
          room.cleanupTimer = null;
        }

        const parsed = parseSmilesToWeapon(msg.weapon.smiles, msg.weapon.name, '#f43f5e');
        const safeWeapon = parsed.success
          ? { smiles: parsed.smiles, name: parsed.name }
          : DEFAULT_P2_WEAPON;

        const p1Open = Boolean(room.p1.ws && room.p1.ws.readyState === 1);
        const p2Open = Boolean(room.p2.ws && room.p2.ws.readyState === 1);

        if (!p2Open) {
          room.p2.ws = ws;
          room.p2.weapon = safeWeapon;
          room.p2.ready = false;
          room.p2.held = emptyHeld();
          room.p2.triggers = emptyTriggers();
          clientMeta.set(ws, { roomId: code, role: 2 });
          sendMsg(ws, { type: 'room_joined', role: 2, room: toSnapshot(room) });
          broadcastRoomState(room);
        } else if (!p1Open) {
          // Allow host reclaim if P1 dropped
          room.p1.ws = ws;
          room.p1.ready = true;
          room.p1.held = emptyHeld();
          room.p1.triggers = emptyTriggers();
          clientMeta.set(ws, { roomId: code, role: 1 });
          sendMsg(ws, { type: 'room_joined', role: 1, room: toSnapshot(room) });
          broadcastRoomState(room);
        } else {
          sendMsg(ws, { type: 'error', message: 'Phòng đấu đã đủ 2 người chơi.' });
        }
        return;
      }

      const meta = clientMeta.get(ws);
      if (!meta || !meta.roomId || !meta.role) return;
      const room = rooms.get(meta.roomId);
      if (!room) return;
      const slot = meta.role === 1 ? room.p1 : room.p2;

      if (msg.type === 'update_weapon') {
        const accent = meta.role === 1 ? '#38bdf8' : '#f43f5e';
        const parsed = parseSmilesToWeapon(msg.weapon.smiles, msg.weapon.name, accent);
        if (!parsed.success) {
          sendMsg(ws, { type: 'error', message: parsed.error || 'SMILES không hợp lệ.' });
          return;
        }
        slot.weapon = { smiles: parsed.smiles, name: parsed.name };
        broadcastRoomState(room);
      } else if (msg.type === 'update_stage') {
        if (meta.role !== 1) return;
        if (isArenaStageId(msg.stage)) {
          room.stage = msg.stage;
          broadcastRoomState(room);
        }
      } else if (msg.type === 'set_ready') {
        slot.ready = Boolean(msg.ready);
        broadcastRoomState(room);
      } else if (msg.type === 'start_match') {
        if (meta.role !== 1) return;
        const p2Open = Boolean(room.p2.ws && room.p2.ws.readyState === 1);
        if (!p2Open) {
          sendMsg(ws, { type: 'error', message: 'Cần bạn bè vào phòng (P2) trước khi bắt đầu.' });
          return;
        }
        startRoomMatch(room);
      } else if (msg.type === 'request_rematch') {
        const p1Open = Boolean(room.p1.ws && room.p1.ws.readyState === 1);
        const p2Open = Boolean(room.p2.ws && room.p2.ws.readyState === 1);
        if (p1Open && p2Open) {
          startRoomMatch(room);
        }
      } else if (msg.type === 'return_to_lobby') {
        stopRoomLoop(room);
        room.phase = 'lobby';
        room.match = null;
        room.p2.ready = false;
        broadcastRoomState(room);
      } else if (msg.type === 'input') {
        if (room.phase !== 'playing') return;
        slot.held = {
          left: Boolean(msg.held.left),
          right: Boolean(msg.held.right),
          crouch: Boolean(msg.held.crouch),
          blockHeld: Boolean(msg.held.blockHeld),
        };
        if (msg.triggers.jump) slot.triggers.jump = true;
        if (msg.triggers.punch) slot.triggers.punch = true;
        if (msg.triggers.kick) slot.triggers.kick = true;
        if (msg.triggers.special) slot.triggers.special = true;
        if (msg.triggers.dash) slot.triggers.dash = true;
      }
    });

    ws.on('close', () => {
      detachClient(ws);
    });
  });

  if (IS_PROD) {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Drug Fighter server listening on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
