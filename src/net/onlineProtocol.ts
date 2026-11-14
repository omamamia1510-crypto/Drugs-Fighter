import type { ArenaStageId } from '../game/arenaStages';
import type { CombatEvent, MatchState } from '../game/combatEngine';

export interface OnlineWeaponConfig {
  smiles: string;
  name: string;
}

export interface OnlinePlayerSlot {
  connected: boolean;
  ready: boolean;
  weapon: OnlineWeaponConfig;
}

export interface OnlineRoomSnapshot {
  roomId: string;
  phase: 'lobby' | 'playing' | 'gameover';
  stage: ArenaStageId;
  p1: OnlinePlayerSlot;
  p2: OnlinePlayerSlot;
}

export interface HeldInputState {
  left: boolean;
  right: boolean;
  crouch: boolean;
  blockHeld: boolean;
}

export interface TriggerInputState {
  jump: boolean;
  punch: boolean;
  kick: boolean;
  special: boolean;
  skill: boolean;
  dash: boolean;
}

export type ClientToServerMessage =
  | { type: 'create_room'; weapon: OnlineWeaponConfig; stage?: ArenaStageId }
  | { type: 'join_room'; roomId: string; weapon: OnlineWeaponConfig }
  | { type: 'update_weapon'; weapon: OnlineWeaponConfig }
  | { type: 'update_stage'; stage: ArenaStageId }
  | { type: 'set_ready'; ready: boolean }
  | { type: 'start_match' }
  | { type: 'request_rematch' }
  | { type: 'return_to_lobby' }
  | { type: 'input'; held: HeldInputState; triggers: TriggerInputState }
  | { type: 'ping'; ts: number };

export type ServerToClientMessage =
  | { type: 'room_joined'; role: 1 | 2; room: OnlineRoomSnapshot }
  | { type: 'room_state'; room: OnlineRoomSnapshot }
  | { type: 'match_started'; match: MatchState }
  | { type: 'state_sync'; match: MatchState; events: CombatEvent[]; seq: number }
  | { type: 'peer_disconnected'; role: 1 | 2 }
  | { type: 'error'; message: string }
  | { type: 'pong'; ts: number };
