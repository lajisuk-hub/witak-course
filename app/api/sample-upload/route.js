// 원장님이 새 문서 샘플을 올릴 때 쓰는 "올리기 표"를 발급하고, 다 올라오면 제자리로 옮긴다.
// 12MB 파일이 서버를 거치면 용량 제한에 걸리므로, 브라우저가 보관소로 직접 올린다.
export const dynamic = 'force-dynamic';

const URL_BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
const BUCKET = 'witak';
const FINAL = 'sample.hwpx';

function allowed(req) {
  const pw = req.headers.get('x-admin-pw') || '';
  return pw === (process.env.ADMIN_PASSWORD || '1234');
}

function headers() {
  return { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
}

async function storage(path, init = {}) {
  return fetch(`${URL_BASE}/storage/v1${path}`, { ...init, headers: headers() });
}

export async function POST(req) {
  try {
    if (!allowed(req)) {
      return Response.json({ error: '비밀번호가 맞지 않습니다.' }, { status: 401 });
    }
    if (!URL_BASE || !KEY) {
      return Response.json({ error: '서버 설정이 끝나지 않았습니다.' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));

    // ── 2단계: 다 올라왔으니 제자리로 옮긴다 ──
    if (body.finalize) {
      const temp = String(body.finalize);
      // 예전 샘플은 날짜를 붙여 보관해 둔다 (되돌릴 수 있게)
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
      await storage(`/object/move`, {
        method: 'POST',
        body: JSON.stringify({
          bucketId: BUCKET,
          sourceKey: FINAL,
          destinationKey: `archive/sample-${stamp}.hwpx`,
        }),
      }); // 없으면 실패해도 그냥 넘어간다

      const mv = await storage(`/object/move`, {
        method: 'POST',
        body: JSON.stringify({ bucketId: BUCKET, sourceKey: temp, destinationKey: FINAL }),
      });
      if (!mv.ok) {
        return Response.json({ error: `옮기지 못했습니다: ${await mv.text()}` }, { status: 500 });
      }
      return Response.json({ ok: true });
    }

    // ── 1단계: 임시 자리로 올릴 표를 발급한다 ──
    const stamp = Date.now();
    const temp = `incoming/sample-${stamp}.hwpx`;
    const res = await storage(`/object/upload/sign/${BUCKET}/${temp}`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      return Response.json({ error: `올리기 표 발급 실패: ${await res.text()}` }, { status: 500 });
    }
    const data = await res.json();
    return Response.json({ url: `${URL_BASE}/storage/v1${data.url}`, temp });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
