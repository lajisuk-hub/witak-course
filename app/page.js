'use client';

import { useEffect, useState } from 'react';
import { COURSE } from '@/lib/course';
import { loadAll } from '@/lib/store';
import { useMe, logout } from '@/lib/auth';
import CalendarBoard from '@/app/CalendarBoard';
import ContactBar from '@/app/ContactBar';
import SampleCard from '@/app/SampleCard';

export default function Home() {
  const { me, ready } = useMe();
  const [done, setDone] = useState({});
  const [coaching, setCoaching] = useState(null);
  const [checkedStart, setCheckedStart] = useState(false);

  // 첫 인터뷰는 언제나 맨 처음에. 마치기 전에는 다른 화면을 보여 드리지 않는다.
  useEffect(() => {
    const d = loadAll();
    const dn = d.done || {};
    if (!dn.start) {
      window.location.replace('/start');
      return;
    }
    if (!dn.guide) {
      window.location.replace('/guide');
      return;
    }
    setDone(dn);
    setCoaching(d.coaching || null);
    setCheckedStart(true);
  }, []);

  if (!ready || !me || !checkedStart) return null;

  return (
    <>
      <div className="head">
        <h1>국공립 신규위탁 과정</h1>
        <p>차시를 순서대로 따라가시면 위탁 제출서류가 완성됩니다</p>
        <a
          onClick={() => {
            logout();
            window.location.reload();
          }}
          style={{ cursor: 'pointer' }}
        >
          {me.name} 원장님 · 나가기
        </a>
      </div>

      <div className="wrap">
        {/* ① 내가 노력해야 할 부분 — 언제나 맨 위 */}
        {coaching && (
          <div className="card mine-card">
            <h2>{me.name} 원장님이 이번 과정에서 노력하실 부분</h2>
            <p className="sub">첫 인터뷰에서 쓰신 내용을 바탕으로 정리한 것입니다.</p>

            {coaching.focus?.length > 0 && (
              <ul className="pts focus">
                {coaching.focus.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}

            {coaching.weaknesses?.length > 0 && (
              <>
                <h3 className="mini">조금 더 채우면 좋을 점</h3>
                <ul className="pts warn-list">
                  {coaching.weaknesses.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </>
            )}

            {coaching.strengths?.length > 0 && (
              <>
                <h3 className="mini">이미 잘 갖추고 계신 점</h3>
                <ul className="pts ok">
                  {coaching.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </>
            )}

            <div className="row" style={{ marginTop: 12 }}>
              <a className="btn btn-ghost btn-sm" href="/guide">
                한 달 공부 계획 보기
              </a>
              <a className="btn btn-ghost btn-sm" href="/start">
                첫 인터뷰 다시 보기
              </a>
            </div>
          </div>
        )}

        {/* ② 차시 목록 */}
        <h2 className="section">차시 목록</h2>
        <div className="card">
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

        {/* ③ 문서 샘플 안내 */}
        <h2 className="section">우리 문서는 이렇게 쌓입니다</h2>
        <SampleCard phone={me.phone} />

        {/* ④ 달력 일정 */}
        <h2 className="section">한 달 일정 달력</h2>
        <div className="card welcome">
          <h2>달력 쓰는 법</h2>
          <p>
            라지숙 소장이 <b>날짜별로 할 일</b>을 올려 드립니다.
            <br />① 날짜를 눌러 그날 할 일을 봅니다 · ② 다 하셨으면 <b>할 일을 눌러 체크</b>합니다 ·
            ③ 체크한 날은 달력에 <b>✓</b> 가 붙습니다.
            <br />
            숫자가 붙은 날은 그날 할 일이 몇 개인지 뜻합니다.
          </p>
        </div>
        <CalendarBoard phone={me.phone} />

        <ContactBar />

        <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13 }}>
          <a href="/admin" style={{ color: 'var(--muted)' }}>
            관리자 화면
          </a>
        </p>
      </div>
    </>
  );
}
