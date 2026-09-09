// 2차시 **예산서(예산 게임)에 쓰신 내용**을 전화번호별로 서버에 보관한다.
//
// 다른 차시 내용(/api/data)과 같은 자리(witak 보관소)를 쓰되, 파일은 따로 둔다.
// 예산서는 한 벌이 통째로 맞물려 있어(정원·반·교직원·수당이 서로 물려 있다)
// 칸별로 섞으면 오히려 이상해진다 → **더 많이 채워진 쪽 한 벌을 그대로** 쓴다.
//
// ★ 2026-09-09 사고: 예산서는 그 브라우저에만 담겨 있어서
//   기기를 바꾸거나 브라우저가 저장분을 지우면 통째로 사라졌다(복구 불가).
//   그래서 ① 서버에도 담고 ② 빈 내용이 채워진 내용을 덮어쓰지 못하게 하고
//   ③ 내용이 줄어드는 저장이 오면 예전 것을 백업해 둔다.
import { validPhone, normalizePhone } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const URL_BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
const BUCKET = 'witak';
const BACKUP_KEEP = 10;

function auth(extra = {}) {
  return { apikey: KEY, Authorization: `Bearer ${KEY}`, ...extra };
}

function objectUrl(phone) {
  return `${URL_BASE}/storage/v1/object/${BUCKET}/budget/${phone}.json`;
}

// 보관소는 한 번 읽은 파일을 한동안 그대로 다시 내준다(캐시).
// 방금 저장한 내용이 안 보이는 사고가 실제로 났으므로 읽을 때마다 시각을 붙인다.
function freshUrl(phone) {
  return `${objectUrl(phone)}?t=${Date.now()}`;
}

function backupPrefix(phone) {
  return `budget/backup/${phone}/`;
}

/** 지금 서버에 담겨 있는 내용 (없으면 null) */
async function readCurrent(phone) {
  try {
    const res = await fetch(freshUrl(phone), {
      headers: auth({ 'Cache-Control': 'no-cache' }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return JSON.parse(await res.text());
  } catch {
    return null;
  }
}

/** 예전 내용을 백업 칸에 복사하고, 오래된 백업은 정리한다 */
async function backup(phone, data) {
  try {
    await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${backupPrefix(phone)}${Date.now()}.json`, {
      method: 'POST',
      headers: auth({ 'Content-Type': 'application/json', 'x-upsert': 'true' }),
      body: JSON.stringify(data),
    });

    const listed = await fetch(`${URL_BASE}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: auth({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefix: backupPrefix(phone), limit: 100 }),
    });
    if (!listed.ok) return;
    const files = await listed.json();
    const old = files
      .map((f) => f.name)
      .sort() // 이름이 시각(숫자)이라 이름순 = 오래된 순
      .slice(0, Math.max(0, files.length - BACKUP_KEEP));
    if (!old.length) return;
    await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}`, {
      method: 'DELETE',
      headers: auth({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes: old.map((n) => `${backupPrefix(phone)}${n}`) }),
    });
  } catch (e) {
    console.error('예산서 백업 실패', e); // 백업이 안 돼도 저장 자체는 막지 않는다
  }
}

// 이 전화번호로 담아 둔 예산서 내용을 돌려준다 (없으면 null)
export async function GET(req) {
  try {
    if (!URL_BASE || !KEY) {
      return Response.json({ error: '서버 설정이 끝나지 않았습니다.' }, { status: 500 });
    }
    const phone = normalizePhone(new URL(req.url).searchParams.get('phone'));
    if (!validPhone(phone)) return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });

    const res = await fetch(freshUrl(phone), {
      headers: auth({ 'Cache-Control': 'no-cache' }),
      cache: 'no-store',
    });
    if (res.status === 404 || res.status === 400) return Response.json({ data: null });
    if (!res.ok) throw new Error(await res.text());

    let data = null;
    try {
      data = JSON.parse(await res.text());
    } catch {
      data = null; // 파일이 깨져 있으면 없는 것으로 본다
    }
    return Response.json({ data });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// 이 전화번호의 예산서 내용을 담는다
export async function POST(req) {
  try {
    if (!URL_BASE || !KEY) {
      return Response.json({ error: '서버 설정이 끝나지 않았습니다.' }, { status: 500 });
    }
    const body = await req.json().catch(() => ({}));
    const phone = normalizePhone(body.phone);
    if (!validPhone(phone)) return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    if (!body.data || typeof body.data !== 'object') {
      return Response.json({ error: '저장할 내용이 없습니다.' }, { status: 400 });
    }

    const current = await readCurrent(phone);
    const curSize = Number(current && current.size) || 0;
    const newSize = Number(body.size) || 0;

    // ★ 빈 내용이 채워진 내용을 덮어쓰지 못한다.
    //   ('처음부터 다시 하기'처럼 정말로 비우려는 때만 force 로 들어온다)
    if (!body.force && newSize === 0 && curSize > 0) {
      return Response.json({ ok: true, skipped: true });
    }

    // 내용이 줄어드는 저장이면 예전 것을 백업해 둔다 (실수로 지워져도 되돌릴 수 있게)
    if (current && newSize < curSize) await backup(phone, current);

    const save = {
      at: typeof body.at === 'string' ? body.at : new Date().toISOString(),
      size: newSize,
      currentStep: Number(body.currentStep) || 0,
      data: body.data,
    };

    const res = await fetch(objectUrl(phone), {
      method: 'POST',
      headers: auth({
        'Content-Type': 'application/json',
        'x-upsert': 'true',
        'cache-control': 'max-age=0, no-store',
      }),
      body: JSON.stringify(save),
    });
    if (!res.ok) throw new Error(await res.text());
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
