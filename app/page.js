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
  const [tocReady, setTocReady] = useState(false); // 0차시 목차를 정리했는지
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
    setTocReady(Array.isArray(d.items) && d.items.length > 0);
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

        {/* ② 차시 (작게 나열) */}
        <div className="card chips-card">
          {tocReady ? (
            <p className="sub" style={{ margin: '0 0 12px' }}>
              아래 순서대로 문서를 만드시면 됩니다. 끝낸 곳은 <b>✓</b> 로 표시됩니다.
            </p>
          ) : (
            <div className="warn" style={{ margin: '0 0 14px' }}>
              <b>아래 순서대로 문서를 제작하면 됩니다.</b>
              <br />
              가장 먼저 <b>0. 우리 지자체 목차 만들기</b>를 눌러 이동해서 목차를 정리하세요.
              <br />
              목차를 정리해야 다음 차시로 넘어갈 수 있습니다.
            </div>
          )}

          <div className="chips">
            {COURSE.map((c) => {
              const finished = !!done[String(c.no)];
              const soon = !c.href;
              const locked = !tocReady && c.no !== 0; // 목차 먼저
              const label = (
                <>
                  <b>{locked ? '🔒' : finished ? '✓' : c.no}</b>
                  <span>{c.title}</span>
                </>
              );
              if (locked) {
                return (
                  <span className="chip off" key={c.no} title="먼저 0차시 목차를 정리해 주세요">
                    {label}
                  </span>
                );
              }
              return soon ? (
                <span className="chip off" key={c.no} title={c.desc}>
                  {label}
                </span>
              ) : (
                <a
                  className={`chip${finished ? ' done' : ''}${c.no === 0 && !tocReady ? ' first' : ''}`}
                  key={c.no}
                  href={c.href}
                  title={c.desc}
                >
                  {label}
                </a>
              );
            })}
          </div>
        </div>

        {/* ③ 문서 샘플 안내 */}
        <h2 className="section">우리 문서는 이렇게 쌓입니다</h2>
        <SampleCard phone={me.phone} />

        {/* ④ 달력 일정 */}
        <h2 className="section">한 달 일정 달력</h2>
        <div className="card welcome">
          <h2>달력 쓰는 법</h2>
          <p>
            <b>숫자가 붙은 날을 누르면</b> 그날 할 일과 <b>만드실 서류 안내</b>가 뜹니다. 다
            하셨으면 눌러서 체크하시면 됩니다. 체크한 날은 <b>✓</b> 로 바뀝니다.
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
