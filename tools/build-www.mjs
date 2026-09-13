/**
 * 웹 소스를 Capacitor가 앱에 넣을 www/ 로 모은다.
 *
 * 왜 필요한가
 *   Capacitor는 webDir 하나를 통째로 앱 번들에 복사한다. 저장소 루트를 그대로
 *   webDir로 쓰면 .git / supabase(생성 스크립트·SQL) / node_modules 까지 앱에
 *   따라 들어간다. 실제로 기기에서 필요한 건 화면을 그리는 파일뿐이라,
 *   그 목록만 여기서 추린다.
 *
 *   번들 스텝이 따로 없는 정적 사이트라 트랜스파일·압축은 하지 않는다.
 *   그대로 복사하는 것이 전부이고, 그래서 원본 파일 구조를 하나도 바꾸지 않는다.
 */
import { cp, rm, mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'www');

/* 디렉터리는 통째로, HTML은 루트에 있는 것만 자동으로 집는다. */
const DIRS = ['css', 'js', 'assets'];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const htmls = (await readdir(ROOT)).filter(f => f.endsWith('.html'));
for (const f of htmls) await cp(join(ROOT, f), join(OUT, f));
for (const d of DIRS) await cp(join(ROOT, d), join(OUT, d), { recursive: true });

console.log(`www/ 생성 — html ${htmls.length}개, 디렉터리 ${DIRS.join(' ')}`);
