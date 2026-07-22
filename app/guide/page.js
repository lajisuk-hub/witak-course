'use client';

import { useEffect, useState } from 'react';
import { loadAll, markDone } from '@/lib/store';
import { CONTACT_LINE } from '@/lib/course';
import { useMe } from '@/lib/auth';

// 시작 인터뷰를 마친 뒤, 안내를 한 번 더 보여 드리고
// "확인하였습니다"를 누르면 1차시로 넘어간다.
export default function Guide() {
  const { me, ready: authed } = useMe();
  const [coaching, setCoaching] = useState(null);
  const [name, setName] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!authed || !me) return;
    const d = loadAll();
    if (!d.coaching) {
      window.location.replace('/start');
      return;
    }
    setCoaching(d.coaching);
    setName(d.profile?.name || me.name || '');
    setReady(true);
  }, [authed, me]);

  function confirm() {
    markDone('guide');
    window.location.href = '/step1';
  }

  if (!authed || !me || !ready || !coaching) return null;

  return (
    <>
      <div className="head">
        <h1>이렇게 진행하시면 됩니다</h1>
        <p>시작하기 전에 한 번만 더 읽어 주세요</p>
      </div>

      <div className="wrap">
        <div className="card">
          <h2>{name} 원장님께 드리는 안내</h2>
          <p className="sub">
            방금 쓰신 내용을 바탕으로, 이 과정에서 특히 힘을 쏟으시면 좋을 부분을 정리했습니다.
          </p>

          <h3 className="mini">이 부분을 확실하게 공부하시면 좋겠어요</h3>
          <ul className="pts focus">
            {coaching.focus?.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>

        {coaching.plan?.length > 0 && (
          <div className="card">
            <h2>한 달 동안 이런 일정으로 공부하세요</h2>
            {coaching.plan.map((p, i) => (
              <div className="item" key={i}>
                <div>
                  <span className="week">{p.week || `${i + 1}주차`}</span>
                  <span className="name">{p.title}</span>
                </div>
                {p.todo && <div className="meta">▸ {p.todo}</div>}
              </div>
            ))}
          </div>
        )}

        <div className="card">
          <h2>진행 방법</h2>
          <ul className="pts">
            <li>차시를 순서대로 따라가시면 위탁 제출서류가 완성됩니다.</li>
            <li>만든 자료는 차시마다 한글 파일로 내려받아 원장님 컴퓨터에 보관하세요.</li>
            <li>날짜별 할 일은 달력에 올라옵니다. 다 하시면 체크해 주세요.</li>
            <li>다음 접속부터는 이 인터뷰 없이 바로 일정 화면이 나옵니다.</li>
          </ul>
        </div>

        <div className="card contact">
          <p>{CONTACT_LINE}</p>
        </div>

        <div className="foot-nav">
          <a className="btn btn-ghost" href="/start">
            내가 쓴 내용 다시 보기
          </a>
          <button className="btn btn-gold" onClick={confirm}>
            확인하였습니다 · 자기소개서 시작하기 →
          </button>
        </div>
      </div>
    </>
  );
}
