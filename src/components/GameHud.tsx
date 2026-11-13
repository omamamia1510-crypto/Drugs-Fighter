import React from 'react';
import { Pause, Volume2, VolumeX } from 'lucide-react';
import type { ParsedMolecule } from '../chem/smilesEngine';
import type { MatchState } from '../game/combatEngine';

export interface FloatingCallout {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
}

interface GameHudProps {
  match: MatchState;
  p1Weapon: ParsedMolecule;
  p2Weapon: ParsedMolecule;
  muted: boolean;
  callouts: FloatingCallout[];
  onToggleMute: () => void;
  onPause: () => void;
}

const RoundSockets: React.FC<{ won: number; accent: string }> = ({ won, accent }) => (
  <div className="flex items-center gap-1.5" aria-label={`Đã thắng ${won} hiệp`}>
    {[0, 1].map((idx) => (
      <span
        key={idx}
        className="inline-block h-3 w-3 rounded-full border"
        style={{
          borderColor: idx < won ? accent : '#475569',
          backgroundColor: idx < won ? accent : 'transparent',
        }}
      />
    ))}
  </div>
);

export const GameHud: React.FC<GameHudProps> = ({
  match,
  p1Weapon,
  p2Weapon,
  muted,
  callouts,
  onToggleMute,
  onPause,
}) => {
  const { p1, p2 } = match;
  const p1Pct = Math.max(0, Math.min(100, (p1.hp / p1.maxHp) * 100));
  const p1GhostPct = Math.max(0, Math.min(100, (p1.ghostHp / p1.maxHp) * 100));
  const p2Pct = Math.max(0, Math.min(100, (p2.hp / p2.maxHp) * 100));
  const p2GhostPct = Math.max(0, Math.min(100, (p2.ghostHp / p2.maxHp) * 100));

  const timerDisplay = String(Math.ceil(match.roundTimer)).padStart(2, '0');

  let bannerText = '';
  let bannerColor = '#f8fafc';
  if (match.phase === 'round_intro') {
    bannerText = match.phaseTimer > 0.45 ? `HIỆP ${match.roundNumber}` : 'CHIẾN!';
    bannerColor = match.phaseTimer > 0.45 ? '#7dd3fc' : '#facc15';
  } else if (match.phase === 'round_ko') {
    bannerText = match.roundTimer <= 0 ? 'HẾT GIỜ!' : 'K.O.!';
    bannerColor = '#f43f5e';
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 md:px-7 md:py-5">
      {/* Top Perimeter Combat HUD */}
      <div className="flex items-start justify-between gap-4">
        {/* P1 Bar Cluster */}
        <div className="flex w-[38%] max-w-[460px] items-start gap-3">
          <div
            className="hidden h-16 w-16 shrink-0 rounded-lg border-2 p-1 sm:block"
            style={{
              backgroundColor: 'rgba(7, 16, 34, 0.92)',
              borderColor: '#38bdf8',
            }}
            dangerouslySetInnerHTML={{ __html: p1Weapon.svg2d }}
          />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="font-display truncate text-sm font-bold tracking-wide text-sky-300">
                  P1 · {p1.name.toUpperCase()}
                </span>
                <span className="font-mono-tabular hidden text-xs text-slate-400 md:inline">
                  {p1.formula}
                </span>
              </div>
              <RoundSockets won={p1.roundsWon} accent="#38bdf8" />
            </div>

            {/* HP Track with Delayed Ghost Bar */}
            <div className="relative h-4 w-full overflow-hidden rounded border border-slate-700 bg-slate-950">
              <div
                className="absolute inset-y-0 left-0 bg-white/65 transition-none"
                style={{ width: `${p1GhostPct}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 transition-none"
                style={{
                  width: `${p1Pct}%`,
                  backgroundColor: p1Pct < 25 ? '#f59e0b' : '#38bdf8',
                }}
              />
              <span
                className="font-mono-tabular relative z-10 flex h-full items-center px-2 text-[10px] font-bold text-white"
                style={{ textShadow: '0 1px 3px rgba(2, 6, 18, 0.98)' }}
              >
                {Math.round(p1.hp)} / {p1.maxHp}
              </span>
            </div>

            {/* Special Energy Bar + Combo */}
            <div className="mt-1.5 flex items-center gap-2">
              <div className="relative h-2 flex-1 overflow-hidden rounded-sm border border-slate-800 bg-slate-950">
                <div
                  className="h-full transition-none"
                  style={{
                    width: `${p1.energy}%`,
                    backgroundColor: p1.energy >= 100 ? '#facc15' : '#0284c7',
                  }}
                />
              </div>
              <span
                className="font-mono-tabular text-[10px] font-bold"
                style={{ color: p1.energy >= 100 ? '#facc15' : '#64748b' }}
              >
                {p1.energy >= 100 ? 'BURST READY [R/U]' : `${Math.floor(p1.energy)}%`}
              </span>
            </div>
            {p1.comboCount >= 2 && (
              <div className="font-display mt-1 text-sm font-bold tracking-wider text-amber-300">
                {p1.comboCount} HIT COMBO!
              </div>
            )}
          </div>
        </div>

        {/* Center Timer + Utility Controls */}
        <div className="flex flex-col items-center">
          <div
            className="flex flex-col items-center rounded-xl border border-slate-700/80 px-5 py-1.5"
            style={{ backgroundColor: 'rgba(7, 13, 28, 0.9)' }}
          >
            <div className="font-mono-tabular text-3xl font-bold leading-none text-white md:text-4xl">
              {timerDisplay}
            </div>
            <div className="font-display mt-0.5 text-[10px] font-bold tracking-widest text-slate-400">
              HIỆP {match.roundNumber} / 3
            </div>
          </div>
          <div className="pointer-events-auto mt-1.5 flex items-center gap-1.5">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              aria-label={muted ? 'Bật âm thanh [M]' : 'Tắt âm thanh [M]'}
              className="flex h-7 w-7 items-center justify-center rounded border border-slate-700 bg-slate-900/90 text-slate-300 hover:border-sky-400 hover:text-white"
            >
              {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              aria-label="Tạm dừng [P]"
              className="flex h-7 w-7 items-center justify-center rounded border border-slate-700 bg-slate-900/90 text-slate-300 hover:border-sky-400 hover:text-white"
            >
              <Pause className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* P2 Bar Cluster */}
        <div className="flex w-[38%] max-w-[460px] flex-row-reverse items-start gap-3">
          <div
            className="hidden h-16 w-16 shrink-0 rounded-lg border-2 p-1 sm:block"
            style={{
              backgroundColor: 'rgba(7, 16, 34, 0.92)',
              borderColor: '#f43f5e',
            }}
            dangerouslySetInnerHTML={{ __html: p2Weapon.svg2d }}
          />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-row-reverse items-center justify-between gap-2">
              <div className="flex min-w-0 flex-row-reverse items-center gap-2">
                <span className="font-display truncate text-sm font-bold tracking-wide text-rose-300">
                  {match.playMode === '1p' ? 'CPU' : 'P2'} · {p2.name.toUpperCase()}
                </span>
                <span className="font-mono-tabular hidden text-xs text-slate-400 md:inline">
                  {p2.formula}
                </span>
              </div>
              <RoundSockets won={p2.roundsWon} accent="#f43f5e" />
            </div>

            <div className="relative h-4 w-full overflow-hidden rounded border border-slate-700 bg-slate-950">
              <div
                className="absolute inset-y-0 right-0 bg-white/65 transition-none"
                style={{ width: `${p2GhostPct}%` }}
              />
              <div
                className="absolute inset-y-0 right-0 transition-none"
                style={{
                  width: `${p2Pct}%`,
                  backgroundColor: p2Pct < 25 ? '#f59e0b' : '#f43f5e',
                }}
              />
              <span
                className="font-mono-tabular relative z-10 flex h-full items-center justify-end px-2 text-[10px] font-bold text-white"
                style={{ textShadow: '0 1px 3px rgba(2, 6, 18, 0.98)' }}
              >
                {Math.round(p2.hp)} / {p2.maxHp}
              </span>
            </div>

            <div className="mt-1.5 flex flex-row-reverse items-center gap-2">
              <div className="relative h-2 flex-1 overflow-hidden rounded-sm border border-slate-800 bg-slate-950">
                <div
                  className="ml-auto h-full transition-none"
                  style={{
                    width: `${p2.energy}%`,
                    backgroundColor: p2.energy >= 100 ? '#facc15' : '#e11d48',
                  }}
                />
              </div>
              <span
                className="font-mono-tabular text-[10px] font-bold"
                style={{ color: p2.energy >= 100 ? '#facc15' : '#64748b' }}
              >
                {p2.energy >= 100
                  ? match.playMode === '2p'
                    ? 'BURST [M]'
                    : 'BURST READY'
                  : `${Math.floor(p2.energy)}%`}
              </span>
            </div>
            {p2.comboCount >= 2 && (
              <div className="font-display mt-1 text-right text-sm font-bold tracking-wider text-amber-300">
                {p2.comboCount} HIT COMBO!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Center Round / KO Banner */}
      {bannerText && (
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
          <div
            key={bannerText}
            className="animate-banner-pop font-display text-5xl font-bold tracking-widest md:text-7xl"
            style={{
              color: bannerColor,
              textShadow: '0 6px 28px rgba(0, 0, 0, 0.85)',
            }}
          >
            {bannerText}
          </div>
        </div>
      )}

      {/* Floating Damage & Impact Callouts */}
      {callouts.map((c) => (
        <div
          key={c.id}
          className="animate-float-hit font-display pointer-events-none fixed text-xl font-bold tracking-wide"
          style={{
            left: `${c.x}px`,
            top: `${c.y}px`,
            color: c.color,
            textShadow: '0 2px 10px rgba(0,0,0,0.9)',
          }}
        >
          {c.text}
        </div>
      ))}

      {/* Bottom Discrete Keybind Hint Bar */}
      <div className="flex items-end justify-center">
        <p
          className="rounded-md px-3 py-1 font-mono-tabular text-[11px] text-slate-300"
          style={{ backgroundColor: 'rgba(7, 13, 28, 0.72)' }}
        >
          {match.playMode === '1p'
            ? 'P1: A/D Di chuyển · W Nhảy · S Ngồi · Shift Lướt · F/J Đấm · G/K Đá · H/L Đỡ · R/U Tuyệt chiêu · Esc Tạm dừng'
            : 'P1: WASD + Shift Lướt + F Đấm + G Đá + H Đỡ + R Chiêu  |  P2: Mũi tên + , Đấm + . Đá + / Đỡ + M Chiêu'}
        </p>
      </div>
    </div>
  );
};
