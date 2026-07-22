// 원장님이 **문서별 한글 샘플**을 올릴 때 쓰는 "올리기 표"를 발급하고, 다 올라오면 제자리로 옮긴다.
// 큰 파일이 서버를 거치면 용량 제한에 걸리므로, 브라우저가 보관소로 직접 올린다.
export const dynamic = 'force-dynamic';

const URL_BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;
const BUCKET = 'witak';

const ALLOWED = ['toc', 'intro', 'budget', 'program', 'special', 'vulnerable', 'parent', 'final'];

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
    const kind = String(body.kind || '');
    if (!ALLOWED.includes(kind)) {
      return Response.json({ error: '알 수 없는 문서 종류입니다.' }, { status: 400 });
    }
    const final = `forms/${kind}.hwpx`;

    // ── 2단계: 다 올라왔으니 제자리로 옮긴다 ──
    if (body.finalize) {
      const temp = String(body.finalize);
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
      // 예전 것은 보관해 둔다 (되돌릴 수 있게). 없으면 실패해도 그냥 넘어간다.
      await storage('/object/move', {
        method: 'POST',
        body: JSON.stringify({
          bucketId: BUCKET,
          sourceKey: final,
          destinationKey: `archive/${kind}-${stamp}.hwpx`,
        }),
      });

      const mv = await storage('/object/move', {
        method: 'POST',
        body: JSON.stringify({ bucketId: BUCKET, sourceKey: temp, destinationKey: final }),
      });
      if (!mv.ok) {
        return Response.json({ error: `옮기지 못했습니다: ${await mv.text()}` }, { status: 500 });
      }
      return Response.json({ ok: true });
    }

    // ── 1단계: 임시 자리로 올릴 표를 발급한다 ──
    const temp = `incoming/${kind}-${Date.now()}.hwpx`;
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

// 어떤 문서 샘플이 올라와 있는지 (관리자 화면에서 확인용)
export async function GET(req) {
  try {
    if (!allowed(req)) {
      return Response.json({ error: '비밀번호가 맞지 않습니다.' }, { status: 401 });
    }
    const res = await storage(`/object/list/${BUCKET}`, {
      method: 'POST',
      body: JSON.stringify({ prefix: 'forms', limit: 100 }),
    });
    if (!res.ok) return Response.json({ files: [] });
    const list = await res.json();
    const files = {};
    list.forEach((o) => {
      const key = String(o.name).replace(/\.hwpx$/, '');
      files[key] = {
        size: (o.metadata || {}).size || 0,
        at: o.updated_at || o.created_at || '',
      };
    });
    return Response.json({ files });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
