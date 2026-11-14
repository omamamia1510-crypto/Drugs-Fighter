import React from 'react';
import { CheckCircle2, FlaskConical, LogOut, Play, QrCode, Volume2, VolumeX, Wifi } from 'lucide-react';
import { DRUG_PRESETS, type ParsedMolecule } from '../chem/smilesEngine';
import { ARENA_STAGES, getArenaStageInfo, type ArenaStageId } from '../game/arenaStages';
import type { ColorSchemeMode, CpuDifficulty, PlayMode } from '../game/combatEngine';
import type { OnlineRoomSnapshot } from '../net/onlineProtocol';

interface TitleScreenProps {
  p1Weapon: ParsedMolecule;
  p2Weapon: ParsedMolecule;
  playMode: PlayMode;
  difficulty: CpuDifficulty;
  colorMode: ColorSchemeMode;
  arenaStage: ArenaStageId;
  muted: boolean;
  onlineRole: 1 | 2 | null;
  onlineRoom: OnlineRoomSnapshot | null;
  onlineError: string | null;
  onSelectPreset: (playerId: 1 | 2, smiles: string, name: string) => void;
  onOpenCustomSmiles: (playerId: 1 | 2) => void;
  onChangePlayMode: (mode: PlayMode) => void;
  onChangeDifficulty: (diff: CpuDifficulty) => void;
  onChangeColorMode: (mode: ColorSchemeMode) => void;
  onChangeStage: (stage: ArenaStageId) => void;
  onToggleMute: () => void;
  onStart: () => void;
  onCreateOnlineRoom: () => void;
  onOpenInviteModal: () => void;
  onToggleReady: () => void;
  onLeaveOnlineRoom: () => void;
}

const FighterLoadoutCard: React.FC<{
  playerId: 1 | 2;
  weapon: ParsedMolecule;
  roleLabel?: string;
  locked?: boolean;
  lockedHint?: string;
  highlighted?: boolean;
  onSelectPreset: (smiles: string, name: string) => void;
  onOpenCustom: () => void;
}> = ({
  playerId,
  weapon,
  roleLabel,
  locked = false,
  lockedHint,
  highlighted = false,
  onSelectPreset,
  onOpenCustom,
}) => {
  const isP1 = playerId === 1;
  const accent = isP1 ? '#38bdf8' : '#f43f5e';
  const borderCol = highlighted
    ? accent
    : isP1
    ? 'rgba(56, 189, 248, 0.4)'
    : 'rgba(244, 63, 94, 0.4)';

  return (
    <section
      aria-label={`Trang bị Player ${playerId}`}
      className="pointer-events-auto w-full max-w-[330px] rounded-xl border p-3.5"
      style={{
        backgroundColor: 'rgba(7, 13, 28, 0.9)',
        borderColor: borderCol,
        boxShadow: highlighted ? `0 0 24px ${isP1 ? 'rgba(56,189,248,0.22)' : 'rgba(244,63,94,0.25)'}` : undefined,
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
              {roleLabel ?? `PLAYER ${playerId} ${isP1 ? '· AZURE' : '· CRIMSON'}`}
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

      {/* Signature SMILES [F] Skill Badge */}
      <div
        data-testid={`p${playerId}-loadout-skill`}
        className="mt-2 flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5"
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.72)',
          borderColor: `${weapon.stats.skill.accentHex}55`,
        }}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className="rounded px-1.5 py-0.5 font-mono-tabular text-[10px] font-bold text-slate-950"
            style={{ backgroundColor: weapon.stats.skill.accentHex }}
          >
            F
          </span>
          <span className="truncate text-xs font-bold text-slate-100">
            {weapon.stats.skill.name}
          </span>
        </div>
        <span
          className="shrink-0 font-mono-tabular text-[10px] font-semibold"
          style={{ color: weapon.stats.skill.accentHex }}
        >
          {weapon.stats.skill.shortLabel}
        </span>
      </div>

      {/* Preset Drug Selector or Locked Peer Info */}
      {locked ? (
        <div className="mt-2.5 rounded-lg border border-slate-800 bg-slate-950/90 px-3 py-2 text-center text-[11px] font-medium text-slate-400">
          {lockedHint ?? 'Đồng bộ trực tiếp từ người chơi còn lại'}
        </div>
      ) : (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {DRUG_PRESETS.slice(0, 6).map((preset) => {
            const active = weapon.smiles === preset.smiles;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectPreset(preset.smiles, preset.name)}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold whitespace-nowrap transition-all duration-150 active:scale-95 ${
                  active
                    ? 'text-slate-950 shadow-sm'
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
            className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition-all duration-150 hover:border-sky-400 hover:text-white active:scale-95"
          >
            <FlaskConical className="h-3 w-3" style={{ color: accent }} aria-hidden="true" />
            SMILES Tuỳ chỉnh
          </button>
        </div>
      )}
    </section>
  );
};

export const TitleScreen: React.FC<TitleScreenProps> = ({
  p1Weapon,
  p2Weapon,
  playMode,
  difficulty,
  colorMode,
  arenaStage,
  muted,
  onlineRole,
  onlineRoom,
  onlineError,
  onSelectPreset,
  onOpenCustomSmiles,
  onChangePlayMode,
  onChangeDifficulty,
  onChangeColorMode,
  onChangeStage,
  onToggleMute,
  onStart,
  onCreateOnlineRoom,
  onOpenInviteModal,
  onToggleReady,
  onLeaveOnlineRoom,
}) => {
  const activeStageInfo = getArenaStageInfo(arenaStage);
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
            roleLabel={
              onlineRole === 1
                ? 'P1 · BẠN (CHỦ PHÒNG)'
                : onlineRole === 2
                ? 'P1 · CHỦ PHÒNG (HOST)'
                : undefined
            }
            locked={onlineRole === 2}
            lockedHint={
              onlineRoom?.p1.connected
                ? 'Host P1 đang điều chỉnh vũ khí'
                : 'Đang chờ Host kết nối lại...'
            }
            highlighted={onlineRole === 1}
            onSelectPreset={(s, n) => onSelectPreset(1, s, n)}
            onOpenCustom={() => onOpenCustomSmiles(1)}
          />

          {/* Center Controls & Primary Start CTA */}
          <div
            className="pointer-events-auto flex w-full max-w-[336px] flex-col items-center gap-2.5 rounded-xl border border-slate-700/80 p-3.5"
            style={{ backgroundColor: 'rgba(7, 13, 28, 0.92)' }}
          >
            {onlineError && (
              <div className="w-full rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-center text-xs font-medium text-rose-200">
                {onlineError}
              </div>
            )}

            {onlineRole === null ? (
              <>
                <button
                  type="button"
                  data-start="true"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onStart();
                  }}
                  className="font-display flex w-full items-center justify-center gap-2 rounded-lg bg-sky-400 px-6 py-3 text-lg font-bold tracking-wider text-slate-950 shadow-lg transition-all duration-150 hover:bg-sky-300 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-white"
                >
                  <Play className="h-5 w-5 fill-current" aria-hidden="true" />
                  BẮT ĐẦU ĐẤU
                </button>

                <button
                  type="button"
                  data-testid="create-online-room"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onCreateOnlineRoom();
                  }}
                  className="font-display flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/50 bg-emerald-500/15 px-4 py-2 text-xs font-bold tracking-wider text-emerald-300 transition-colors hover:bg-emerald-500/25 hover:text-white"
                >
                  <QrCode className="h-4 w-4" aria-hidden="true" />
                  MỜI BẠN SOLO ONLINE (QR / LINK)
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
                </div>
              </>
            ) : (
              /* Online Solo Room Lobby Panel (Host P1 or Guest P2) */
              <div className="w-full space-y-2.5">
                <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs">
                  <span className="flex items-center gap-1.5 font-mono-tabular font-bold text-emerald-300">
                    <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
                    PHÒNG #{onlineRoom?.roomId ?? '...'}
                  </span>
                  <span className="font-mono-tabular text-[11px] font-bold text-slate-300">
                    {onlineRole === 1 ? 'HOST · P1' : 'KHÁCH · P2'}
                  </span>
                </div>

                {onlineRole === 1 ? (
                  <>
                    <button
                      type="button"
                      data-testid="start-online-match"
                      disabled={!onlineRoom?.p2.connected}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onStart();
                      }}
                      className={`font-display flex w-full items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-base font-bold tracking-wider transition-colors ${
                        onlineRoom?.p2.connected
                          ? onlineRoom.p2.ready
                            ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                            : 'bg-sky-400 text-slate-950 hover:bg-sky-300'
                          : 'cursor-not-allowed border border-slate-800 bg-slate-900 text-slate-500'
                      }`}
                    >
                      <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                      {onlineRoom?.p2.connected ? 'BẮT ĐẦU SOLO ONLINE' : 'CHỜ BẠN BÈ VÀO (P2)...'}
                    </button>
                    <button
                      type="button"
                      onClick={onOpenInviteModal}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-2 text-xs font-bold text-sky-200 transition-colors hover:bg-sky-500/25"
                    >
                      <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                      MÃ QR &amp; LINK MỜI BẠN
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    data-testid="p2-ready-btn"
                    onClick={onToggleReady}
                    className={`font-display flex w-full items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold tracking-wider transition-colors ${
                      onlineRoom?.p2.ready
                        ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                        : 'bg-rose-500 text-white hover:bg-rose-400'
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {onlineRoom?.p2.ready ? 'ĐÃ SẴN SÀNG · CHỜ P1' : 'SẴN SÀNG CHIẾN ĐẤU (P2)'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={onLeaveOnlineRoom}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-400 transition-colors hover:border-rose-500/40 hover:text-rose-200"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  Rời phòng Online
                </button>
              </div>
            )}

            {/* Arena Stage Selector (4 Biochemical Venues) */}
            <div className="w-full space-y-1.5">
              <div className="flex items-center justify-between px-0.5 text-[11px] font-semibold text-slate-400">
                <span>Sàn thi đấu</span>
                <span className="truncate font-medium text-slate-300">
                  {onlineRole === 2 ? `${activeStageInfo.label} (Host)` : activeStageInfo.label}
                </span>
              </div>
              <div className="grid w-full grid-cols-2 gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1">
                {ARENA_STAGES.map((st) => {
                  const active = arenaStage === st.id;
                  const disabled = onlineRole === 2;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      data-testid={`stage-${st.id}`}
                      aria-pressed={active}
                      disabled={disabled}
                      onClick={() => onChangeStage(st.id)}
                      className={`rounded-md px-2 py-1.5 text-[11px] font-bold whitespace-nowrap transition-colors ${
                        active
                          ? 'text-slate-950'
                          : disabled
                          ? 'cursor-not-allowed text-slate-500'
                          : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                      }`}
                      style={active ? { backgroundColor: st.accentHex } : undefined}
                    >
                      {st.shortLabel}
                    </button>
                  );
                })}
              </div>
              <div className="px-0.5 text-[10px] font-medium text-slate-400">
                Hiểm hoạ sàn:{' '}
                <span className="font-semibold" style={{ color: activeStageInfo.accentHex }}>
                  {activeStageInfo.hazardLabel}
                </span>
              </div>
            </div>

            {/* Molecular Visual Mode (available in both offline and online) */}
            <div className="grid w-full grid-cols-3 gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1">
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

          <FighterLoadoutCard
            playerId={2}
            weapon={p2Weapon}
            roleLabel={
              onlineRole === 2
                ? 'P2 · BẠN (TUỲ CHỈNH)'
                : onlineRole === 1
                ? 'P2 · BẠN BÈ ONLINE'
                : undefined
            }
            locked={onlineRole === 1}
            lockedHint={
              onlineRoom?.p2.connected
                ? onlineRoom.p2.ready
                  ? 'Bạn bè đã sẵn sàng chiến đấu!'
                  : 'Bạn bè đang tuỳ chỉnh vũ khí P2...'
                : 'Gửi QR / Link cho bạn bè để chọn P2'
            }
            highlighted={onlineRole === 2}
            onSelectPreset={(s, n) => onSelectPreset(2, s, n)}
            onOpenCustom={() => onOpenCustomSmiles(2)}
          />
        </div>

        {/* Single flat control hint line */}
        <p className="text-center font-mono-tabular text-xs text-slate-400">
          WASD Di chuyển · F Kỹ năng SMILES · J Đấm · G/K Đá · H/L Đỡ · R/U Burst · Tiến+J Ném phân tử · S+K Hất tung · Tiến+K Xung kích
        </p>
      </div>
    </div>
  );
};
