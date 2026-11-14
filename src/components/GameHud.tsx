import React from 'react';
import { LogOut, Pause, Volume2, VolumeX } from 'lucide-react';
import type { ParsedMolecule } from '../chem/smilesEngine';
import { getArenaStageInfo, type ArenaStageId } from '../game/arenaStages';
import { getHealthPowerMultiplier, type FighterBuffs, type MatchState } from '../game/combatEngine';

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
  arenaStage?: ArenaStageId;
  muted: boolean;
  onlineRole?: 1 | 2 | null;
  outroWinner?: 1 | 2 | null;
  callouts: FloatingCallout[];
  onToggleMute: () => void;
  onPause: () => void;
  onSkipOutro?: () => void;
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

const BuffStrip: React.FC<{ buffs?: FighterBuffs; align: 'left' | 'right' }> = ({
  buffs,
  align,
}) => {
  if (!buffs) return null;
  const active: { key: string; label: string; secs: number; color: string; icon: 'bolt' | 'fist' | 'shroom' | 'x3' | 'grow' }[] = [];
  if (buffs.lightning > 0) active.push({ key: 'bolt', label: 'Tốc đánh', secs: buffs.lightning, color: '#facc15', icon: 'bolt' });
  if (buffs.fist > 0) active.push({ key: 'fist', label: '+Sát thương', secs: buffs.fist, color: '#fb923c', icon: 'fist' });
  if (buffs.shrink > 0) active.push({ key: 'shroom', label: 'Thu nhỏ', secs: buffs.shrink, color: '#34d399', icon: 'shroom' });
  if (buffs.tripleThrow > 0) active.push({ key: 'x3', label: 'Ném x3', secs: buffs.tripleThrow, color: '#c084fc', icon: 'x3' });
  if (buffs.giant > 0) active.push({ key: 'grow', label: 'Phóng to', secs: buffs.giant, color: '#fbbf24', icon: 'grow' });
  if (active.length === 0) return null;

  return (
    <div
      className={`mt-1.5 flex flex-wrap items-center gap-1.5 ${
        align === 'right' ? 'justify-end' : 'justify-start'
      }`}
    >
      {active.map((b) => (
        <span
          key={b.key}
          className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono-tabular text-[10px] font-bold"
          style={{
            backgroundColor: 'rgba(7, 13, 28, 0.9)',
            borderColor: b.color,
            color: b.color,
          }}
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0" aria-hidden="true">
            {b.icon === 'bolt' && (
              <polygon points="9,1 3,9 8,9 7,15 13,7 8,7" fill="currentColor" />
            )}
            {b.icon === 'fist' && (
              <path d="M4 6h8v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6zm1-3h2v2H5V3zm3 0h2v2H8V3z" fill="currentColor" />
            )}
            {b.icon === 'shroom' && (
              <path d="M2 8a6 6 0 0 1 12 0H2zm4 1h4v5H6V9z" fill="currentColor" />
            )}
            {b.icon === 'x3' && (
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            )}
            {b.icon === 'grow' && (
              <path d="M8 1l5 6H9.5v8h-3V7H3l5-6z" fill="currentColor" />
            )}
          </svg>
          <span>{b.label}</span>
          <span>{Math.ceil(b.secs)}s</span>
        </span>
      ))}
    </div>
  );
};

export const GameHud: React.FC<GameHudProps> = ({
  match,
  p1Weapon,
  p2Weapon,
  arenaStage = 'cell',
  muted,
  onlineRole = null,
  outroWinner = null,
  callouts,
  onToggleMute,
  onPause,
  onSkipOutro,
}) => {
  const stageInfo = getArenaStageInfo(arenaStage);
  const { p1, p2 } = match;
  const p1Pct = Math.max(0, Math.min(100, (p1.hp / p1.maxHp) * 100));
  const p1GhostPct = Math.max(0, Math.min(100, (p1.ghostHp / p1.maxHp) * 100));
  const p2Pct = Math.max(0, Math.min(100, (p2.hp / p2.maxHp) * 100));
  const p2GhostPct = Math.max(0, Math.min(100, (p2.ghostHp / p2.maxHp) * 100));
  const p1PowerPct = Math.round(getHealthPowerMultiplier(p1) * 100);
  const p2PowerPct = Math.round(getHealthPowerMultiplier(p2) * 100);

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
            className={`hidden h-16 w-16 shrink-0 rounded-lg border-2 p-1 transition-all duration-200 sm:block ${
              p1Pct > 0 && p1Pct < 28 ? 'animate-pulse' : ''
            }`}
            style={{
              backgroundColor: 'rgba(7, 16, 34, 0.92)',
              borderColor: p1Pct > 0 && p1Pct < 28 ? '#f59e0b' : '#38bdf8',
              boxShadow:
                p1Pct > 0 && p1Pct < 28
                  ? '0 0 16px rgba(245, 158, 11, 0.45)'
                  : '0 0 12px rgba(56, 189, 248, 0.18)',
            }}
            dangerouslySetInnerHTML={{ __html: p1Weapon.svg2d }}
          />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="font-display truncate text-sm font-bold tracking-wide text-sky-300">
                  P1{onlineRole === 1 ? ' (BẠN)' : ''} · {p1.name.toUpperCase()}
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
                className="absolute inset-y-0 left-0 bg-white/65 transition-[width] duration-150 ease-out"
                style={{ width: `${p1GhostPct}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 transition-[width,background-color] duration-100 ease-out"
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

            {/* Special Energy Bar + Signature SMILES [F] Skill */}
            <div className="mt-1.5 flex items-center gap-2">
              <div className="relative h-2 flex-1 overflow-hidden rounded-sm border border-slate-800 bg-slate-950">
                <div
                  className="h-full transition-[width,background-color] duration-100 ease-out"
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

            {(() => {
              const p1SkillReady = (p1.skillCooldown ?? 0) <= 0.01;
              const p1SkillPct = p1SkillReady
                ? 100
                : Math.max(
                    0,
                    Math.min(100, (1 - p1.skillCooldown / Math.max(1, p1.skillMaxCooldown)) * 100)
                  );
              return (
                <div
                  data-testid="p1-skill-bar"
                  className={`mt-1.5 flex items-center gap-2 rounded border px-2 py-0.5 transition-all duration-150 ${
                    p1SkillReady ? 'animate-skill-ready' : ''
                  }`}
                  style={{
                    backgroundColor: 'rgba(7, 13, 28, 0.88)',
                    borderColor: p1SkillReady ? p1.skillColor : 'rgba(51, 65, 85, 0.75)',
                  }}
                >
                  <span
                    className="rounded px-1 font-mono-tabular text-[10px] font-bold text-slate-950"
                    style={{ backgroundColor: p1SkillReady ? p1.skillColor : '#475569' }}
                  >
                    F
                  </span>
                  <span className="truncate text-[10px] font-bold text-slate-100">
                    {p1.skillName}
                  </span>
                  <div className="relative h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-slate-900">
                    <div
                      className="h-full transition-[width] duration-100 ease-out"
                      style={{
                        width: `${p1SkillPct}%`,
                        backgroundColor: p1SkillReady ? p1.skillColor : '#64748b',
                      }}
                    />
                  </div>
                  <span
                    className="font-mono-tabular shrink-0 text-[10px] font-bold"
                    style={{ color: p1SkillReady ? p1.skillColor : '#94a3b8' }}
                  >
                    {p1SkillReady ? 'SẴN SÀNG' : `${p1.skillCooldown.toFixed(1)}s`}
                  </span>
                </div>
              );
            })()}

            {p1.hp > 0 && p1PowerPct < 96 && (
              <div
                data-testid="p1-power-decay"
                className="font-mono-tabular mt-1 text-[10px] font-bold"
                style={{ color: p1PowerPct < 65 ? '#fb7185' : '#fbbf24' }}
              >
                Phân huỷ {Math.round(100 - p1Pct)}% · Lực đánh {p1PowerPct}%
              </div>
            )}
            {p1.comboCount >= 2 && (
              <div
                key={`p1-combo-${p1.comboCount}`}
                className="animate-combo-pop font-display mt-1 text-sm font-bold tracking-wider text-amber-300"
              >
                {p1.comboCount} HIT COMBO!
              </div>
            )}
            <BuffStrip buffs={p1.buffs} align="left" />
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
              HIỆP {match.roundNumber} / 3 · {stageInfo.shortLabel.toUpperCase()}
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
              aria-label={onlineRole ? 'Rời trận online' : 'Tạm dừng [P]'}
              title={onlineRole ? 'Quay về phòng chờ Online' : 'Tạm dừng [P]'}
              className="flex h-7 w-7 items-center justify-center rounded border border-slate-700 bg-slate-900/90 text-slate-300 hover:border-sky-400 hover:text-white"
            >
              {onlineRole ? <LogOut className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* P2 Bar Cluster */}
        <div className="flex w-[38%] max-w-[460px] flex-row-reverse items-start gap-3">
          <div
            className={`hidden h-16 w-16 shrink-0 rounded-lg border-2 p-1 transition-all duration-200 sm:block ${
              p2Pct > 0 && p2Pct < 28 ? 'animate-pulse' : ''
            }`}
            style={{
              backgroundColor: 'rgba(7, 16, 34, 0.92)',
              borderColor: p2Pct > 0 && p2Pct < 28 ? '#f59e0b' : '#f43f5e',
              boxShadow:
                p2Pct > 0 && p2Pct < 28
                  ? '0 0 16px rgba(245, 158, 11, 0.45)'
                  : '0 0 12px rgba(244, 63, 94, 0.18)',
            }}
            dangerouslySetInnerHTML={{ __html: p2Weapon.svg2d }}
          />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-row-reverse items-center justify-between gap-2">
              <div className="flex min-w-0 flex-row-reverse items-center gap-2">
                <span className="font-display truncate text-sm font-bold tracking-wide text-rose-300">
                  {match.playMode === '1p' ? 'CPU' : `P2${onlineRole === 2 ? ' (BẠN)' : ''}`} · {p2.name.toUpperCase()}
                </span>
                <span className="font-mono-tabular hidden text-xs text-slate-400 md:inline">
                  {p2.formula}
                </span>
              </div>
              <RoundSockets won={p2.roundsWon} accent="#f43f5e" />
            </div>

            <div className="relative h-4 w-full overflow-hidden rounded border border-slate-700 bg-slate-950">
              <div
                className="absolute inset-y-0 right-0 bg-white/65 transition-[width] duration-150 ease-out"
                style={{ width: `${p2GhostPct}%` }}
              />
              <div
                className="absolute inset-y-0 right-0 transition-[width,background-color] duration-100 ease-out"
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
                  className="ml-auto h-full transition-[width,background-color] duration-100 ease-out"
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
                  ? onlineRole === 2
                    ? 'BURST [R/U/M]'
                    : match.playMode === '2p' && !onlineRole
                    ? 'BURST [M]'
                    : 'BURST READY'
                  : `${Math.floor(p2.energy)}%`}
              </span>
            </div>

            {(() => {
              const p2SkillReady = (p2.skillCooldown ?? 0) <= 0.01;
              const p2SkillPct = p2SkillReady
                ? 100
                : Math.max(
                    0,
                    Math.min(100, (1 - p2.skillCooldown / Math.max(1, p2.skillMaxCooldown)) * 100)
                  );
              const p2SkillKey =
                onlineRole === 2 ? 'F/;' : match.playMode === '2p' ? ';' : 'CPU';
              return (
                <div
                  data-testid="p2-skill-bar"
                  className="mt-1.5 flex flex-row-reverse items-center gap-2 rounded border px-2 py-0.5 transition-all duration-150"
                  style={{
                    backgroundColor: 'rgba(7, 13, 28, 0.88)',
                    borderColor: p2SkillReady ? p2.skillColor : 'rgba(51, 65, 85, 0.75)',
                  }}
                >
                  <span
                    className="rounded px-1 font-mono-tabular text-[10px] font-bold text-slate-950"
                    style={{ backgroundColor: p2SkillReady ? p2.skillColor : '#475569' }}
                  >
                    {p2SkillKey}
                  </span>
                  <span className="truncate text-[10px] font-bold text-slate-100">
                    {p2.skillName}
                  </span>
                  <div className="relative h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-slate-900">
                    <div
                      className="ml-auto h-full transition-[width] duration-100 ease-out"
                      style={{
                        width: `${p2SkillPct}%`,
                        backgroundColor: p2SkillReady ? p2.skillColor : '#64748b',
                      }}
                    />
                  </div>
                  <span
                    className="font-mono-tabular shrink-0 text-[10px] font-bold"
                    style={{ color: p2SkillReady ? p2.skillColor : '#94a3b8' }}
                  >
                    {p2SkillReady ? 'SẴN SÀNG' : `${p2.skillCooldown.toFixed(1)}s`}
                  </span>
                </div>
              );
            })()}

            {p2.hp > 0 && p2PowerPct < 96 && (
              <div
                data-testid="p2-power-decay"
                className="font-mono-tabular mt-1 text-right text-[10px] font-bold"
                style={{ color: p2PowerPct < 65 ? '#fb7185' : '#fbbf24' }}
              >
                Phân huỷ {Math.round(100 - p2Pct)}% · Lực đánh {p2PowerPct}%
              </div>
            )}
            {p2.comboCount >= 2 && (
              <div
                key={`p2-combo-${p2.comboCount}`}
                className="animate-combo-pop font-display mt-1 text-right text-sm font-bold tracking-wider text-amber-300"
              >
                {p2.comboCount} HIT COMBO!
              </div>
            )}
            <BuffStrip buffs={p2.buffs} align="right" />
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

      {/* Bottom Bar: Stage Victory Outro Banner OR Discrete Keybind Hint */}
      {outroWinner ? (
        <div
          data-testid="stage-outro-banner"
          className="pointer-events-auto mx-auto flex max-w-2xl items-center justify-between gap-4 rounded-xl border px-5 py-3 shadow-2xl"
          style={{
            backgroundColor: 'rgba(7, 13, 28, 0.92)',
            borderColor: stageInfo.accentHex,
          }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="font-mono-tabular text-[11px] font-bold uppercase tracking-wider"
                style={{ color: stageInfo.accentHex }}
              >
                {outroWinner === 1 ? `P1 · ${p1.name}` : `P2 · ${p2.name}`} CHIẾN THẮNG
              </span>
              <span className="text-slate-600">·</span>
              <span className="font-mono-tabular text-[11px] font-semibold text-slate-300">
                {stageInfo.label}
              </span>
            </div>
            <div className="font-display text-lg font-bold tracking-wide text-white">
              {stageInfo.outroTitle}
            </div>
            <p className="text-xs text-slate-300">{stageInfo.outroSubtitle}</p>
          </div>
          {onSkipOutro && (
            <button
              type="button"
              onClick={onSkipOutro}
              className="shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono-tabular text-xs font-bold text-slate-200 transition-colors hover:border-sky-400 hover:text-white"
            >
              Kết quả →
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-end justify-center">
          <p
            className="rounded-md px-3 py-1 font-mono-tabular text-[11px] text-slate-300"
            style={{ backgroundColor: 'rgba(7, 13, 28, 0.72)' }}
          >
            {onlineRole
              ? `ONLINE P${onlineRole} (BẠN): WASD / Mũi tên Di chuyển · F Kỹ năng SMILES · J Đấm · G/K Đá · H/L Đỡ · R/U Burst · Tiến+J Ném`
              : match.playMode === '1p'
              ? 'P1: WASD Di chuyển · F Kỹ năng SMILES · J Đấm · G/K Đá · H/L Đỡ · R/U Burst · Tiến+J Ném phân tử · S+K Hất tung · Esc Dừng'
              : 'P1: WASD + F Skill SMILES + J Đấm + K Đá + Tiến+J Ném · S+K Hất | P2: Mũi tên + ; Skill + , Đấm + . Đá + Tiến+, Ném'}
          </p>
        </div>
      )}
    </div>
  );
};
