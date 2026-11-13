import React, { useEffect, useState } from 'react';
import { Check, Copy, Link2, Play, QrCode, Users, X } from 'lucide-react';
import QRCode from 'qrcode';
import type { OnlineRoomSnapshot } from '../net/onlineProtocol';

interface OnlineInviteModalProps {
  open: boolean;
  room: OnlineRoomSnapshot | null;
  inviteUrl: string;
  onClose: () => void;
  onStartMatch: () => void;
}

export const OnlineInviteModal: React.FC<OnlineInviteModalProps> = ({
  open,
  room,
  inviteUrl,
  onClose,
  onStartMatch,
}) => {
  const [qrSvg, setQrSvg] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !inviteUrl) return;
    let active = true;
    QRCode.toString(inviteUrl, {
      type: 'svg',
      margin: 1,
      width: 200,
      color: {
        dark: '#040914',
        light: '#f8fafc',
      },
    })
      .then((svg) => {
        if (active) setQrSvg(svg);
      })
      .catch(() => {
        if (active) setQrSvg('');
      });
    return () => {
      active = false;
    };
  }, [inviteUrl, open]);

  if (!open || !room) return null;

  const p2Connected = room.p2.connected;
  const p2Ready = room.p2.ready;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback selection copy
      const input = document.getElementById('online-invite-url-input') as HTMLInputElement | null;
      if (input) {
        input.select();
        document.execCommand('copy');
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Mời bạn bè solo trực tuyến"
    >
      <div className="w-full max-w-md rounded-xl border border-sky-500/40 bg-[#070d1c] p-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-sky-400" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold tracking-wide text-white">
              MỜI BẠN SOLO ONLINE
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ mời bạn"
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Room Code & Role Badge */}
        <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Mã phòng
            </span>
            <span
              data-testid="room-code"
              className="font-mono-tabular text-lg font-bold tracking-widest text-sky-300"
            >
              {room.roomId}
            </span>
          </div>
          <span className="rounded-md border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 font-mono-tabular text-xs font-bold text-sky-300">
            BẠN LÀ HOST (P1)
          </span>
        </div>

        {/* QR Code */}
        <div className="mt-4 flex flex-col items-center">
          <div
            data-testid="invite-qr"
            className="flex h-[200px] w-[200px] items-center justify-center overflow-hidden rounded-xl border-2 border-sky-400/50 bg-slate-50 p-2 shadow-inner"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="mt-2 text-center text-xs text-slate-400">
            Bạn bè quét mã QR hoặc mở link bên dưới để tuỳ chỉnh nhân vật &amp; điều khiển{' '}
            <span className="font-bold text-rose-400">P2</span>
          </p>
        </div>

        {/* Shareable Invite Link */}
        <div className="mt-3.5">
          <label
            htmlFor="online-invite-url-input"
            className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-300"
          >
            <Link2 className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
            Link phòng đấu trực tuyến
          </label>
          <div className="flex gap-2">
            <input
              id="online-invite-url-input"
              data-testid="invite-url-input"
              type="text"
              readOnly
              value={inviteUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="font-mono-tabular flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-sky-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-sky-500/50 bg-sky-500/20 px-3 py-2 text-xs font-bold text-sky-200 transition-colors hover:bg-sky-500/30"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                  Đã chép
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  Sao chép
                </>
              )}
            </button>
          </div>
        </div>

        {/* P2 Peer Status */}
        <div className="mt-3.5 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Users className="h-4 w-4 text-rose-400" aria-hidden="true" />
              Đối thủ (P2)
            </span>
            {p2Connected ? (
              <span
                className={`font-mono-tabular font-bold ${
                  p2Ready ? 'text-emerald-400' : 'text-amber-300'
                }`}
              >
                {p2Ready ? 'ĐÃ SẴN SÀNG' : 'ĐANG TUỲ CHỈNH'}
              </span>
            ) : (
              <span className="font-mono-tabular text-slate-400">Đang chờ kết nối...</span>
            )}
          </div>
          {p2Connected && (
            <div className="mt-1 text-xs text-slate-400">
              Vũ khí P2: <span className="font-semibold text-rose-300">{room.p2.weapon.name}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-bold text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
          >
            Đóng &amp; Chỉnh P1
          </button>
          <button
            type="button"
            disabled={!p2Connected}
            onClick={onStartMatch}
            className={`font-display flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-bold tracking-wider transition-colors ${
              p2Connected
                ? 'bg-sky-400 text-slate-950 hover:bg-sky-300'
                : 'cursor-not-allowed border border-slate-800 bg-slate-900 text-slate-500'
            }`}
          >
            <Play className="h-4 w-4 fill-current" aria-hidden="true" />
            BẮT ĐẦU SOLO
          </button>
        </div>
      </div>
    </div>
  );
};
