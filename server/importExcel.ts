import * as XLSX from 'xlsx';
import { prisma } from './db';
import { hashPassword } from './auth';
import { config } from './config';
import { HttpError } from './http';
import { backupDatabase } from './backup';

// ===== Import danh sách thành viên từ file Excel (danh bạ nhiệm kỳ của CLB) =====
// Định dạng: mỗi sheet là 1 ban (BCN, HỌC THUẬT, SỰ KIỆN, TRUYỀN THÔNG, ĐỐI NGOẠI).
// Cột (thứ tự tùy ý, nhận diện theo tiêu đề): STT | TÊN (THÀNH VIÊN) | SĐT | NGÀY SINH | MSV | LỚP | EMAIL | CHỨC VỤ
//
// Quy trình an toàn:
//   1. Đọc + kiểm tra TOÀN BỘ file trước, chưa ghi gì vào CSDL.
//   2. File không có dòng hợp lệ nào → báo lỗi, KHÔNG tạo nhiệm kỳ, KHÔNG đổi nhiệm kỳ hiện hành.
//   3. Ghi trong một transaction (lỗi giữa chừng thì không thay đổi gì).
//   4. Nhiệm kỳ CŨ hơn nhiệm kỳ hiện hành = nhập lưu trữ: không đổi nhiệm kỳ hiện hành, không sửa người đang có
//      trong hệ thống, người mới lưu với trạng thái "alumni" và không tạo tài khoản đăng nhập.

export type ImportMode = 'current' | 'newer' | 'archive';

export interface ImportSummary {
  term: string;
  mode: ImportMode;
  created: number;
  updated: number;
  skipped: number;
  skippedRows: string[];
  departments: Record<string, number>;
  /** Tệp sao lưu tạo trước khi ghi (chế độ current/newer) */
  backup?: string;
}

/** Bỏ dấu tiếng Việt để so khớp tiêu đề/tên ban/chức vụ */
function stripAccents(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

const DEPARTMENTS = ['Ban Chủ nhiệm', 'Học thuật', 'Sự kiện', 'Truyền thông', 'Đối ngoại'];

function sheetNameToDepartment(sheetName: string): string | null {
  const s = stripAccents(sheetName.toLowerCase()).trim();
  if (s.includes('bcn') || s.includes('chu nhiem')) return 'Ban Chủ nhiệm';
  if (s.includes('hoc thuat') || s === 'ht') return 'Học thuật';
  if (s.includes('su kien') || s === 'sk') return 'Sự kiện';
  if (s.includes('truyen thong') || s === 'tt') return 'Truyền thông';
  if (s.includes('doi ngoai') || s === 'dn') return 'Đối ngoại';
  return null; // không đoán bừa ra ban mới
}

/** Chuẩn hóa chức vụ tự do trong Excel về vai trò của hệ thống */
export function normalizeRole(raw: string): string {
  const s = stripAccents(String(raw || '').toLowerCase().trim());
  if (!s) return 'Thành viên';
  if (s.includes('pho chu nhiem') || s.includes('pho chu tich')) return 'Phó Chủ nhiệm';
  if (s.includes('chu nhiem') || s.includes('chu tich')) return 'Chủ nhiệm';
  if (s.includes('truong ban')) return 'Trưởng ban';
  if (s.includes('pho ban')) return 'Phó ban';
  if (s.includes('co van')) return 'Cố vấn';
  return 'Thành viên';
}

const ROLE_RANK: Record<string, number> = {
  'Chủ nhiệm': 6,
  'Phó Chủ nhiệm': 5,
  'Trưởng ban': 4,
  'Phó ban': 3,
  'Cố vấn': 2,
  'Thành viên': 1,
};

// ----- Nhận diện nội dung ô -----

/** Trông như số điện thoại VN (9–11 chữ số, có thể mất số 0 đầu) */
function looksLikePhone(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return false;
  if (typeof v === 'number') return v >= 1e8 && v < 1e11;
  const s = String(v).replace(/[\s.\-+()]/g, '');
  return /^\d{9,11}$/.test(s);
}

/** Trông như ngày sinh: số serial Excel, Date, hoặc d/m/y */
function looksLikeDate(v: unknown): boolean {
  if (v instanceof Date) return true;
  if (typeof v === 'number') return v > 20000 && v < 60000;
  const s = String(v ?? '').trim();
  if (/^\d{5}$/.test(s)) return Number(s) > 20000 && Number(s) < 60000;
  return /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(s);
}

/** SĐT: Excel nuốt số 0 đầu ("362647481") → khôi phục, bỏ khoảng trắng */
function normalizePhone(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  let s = String(v).trim().replace(/[\s.\-]/g, '');
  if (/^\d+(\.0)?$/.test(s)) {
    s = s.replace(/\.0$/, '');
    if (s.length === 9) s = '0' + s;
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

/** Ngày sinh: serial Excel | Date | "09/10/2006" | "31/05/06" | "18/11/206" → dd/MM/yyyy */
function normalizeBirthday(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string' && /^\d{5}$/.test(v.trim())) v = Number(v.trim());
  if (typeof v === 'number' && v > 20000 && v < 60000) {
    v = new Date(Math.round((v - 25569) * 86400 * 1000));
  }
  if (v instanceof Date && !isNaN(v.getTime())) {
    const dd = String(v.getUTCDate()).padStart(2, '0');
    const mm = String(v.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${v.getUTCFullYear()}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    let yy = m[3];
    if (yy.length === 2) yy = '20' + yy;
    if (yy.length === 3) yy = '2' + yy;
    return `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${yy}`;
  }
  return s;
}

/** Tìm hàng tiêu đề (trong 10 dòng đầu) và trả về chỉ số cột theo tên */
function findHeaderMap(rows: unknown[][]): { headerRowIdx: number; col: Record<string, number> } | null {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i] || [];
    const col: Record<string, number> = {};
    row.forEach((cell, idx) => {
      const c = stripAccents(String(cell ?? '').toLowerCase()).replace(/\s+/g, ' ').trim();
      if (!c) return;
      if (col.name === undefined && (c.includes('thanh vien') || c === 'ten' || c === 'ho ten' || c === 'ho va ten' || c === 'ho & ten' || c === 'ten thanh vien')) col.name = idx;
      else if (c.includes('sdt') || c.includes('so dien thoai') || c === 'dien thoai') col.phone = idx;
      else if (c.includes('ngay sinh')) col.birthday = idx;
      else if (c.includes('msv') || c.includes('ma sinh vien') || c.includes('ma sv')) col.studentId = idx;
      else if (c === 'lop' || c.startsWith('lop ')) col.className = idx;
      else if (c.includes('email') || c.includes('e-mail') || c === 'mail') col.email = idx;
      else if (c.includes('chuc vu') || c.includes('vai tro')) col.role = idx;
    });
    if (col.name !== undefined && col.email !== undefined) {
      return { headerRowIdx: i, col };
    }
  }
  return null;
}

interface ParsedMember {
  name: string;
  email: string;
  role: string;
  department: string;
  phone: string | null;
  studentId: string | null;
  className: string | null;
  birthday: string | null;
}

/** Đọc file → danh sách thành viên hợp lệ (không trùng email) + các dòng bị bỏ qua. Không đụng CSDL. */
export function parseRosterWorkbook(buffer: Buffer): { members: ParsedMember[]; skippedRows: string[] } {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'buffer' });
  } catch {
    throw new HttpError(400, 'Không đọc được file. Hãy chọn file Excel (.xlsx hoặc .xls).');
  }
  const skippedRows: string[] = [];
  const byEmail = new Map<string, ParsedMember & { fromBcnSheet: boolean }>();

  for (const sheetName of wb.SheetNames) {
    const department = sheetNameToDepartment(sheetName);
    if (!department) {
      skippedRows.push(`Sheet "${sheetName}": tên sheet không khớp ban nào (BCN, Học thuật, Sự kiện, Truyền thông, Đối ngoại) — bỏ qua`);
      continue;
    }
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: null, raw: true });
    const header = findHeaderMap(rows);
    if (!header) {
      if (rows.some((r) => (r || []).some((c) => String(c ?? '').trim()))) {
        skippedRows.push(`Sheet "${sheetName}": không tìm thấy hàng tiêu đề có cột Tên và Email — bỏ qua`);
      }
      continue;
    }

    for (let i = header.headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const get = (key: string): unknown => (header.col[key] !== undefined ? row[header.col[key]] : null);
      const name = String(get('name') ?? '').replace(/\s+/g, ' ').trim();
      if (!name) continue;

      const email = String(get('email') ?? '').trim().toLowerCase();
      if (!email) {
        skippedRows.push(`Sheet "${sheetName}" dòng ${i + 1}: "${name}" thiếu email — bỏ qua`);
        continue;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        skippedRows.push(`Sheet "${sheetName}" dòng ${i + 1}: "${name}" email không hợp lệ (${email}) — bỏ qua`);
        continue;
      }

      // Cột SĐT / Ngày sinh có thể bị ghi nhầm tiêu đề (đảo chỗ) → nhận theo nội dung
      let phoneRaw = get('phone');
      let birthdayRaw = get('birthday');
      if (looksLikeDate(phoneRaw) && looksLikePhone(birthdayRaw)) {
        [phoneRaw, birthdayRaw] = [birthdayRaw, phoneRaw];
      }

      const role = normalizeRole(String(get('role') ?? ''));
      const parsed = {
        name,
        email,
        role,
        // Chủ nhiệm / Phó Chủ nhiệm luôn thuộc Ban Chủ nhiệm
        department: role === 'Chủ nhiệm' || role === 'Phó Chủ nhiệm' ? 'Ban Chủ nhiệm' : department,
        phone: looksLikePhone(phoneRaw) ? normalizePhone(phoneRaw) : null,
        studentId: normalizeStudentId(get('studentId')),
        className: String(get('className') ?? '').trim() || null,
        birthday: looksLikeDate(birthdayRaw) ? normalizeBirthday(birthdayRaw) : null,
        fromBcnSheet: department === 'Ban Chủ nhiệm',
      };

      // Một người có thể có mặt ở cả sheet BCN lẫn sheet ban → gộp: giữ vai trò cao nhất,
      // ban lấy theo sheet ban (trừ Chủ nhiệm/Phó Chủ nhiệm), thông tin còn thiếu thì bổ sung.
      const prev = byEmail.get(email);
      if (!prev) {
        byEmail.set(email, parsed);
        continue;
      }
      const role2 = (ROLE_RANK[parsed.role] || 0) > (ROLE_RANK[prev.role] || 0) ? parsed.role : prev.role;
      const dept2 =
        role2 === 'Chủ nhiệm' || role2 === 'Phó Chủ nhiệm'
          ? 'Ban Chủ nhiệm'
          : prev.fromBcnSheet && !parsed.fromBcnSheet
          ? parsed.department
          : prev.department;
      byEmail.set(email, {
        ...prev,
        role: role2,
        department: dept2,
        fromBcnSheet: prev.fromBcnSheet && parsed.fromBcnSheet,
        phone: prev.phone || parsed.phone,
        studentId: prev.studentId || parsed.studentId,
        className: prev.className || parsed.className,
        birthday: prev.birthday || parsed.birthday,
      });
    }
  }

  const members = [...byEmail.values()].map(({ fromBcnSheet: _f, ...m }) => m);
  return { members, skippedRows };
}

/**
 * Import danh bạ vào nhiệm kỳ `termName`.
 *  - Nhiệm kỳ mới hơn nhiệm kỳ hiện hành (hoặc chưa có hiện hành): tạo nhiệm kỳ, upsert theo email, đặt làm hiện hành.
 *  - Trùng nhiệm kỳ hiện hành: upsert theo email, không đổi nhiệm kỳ.
 *  - Cũ hơn nhiệm kỳ hiện hành: chỉ lưu trữ — xem chú thích đầu tệp.
 */
export async function importRosterFromExcel(buffer: Buffer, termName: string): Promise<ImportSummary> {
  const { members, skippedRows } = parseRosterWorkbook(buffer);
  if (members.length === 0) {
    const reasons = skippedRows.slice(0, 3).join(' · ');
    throw new HttpError(
      400,
      `Không tìm thấy thành viên hợp lệ nào trong file — chưa thay đổi gì.${reasons ? ` ${reasons}` : ''}`,
      'IMPORT_EMPTY'
    );
  }

  const active = await prisma.term.findFirst({ where: { isActive: true } });
  const mode: ImportMode = !active || termName > active.name ? 'newer' : termName === active.name ? 'current' : 'archive';

  // Không tự khóa hệ thống: sau khi import phải còn ít nhất một Chủ nhiệm đang hoạt động
  // (file có thể ghi vai trò khác cho Chủ nhiệm hiện tại — VD danh bạ nhiệm kỳ trước).
  if (mode !== 'archive') {
    const fileRole = new Map(members.map((m) => [m.email, m.role]));
    const presidents = await prisma.member.findMany({ where: { role: 'Chủ nhiệm', status: 'active' }, select: { email: true } });
    const remaining = presidents.filter((p) => !fileRole.has(p.email.toLowerCase()) || fileRole.get(p.email.toLowerCase()) === 'Chủ nhiệm').length;
    const newPresidents = members.filter((m) => m.role === 'Chủ nhiệm' && !presidents.some((p) => p.email.toLowerCase() === m.email)).length;
    if (remaining + newPresidents === 0) {
      throw new HttpError(
        409,
        `File ghi Chủ nhiệm hiện tại với vai trò khác và không có Chủ nhiệm nào khác — import sẽ khiến không ai quản trị được hệ thống. Kiểm tra lại cột Chức vụ hoặc nhiệm kỳ (${termName}). Chưa thay đổi gì.`,
        'IMPORT_NO_PRESIDENT'
      );
    }
  }

  const summary: ImportSummary = { term: termName, mode, created: 0, updated: 0, skipped: 0, skippedRows: [...skippedRows], departments: {} };
  if (mode !== 'archive') summary.backup = (await backupDatabase('pre-import-excel')).split(/[\\/]/).pop();
  const passwordHash = mode === 'archive' ? '' : await hashPassword(config.defaultPassword);

  await prisma.$transaction(
    async (tx) => {
      const term = (await tx.term.findUnique({ where: { name: termName } })) ?? (await tx.term.create({ data: { name: termName } }));

      for (const m of members) {
        if (!DEPARTMENTS.includes(m.department)) continue;
        const existing = await tx.member.findFirst({ where: { email: m.email } });

        if (mode === 'archive') {
          // Không sửa người đang có trong hệ thống (họ thuộc nhiệm kỳ khác, thường là nhiệm kỳ hiện hành)
          if (existing) {
            summary.skipped += 1;
            continue;
          }
          await tx.member.create({ data: { ...m, status: 'alumni', termId: term.id } });
          summary.created += 1;
        } else if (existing) {
          await tx.member.update({ where: { id: existing.id }, data: { ...m, status: 'active', termId: term.id } });
          const user = await tx.user.findFirst({ where: { OR: [{ memberId: existing.id }, { email: m.email }] } });
          if (!user) await tx.user.create({ data: { email: m.email, passwordHash, memberId: existing.id } });
          summary.updated += 1;
        } else {
          const created = await tx.member.create({ data: { ...m, status: 'active', termId: term.id } });
          await tx.user.create({ data: { email: m.email, passwordHash, memberId: created.id } });
          summary.created += 1;
        }
        summary.departments[m.department] = (summary.departments[m.department] || 0) + 1;
      }

      if (mode === 'newer') {
        await tx.term.updateMany({ where: { isActive: true, id: { not: term.id } }, data: { isActive: false } });
        await tx.term.update({ where: { id: term.id }, data: { isActive: true } });
      }
    },
    { timeout: 120_000, maxWait: 15_000 }
  );

  if (mode === 'archive' && summary.skipped > 0) {
    summary.skippedRows.unshift(
      `${summary.skipped} người đã có trong hệ thống (nhiệm kỳ khác) — giữ nguyên thông tin hiện tại, không ghi đè bằng dữ liệu nhiệm kỳ cũ`
    );
  }
  return summary;
}

/** Nhiệm kỳ hiện hành (tạo mới nếu chưa có) — dùng bởi POST /members */
export async function getActiveTerm() {
  let term = await prisma.term.findFirst({ where: { isActive: true } });
  if (!term) {
    term = await prisma.term.create({ data: { name: 'Chưa phân nhiệm kỳ', isActive: true } });
  }
  return term;
}
