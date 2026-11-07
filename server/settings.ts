import { prisma } from './db';

// ===== G5: Cấu hình hệ thống (bảng Setting key-value + mặc định) =====

export interface AppSettings {
  clubName: string;
  groupEmail: string;
  kpiOnTime: number;
  kpiLate: number;
  kpiPending: number;
  kpiOverdue: number;
  reportDayOfWeek: number; // 0=Chủ nhật, 1=Thứ hai, ... 6=Thứ bảy
  reportHour: number; // giờ gửi báo cáo tuần (0-23)
}

export const DEFAULT_SETTINGS: AppSettings = {
  clubName: 'CLB Công nghệ thông tin NITC',
  groupEmail: 'bdh-nitc-club@googlegroups.com',
  kpiOnTime: 3,
  kpiLate: 1,
  kpiPending: 1,
  kpiOverdue: -2,
  reportDayOfWeek: 0,
  reportHour: 21,
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await prisma.setting.findMany();
  const stored = new Map(rows.map((r) => [r.key, r.value]));
  const result: AppSettings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]) {
    if (stored.has(key)) {
      try {
        const v = JSON.parse(stored.get(key)!);
        if (typeof v === typeof DEFAULT_SETTINGS[key]) {
          (result as any)[key] = v;
        }
      } catch {
        // giá trị hỏng -> dùng mặc định
      }
    }
  }
  return result;
}

/** Cập nhật một phần cấu hình (Ban lãnh đạo). Trả về cấu hình sau cập nhật. */
export async function updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]) {
    if (partial[key] !== undefined) {
      const value = JSON.stringify(partial[key]);
      await prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }
  }
  return getSettings();
}
