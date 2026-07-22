'use client';

import { useEffect, useState } from 'react';
import { COURSE } from '@/lib/course';
import { loadAll } from '@/lib/store';

export default function Home() {
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('');
  const [done, setDone] = useState({});

  useEffect(() => {
    const d = loadAll();
    setName(d.profile?.name || '');
    setDone(d.done || {});
    setReady(true);
  }, []);

  if (!ready) return null;

  const started = !!done.start;

  return (
    <>
      <div className="head">
        <h1>국공립 신규위탁 과정</h1>
        <p>차시를 순서대로 따라가시면 위탁 제출서류가 완성됩니다</p>
      </div>

      <div className="wrap">
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
            <h2>{name ? `${name} 원장님, 반갑습니다` : '반갑습니다'}</h2>
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
