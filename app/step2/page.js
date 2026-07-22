'use client';

import { useEffect, useRef, useState } from 'react';
import { loadAll, markDone } from '@/lib/store';
import { useMe } from '@/lib/auth';
import ContactBar from '@/app/ContactBar';
import { buildBudgetDoc } from '@/lib/budgetDoc';
import { downloadBlob } from '@/lib/formDoc';

export default function Step2() {
  const { me, ready: authed } = useMe();
  const [ready, setReady] = useState(false);
  const [tocReady, setTocReady] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!authed || !me) return;
    const d = loadAll();
    setTocReady(Array.isArray(d.items) && d.items.length > 0);
    setReady(true);
  }, [authed, me]);

  async function makeDoc() {
    setError('');
    setResult(null);
    try {
      const w = frameRef.current?.contentWindow;
      if (!w || typeof w.__witakBudget !== 'function') {
        throw new Error('예산서 화면이 아직 준비되지 않았습니다. 잠시 뒤 다시 눌러 주세요.');
      }
      const { state, calc } = w.__witakBudget();
      if (!state?.data?.capacity) {
        throw new Error('먼저 위 예산서에서 정원부터 채워 주세요.');
      }

      setBusy('예산서를 만드는 중입니다...');
      const d = loadAll();
      const r = await buildBudgetDoc({
        state,
        calc,
        phone: me.phone,
        city: d.city,
        student: d.applicant || me.name,
        onProgress: setBusy,
      });
      downloadBlob(r.blob, r.name);
      markDone(2);
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  if (!authed || !me || !ready) return null;

  if (!tocReady) {
    return (
      <>
        <div className="head">
          <h1>2차시 · 40인 기준 회계서류</h1>
          <p>먼저 하실 일이 있습니다</p>
          <a href="/">← 차시 목록으로</a>
        </div>
        <div className="wrap" style={{ maxWidth: 560 }}>
          <div className="card welcome">
            <h2>먼저 우리 지자체 목차를 정리해 주세요</h2>
            <p>
              예산서도 <b>통합 위탁 서류의 한 부분</b>입니다. 0차시에서 공고문의 목차를 올리고
              반영하신 뒤 다시 오세요.
            </p>
            <div className="row" style={{ marginTop: 14 }}>
              <a className="btn btn-gold" href="/toc">
                0차시 목차 만들기 하러 가기 →
              </a>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="head noprint">
        <h1>2차시 · 세입·세출 예산서</h1>
        <p>질문에 답하시면 예산이 자동으로 계산됩니다</p>
        <a href="/">← 차시 목록으로</a>
      </div>

      <div className="wrap" style={{ maxWidth: 1100 }}>
        {error && <div className="err">{error}</div>}

        <div className="card welcome">
          <h2>이렇게 하시면 됩니다</h2>
          <p>
            아래 화면에서 <b>정원 · 반 구성 · 교직원</b>부터 차례대로 답해 주세요. 4대보험과 인건비
            지원율 같은 어려운 계산은 자동으로 처리됩니다.
            <br />
            끝까지 마치신 뒤 맨 아래 <b>한글 예산서로 저장</b>을 누르시면, 라지숙 소장 서식의
            세입·세출 표에 <b>금액과 산출기초가 채워진 채로</b> 나옵니다.
          </p>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <iframe
            ref={frameRef}
            src="/budget/index.html"
            title="예산서 만들기"
            style={{ width: '100%', height: '78vh', border: 'none', display: 'block' }}
          />
        </div>

        <div className="card done-card noprint">
          <h2>한글 예산서로 저장</h2>
          <p>
            위에서 채운 내용이 <b>관·항·목 자리에 맞춰</b> 들어갑니다. 신규위탁이라 전년도
            예산액·증감은 비워 둡니다.
          </p>

          {busy && (
            <div className="info">
              <span className="spin" style={{ borderColor: '#1a3a5c', borderTopColor: 'transparent' }} />
              {busy}
            </div>
          )}

          {result && (
            <div className="info">
              <b>{result.name}</b> 을 받았습니다.
              <br />
              세입 {result.filled.income.length}개 · 세출 {result.filled.expense.length}개 항목을
              채웠습니다.
              {result.totals && (
                <>
                  <br />
                  세입 합계 {Math.round(result.totals.income / 1000).toLocaleString('ko-KR')}천원 ·
                  세출 합계 {Math.round(result.totals.expense / 1000).toLocaleString('ko-KR')}천원
                  {result.totals.income !== result.totals.expense && (
                    <>
                      <br />
                      <b style={{ color: 'var(--warn)' }}>
                        ※ 세입과 세출이 맞지 않습니다. 위에서 다시 확인해 주세요.
                      </b>
                    </>
                  )}
                </>
              )}
              {result.missing?.length > 0 && (
                <>
                  <br />
                  <span style={{ color: 'var(--muted)' }}>
                    서식에 자리가 없어 못 넣은 항목: {result.missing.join(', ')}
                  </span>
                </>
              )}
            </div>
          )}

          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn btn-gold" onClick={makeDoc} disabled={!!busy}>
              한글 예산서로 저장
            </button>
            <a className="btn btn-ghost" href="/">
              메인으로 →
            </a>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '10px 0 0' }}>
            ※ 파일 이름은 <b>지역_이름_예산서.hwpx</b> 입니다. 다시 계산해서 몇 번이든 새로 받으실
            수 있습니다.
          </p>
        </div>

        <ContactBar />
      </div>
    </>
  );
}
