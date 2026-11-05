import * as XLSX from 'xlsx';
import { prisma } from './db';
import { hashPassword } from './auth';

// ===== Import danh sách thành viên từ file Excel (danh bạ nhiệm kỳ của CLB) =====
// Định dạng file chuẩn NITC: mỗi sheet là 1 ban (BCN, HỌC THUẬT, SỰ KIỆN, TRUYỀN THÔNG, ĐỐI NGOẠI),
// cột: STT | TÊN THÀNH VIÊN | SĐT | NGÀY SINH | MSV | LỚP | EMAIL | CHỨC VỤ [ | LINK FB ]

export interface ImportSummary {
  term: string;
  created: number;
  updated: number;
  skipped: number;
  skippedRows: string[];
  departments: Record<string, number>;
}

/** Bỏ dấu tiếng Việt để so khớp tiêu đề/ten ban/chuc vu */
function stripAccents(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function sheetNameToDepartment(sheetName: string): string {
  const s = stripAccents(sheetName.toLowerCase()).trim();
  if (s.includes('bcn') || s.includes('chu nhiem') || s.includes('ban chu nhiem')) return 'Ban Chủ nhiệm';
  if (s.includes('hoc')) return 'Học thuật';
  if (s.includes('su kien') || s.includes('sk')) return 'Sự kiện';
  if (s.includes('truyen')) return 'Truyền thông';
  if (s.includes('doi ngoai') || s.includes('dn')) return 'Đối ngoại';
  return s; // fallback: dùng nguyên tên
}

/** Chuẩn hóa chức vụ tự do trong Excel về Role của hệ thống */
export function normalizeRole(raw: string, department: string): string {
  const s = stripAccents(String(raw || '').toLowerCase().trim());
  if (!s) return 'Thành viên';
  if (s.includes('chu nhiem') && !s.includes('pho')) return 'Chủ nhiệm';
  if (s.includes('chu tich') && !s.includes('pho')) return 'Chủ nhiệm';
  if ((s.includes('pho chu nhiem') || s.includes('pho chu tich'))) return 'Phó Chủ nhiệm';
  if (s.includes('truong ban') || s.includes('truong ban')) return 'Trưởng ban';
  if (s.includes('pho ban')) return 'Phó ban';
  if (s.includes('co van')) return 'Cố vấn';
  return 'Thành viên';
}

/** SĐT: số bị Excel nuốt mất số 0 đầu ("362647481" hoặc 362647481.0) → khôi phục, bỏ khoảng trắng */
function normalizePhone(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  let s = String(v).trim().replace(/[\s.\-]/g, '');
  if (/^\d+(\.0)?$/.test(s)) {
    s = s.replace(/\.0$/, '');
    if (s.length === 9) s = '0' + s; // SĐT VN thiếu số 0 đầu
  }
  return s || null;
}

/** MSV: 11236155.0 → "11236155"; giữ nguyên chuỗi kiểu "B25DCCN158" */
function normalizeStudentId(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  let s = String(v).trim();
  if (/^\d+(\.0)?$/.test(s)) s = s.replace(/\.0$/, '');
  return s || null;
}

/** Ngày sinh: Excel serial (38579) | Date | "09/10/2006" | "31/05/06" | "18/11/206" (typo) → chuẩn dd/MM/yyyy khi có thể */
function normalizeBirthday(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && v > 20000 && v < 60000) {
    // Excel serial date (ngày kể từ 1900) → JS Date
    v = new Date(Math.round((v - 25569) * 86400 * 1000));
  }
  if (v instanceof Date && !isNaN(v.getTime())) {
    const dd = String(v.getDate()).padStart(2, '0');
    const mm = String(v.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${v.getFullYear()}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let yy = m[3];
    if (yy.length === 2) yy = '20' + yy; // "06" → 2006
    if (yy.length === 3) yy = '2' + yy; // typo "206" → 2006
    return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${yy}`;
  }
  return s;
}

/** Tìm hàng tiêu đề chứa "THÀNH VIÊN" và trả về map cột theo chỉ số */
function findHeaderMap(rows: unknown[][]): { headerRowIdx: number; col: Record<string, number> } | null {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i] || [];
    const cells = row.map((c) => stripAccents(String(c ?? '').toLowerCase()));
    const col: Record<string, number> = {};
    cells.forEach((c, idx) => {
      if (c.includes('thanh vien')) col.name = idx;
      else if (c.includes('sdt')) col.phone = idx;
      else if (c.includes('ngay sinh')) col.birthday = idx;
      else if (c.includes('msv')) col.studentId = idx;
      else if (c.includes('lop')) col.className = idx;
      else if (c.includes('email')) col.email = idx;
      else if (c.includes('chuc vu')) col.role = idx;
      else if (c.includes('link fb') || c.includes('facebook')) col.facebook = idx;
    });
    if (col.name !== undefined && (col.email !== undefined || col.role !== undefined)) {
      return { headerRowIdx: i, col };
    }
  }
  return null;
}

/**
 * Import roster từ buffer Excel vào 1 nhiệm kỳ (tạo mới nếu chưa có), đặt làm nhiệm kỳ hiện hành.
 * Upsert theo email: trùng → cập nhật thông tin; mới → tạo thành viên + tài khoản đăng nhập.
 */
export async function importRosterFromExcel(
  buffer: Buffer,
  termName: string,
  opts: { deactivateOldTerm?: boolean } = { deactivateOldTerm: true }
): Promise<ImportSummary> {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const passwordHash = await hashPassword('nitc123');

  // 1. Nhiệm kỳ: upsert + đặt hiện hành
  let term = await prisma.term.findUnique({ where: { name: termName } });
  if (!term) term = await prisma.term.create({ data: { name: termName } });
  if (opts.deactivateOldTerm) {
    await prisma.term.updateMany({ where: { isActive: true, id: { not: term.id } }, data: { isActive: false } });
    await prisma.term.update({ where: { id: term.id }, data: { isActive: true } });
  }

  const summary: ImportSummary = {
    term: termName,
    created: 0,
    updated: 0,
    skipped: 0,
    skippedRows: [],
    departments: {},
  };

  // 2. Duyệt từng sheet = 1 ban
  for (const sheetName of wb.SheetNames) {
    const department = sheetNameToDepartment(sheetName);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: null });
    const header = findHeaderMap(rows);
    if (!header) {
      summary.skippedRows.push(`Sheet "${sheetName}": không nhận diện được hàng tiêu đề`);
      continue;
    }

    for (let i = header.headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const get = (key: string): unknown => (header.col[key] !== undefined ? row[header.col[key]] : null);

      const name = String(get('name') ?? '').trim();
      if (!name) continue; // hàng trống/đếm số thứ tự

      const email = String(get('email') ?? '').trim().toLowerCase();
      const role = normalizeRole(String(get('role') ?? ''), department);
      if (!email) {
        summary.skipped += 1;
        summary.skippedRows.push(`Sheet "${sheetName}" dòng ${i + 1}: "${name}" thiếu email — bỏ qua`);
        continue;
      }

      const data = {
        name,
        role,
        department,
        email,
        phone: normalizePhone(get('phone')),
        studentId: normalizeStudentId(get('studentId')),
        className: String(get('className') ?? '').trim() || null,
        birthday: normalizeBirthday(get('birthday')),
        status: 'active',
        termId: term.id,
      };

      const existing = await prisma.member.findFirst({ where: { email } });
      if (existing) {
        await prisma.member.update({ where: { id: existing.id }, data });
        summary.updated += 1;
      } else {
        const mem = await prisma.member.create({ data });
        await prisma.user.create({
          data: { email, passwordHash, memberId: mem.id },
        });
        summary.created += 1;
      }
      summary.departments[department] = (summary.departments[department] || 0) + 1;
    }
  }

  return summary;
}

/** Nhập tay 1 thành viên vào nhiệm kỳ hiện hành (dùng bởi POST /members) */
export async function getActiveTerm() {
  let term = await prisma.term.findFirst({ where: { isActive: true } });
  if (!term) {
    term = await prisma.term.create({ data: { name: 'Chưa phân nhiệm kỳ', isActive: true } });
  }
  return term;
}
