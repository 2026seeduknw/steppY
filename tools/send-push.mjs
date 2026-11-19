/**
 * 푸시 알림 보내기 — 내 컴퓨터에서 한 줄로.
 *
 *   npm run push -- "제목" "내용"                        전체에게
 *   npm run push -- "제목" "내용" --url consult.html     누르면 그 화면이 열림
 *   npm run push -- "제목" "내용" --user <user_id>       특정 사람만 (여러 번 써도 됨)
 *   npm run push -- "제목" "내용" --dry-run              보내지 않고 몇 대에 갈지만 확인
 *
 * 보내기 전에 몇 대에 갈지 보여주고 한 번 더 묻는다. --yes 를 붙이면 묻지 않는다.
 *
 * 처음 한 번만: 이 폴더(steppY-diary)에 .env.local 파일을 만들고 아래 한 줄을 넣는다.
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *   값: Supabase 대시보드 → Project Settings → API Keys → Legacy API Keys → service_role
 *   이 키는 모든 데이터를 열 수 있는 관리자 키다. .gitignore 에 들어 있어 커밋되지 않고,
 *   앱(www/)에도 들어가지 않는다. 절대 js/ 아래 파일에 넣지 말 것.
 *
 * 실제 발송은 Edge Function(supabase/functions/send-push)이 한다.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUPABASE_URL = 'https://iejxyrqjhqevbmgwcmwf.supabase.co';

async function serviceKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
  let text = '';
  try { text = await readFile(join(ROOT, '.env.local'), 'utf8'); } catch { /* 없음 */ }
  const m = text.match(/^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*["']?([^"'\r\n]+)/m);
  if (m) return m[1].trim();
  console.error('service_role 키가 없음. steppY-diary/.env.local 에 SUPABASE_SERVICE_ROLE_KEY=... 한 줄을 넣어야 함');
  process.exit(1);
}

function parseArgs(argv) {
  const out = { texts: [], users: [], url: null, dryRun: false, yes: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--user') out.users.push(argv[++i]);
    else if (a === '--url') out.url = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--yes' || a === '-y') out.yes = true;
    else out.texts.push(a);
  }
  return out;
}

async function call(key, body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`실패 (${res.status}):`, data);
    process.exit(1);
  }
  return data;
}

const args = parseArgs(process.argv.slice(2));
const [title = '', body = ''] = args.texts;
if (!title && !body) {
  console.error('사용법: npm run push -- "제목" "내용" [--url consult.html] [--user <id>] [--dry-run] [--yes]');
  process.exit(1);
}

const key = await serviceKey();
const request = {
  title,
  body,
  ...(args.users.length ? { user_ids: args.users } : {}),
  ...(args.url ? { url: args.url } : {})
};

const { targets } = await call(key, { ...request, dry_run: true });
const who = args.users.length ? `지정한 ${args.users.length}명` : '전체';
console.log(`대상: ${who} — 기기 ${targets}대`);
console.log(`제목: ${title}\n내용: ${body}${args.url ? `\n누르면: ${args.url}` : ''}`);

if (args.dryRun || targets === 0) process.exit(0);

if (!args.yes) {
  if (!process.stdin.isTTY) {
    console.error('확인할 수 없는 환경이라 보내지 않음. 보내려면 --yes 를 붙여야 함');
    process.exit(1);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('보낼까? (y/N) ')).trim().toLowerCase();
  rl.close();
  if (answer !== 'y' && answer !== 'yes') {
    console.log('취소함');
    process.exit(0);
  }
}

const result = await call(key, request);
console.log(`보냄 ${result.sent} · 실패 ${result.failed} · 지운 토큰 ${result.removed}`);
if (result.reasons && Object.keys(result.reasons).length) console.log('사유:', result.reasons);
