'use client';

// 3차시 · 연간–월간–하루일지 계획
// (원장님 방침) 우선은 자동 생성 없이, 원장님이 올려 주신 **샘플을 받아 참고**해서
// 직접 작성하는 간단한 단계로 둔다. 샘플은 관리자 문서 샘플의 '연간–월간–하루일지'(program) 슬롯을 쓴다.

import { useEffect, useState } from 'react';
import { markDone } from '@/lib/store';
import { useMe } from '@/lib/auth';
import ContactBar from '@/app/ContactBar';
import { downloadBlob } from '@/lib/formDoc';

export default function Step3() {
  const { me, ready: authed } = useMe();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!authed || !me) return;
    setReady(true);
  }, [authed, me]);

  async function getSample() {
    setError('');
    setBusy('샘플을 불러오는 중입니다...');
    try {
      const t = await fetch(`/api/sample?kind=program&phone=${encodeURIComponent(me.phone)}`);
      const info = await t.json();
      if (!t.ok) {
        throw new Error(
          info.error || '아직 샘플이 올라오지 않았습니다. 라지숙 소장에게 문의해 주세요.'
        );
      }
      const res = await fetch(info.url);
      if (!res.ok) throw new Error('샘플을 받지 못했습니다');
      const blob = await res.blob();
      downloadBlob(blob, '연간월간하루일지_샘플.hwpx');
      markDone(3);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  if (!authed || !me || !ready) return null;

  return (
    <>
      <div className="head noprint">
        <h1>3차시 · 연간–월간–하루일지 계획</h1>
        <p>개정 표준보육과정·놀이중심을 반영한 보육사업계획입니다</p>
        <a href="/">← 차시 목록으로</a>
      </div>

      <div className="wrap" style={{ maxWidth: 640 }}>
        {error && <div className="err">{error}</div>}

        <div className="card welcome">
          <h2>이 차시는 이렇게 진행합니다</h2>
          <p>
            연간–월간–하루일지는 원마다 형식이 조금씩 달라, 우선 <b>라지숙 소장이 준비한 샘플</b>을
            받아 <b>참고해서 직접 작성</b>하시면 됩니다.
            <br />
            아래 <b>[샘플 받기]</b>를 눌러 한글 샘플을 내려받은 뒤, 우리 원 상황에 맞게 고쳐 쓰세요.
          </p>

          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn btn-gold" onClick={getSample} disabled={!!busy}>
              {busy ? '불러오는 중...' : '샘플 받기 (한글 .hwpx)'}
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
              샘플을 받았습니다. 한글에서 열어 우리 원 내용으로 고쳐 작성하시면 됩니다. 어려운 점이
              있으면 라지숙 소장에게 문의해 주세요.
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
