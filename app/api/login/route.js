// 전화번호 로그인. 처음 들어온 번호는 명단에 자동으로 올라간다.
import { ready, select, insert, update, normalizePhone, validPhone } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    if (!ready()) {
      return Response.json({ error: '아직 서버 설정이 끝나지 않았습니다.' }, { status: 500 });
    }

    const body = await req.json();
    const phone = normalizePhone(body.phone);
    const name = String(body.name || '').trim();

    if (!validPhone(phone)) {
      return Response.json(
        { error: '전화번호를 하이픈 없이 숫자만 넣어 주세요. (예: 01012345678)' },
        { status: 400 }
      );
    }

    const found = await select(
      'witak_students',
      `select=*&phone=eq.${encodeURIComponent(phone)}`
    );

    if (found.length) {
      const me = found[0];
      if (me.allowed === false) {
        return Response.json(
          { error: '이 번호는 지금 이용할 수 없습니다. 라지숙 소장에게 연락해 주세요.' },
          { status: 403 }
        );
      }
      const patch = { last_seen: new Date().toISOString() };
      if (name && name !== me.name) patch.name = name;
      if (body.region) patch.region = String(body.region).trim();
      if (body.target) patch.target = String(body.target).trim();
      const [updated] = await update(
        'witak_students',
        `phone=eq.${encodeURIComponent(phone)}`,
        patch
      );
      return Response.json({ student: updated, isNew: false });
    }

    if (!name) {
      // 처음 오신 분이라 이름이 필요하다
      return Response.json({ needName: true });
    }

    const [created] = await insert('witak_students', {
      phone,
      name,
      region: body.region ? String(body.region).trim() : null,
      target: body.target ? String(body.target).trim() : null,
    });
    return Response.json({ student: created, isNew: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message || '알 수 없는 오류' }, { status: 500 });
  }
}
