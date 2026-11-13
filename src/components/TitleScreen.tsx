import React from 'react';
import { FlaskConical, Play, Volume2, VolumeX } from 'lucide-react';
import { DRUG_PRESETS, type ParsedMolecule } from '../chem/smilesEngine';
import type { ColorSchemeMode, CpuDifficulty, PlayMode } from '../game/combatEngine';

interface TitleScreenProps {
  p1Weapon: ParsedMolecule;
  p2Weapon: ParsedMolecule;
  playMode: PlayMode;
  difficulty: CpuDifficulty;
  colorMode: ColorSchemeMode;
  muted: boolean;
  onSelectPreset: (playerId: 1 | 2, smiles: string, name: string) => void;
  onOpenCustomSmiles: (playerId: 1 | 2) => void;
  onChangePlayMode: (mode: PlayMode) => void;
  onChangeDifficulty: (diff: CpuDifficulty) => void;
  onChangeColorMode: (mode: ColorSchemeMode) => void;
  onToggleMute: () => void;
  onStart: () => void;
}

const FighterLoadoutCard: React.FC<{
  playerId: 1 | 2;
  weapon: ParsedMolecule;
  onSelectPreset: (smiles: string, name: string) => void;
  onOpenCustom: () => void;
}> = ({ playerId, weapon, onSelectPreset, onOpenCustom }) => {
  const isP1 = playerId === 1;
  const accent = isP1 ? '#38bdf8' : '#f43f5e';
  const borderCol = isP1 ? 'rgba(56, 189, 248, 0.4)' : 'rgba(244, 63, 94, 0.4)';

  return (
    <section
      aria-label={`Trang bị Player ${playerId}`}
      className="pointer-events-auto w-full max-w-[330px] rounded-xl border p-3.5"
      style={{
        backgroundColor: 'rgba(7, 13, 28, 0.88)',
        borderColor: borderCol,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="h-16 w-16 shrink-0 rounded-lg border bg-slate-950 p-1"
          style={{ borderColor: borderCol }}
          dangerouslySetInnerHTML={{ __html: weapon.svg2d }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className="font-display text-xs font-bold tracking-wider"
              style={{ color: accent }}
            >
              PLAYER {playerId} {isP1 ? '· AZURE' : '· CRIMSON'}
            </span>
            <span className="font-mono-tabular text-xs font-semibold text-slate-400">
              {weapon.formula}
            </span>
          </div>
          <h3 className="font-display truncate text-lg font-bold text-white">
            {weapon.name}
          </h3>
          <div className="text-xs text-slate-400">
            {weapon.stats.archetype} · MW {weapon.stats.mw}
          </div>
        </div>
      </div>

      {/* Combat Stats Row */}
      <div className="mt-2.5 grid grid-cols-4 gap-1.5 border-y border-slate-800/80 py-1.5 text-center font-mono-tabular text-xs">
        <div>
          <span className="block text-[10px] text-slate-400">HP</span>
          <span className="font-bold text-emerald-400">{weapon.stats.hp}</span>
        </div>
        <div>
          <span className="block text-[10px] text-slate-400">ATK</span>
          <span className="font-bold text-amber-400">{weapon.stats.atk}</span>
        </div>
        <div>
          <span className="block text-[10px] text-slate-400">DEF</span>
          <span className="font-bold text-sky-400">{weapon.stats.def}</span>
        </div>
        <div>
          <span className="block text-[10px] text-slate-400">CRIT</span>
          <span className="font-bold text-rose-400">{weapon.stats.crit}%</span>
        </div>
      </div>

      {/* Preset Drug Selector */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {DRUG_PRESETS.slice(0, 6).map((preset) => {
          const active = weapon.smiles === preset.smiles;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(preset.smiles, preset.name)}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors ${
                active
                  ? 'text-slate-950'
                  : 'border border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-600 hover:text-white'
              }`}
              style={active ? { backgroundColor: accent } : undefined}
            >
              {preset.name}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onOpenCustom}
          className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition-colors hover:border-sky-400 hover:text-white"
        >
          <FlaskConical className="h-3 w-3" style={{ color: accent }} aria-hidden="true" />
          SMILES Tuỳ chỉnh
        </button>
      </div>
    </section>
  );
};

export const TitleScreen: React.FC<TitleScreenProps> = ({
  p1Weapon,
  p2Weapon,
  playMode,
  difficulty,
  colorMode,
  muted,
  onSelectPreset,
  onOpenCustomSmiles,
  onChangePlayMode,
  onChangeDifficulty,
  onChangeColorMode,
  onToggleMute,
  onStart,
}) => {
  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-5 md:p-7">
      {/* Top Bar: Bespoke Inline SVG Title Lockup over calm negative space + Mute button */}
      <div className="flex items-start justify-between">
        <div className="w-10" />
        <div className="flex flex-col items-center text-center">
          <svg
            viewBox="0 0 460 88"
            className="h-16 w-auto drop-shadow-[0_4px_20px_rgba(56,189,248,0.35)] md:h-20"
            role="img"
            aria-label="Drug Fighter Molecular Arena"
          >
            {/* Left Benzene Crest */}
            <polygon
              points="46,16 68,29 68,55 46,68 24,55 24,29"
              fill="rgba(7,16,34,0.85)"
              stroke="#38bdf8"
              strokeWidth="3"
            />
            <circle cx="46" cy="42" r="11" fill="none" stroke="#7dd3fc" strokeWidth="2" strokeDasharray="4 3" />
            <circle cx="46" cy="42" r="4" fill="#38bdf8" />

            {/* Right Benzene Crest */}
            <polygon
              points="414,16 436,29 436,55 414,68 392,55 392,29"
              fill="rgba(7,16,34,0.85)"
              stroke="#f43f5e"
              strokeWidth="3"
            />
            <circle cx="414" cy="42" r="11" fill="none" stroke="#fda4af" strokeWidth="2" strokeDasharray="4 3" />
            <circle cx="414" cy="42" r="4" fill="#f43f5e" />

            {/* Covalent Divider Bonds */}
            <line x1="74" y1="40" x2="96" y2="40" stroke="#38bdf8" strokeWidth="2.5" />
            <line x1="74" y1="46" x2="96" y2="46" stroke="#38bdf8" strokeWidth="1.5" />
            <line x1="364" y1="40" x2="386" y2="40" stroke="#f43f5e" strokeWidth="2.5" />
            <line x1="364" y1="46" x2="386" y2="46" stroke="#f43f5e" strokeWidth="1.5" />

            {/* Main Display Title */}
            <text
              x="230"
              y="48"
              textAnchor="middle"
              fill="#f8fafc"
              stroke="#040914"
              strokeWidth="5"
              paintOrder="stroke fill"
              fontFamily="Chakra Petch, sans-serif"
              fontSize="36"
              fontWeight="700"
              letterSpacing="4"
            >
              DRUG FIGHTER
            </text>
            <text
              x="230"
              y="72"
              textAnchor="middle"
              fill="#94a3b8"
              fontFamily="JetBrains Mono, monospace"
              fontSize="12"
              fontWeight="700"
              letterSpacing="5"
            >
              MOLECULAR PVP ARENA
            </text>
          </svg>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/90 text-slate-200 transition-colors hover:border-sky-400 hover:text-white"
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>

      {/* Bottom Dock: P1 Loadout | Center Match Controls + Start CTA | P2 Loadout */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col items-center justify-between gap-4 lg:flex-row lg:items-end">
          <FighterLoadoutCard
            playerId={1}
            weapon={p1Weapon}
            onSelectPreset={(s, n) => onSelectPreset(1, s, n)}
            onOpenCustom={() => onOpenCustomSmiles(1)}
          />

          {/* Center Controls & Primary Start CTA */}
          <div
            className="pointer-events-auto flex w-full max-w-[300px] flex-col items-center gap-3 rounded-xl border border-slate-700/80 p-4"
            style={{ backgroundColor: 'rgba(7, 13, 28, 0.9)' }}
          >
            <button
              type="button"
              data-start="true"
              onClick={(e) => {
                e.currentTarget.blur();
                onStart();
              }}
              className="font-display flex w-full items-center justify-center gap-2 rounded-lg bg-sky-400 px-6 py-3 text-lg font-bold tracking-wider text-slate-950 shadow-lg transition-colors hover:bg-sky-300 focus-visible:outline-2 focus-visible:outline-white"
            >
              <Play className="h-5 w-5 fill-current" aria-hidden="true" />
              BẮT ĐẦU ĐẤU
            </button>

            {/* Mode Switch */}
            <div className="w-full space-y-2">
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1">
                <button
                  type="button"
                  onClick={() => onChangePlayMode('1p')}
                  className={`rounded-md py-1.5 text-xs font-bold transition-colors ${
                    playMode === '1p'
                      ? 'bg-slate-100 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  1P VS CPU
                </button>
                <button
                  type="button"
                  onClick={() => onChangePlayMode('2p')}
                  className={`rounded-md py-1.5 text-xs font-bold transition-colors ${
                    playMode === '2p'
                      ? 'bg-slate-100 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  2P LOCAL
                </button>
              </div>

              {/* CPU Difficulty */}
              {playMode === '1p' && (
                <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1">
                  {(['easy', 'normal', 'hard'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => onChangeDifficulty(lvl)}
                      className={`rounded-md py-1 text-[11px] font-bold uppercase transition-colors ${
                        difficulty === lvl
                          ? 'bg-sky-400 text-slate-950'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {lvl === 'easy' ? 'Dễ' : lvl === 'normal' ? 'Vừa' : 'Khó'}
                    </button>
                  ))}
                </div>
              )}

              {/* Molecular Visual Mode */}
              <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1">
                {([
                  { id: 'elemental', label: 'CPK' },
                  { id: 'rainbow', label: 'Rainbow' },
                  { id: 'bond', label: 'Bậc LK' },
                ] as const).map((scheme) => (
                  <button
                    key={scheme.id}
                    type="button"
                    onClick={() => onChangeColorMode(scheme.id)}
                    className={`rounded-md py-1 text-[11px] font-bold transition-colors ${
                      colorMode === scheme.id
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {scheme.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <FighterLoadoutCard
            playerId={2}
            weapon={p2Weapon}
            onSelectPreset={(s, n) => onSelectPreset(2, s, n)}
            onOpenCustom={() => onOpenCustomSmiles(2)}
          />
        </div>

        {/* Single flat control hint line */}
        <p className="text-center font-mono-tabular text-xs text-slate-400">
          WASD Di chuyển &amp; Nhảy · F/J Đấm · G/K Đá · H/L Đỡ · R/U Tuyệt chiêu · Enter/Space Bắt đầu
        </p>
      </div>
    </div>
  );
};
