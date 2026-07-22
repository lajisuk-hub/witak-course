'use client';

import { useEffect, useMemo, useState } from 'react';
import { COURSE } from '@/lib/course';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

// step 이 이 값이면 체크하는 할 일이 아니라 원장님이 남긴 메모·전달사항이다.
export const MEMO = -1;

export function ymd(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function CalendarBoard({ phone }) {
  const [month, setMonth] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [checked, setChecked] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [popup, setPopup] = useState(''); // 눌러서 연 날짜

  const today = useMemo(() => ymd(new Date()), []);

  useEffect(() => {
    const now = new Date();
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  }, []);

  useEffect(() => {
    if (!phone) return;
    (async () => {
      try {
        const res = await fetch(`/api/plan?phone=${encodeURIComponent(phone)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '불러오지 못했습니다');
        setTasks(data.tasks || []);
        setChecked(data.checked || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    })();
  }, [phone]);

  const byDate = useMemo(() => {
    const m = {};
    tasks.forEach((t) => {
      (m[t.due_date] = m[t.due_date] || []).push(t);
    });
    return m;
  }, [tasks]);

  // 체크하는 할 일만 (메모는 뺀다)
  const todos = useMemo(() => tasks.filter((t) => t.step !== MEMO), [tasks]);

  async function toggle(taskId) {
    const on = !checked.includes(taskId);
    setChecked((c) => (on ? [...c, taskId] : c.filter((x) => x !== taskId)));
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, taskId, on }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setChecked((c) => (on ? c.filter((x) => x !== taskId) : [...c, taskId]));
      setError('저장하지 못했습니다. 인터넷 연결을 확인해 주세요.');
    }
  }

  if (!month) return null;

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  }

  const total = todos.length;
  const doneCount = checked.length;
  const popupList = byDate[popup] || [];

  return (
    <>
      {error && <div className="err">{error}</div>}

      <div className="card">
        <div className="cal-head">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            ← 지난달
          </button>
          <b>
            {month.getFullYear()}년 {month.getMonth() + 1}월
          </b>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            다음달 →
          </button>
        </div>

        {busy ? (
          <div className="info">
            <span className="spin" style={{ borderColor: '#1a3a5c', borderTopColor: 'transparent' }} />
            일정을 불러오는 중입니다...
          </div>
        ) : (
          <>
            <div className="cal">
              {DAYS.map((d, i) => (
                <div className={`cal-dow${i === 0 ? ' sun' : ''}`} key={d}>
                  {d}
                </div>
              ))}
              {cells.map((d, i) => {
                if (!d) return <div className="cal-cell empty" key={i} />;
                const key = ymd(d);
                const list = byDate[key] || [];
                const todoList = list.filter((t) => t.step !== MEMO);
                const allDone = todoList.length > 0 && todoList.every((t) => checked.includes(t.id));
                const someDone = todoList.some((t) => checked.includes(t.id));
                return (
                  <button
                    key={i}
                    className={[
                      'cal-cell',
                      key === today ? 'today' : '',
                      list.length ? 'has' : '',
                      allDone ? 'done' : someDone ? 'part' : '',
                    ].join(' ')}
                    onClick={() => list.length && setPopup(key)}
                  >
                    <span className={`num${d.getDay() === 0 ? ' sun' : ''}`}>{d.getDate()}</span>
                    {list.length > 0 && (
                      <span className="dot">{allDone ? '✓' : `${list.length}`}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {total > 0 && (
              <div className="meter" style={{ marginBottom: 0 }}>
                <span>전체 진도</span>
                <b>
                  {doneCount} / {total}
                </b>
                <div className="bar">
                  <i style={{ width: `${Math.round((doneCount / total) * 100)}%` }} />
                </div>
              </div>
            )}

            {total === 0 && (
              <p className="sub" style={{ margin: '10px 0 0' }}>
                아직 올라온 일정이 없습니다. 올라오면 이 달력에 표시됩니다.
              </p>
            )}
          </>
        )}
      </div>

      {/* ── 날짜를 누르면 뜨는 창 ── */}
      {popup && (
        <div className="pop-bg" onClick={() => setPopup('')}>
          <div className="pop" onClick={(e) => e.stopPropagation()}>
            <div className="pop-head">
              <b>{popup.replace(/-/g, '. ')}</b>
              <button className="pop-x" onClick={() => setPopup('')}>
                ✕
              </button>
            </div>

            <div className="pop-body">
              {popupList.map((t) => {
                if (t.step === MEMO) {
                  return (
                    <div className="memo" key={t.id}>
                      <span className="tag">전달사항</span>
                      <b>{t.title}</b>
                      {t.detail && <p>{t.detail}</p>}
                    </div>
                  );
                }
                const on = checked.includes(t.id);
                const course = COURSE.find((c) => c.no === t.step);
                return (
                  <div key={t.id}>
                    <button className={`todo ${on ? 'on' : ''}`} onClick={() => toggle(t.id)}>
                      <span className="box">{on ? '✓' : ''}</span>
                      <span className="txt">
                        <b>{t.title}</b>
                        {t.detail && <span className="d">{t.detail}</span>}
                      </span>
                    </button>

                    {course && (
                      <div className="linked">
                        <div className="meta">
                          ▸ 이 날 만드실 서류: <b>{course.title}</b>
                          <br />
                          {course.desc}
                        </div>
                        {course.href ? (
                          <a className="btn btn-gold btn-sm" href={course.href}>
                            {course.no}차시 하러 가기 →
                          </a>
                        ) : (
                          <span className="badge off">준비 중</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pop-foot">
              <button className="btn btn-ghost" onClick={() => setPopup('')}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
