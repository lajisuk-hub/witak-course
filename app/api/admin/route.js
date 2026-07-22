// 원장님(관리자) 전용. 비밀번호를 아는 사람만 쓸 수 있다.
import { ready, select, insert, update, remove } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function allowed(req) {
  const pw = req.headers.get('x-admin-pw') || '';
  const real = process.env.ADMIN_PASSWORD || '1234';
  return pw === real;
}

const NO = () => Response.json({ error: '비밀번호가 맞지 않습니다.' }, { status: 401 });

// 수강생 명단 + 할 일 + 체크 현황
export async function GET(req) {
  try {
    if (!allowed(req)) return NO();
    if (!ready()) return Response.json({ error: '서버 설정이 끝나지 않았습니다.' }, { status: 500 });

    const [students, tasks, checks] = await Promise.all([
      select('witak_students', 'select=*&order=created_at.asc'),
      select('witak_tasks', 'select=*&order=due_date.asc,id.asc'),
      select('witak_checks', 'select=phone,task_id,checked_at'),
    ]);
    return Response.json({ students, tasks, checks });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// 할 일 추가
export async function POST(req) {
  try {
    if (!allowed(req)) return NO();
    const { due_date, title, detail, step } = await req.json();
    if (!due_date || !String(title || '').trim()) {
      return Response.json({ error: '날짜와 할 일 제목은 꼭 있어야 합니다.' }, { status: 400 });
    }
    const [row] = await insert('witak_tasks', {
      due_date,
      title: String(title).trim(),
      detail: detail ? String(detail).trim() : null,
      step: step === '' || step == null ? null : Number(step),
    });
    return Response.json({ task: row });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// 할 일 고치기·지우기 / 수강생 이용 막기·풀기
export async function PATCH(req) {
  try {
    if (!allowed(req)) return NO();
    const body = await req.json();
    const { action, id, phone, allowed: allow } = body;

    if (action === 'deleteTask' && id) {
      await remove('witak_tasks', `id=eq.${Number(id)}`);
      return Response.json({ ok: true });
    }
    if (action === 'updateTask' && id) {
      if (!body.due_date || !String(body.title || '').trim()) {
        return Response.json({ error: '날짜와 제목은 꼭 있어야 합니다.' }, { status: 400 });
      }
      const [row] = await update('witak_tasks', `id=eq.${Number(id)}`, {
        due_date: body.due_date,
        title: String(body.title).trim(),
        detail: body.detail ? String(body.detail).trim() : null,
        step: body.step === '' || body.step == null ? null : Number(body.step),
      });
      return Response.json({ task: row });
    }
    if (action === 'setAllowed' && phone) {
      await update('witak_students', `phone=eq.${encodeURIComponent(phone)}`, {
        allowed: Boolean(allow),
      });
      return Response.json({ ok: true });
    }
    return Response.json({ error: '알 수 없는 요청입니다.' }, { status: 400 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
