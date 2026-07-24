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
  const excelRef = useRef(null);

  useEffect(() => {
    if (!authed || !me) return;
    const d = loadAll();
    setTocReady(Array.isArray(d.items) && d.items.length > 0);
    setReady(true);
  }, [authed, me]);

  async function onExcel(e) {
    const f = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!f) return;
    if (!/\.xlsx?$/i.test(f.name)) {
      setError('엑셀 파일(.xlsx)만 올릴 수 있습니다.');
      return;
    }

    setError('');
    setResult(null);
    setBusy('엑셀을 읽는 중입니다...');
    try {
      const d = loadAll();
      const r = await buildBudgetDoc({
        file: f,
        phone: me.phone,
        city: d.city,
        student: d.applicant || me.name,
        onProgress: setBusy,
      });
      downloadBlob(r.blob, r.name);
      markDone(2);
      setResult(r);
    } catch (err) {
      setError(err.message);
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
            ① 아래 화면에서 <b>정원 · 반 구성 · 교직원</b>부터 차례대로 답해 주세요. 4대보험과
            인건비 지원율 같은 어려운 계산은 자동으로 처리됩니다.
            <br />② 다 마치시면 그 화면의 <b>엑셀 다운로드</b>를 누르세요.
            <br />③ 받은 엑셀을 <b>맨 아래 칸에 올리시면</b> 한글 예산서가 만들어집니다.
          </p>
          <div className="warn" style={{ marginTop: 12 }}>
            <b>이 화면은 중간에 나가시면 입력한 내용이 사라집니다.</b> 한 번에 끝까지 답해 주시고,{' '}
            <b>받으신 엑셀 파일은 컴퓨터에 꼭 보관</b>해 두세요. 나중에 고치실 때 그 엑셀만 다시
            올리시면 한글 예산서를 새로 받으실 수 있습니다.
          </div>
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
          <h2>엑셀을 올리면 한글 예산서로 만들어 드립니다</h2>
          <p>
            위 예산서를 다 채우신 뒤 <b>엑셀 다운로드</b>를 누르세요. 그 파일을 아래에 올리시면,
            라지숙 소장 서식의 <b>세입·세출 표에 금액과 산출기초가 채워진 채로</b> 나옵니다.
            <br />
            신규위탁이라 <b>전년도 예산액·증감은 비워</b> 둡니다.
          </p>

          <div className="drop" style={{ marginTop: 14 }}>
            <p style={{ margin: '0 0 12px' }}>
              예산서 앱에서 받은 <strong>엑셀(.xlsx)</strong> 파일
            </p>
            <button className="btn btn-gold" onClick={() => excelRef.current?.click()} disabled={!!busy}>
              엑셀 파일 고르기
            </button>
            <input
              ref={excelRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={onExcel}
              style={{ display: 'none' }}
            />
          </div>

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
                </>
              )}
              {result.missing?.length > 0 && (
                <>
                  <br />
                  <span style={{ color: 'var(--warn)' }}>
                    서식에 자리가 없어 못 넣은 항목: {result.missing.join(', ')} — 한글에서 직접
                    넣어 주세요.
                  </span>
                </>
              )}
            </div>
          )}

          <div className="row" style={{ marginTop: 12 }}>
            <a className="btn btn-ghost" href="/">
              메인으로 →
            </a>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '10px 0 0' }}>
            ※ 파일 이름은 <b>지역_이름_예산서.hwpx</b> 입니다. 예산을 고치신 뒤 엑셀을 다시 받아
            올리시면 몇 번이든 새로 만드실 수 있습니다.
          </p>
        </div>

        <ContactBar />
      </div>
    </>
  );
}
