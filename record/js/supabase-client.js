/**
 * Supabase 클라이언트 초기화.
 *
 * 아래 두 값을 채우면(SUPABASE_URL, SUPABASE_ANON_KEY) js/data-source.js가
 * 자동으로 원격 데이터를 불러와 mock-data.js 값을 덮어씁니다.
 * 비워두면 지금처럼 mock-data.js 값 그대로 동작합니다 — 아무것도 깨지지 않습니다.
 *
 * 값 구하는 곳: Supabase 대시보드 → Project Settings → API
 *   - SUPABASE_URL      = Project URL (예: https://xxxxxxxx.supabase.co)
 *   - SUPABASE_ANON_KEY = anon public key
 *     (service_role 키 아님 — 그건 서버 전용이고 절대 프론트 코드에 넣으면 안 됩니다.
 *      anon key는 공개돼도 되는 키이며, 실제 접근 제어는 Supabase의 RLS 정책이 담당합니다.)
 */
const SUPABASE_URL = 'https://iejxyrqjhqevbmgwcmwf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imllanh5cnFqaHFldmJtZ3djbXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNjA0NTQsImV4cCI6MjEwMjYzNjQ1NH0.Xia_lXQBjh4iUcUBzN5xKkLyjNXEaM0qIsLKXhUxa8s';

const SUPABASE_CONFIGURED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

const supabaseClient = SUPABASE_CONFIGURED
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
