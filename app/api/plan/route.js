// 달력에 올릴 할 일과, 수강생이 누른 체크를 다룬다.
import { ready, select, insert, remove, normalizePhone, validPhone } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// 할 일 목록 + 내가 체크한 것
export async function GET(req) {
  try {
    if (!ready()) return Response.json({ error: '서버 설정이 끝나지 않았습니다.' }, { status: 500 });

    const url = new URL(req.url);
    const phone = normalizePhone(url.searchParams.get('phone'));

    const tasks = await select('witak_tasks', 'select=*&order=due_date.asc,id.asc');
    let checked = [];
    if (validPhone(phone)) {
      const rows = await select(
        'witak_checks',
        `select=task_id&phone=eq.${encodeURIComponent(phone)}`
      );
      checked = rows.map((r) => r.task_id);
    }
    return Response.json({ tasks, checked });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// 체크하기 / 체크 풀기
export async function POST(req) {
  try {
    if (!ready()) return Response.json({ error: '서버 설정이 끝나지 않았습니다.' }, { status: 500 });

    const { phone: raw, taskId, on } = await req.json();
    const phone = normalizePhone(raw);
    if (!validPhone(phone) || !taskId) {
      return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    }

    if (on) {
      await insert('witak_checks', { phone, task_id: taskId }, { upsert: true });
    } else {
      await remove(
        'witak_checks',
        `phone=eq.${encodeURIComponent(phone)}&task_id=eq.${Number(taskId)}`
      );
    }
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
