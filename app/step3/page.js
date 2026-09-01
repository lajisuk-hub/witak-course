'use client';

// 3차시 · 연간–월간–하루일지 계획
// 원장님이 올려 주신 샘플 문서를 그대로 내려받는 단계다.
// (연령 고르기 · 연간계획안 새로 만들기는 원장님 지시로 없앴다 — 2026-09-02)

import { useState } from 'react';
import { markDone } from '@/lib/store';
import { useMe } from '@/lib/auth';
import ContactBar from '@/app/ContactBar';
import { downloadBlob } from '@/lib/formDoc';
import { downloadWholeSample } from '@/lib/programPlanDoc';

export default function Step3() {
  const { me, ready: authed } = useMe();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function getSample() {
    setError('');
    setDone(false);
    setBusy('문서를 받는 중입니다...');
    try {
      const blob = await downloadWholeSample(me.phone);
      downloadBlob(blob, '연간월간하루일지_샘플.hwpx');
      markDone(3);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  if (!authed || !me) return null;

  return (
    <>
      <div className="head noprint">
        <h1>3차시 · 연간–월간–하루일지 계획</h1>
        <p>개정 표준보육과정·놀이중심을 반영한 보육사업계획입니다</p>
        <a href="/">← 차시 목록으로</a>
      </div>

      <div className="wrap" style={{ maxWidth: 680 }}>
        {error && <div className="err">{error}</div>}

        <div className="card welcome">
          <h2>샘플 문서를 받아 가세요</h2>
          <p>
            아래 단추를 누르면 <b>연간 → 월간 → 하루일지</b>가 이어지는 한글 샘플 문서를 그대로
            받으실 수 있습니다.
            <br />
            <b>표준보육과정 기본설명</b>(구성방향·5개 영역·구성의 중점·평가·환류체계)과 만 0~5세
            연간놀이계획안이 모두 들어 있습니다.
          </p>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6 }}>
            받으신 문서 안의 <b>하루 일과표</b>와 <b>보육일지</b>는 반마다 사정이 다르므로, 한글에서
            열어 <b>반별로 따로따로 고쳐 쓰셔도 됩니다.</b>
          </p>

          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn btn-gold" onClick={getSample} disabled={!!busy}>
              {busy ? '받는 중...' : '샘플 문서 받기 (한글 .hwpx)'}
            </button>
          </div>

          {busy && (
            <div className="info">
              <span
                className="spin"
                style={{ borderColor: '#1a3a5c', borderTopColor: 'transparent' }}
              />
              {busy}
            </div>
          )}

          {done && (
            <div className="info">
              <b>연간월간하루일지_샘플.hwpx</b> 를 받았습니다.
              <br />
              한글에서 열어 우리 원 반 이름·시간·정원에 맞게 고쳐 쓰시면 됩니다.
            </div>
          )}

          <div className="row" style={{ marginTop: 14 }}>
            <a className="btn btn-ghost" href="/">
              메인으로 →
            </a>
          </div>
        </div>

        <ContactBar />
      </div>
    </>
  );
}
