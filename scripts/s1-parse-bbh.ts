// Thử nghiệm S1: chạy bộ đọc biên bản họp (server/aiParser.ts) trên một thư mục biên bản dạng văn bản.
// Gọi thẳng hàm xử lý của máy chủ — không đi qua CSDL, không đụng dev.db.
//
// Chạy (AI, cần OPENAI_API_KEY trong .env):
//   node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/s1-parse-bbh.ts <thư_mục_bbh> <roster.json> <nhãn.json> <thư_mục_ra> ai 3
// Chạy (phương án dự phòng theo quy tắc, không gọi mạng):
//   node node_modules/tsx/dist/cli.mjs scripts/s1-parse-bbh.ts <thư_mục_bbh> <roster.json> <nhãn.json> <thư_mục_ra> heuristic 1
//
// Mỗi lần chạy ghi <thư_mục_ra>/<chế độ>/run<k>/<BBH-xx>.json gồm: thời gian trả lời, có phải rơi về phương án dự phòng không, kết quả.
import fs from 'fs';
import path from 'path';
import { parseBBHHandler } from '../server/aiParser';

const [bbhDir, rosterFile, labelFile, outDir, mode = 'ai', runsArg = '1'] = process.argv.slice(2);
if (!bbhDir || !rosterFile || !labelFile || !outDir) {
  console.error('Thiếu tham số. Xem phần đầu tệp.');
  process.exit(1);
}
const runs = Number(runsArg);
if (mode === 'heuristic') process.env.OPENAI_API_KEY = ''; // ép dùng bộ phân tích dự phòng
if (mode === 'ai' && !process.env.OPENAI_API_KEY) {
  console.error('Chế độ ai cần OPENAI_API_KEY (chạy với --env-file=.env).');
  process.exit(1);
}

const members = JSON.parse(fs.readFileSync(rosterFile, 'utf-8'));
const labels: { id: string; ngay: string }[] = JSON.parse(fs.readFileSync(labelFile, 'utf-8'));
const dateOf = new Map(labels.map((b) => [b.id, b.ngay]));
const files = fs.readdirSync(bbhDir).filter((f) => /^BBH-\d+\.txt$/.test(f)).sort();

// Ghi lại lỗi AI mà bộ xử lý nuốt (nó tự rơi về phương án dự phòng và vẫn trả 200)
let lastAiError = '';
const origErr = console.error;
console.error = (...a: any[]) => {
  const s = a.map(String).join(' ');
  if (s.includes('AI parsing error')) lastAiError = s;
  origErr(...a);
};

async function one(file: string, run: number) {
  const id = file.replace('.txt', '');
  const bbhText = fs.readFileSync(path.join(bbhDir, file), 'utf-8');
  const res: any = {
    statusCode: 200,
    body: null,
    status(c: number) {
      this.statusCode = c;
      return this;
    },
    json(b: any) {
      this.body = b;
      return this;
    },
  };
  lastAiError = '';
  const t0 = Date.now();
  let error: string | null = null;
  try {
    await parseBBHHandler({ body: { bbhText, members, meetingDate: dateOf.get(id) || '' } } as any, res);
  } catch (e: any) {
    error = String(e?.message || e);
  }
  const ms = Date.now() - t0;
  const tasks = res.body?.tasks || [];
  const fellBack = mode === 'ai' && (lastAiError !== '' || tasks.some((t: any) => String(t.reasoning).startsWith('Heuristic parsing')));
  const dir = path.join(outDir, mode, mode === 'ai' ? `run${run}` : 'run1');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${id}.json`),
    JSON.stringify({ id, mode, run, meetingDate: dateOf.get(id) || '', latencyMs: ms, statusCode: res.statusCode, error, fellBackToHeuristic: fellBack, aiError: lastAiError || null, result: res.body }, null, 1),
    'utf-8'
  );
  console.log(`${mode} run${run} ${id}: ${tasks.length} việc, ${ms} ms${fellBack ? ' [RƠI VỀ DỰ PHÒNG]' : ''}${error ? ' [LỖI: ' + error + ']' : ''}`);
}

for (let k = 1; k <= runs; k++) {
  // 3 biên bản song song cho nhanh; các lượt chạy nối tiếp nhau
  const queue = [...files];
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      for (let f = queue.shift(); f; f = queue.shift()) await one(f, k);
    })
  );
}
process.exit(0);
