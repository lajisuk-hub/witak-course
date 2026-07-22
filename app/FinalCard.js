'use client';

import { useState } from 'react';
import { FORMS } from '@/lib/forms';
import { loadAll } from '@/lib/store';

// 맨 마지막 단계 — 그동안 만든 문서들을 전체 서식에 옮겨 담아 한 부로 완성한다.
export default function FinalCard({ phone }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const d = loadAll();
  const docs = FORMS.filter((f) => f.step != null);
  const made = docs.filter((f) => d.done?.[String(f.step)]);
  const rest = docs.filter((f) => !d.done?.[String(f.step)]);
  const allDone = rest.length === 0 && made.length > 0;

  async function downloadFinal() {
    setError('');
    setBusy('전체 문서 서식을 준비하는 중입니다...');
    try {
      const res = await fetch(`/api/sample?kind=final&phone=${encodeURIComponent(phone)}`);
      const info = await res.json();
      if (!res.ok) throw new Error(info.error || '서식을 열지 못했습니다');
      const a = document.createElement('a');
      a.href = info.url;
      a.download = '전체문서_서식.hwpx';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <h2 className="section">마지막 단계</h2>

      {error && <div className="err">{error}</div>}

      <div className={`card ${allDone ? 'done-card' : ''}`}>
        <h2>
          전체 문서로 합치기
          {allDone && <span className="badge ok">지금 하실 차례</span>}
        </h2>
        <p className="sub">
          모든 문서를 만드신 뒤, <b>전체 문서 서식</b>을 받아 그동안 만든 문서들을 옮겨 담아 한
          부로 완성하시면 됩니다.
        </p>

        <ul className="pts">
          <li>
            만든 문서 <b>{made.length}가지</b>
            {made.length > 0 && ` — ${made.map((f) => f.name).join(', ')}`}
          </li>
          {rest.length > 0 && (
            <li>
              남은 문서 <b>{rest.length}가지</b> — {rest.map((f) => f.name).join(', ')}
            </li>
          )}
        </ul>

        {busy && (
          <div className="info">
            <span className="spin" style={{ borderColor: '#1a3a5c', borderTopColor: 'transparent' }} />
            {busy}
          </div>
        )}

        <div className="row" style={{ marginTop: 12 }}>
          <button
            className={`btn ${allDone ? 'btn-gold' : 'btn-ghost'}`}
            onClick={downloadFinal}
            disabled={!!busy}
          >
            전체 문서 서식 받기
          </button>
        </div>
        {!allDone && (
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '10px 0 0' }}>
            ※ 아직 만들 문서가 남아 있습니다. 남은 차시를 먼저 마치세요.
          </p>
        )}
      </div>
    </>
  );
}
