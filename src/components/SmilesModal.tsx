import React, { useEffect, useMemo, useState } from 'react';
import { X, FlaskConical, Check, AlertTriangle, Dices } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import {
  DRUG_PRESETS,
  INTERESTING_COMPOUNDS,
  parseSmilesToWeapon,
  type DrugPreset,
  type ParsedMolecule,
} from '../chem/smilesEngine';

interface SmilesModalProps {
  open: boolean;
  playerId: 1 | 2;
  currentSmiles: string;
  onClose: () => void;
  onEquip: (playerId: 1 | 2, mol: ParsedMolecule) => void;
}

const ALL_SUGGESTIONS: DrugPreset[] = [...DRUG_PRESETS, ...INTERESTING_COMPOUNDS];
const QUICK_SAMPLES: DrugPreset[] = [...DRUG_PRESETS.slice(0, 6), ...INTERESTING_COMPOUNDS.slice(0, 4)];

export const SmilesModal: React.FC<SmilesModalProps> = ({
  open,
  playerId,
  currentSmiles,
  onClose,
  onEquip,
}) => {
  const [smilesText, setSmilesText] = useState(currentSmiles);
  const [customName, setCustomName] = useState('');
  const [activeNote, setActiveNote] = useState<{ name: string; category: string; description: string } | null>(null);

  useEffect(() => {
    if (open) {
      setSmilesText(currentSmiles);
      setCustomName('');
      setActiveNote(null);
    }
  }, [open, currentSmiles]);

  const accentHex = playerId === 1 ? '#38bdf8' : '#f43f5e';
  const preview = useMemo(
    () => parseSmilesToWeapon(smilesText, customName.trim() || undefined, accentHex),
    [smilesText, customName, accentHex]
  );

  if (!open) return null;

  const handlePickPreset = (item: DrugPreset) => {
    soundEngine.playUiClick();
    setSmilesText(item.smiles);
    setCustomName(item.name);
    setActiveNote({ name: item.name, category: item.category, description: item.description });
  };

  const handleRandomSuggestion = () => {
    const candidates = ALL_SUGGESTIONS.filter((item) => item.smiles.trim() !== smilesText.trim());
    const pool = candidates.length > 0 ? candidates : ALL_SUGGESTIONS;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    handlePickPreset(picked);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview.success) return;
    onEquip(playerId, preview);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(2, 6, 16, 0.82)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="smiles-modal-title"
    >
      <div
        className="w-full max-w-2xl rounded-xl border p-6 shadow-2xl"
        style={{
          backgroundColor: 'rgba(10, 18, 36, 0.98)',
          borderColor: playerId === 1 ? 'rgba(56, 189, 248, 0.45)' : 'rgba(244, 63, 94, 0.45)',
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FlaskConical
              className="h-5 w-5"
              style={{ color: accentHex }}
              aria-hidden="true"
            />
            <h2
              id="smiles-modal-title"
              className="font-display text-lg font-bold tracking-wide text-slate-100"
            >
              Chế tạo Vũ khí Phân tử — Player {playerId}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ SMILES"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[1fr_200px]">
            <div className="space-y-3">
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label
                    htmlFor="smiles-input"
                    className="block text-xs font-semibold tracking-wider text-slate-300"
                  >
                    Chuỗi SMILES (Cấu trúc hóa học)
                  </label>
                  <button
                    type="button"
                    data-testid="random-smiles-btn"
                    onClick={handleRandomSuggestion}
                    className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/50 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300 transition-colors hover:border-amber-300 hover:bg-amber-500/25 hover:text-amber-100 focus-visible:outline-2 focus-visible:outline-amber-400"
                  >
                    <Dices className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Gợi ý ngẫu nhiên</span>
                  </button>
                </div>
                <input
                  id="smiles-input"
                  type="text"
                  value={smilesText}
                  onChange={(e) => {
                    setSmilesText(e.target.value);
                    setActiveNote(null);
                  }}
                  placeholder="Ví dụ: CC(=O)Oc1ccccc1C(=O)O"
                  autoFocus
                  className="font-mono-tabular w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
                />
                {activeNote && (
                  <p
                    data-testid="random-smiles-note"
                    className="mt-1.5 rounded-md border border-slate-800 bg-slate-900/90 px-2.5 py-1.5 text-[11px] leading-snug text-slate-300"
                  >
                    <span className="font-semibold text-amber-300">{activeNote.name}</span>
                    <span className="mx-1.5 text-slate-600">·</span>
                    <span className="text-sky-300">{activeNote.category}</span>
                    <span className="mx-1.5 text-slate-600">—</span>
                    <span>{activeNote.description}</span>
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="weapon-name-input"
                  className="mb-1.5 block text-xs font-semibold tracking-wider text-slate-300"
                >
                  Tên vũ khí (Tuỳ chọn)
                </label>
                <input
                  id="weapon-name-input"
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Tự động nhận diện công thức nếu để trống"
                  maxLength={24}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div>
                <div className="mb-1.5 text-xs font-semibold text-slate-400">
                  Mẫu phân tử nhanh:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_SAMPLES.map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => handlePickPreset(item)}
                      className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:border-sky-400 hover:text-white"
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live 2D SVG & Stats Preview */}
            <div className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-950 p-3">
              {preview.success ? (
                <>
                  <div
                    className="mx-auto h-36 w-36"
                    dangerouslySetInnerHTML={{ __html: preview.svg2d }}
                  />
                  <div className="mt-2 space-y-1 border-t border-slate-800 pt-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Công thức</span>
                      <span className="font-mono-tabular font-bold text-slate-100">
                        {preview.formula}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">MW / LogP</span>
                      <span className="font-mono-tabular text-slate-200">
                        {preview.stats.mw} · {preview.stats.logp}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pt-1 font-mono-tabular text-[11px]">
                      <span className="text-emerald-400">HP {preview.stats.hp}</span>
                      <span className="text-amber-400">ATK {preview.stats.atk}</span>
                      <span className="text-sky-400">DEF {preview.stats.def}</span>
                      <span className="text-rose-400">CRIT {preview.stats.crit}%</span>
                    </div>
                    <div
                      data-testid="modal-smiles-skill"
                      className="mt-2 rounded-md border border-slate-800 bg-slate-900/90 p-2"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="text-[11px] font-bold"
                          style={{ color: preview.stats.skill.accentHex }}
                        >
                          [F] {preview.stats.skill.name}
                        </span>
                        <span className="font-mono-tabular text-[10px] text-slate-400">
                          {preview.stats.skill.cooldown}s
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] leading-snug text-slate-300">
                        {preview.stats.skill.description}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-2 text-center text-rose-400">
                  <AlertTriangle className="h-7 w-7" />
                  <span className="text-xs leading-relaxed">{preview.error}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-800 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={!preview.success}
              className="flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-bold text-slate-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: accentHex }}
            >
              <Check className="h-4 w-4" />
              Trang bị Vũ khí
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
