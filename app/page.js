'use client';

import { useEffect, useState } from 'react';
import { COURSE } from '@/lib/course';
import { loadAll } from '@/lib/store';
import { useMe, logout } from '@/lib/auth';

export default function Home() {
  const { me, ready } = useMe();
  const [done, setDone] = useState({});
  const [plan, setPlan] = useState(null); // { total, doneCount, todayTasks }

  useEffect(() => {
    setDone(loadAll().done || {});
  }, []);

  useEffect(() => {
    if (!ready || !me) return;
    (async () => {
      try {
        const res = await fetch(`/api/plan?phone=${encodeURIComponent(me.phone)}`);
        const d = await res.json();
        if (!res.ok) return;
        const p = (n) => String(n).padStart(2, '0');
        const now = new Date();
        const today = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
        setPlan({
          total: d.tasks.length,
          doneCount: d.checked.length,
          todayTasks: d.tasks.filter((t) => t.due_date === today),
          todayDone: d.tasks.filter((t) => t.due_date === today && d.checked.includes(t.id)).length,
        });
      } catch {
        /* 달력은 못 불러와도 나머지는 쓸 수 있게 둔다 */
      }
    })();
  }, [ready, me]);

  if (!ready || !me) return null;

  const started = !!done.start;

  return (
    <>
      <div className="head">
        <h1>국공립 신규위탁 과정</h1>
        <p>차시를 순서대로 따라가시면 위탁 제출서류가 완성됩니다</p>
        <a onClick={() => { logout(); window.location.reload(); }} style={{ cursor: 'pointer' }}>
          {me.name} 원장님 · 나가기
        </a>
      </div>

      <div className="wrap">
        {/* 오늘 할 일 */}
        <a className="card plan-card" href="/plan">
          <h2>
            오늘 할 일
            {plan && plan.todayTasks.length > 0 && (
              <span className="badge mine">
                {plan.todayDone}/{plan.todayTasks.length}
              </span>
            )}
          </h2>
          {!plan ? (
            <p className="sub" style={{ margin: 0 }}>달력을 불러오는 중입니다...</p>
          ) : plan.todayTasks.length === 0 ? (
            <p className="sub" style={{ margin: 0 }}>
              오늘 정해진 할 일은 없습니다. 달력에서 이번 달 계획을 보실 수 있습니다. →
            </p>
          ) : (
            <>
              <ul className="today">
                {plan.todayTasks.slice(0, 3).map((t) => (
                  <li key={t.id}>· {t.title}</li>
                ))}
              </ul>
              <p className="sub" style={{ margin: 0 }}>눌러서 달력으로 가기 →</p>
            </>
          )}
        </a>

        {/* 시작 인터뷰 */}
        {!started ? (
          <div className="card start-card">
            <h2>먼저 여기부터 시작해 주세요</h2>
            <p className="sub">
              간단한 인터뷰로 원장님의 강점과 보완할 점을 살펴보고,
              <b> 한 달 공부 계획</b>을 짜 드립니다. 5분이면 됩니다.
            </p>
            <a className="btn btn-gold" href="/start">
              시작 인터뷰 하기
            </a>
          </div>
        ) : (
          <div className="card start-card">
            <h2>{me.name} 원장님, 반갑습니다</h2>
            <p className="sub">시작 인터뷰를 마치셨습니다. 아래 차시를 순서대로 진행하세요.</p>
            <a className="btn btn-ghost btn-sm" href="/start">
              내 공부 계획 다시 보기
            </a>
          </div>
        )}

        <div className="card">
          <h2>차시 목록</h2>
          <p className="sub">
            만든 자료는 차시마다 <b>한글 파일로 내려받아</b> 원장님 컴퓨터에 보관하세요.
          </p>

          {COURSE.map((c) => {
            const finished = !!done[String(c.no)];
            const soon = !c.href;
            const inner = (
              <>
                <div>
                  <span className="no">{c.no}</span>
                  <span className="name">{c.title}</span>
                  {finished && <span className="badge ok">완료</span>}
                  {soon && <span className="badge off">준비 중</span>}
                </div>
                <div className="meta">{c.desc}</div>
              </>
            );
            return soon ? (
              <div className="item dim" key={c.no}>
                {inner}
              </div>
            ) : (
              <a className="item link" key={c.no} href={c.href}>
                {inner}
              </a>
            );
          })}
        </div>

        <p style={{ textAlign: 'center', marginTop: 26, fontSize: 13 }}>
          <a href="/admin" style={{ color: 'var(--muted)' }}>
            관리자 화면
          </a>
        </p>
      </div>
    </>
  );
}
