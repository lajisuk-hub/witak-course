'use client';

import { useEffect, useState } from 'react';
import { loadAll, markDone } from '@/lib/store';
import { useMe } from '@/lib/auth';
import ContactBar from '@/app/ContactBar';
import { buildParentDoc, PARENT_PROGRAMS } from '@/lib/parentDoc';
import { downloadBlob } from '@/lib/formDoc';

export default function Step6() {
  const { me, ready: authed } = useMe();
  const [ready, setReady] = useState(false);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!authed || !me) return;
    setReady(true);
  }, [authed, me]);

  function toggle(key) {
    setResult(null);
    setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  }

  async function make() {
    if (picked.length < 3) {
      setError('심사 요구사항에 맞춰 최소 3가지 참여 프로그램을 골라 주세요.');
      return;
    }
    setError('');
    setResult(null);
    setBusy('문서를 만드는 중입니다...');
    try {
      const d = loadAll();
      const ordered = PARENT_PROGRAMS.filter((p) => picked.includes(p.key)).map((p) => p.key);
      const r = await buildParentDoc({
        selected: ordered,
        phone: me.phone,
        city: d.city,
        student: d.applicant || me.name,
        onProgress: setBusy,
      });
      downloadBlob(r.blob, r.name);
      markDone(6);
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
        <h1>6차시 · 학부모 참여수업 계획</h1>
        <p>열린어린이집 서식에 우리 원의 부모·가족 참여 프로그램을 넣어 드립니다</p>
        <a href="/">← 차시 목록으로</a>
      </div>

      <div className="wrap" style={{ maxWidth: 720 }}>
        {error && <div className="err">{error}</div>}

        <div className="card welcome">
          <h2>우리 원이 할 참여 프로그램을 골라 주세요</h2>
          <p>
            서식의 <b>열린어린이집 3요소</b>(개방적 환경·부모 역량 강화·다면적 의사소통)는 그대로
            들어갑니다. 여기에서 <b>우리 원이 실제로 운영할 부모·가족 참여 프로그램</b>을 고르시면,{' '}
            <b>「(4) 부모·가족 참여 프로그램」</b> 표가 추가된 한글 문서가 만들어집니다.
            <br />
            위탁심사는 <b>3가지 이상</b>을 요구합니다. (아빠·조부모 참여를 넣으면 더 좋습니다)
          </p>

          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
            {PARENT_PROGRAMS.map((p) => {
              const on = picked.includes(p.key);
              return (
                <button
                  key={p.key}
                  onClick={() => toggle(p.key)}
                  className="drop"
                  style={{
                    textAlign: 'left',
                    cursor: 'pointer',
                    padding: '12px 16px',
                    border: on ? '2px solid #1a3a5c' : '1px solid #d8dee6',
                    background: on ? '#eaf0f7' : '#fff',
                    borderRadius: 12,
                    color: '#1a3a5c',
                  }}
                >
                  <div style={{ fontWeight: on ? 700 : 600, fontSize: 16 }}>
                    {on ? '☑' : '⬜'} {p.name}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4, marginLeft: 24 }}>
                    {p.detail.slice(0, 45)}…
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 8, fontSize: 14, color: 'var(--muted)' }}>
            고른 프로그램: {picked.length}가지
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn btn-gold" onClick={make} disabled={!!busy}>
              {busy ? '만드는 중...' : '학부모 참여수업 문서 만들기 (한글 .hwpx)'}
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
              「(4) 부모·가족 참여 프로그램」에 {result.programs.length}가지를 넣었습니다:{' '}
              {result.programs.join(', ')}
              <br />
              한글에서 열어 우리 원 상황에 맞게 횟수·시기 등을 확인·수정하시면 됩니다.
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
