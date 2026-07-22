'use client';

import { useEffect, useState } from 'react';
import { loadAll, markDone } from '@/lib/store';
import ContactBar from '@/app/ContactBar';
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
          <ol className="steps-list">
            <li>
              <b>일정에 따라 달력을 보고</b> 문서를 완성해 갑니다.
            </li>
            <li>
              <b>줌 수업은 4번</b> 진행되고, <b>녹화본</b>도 제공됩니다.
            </li>
            <li>
              <b>샘플 문서를 토대로</b> 내가 작성할 때마다 문서가 완성됩니다.
            </li>
            <li>
              이제 가장 먼저! 내가 위탁받고자 하는 <b>공고문의 목차부터 준비</b>해 주세요.
              <br />
              목차를 올리시면 <b>나만의 위탁 준비</b>가 시작됩니다.
            </li>
          </ol>
        </div>

        <div className="card notice">
          <h2>꼭 지켜 주세요</h2>
          <p>
            이 프로그램은 <b>해당 교육비를 납부한 신청자에게만</b> 제공되며, 로그인이 실시간으로
            관리자 화면에서 관리됩니다.
            <br />
            <b>교육 신청자가 아니거나 외부로 유출할 경우 1,000만원의 벌금이 부과될 수 있으니</b>{' '}
            유의해 주세요.
          </p>
        </div>

        <ContactBar />

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
