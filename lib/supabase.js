// Supabase 서버 전용 도우미.
// 열쇠(SUPABASE_SECRET_KEY)는 서버에서만 쓰고 브라우저로 절대 내려보내지 않는다.

const URL_BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;

export const BUCKET = 'witak';

export function ready() {
  return Boolean(URL_BASE && KEY);
}

function headers(extra = {}) {
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

/** 표 읽기. query 는 PostgREST 형식 (예: 'select=*&order=due_date') */
export async function select(table, query = 'select=*') {
  const res = await fetch(`${URL_BASE}/rest/v1/${table}?${query}`, {
    headers: headers(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`읽기 실패(${table}): ${await res.text()}`);
  return res.json();
}

/** 넣기. upsert=true 면 이미 있으면 덮어쓴다 */
export async function insert(table, row, { upsert = false } = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers({
      Prefer: `return=representation${upsert ? ',resolution=merge-duplicates' : ''}`,
    }),
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`저장 실패(${table}): ${await res.text()}`);
  return res.json();
}

/** 고치기 */
export async function update(table, query, patch) {
  const res = await fetch(`${URL_BASE}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`수정 실패(${table}): ${await res.text()}`);
  return res.json();
}

/** 지우기 */
export async function remove(table, query) {
  const res = await fetch(`${URL_BASE}/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok) throw new Error(`삭제 실패(${table}): ${await res.text()}`);
  return true;
}

/**
 * 비공개 보관소 파일의 임시 주소를 만든다.
 * 이 주소를 모르면 파일을 받을 수 없고, 정해진 시간이 지나면 못 쓰게 된다.
 */
export async function signedUrl(path, expiresIn = 600) {
  const res = await fetch(`${URL_BASE}/storage/v1/object/sign/${BUCKET}/${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) throw new Error(`파일 주소 만들기 실패: ${await res.text()}`);
  const data = await res.json();
  return `${URL_BASE}/storage/v1${data.signedURL}`;
}

/** 전화번호를 하이픈 없는 숫자만 남긴다 */
export function normalizePhone(v) {
  return String(v || '').replace(/[^0-9]/g, '');
}

export function validPhone(v) {
  const p = normalizePhone(v);
  return /^01[0-9]{8,9}$/.test(p);
}
