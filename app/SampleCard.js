'use client';

import { useState } from 'react';
import { COURSE } from '@/lib/course';
import { loadAll } from '@/lib/store';

// 문서 샘플이 어떻게 쓰이는지 설명하고, 샘플 틀을 내려받게 해준다.
export default function SampleCard({ phone }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function downloadSample() {
    setError('');
    setBusy('문서 샘플을 준비하는 중입니다... (12MB, 1분쯤 걸립니다)');
    try {
      const res = await fetch(`/api/sample?phone=${encodeURIComponent(phone)}`);
      const info = await res.json();
      if (!res.ok) throw new Error(info.error || '샘플을 열지 못했습니다');
      const a = document.createElement('a');
      a.href = info.url;
      a.download = '원장님_문서샘플.hwpx';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  const d = loadAll();
  const hasToc = Array.isArray(d.items) && d.items.length > 0;
  const doneSteps = COURSE.filter((c) => d.done?.[String(c.no)]);

  return (
    <>
      {error && <div className="err">{error}</div>}

      <div className="card welcome">
        <h2>원장님 문서 샘플이 우리 서류의 뼈대입니다</h2>
        <p>
          라지숙 소장이 만든 <b>문서 샘플</b>을 바탕으로, 우리 지자체 공고문에 맞춰 목차를 다시
          정리해 드립니다. 그리고 <b>차시마다 작성하신 내용이 그 문서의 해당 자리에 자동으로
          들어갑니다.</b>
          <br />
          그래서 과정을 끝까지 마치시면 <b>하나로 완성된 위탁 서류</b>가 됩니다.
        </p>
      </div>

      <div className="card">
        <h2>지금까지 쌓인 내용</h2>
        <ul className="pts">
          <li>
            {hasToc ? (
              <>
                <b>우리 지자체 목차</b>가 만들어져 있습니다 ({d.items.length}가지 서류)
              </>
            ) : (
              <>
                아직 <b>우리 지자체 목차</b>가 없습니다. <a href="/toc">0차시</a>에서 공고문을
                올려 주세요
              </>
            )}
          </li>
          <li>
            {doneSteps.length > 0 ? (
              <>
                작성 완료: <b>{doneSteps.map((c) => `${c.no}차시 ${c.title}`).join(', ')}</b>
              </>
            ) : (
              <>아직 작성을 마친 차시가 없습니다</>
            )}
          </li>
        </ul>

        {busy && (
          <div className="info">
            <span className="spin" style={{ borderColor: '#1a3a5c', borderTopColor: 'transparent' }} />
            {busy}
          </div>
        )}

        <div className="row" style={{ marginTop: 12 }}>
          <a className="btn btn-gold" href="/toc">
            지금까지 만든 통합 문서 받기
          </a>
          <button className="btn btn-ghost" onClick={downloadSample} disabled={!!busy}>
            원장님 문서 샘플 원본 받기
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '10px 0 0' }}>
          ※ 차시를 더 진행하신 뒤 다시 받으시면, 그동안 쓰신 내용까지 합쳐진 문서가 나옵니다. 언제든
          이전 차시로 돌아가 고치고 다시 받으실 수 있습니다.
        </p>
      </div>
    </>
  );
}
