export type ArenaStageId = 'cell' | 'flask' | 'bloodstream' | 'receptor';

export interface ArenaStageInfo {
  id: ArenaStageId;
  label: string;
  shortLabel: string;
  subtitle: string;
  hazardLabel: string;
  accentHex: string;
  outroTitle: string;
  outroSubtitle: string;
}

export const ARENA_STAGES: readonly ArenaStageInfo[] = [
  {
    id: 'cell',
    label: 'Trong Tế Bào',
    shortLabel: 'Tế bào',
    subtitle: 'Màng kép phospholipid · Ty thể & Chuỗi xoắn DNA',
    hazardLabel: 'Bị enzyme tấn công',
    accentHex: '#38bdf8',
    outroTitle: 'THÂM NHẬP NHÂN TẾ BÀO',
    outroSubtitle: 'Hoạt chất đi qua lỗ màng nhân để chuyển hoá và phát huy tác dụng!',
  },
  {
    id: 'flask',
    label: 'Bình Cầu Phản Ứng',
    shortLabel: 'Bình cầu',
    subtitle: 'Bình thuỷ tinh borosilicate · Cá từ khuấy & Ống sinh hàn',
    hazardLabel: 'Cá từ quay dưới chân',
    accentHex: '#2dd4bf',
    outroTitle: 'KẾT TINH LẤP LÁNH',
    outroSubtitle: 'Sản phẩm tổng hợp kết tinh thành mạng tinh thể tinh khiết rực sáng!',
  },
  {
    id: 'bloodstream',
    label: 'Trong Mạch Máu',
    shortLabel: 'Mạch máu',
    subtitle: 'Lòng động mạch · Hồng cầu lưỡng lõm & Bạch cầu',
    hazardLabel: 'Bạch cầu từ trên tấn công',
    accentHex: '#fb7185',
    outroTitle: 'HẤP THU VÀO TUẦN HOÀN MÁU',
    outroSubtitle: 'Phân tử chiến thắng hoà tan và được hấp thu vào dòng tuần hoàn máu!',
  },
  {
    id: 'receptor',
    label: 'Đích Tác Động',
    shortLabel: 'Đích tác động',
    subtitle: 'Túi gắn thụ thể GPCR · Xoắn alpha & Trung tâm xúc tác',
    hazardLabel: 'Cạnh tranh thụ thể',
    accentHex: '#c084fc',
    outroTitle: 'GẮN ĐẶC HIỆU VÀO THỤ THỂ',
    outroSubtitle: 'Hoạt chất khớp hoàn hảo vào ổ khoá thụ thể và kích hoạt đáp ứng sinh học!',
  },
] as const;

export function isArenaStageId(value: unknown): value is ArenaStageId {
  return (
    value === 'cell' ||
    value === 'flask' ||
    value === 'bloodstream' ||
    value === 'receptor'
  );
}

export function getArenaStageInfo(id: ArenaStageId): ArenaStageInfo {
  return ARENA_STAGES.find((s) => s.id === id) ?? ARENA_STAGES[0];
}
