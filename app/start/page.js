'use client';

import { useEffect, useState } from 'react';
import { loadAll, patch, markDone } from '@/lib/store';
import { CONTACT_LINE } from '@/lib/course';
import { useMe } from '@/lib/auth';

const QUESTIONS = [
  {
    key: 'career',
    label: '전체 경력을 적어 주세요',
    hint: '어린이집·유치원 근무, 원장 경력, 그 밖의 일까지. 연도와 함께 적으면 좋습니다.',
    ph: '예) 2011~2016 ○○어린이집 보육교사 / 2017~2024 ○○어린이집 원장 (정원 49명) / 보육교사 1급, 원장 자격',
  },
  {
    key: 'reason',
    label: '국공립 원장이 되고자 하는 이유는 무엇인가요?',
    hint: '솔직하게 쓰셔도 됩니다. 이 내용이 자기소개서의 뼈대가 됩니다.',
    ph: '예) 민간에서 하기 어려웠던 ○○을 국공립에서는 제대로 해보고 싶습니다...',
  },
  {
    key: 'worry',
    label: '이번 지원에서 가장 걱정되는 부분은 무엇인가요?',
    hint: '걱정되는 것을 알아야 그 부분을 집중해서 도와드릴 수 있습니다.',
    ph: '예) 예산서를 한 번도 직접 짜본 적이 없어서 걱정입니다',
  },
  {
    key: 'help',
    label: '가장 도움받고 싶은 부분은 무엇인가요?',
    hint: '',
    ph: '예) 면접에서 무슨 말을 해야 할지 모르겠습니다',
  },
];

export default function Start() {
  const { me, ready: authed } = useMe();
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState(0); // 0 인적사항 · 1 질문 · 2 결과

  const [profile, setProfile] = useState({ name: '', phone: '', region: '', targetRegion: '' });
  const [answers, setAnswers] = useState({ career: '', reason: '', worry: '', help: '' });
  const [coaching, setCoaching] = useState(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authed || !me) return;
    const d = loadAll();
    // 로그인할 때 넣은 이름·전화번호를 미리 채워 둔다
    setProfile((p) => ({ ...p, name: me.name || '', phone: me.phone || '' }));
    if (d.profile) setProfile((p) => ({ ...p, ...d.profile }));
    if (d.answers) setAnswers((a) => ({ ...a, ...d.answers }));
    if (d.coaching) {
      setCoaching(d.coaching);
      setPhase(2);
    }
    setReady(true);
  }, [authed, me]);

  useEffect(() => {
    if (!ready) return;
    patch({ profile, answers });
  }, [ready, profile, answers]);

  const setP = (k, v) => setProfile({ ...profile, [k]: v });
  const setA = (k, v) => setAnswers({ ...answers, [k]: v });

  const profileOk = profile.name.trim() && profile.phone.trim() && profile.targetRegion.trim();
  const answersOk = QUESTIONS.every((q) => (answers[q.key] || '').trim().length >= 10);

  async function analyze() {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, answers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '분석하지 못했습니다');
      setCoaching(data);
      patch({ coaching: data });
      markDone('start');
      setPhase(2);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!authed || !me || !ready) return null;

  return (
    <>
      <div className="head">
        <h1>국공립 신규위탁 교육과정</h1>
        <p>먼저 몇 가지만 여쭙고, 원장님께 맞는 공부 계획을 짜 드립니다</p>
        {phase === 2 && <a href="/">← 차시 목록으로</a>}
      </div>

      <div className="wrap">
        <div className="steps">
          <div className={phase === 0 ? 'on' : 'done'}>1. 인적사항</div>
          <div className={phase === 1 ? 'on' : phase > 1 ? 'done' : ''}>2. 지원동기 · 강점 질문</div>
          <div className={phase === 2 ? 'on' : ''}>3. 나만의 계획</div>
        </div>

        {error && <div className="err">{error}</div>}

        {/* 참여 인사말 */}
        {phase < 2 && (
          <div className="card welcome">
            <h2>국공립 신규위탁 한 달 과정에 참여해 주셔서 감사합니다</h2>
            <p>
              사전 인터뷰를 통해 어떤 강점과 약점이 있는지 파악하고 계획하려 합니다.
              <br />
              하단의 내용은 <b>나만의 계획표</b>를 만들기 위함이니 상세히 작성해 주세요!
            </p>
          </div>
        )}

        {/* ── 1. 인적사항 ── */}
        {phase === 0 && (
          <div className="card">
            <h2>인적사항</h2>
            <p className="sub">과정 안내와 연락에 쓰입니다.</p>

            <div className="grid2">
              <div>
                <label>이름</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setP('name', e.target.value)}
                  placeholder="예) 라지숙"
                />
              </div>
              <div>
                <label>전화번호</label>
                <input
                  type="text"
                  value={profile.phone}
                  onChange={(e) => setP('phone', e.target.value)}
                  placeholder="예) 01012345678"
                />
              </div>
              <div>
                <label>지금 계신 지역</label>
                <input
                  type="text"
                  value={profile.region}
                  onChange={(e) => setP('region', e.target.value)}
                  placeholder="예) 세종시"
                />
              </div>
              <div>
                <label>지원하고 싶은 지역</label>
                <input
                  type="text"
                  value={profile.targetRegion}
                  onChange={(e) => setP('targetRegion', e.target.value)}
                  placeholder="예) 충주"
                />
              </div>
            </div>

            <div className="info">
              여기에 쓰신 내용은 <b>원장님 컴퓨터에만</b> 저장됩니다. 다른 사람은 볼 수 없습니다.
            </div>

            <div className="foot-nav">
              <span />
              <button className="btn" onClick={() => setPhase(1)} disabled={!profileOk}>
                다음
              </button>
            </div>
          </div>
        )}

        {/* ── 2. 네 가지 질문 ── */}
        {phase === 1 && (
          <div className="card">
            <h2>네 가지만 여쭙겠습니다</h2>
            <p className="sub">
              길게 쓰지 않으셔도 됩니다. 생각나는 대로 편하게 쓰시면 제가 정리해 드립니다.
            </p>

            {QUESTIONS.map((q) => (
              <div key={q.key}>
                <label>{q.label}</label>
                {q.hint && (
                  <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--muted)' }}>{q.hint}</p>
                )}
                <textarea
                  value={answers[q.key]}
                  onChange={(e) => setA(q.key, e.target.value)}
                  placeholder={q.ph}
                />
              </div>
            ))}

            {busy && (
              <div className="info">
                <span className="spin" style={{ borderColor: '#1a3a5c', borderTopColor: 'transparent' }} />
                원장님 답변을 읽고 있습니다... (20초쯤 걸립니다)
              </div>
            )}

            <div className="foot-nav">
              <button className="btn btn-ghost" onClick={() => setPhase(0)} disabled={busy}>
                이전
              </button>
              <button className="btn btn-gold" onClick={analyze} disabled={busy || !answersOk}>
                내게 맞는 공부 계획 받기
              </button>
            </div>
            {!answersOk && (
              <p style={{ textAlign: 'right', fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
                네 칸을 모두 채우시면 버튼이 켜집니다.
              </p>
            )}
          </div>
        )}

        {/* ── 3. 결과 ── */}
        {phase === 2 && coaching && (
          <>
            <div className="card">
              <h2>{profile.name || '원장'}님, 이렇게 보입니다</h2>
              {coaching.summary && <p className="sub">{coaching.summary}</p>}

              <h3 className="mini">잘 갖추고 계신 점</h3>
              <ul className="pts ok">
                {coaching.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>

              <h3 className="mini">조금 더 채우면 좋을 점</h3>
              <ul className="pts warn-list">
                {coaching.weaknesses.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>

            <div className="card">
              <h2>이 과정에서 이 부분을 확실하게 공부하시면 좋겠어요</h2>
              <ul className="pts focus">
                {coaching.focus.map((s, i) => (
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

            <div className="card contact">
              <p>{CONTACT_LINE}</p>
            </div>

            <div className="foot-nav noprint">
              <button className="btn btn-ghost" onClick={() => setPhase(1)}>
                답변 고치기
              </button>
              <a className="btn btn-gold" href="/guide">
                첫 인터뷰를 작성하였습니다 · 다음으로 이동 →
              </a>
            </div>
            <div className="row right noprint" style={{ marginTop: 10 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>
                인쇄 / PDF로 저장
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
