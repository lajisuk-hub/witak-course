'use client';

import { useEffect, useMemo, useState } from 'react';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function ymd(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 한 달 달력 + 그날 할 일 체크.
 * 홈 화면과 달력 화면에서 같이 쓴다.
 */
export default function CalendarBoard({ phone, compact = false }) {
  const [month, setMonth] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [checked, setChecked] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState('');

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
        setPicked(today);
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    })();
  }, [phone, today]);

  const byDate = useMemo(() => {
    const m = {};
    tasks.forEach((t) => {
      (m[t.due_date] = m[t.due_date] || []).push(t);
    });
    return m;
  }, [tasks]);

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

  const total = tasks.length;
  const doneCount = checked.length;
  const pickedTasks = byDate[picked] || [];

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
            <div className={`cal${compact ? ' small' : ''}`}>
              {DAYS.map((d, i) => (
                <div className={`cal-dow${i === 0 ? ' sun' : ''}`} key={d}>
                  {d}
                </div>
              ))}
              {cells.map((d, i) => {
                if (!d) return <div className="cal-cell empty" key={i} />;
                const key = ymd(d);
                const list = byDate[key] || [];
                const allDone = list.length > 0 && list.every((t) => checked.includes(t.id));
                const someDone = list.some((t) => checked.includes(t.id));
                return (
                  <button
                    key={i}
                    className={[
                      'cal-cell',
                      key === today ? 'today' : '',
                      key === picked ? 'picked' : '',
                      list.length ? 'has' : '',
                      allDone ? 'done' : someDone ? 'part' : '',
                    ].join(' ')}
                    onClick={() => setPicked(key)}
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
          </>
        )}
      </div>

      {!busy && (
        <div className="card">
          <h2>
            {picked === today ? '오늘 할 일' : picked ? picked.replace(/-/g, '. ') : '날짜를 골라 주세요'}
          </h2>
          {pickedTasks.length === 0 ? (
            <p className="sub" style={{ margin: 0 }}>
              {total === 0
                ? '아직 원장님이 올린 할 일이 없습니다. 올라오면 이 달력에 표시됩니다.'
                : '이 날은 정해진 할 일이 없습니다. 쉬셔도 되고, 밀린 것을 하셔도 됩니다.'}
            </p>
          ) : (
            pickedTasks.map((t) => {
              const on = checked.includes(t.id);
              return (
                <button key={t.id} className={`todo ${on ? 'on' : ''}`} onClick={() => toggle(t.id)}>
                  <span className="box">{on ? '✓' : ''}</span>
                  <span className="txt">
                    <b>{t.title}</b>
                    {t.detail && <span className="d">{t.detail}</span>}
                    {t.step != null && <span className="s">{t.step}차시</span>}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </>
  );
}
