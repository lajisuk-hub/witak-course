'use client';

import { useEffect, useState } from 'react';
import { loadAll, patch, markDone } from '@/lib/store';
import { useMe } from '@/lib/auth';
import ContactBar from '@/app/ContactBar';
import { buildVulnerableDoc, VULN_AREAS } from '@/lib/vulnerableDoc';
import { downloadBlob } from '@/lib/formDoc';

export default function Step5() {
  const { me, ready: authed } = useMe();
  const [ready, setReady] = useState(false);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [again, setAgain] = useState(false); // 전에 하신 적이 있는지

  // 전에 고르신 영역을 그대로 다시 보여 준다 (다시 들어와도 처음부터 하지 않도록)
  useEffect(() => {
    if (!authed || !me) return;
    const d = loadAll();
    if (Array.isArray(d.vulnPicked) && d.vulnPicked.length) {
      setPicked(d.vulnPicked);
      setAgain(true);
    }
    setReady(true);
  }, [authed, me]);

  function toggle(key) {
    setResult(null);
    setPicked((p) => {
      const next = p.includes(key) ? p.filter((k) => k !== key) : [...p, key];
      patch({ vulnPicked: next });
      return next;
    });
  }

  async function make() {
    if (picked.length < 2) {
      setError('심사 요구사항에 맞춰 최소 2개 영역을 골라 주세요. (보통 3개를 권합니다)');
      return;
    }
    setError('');
    setResult(null);
    setBusy('문서를 만드는 중입니다...');
    try {
      const d = loadAll();
      // VULN_AREAS 순서대로 정렬해서 넘긴다
      const ordered = VULN_AREAS.filter((a) => picked.includes(a.key)).map((a) => a.key);
      const r = await buildVulnerableDoc({
        selected: ordered,
        phone: me.phone,
        city: d.city,
        student: d.applicant || me.name,
        onProgress: setBusy,
      });
      downloadBlob(r.blob, r.name);
      markDone(5);
      setResult(r);
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
        <h1>5차시 · 취약보육 계획</h1>
        <p>우리 원이 운영하는 취약보육 영역을 골라 맞춤 문서를 만듭니다</p>
        <a href="/">← 차시 목록으로</a>
      </div>

      <div className="wrap" style={{ maxWidth: 680 }}>
        {error && <div className="err">{error}</div>}

        {again && (
          <div className="info" style={{ marginBottom: 12 }}>
            <b>전에 고르신 영역이 그대로 남아 있습니다.</b> 그대로 문서를 다시 받으셔도 되고,
            체크를 고쳐서 새로 만드셔도 됩니다.
          </div>
        )}

        <div className="card welcome">
          <h2>우리 원이 하는 취약보육을 골라 주세요</h2>
          <p>
            아래 4가지 영역 중 <b>우리 어린이집이 실제로 운영하는 영역</b>을 체크하시면, 고른 영역만
            들어간 한글 문서가 만들어집니다. 운영철학·근거법령·통합운영체계는 항상 들어갑니다.
            <br />
            위탁심사는 <b>2개 이상</b>을 요구하며, 보통 <b>3개</b>를 권해 드립니다.
          </p>

          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
            {VULN_AREAS.map((a) => {
              const on = picked.includes(a.key);
              return (
                <button
                  key={a.key}
                  onClick={() => toggle(a.key)}
                  className="drop"
                  style={{
                    textAlign: 'left',
                    cursor: 'pointer',
                    padding: '14px 16px',
                    border: on ? '2px solid #1a3a5c' : '1px solid #d8dee6',
                    background: on ? '#eaf0f7' : '#fff',
                    borderRadius: 12,
                    fontSize: 16,
                    color: '#1a3a5c',
                    fontWeight: on ? 700 : 500,
                  }}
                >
                  {on ? '☑' : '⬜'} {a.label}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 8, fontSize: 14, color: 'var(--muted)' }}>
            고른 영역: {picked.length}개
            {picked.length > 0 &&
              ' — ' + VULN_AREAS.filter((a) => picked.includes(a.key)).map((a) => a.intro).join(', ')}
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn btn-gold" onClick={make} disabled={!!busy}>
              {busy ? '만드는 중...' : '취약보육 문서 만들기 (한글 .hwpx)'}
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

          {result && (
            <div className="info">
              <b>{result.name}</b> 을 받았습니다.
              <br />
              담긴 영역 {result.areas.length}개: {result.areas.join(', ')} (+ 통합 운영 체계)
              <br />
              한글에서 열어 우리 원 정원·시간 등 숫자를 확인·수정하시면 됩니다.
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
