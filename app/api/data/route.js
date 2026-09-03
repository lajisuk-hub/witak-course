// 수강생이 쓴 내용을 **전화번호별로 서버에 보관**한다.
// 이게 있어야 휴대폰에서 하던 것을 컴퓨터에서 이어서 할 수 있다.
// 자료는 비공개 보관소(witak 버킷)의 progress/<전화번호>.json 파일 하나로 둔다.
import { validPhone, normalizePhone } from '@/lib/supabase';
import { contentSize } from '@/lib/mergeData';

export const dynamic = 'force-dynamic';

const URL_BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
const BUCKET = 'witak';

function auth(extra = {}) {
  return { apikey: KEY, Authorization: `Bearer ${KEY}`, ...extra };
}

function objectUrl(phone) {
  return `${URL_BASE}/storage/v1/object/${BUCKET}/progress/${phone}.json`;
}

// 보관소는 한 번 읽은 파일을 한동안 그대로 다시 내준다(캐시).
// 방금 저장한 내용이 안 보이는 사고가 실제로 났으므로,
// 읽을 때마다 주소 끝에 시각을 붙이고 '캐시 쓰지 말라'고 알린다.
function freshUrl(phone) {
  return `${objectUrl(phone)}?t=${Date.now()}`;
}

// ── 되돌릴 수 있게 남겨 두기 ──────────────────────
// 2026-09-03 사고: 내용이 적은 쪽이 서버를 덮어써 수강생 기록이 사라졌다.
// 앞으로는 **내용이 줄어드는 저장이 들어오면 먼저 예전 것을 백업**해 둔다.
// (평소 저장은 백업하지 않는다 — 줄어들 때만이라 보관함이 지저분해지지 않는다)
const BACKUP_KEEP = 10;

function backupPrefix(phone) {
  return `progress/backup/${phone}/`;
}

/** 지금 서버에 있는 내용을 읽어 온다 (없으면 null) */
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
    console.error('백업 실패', e); // 백업이 안 돼도 저장 자체는 막지 않는다
  }
}

// 이 전화번호로 저장해 둔 내용을 돌려준다 (없으면 null)
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

    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null; // 파일이 깨져 있으면 없는 것으로 본다
    }
    return Response.json({ data });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// 이 전화번호의 내용을 통째로 덮어쓴다
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

    // 내용이 줄어드는 저장이면 예전 것을 백업해 둔다 (실수로 지워져도 되돌릴 수 있게)
    const current = await readCurrent(phone);
    if (current && contentSize(body.data) < contentSize(current)) {
      await backup(phone, current);
    }

    const res = await fetch(objectUrl(phone), {
      method: 'POST',
      headers: auth({
        'Content-Type': 'application/json',
        'x-upsert': 'true',
        'cache-control': 'max-age=0, no-store',
      }),
      body: JSON.stringify(body.data),
    });
    if (!res.ok) throw new Error(await res.text());
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
