# vendor/ — 앱 번들에 직접 넣는 서드파티 파일

런타임에 CDN에서 받아오면 네트워크가 느리거나 막힌 곳(지하철·기내·해외 첫날
로밍 전)에서 앱이 통째로 멈춘다. 정확히 steppY를 쓰는 상황이라 번들에 넣는다.

| 파일 | 버전 | 출처 |
| --- | --- | --- |
| `supabase.js` | @supabase/supabase-js 2.116.0 (UMD) | `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.js` |
| `fonts/PretendardVariable.woff2` | Pretendard 1.3.9 | `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2` |

## 올리는 법

    curl -o vendor/supabase.js \
      https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.js

버전을 올리면 위 표의 숫자도 같이 고친다. `@2` 같은 범위 태그가 아니라 정확한
버전을 받아야 다음 사람이 같은 파일을 재현할 수 있다.
