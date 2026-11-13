import React from 'react';
import { Play, RotateCcw, Swords, Trophy } from 'lucide-react';
import type { MatchState } from '../game/combatEngine';

interface StatusModalProps {
  mode: 'paused' | 'gameover';
  match: MatchState;
  onResume: () => void;
  onRematch: () => void;
  onReturnToTitle: () => void;
}

export const StatusModal: React.FC<StatusModalProps> = ({
  mode,
  match,
  onResume,
  onRematch,
  onReturnToTitle,
}) => {
  const isGameOver = mode === 'gameover';
  const winner = match.matchWinner;
  const winnerLabel =
    winner === 1
      ? `PLAYER 1 (${match.p1.name}) CHIẾN THẮNG`
      : winner === 2
      ? `PLAYER 2 (${match.p2.name}) CHIẾN THẮNG`
      : 'TRẬN ĐẤU HÒA';

  const accentHex = winner === 2 ? '#f43f5e' : '#38bdf8';

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(3, 8, 20, 0.78)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-modal-heading"
    >
      <div
        className="animate-banner-pop w-full max-w-md rounded-xl border p-6 text-center shadow-2xl"
        style={{
          backgroundColor: 'rgba(9, 16, 34, 0.97)',
          borderColor: isGameOver ? accentHex : 'rgba(148, 163, 184, 0.35)',
        }}
      >
        {isGameOver ? (
          <>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-slate-900">
              <Trophy className="h-6 w-6" style={{ color: accentHex }} aria-hidden="true" />
            </div>
            <h2
              id="status-modal-heading"
              className="font-display text-3xl font-bold tracking-wider text-white"
            >
              KNOCKOUT
            </h2>
            <p className="mt-1 font-display text-base font-semibold tracking-wide" style={{ color: accentHex }}>
              {winnerLabel}
            </p>

            {/* Tabular-nums Match Stats */}
            <div className="mt-5 grid grid-cols-3 gap-2.5 text-left">
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <div className="text-[11px] font-medium text-slate-400">Tỉ số Hiệp</div>
                <div className="font-mono-tabular mt-1 text-lg font-bold text-slate-100">
                  {match.p1.roundsWon} – {match.p2.roundsWon}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <div className="text-[11px] font-medium text-slate-400">Sát thương P1</div>
                <div className="font-mono-tabular mt-1 text-lg font-bold text-sky-400">
                  {Math.round(match.p1.damageDealt)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <div className="text-[11px] font-medium text-slate-400">Max Combo</div>
                <div className="font-mono-tabular mt-1 text-lg font-bold text-amber-400">
                  {Math.max(match.p1.maxCombo, match.p2.maxCombo)}x
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-300">
              <span className="truncate font-semibold text-sky-300">
                P1: {match.p1.name} ({match.p1.formula})
              </span>
              <span className="px-2 text-slate-500">vs</span>
              <span className="truncate font-semibold text-rose-300">
                P2: {match.p2.name} ({match.p2.formula})
              </span>
            </div>

            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                data-start="true"
                onClick={onRematch}
                className="font-display flex w-full items-center justify-center gap-2 rounded-lg bg-sky-400 px-5 py-2.5 text-base font-bold tracking-wider text-slate-950 transition-colors hover:bg-sky-300 focus-visible:outline-2 focus-visible:outline-white"
              >
                <RotateCcw className="h-4 w-4" />
                ĐẤU LẠI (REMATCH)
              </button>
              <button
                type="button"
                onClick={onReturnToTitle}
                className="font-display flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold tracking-wide text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <Swords className="h-4 w-4" />
                CHỌN VŨ KHÍ & CHẾ ĐỘ
              </button>
            </div>
          </>
        ) : (
          <>
            <h2
              id="status-modal-heading"
              className="font-display text-2xl font-bold tracking-wider text-white"
            >
              TẠM DỪNG
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Hiệp {match.roundNumber} · {match.p1.name} vs {match.p2.name}
            </p>

            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onResume}
                className="font-display flex w-full items-center justify-center gap-2 rounded-lg bg-sky-400 px-5 py-2.5 text-base font-bold tracking-wider text-slate-950 transition-colors hover:bg-sky-300"
              >
                <Play className="h-4 w-4" />
                TIẾP TỤC (ESC)
              </button>
              <button
                type="button"
                onClick={onRematch}
                className="font-display flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <RotateCcw className="h-4 w-4" />
                CHƠI LẠI TỪ ĐẦU
              </button>
              <button
                type="button"
                onClick={onReturnToTitle}
                className="font-display flex w-full items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-5 py-2.5 text-sm font-semibold text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-200"
              >
                <Swords className="h-4 w-4" />
                QUAY LẠI MÀN HÌNH CHÍNH
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
