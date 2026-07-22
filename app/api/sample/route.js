// 문서 서식(샘플)의 임시 주소를 발급한다.
// 명단에 있는 전화번호로 로그인한 사람만 받을 수 있다.
import { ready, select, signedUrl, normalizePhone, validPhone } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ALLOWED = ['toc', 'intro', 'budget', 'program', 'special', 'vulnerable', 'parent', 'final'];

export async function GET(req) {
  try {
    if (!ready()) return Response.json({ error: '서버 설정이 끝나지 않았습니다.' }, { status: 500 });

    const url = new URL(req.url);
    const phone = normalizePhone(url.searchParams.get('phone'));
    const kind = String(url.searchParams.get('kind') || '');

    if (!validPhone(phone)) {
      return Response.json({ error: '먼저 전화번호로 들어와 주세요.' }, { status: 401 });
    }
    if (!ALLOWED.includes(kind)) {
      return Response.json({ error: '알 수 없는 문서 종류입니다.' }, { status: 400 });
    }

    const found = await select(
      'witak_students',
      `select=phone,allowed&phone=eq.${encodeURIComponent(phone)}`
    );
    if (!found.length || found[0].allowed === false) {
      return Response.json(
        { error: '이용할 수 없는 번호입니다. 라지숙 소장에게 연락해 주세요.' },
        { status: 403 }
      );
    }

    try {
      // 10분만 쓸 수 있는 주소
      const link = await signedUrl(`forms/${kind}.hwpx`, 600);
      return Response.json({ url: link });
    } catch {
      return Response.json(
        { error: '아직 이 문서의 서식이 올라오지 않았습니다. 라지숙 소장에게 문의해 주세요.' },
        { status: 404 }
      );
    }
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
