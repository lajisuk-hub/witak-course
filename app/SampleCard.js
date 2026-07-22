'use client';

import { useState } from 'react';
import { COURSE } from '@/lib/course';
import { loadAll } from '@/lib/store';

// 문서가 어떻게 만들어지고 모이는지 안내하고, 마지막 전체 서식을 받게 해준다.
export default function SampleCard({ phone }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const d = loadAll();
  const hasToc = Array.isArray(d.items) && d.items.length > 0;
  const doneSteps = COURSE.filter((c) => d.done?.[String(c.no)]);

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
      {error && <div className="err">{error}</div>}

      <div className="card welcome">
        <h2>차시마다 문서 하나씩 받아 모으시면 됩니다</h2>
        <p>
          차시를 마치실 때마다 그 문서를 <b>한글 파일로 받으실 수 있습니다.</b> 라지숙 소장이
          만든 서식(글꼴·글자크기·줄간격·여백)에 맞춰 나오니, 받아서 그대로 쓰시면 됩니다.
          <br />
          파일 이름은 <b>지역_이름_문서이름</b> 으로 통일되어 있어 모아두기 좋습니다.
          <br />
          모든 차시를 마치시면 <b>전체 문서 서식</b>을 받아 하나로 정리하시면 완성입니다.
        </p>
      </div>

      <div className="card">
        <h2>지금까지 만든 문서</h2>

        <ul className="pts">
          <li>
            {hasToc ? (
              <>
                목차 정리 완료 — <b>{d.items.length}가지 서류</b>
                {d.city ? ` (${d.city} 순서)` : ''}
              </>
            ) : (
              <>
                아직 목차가 없습니다. <a href="/toc">0차시</a>에서 공고문을 올려 주세요
              </>
            )}
          </li>
          <li>
            {doneSteps.length > 0 ? (
              <>
                받으신 문서 — <b>{doneSteps.map((c) => c.title).join(', ')}</b>
              </>
            ) : (
              <>아직 만든 문서가 없습니다</>
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
          <button className="btn btn-ghost" onClick={downloadFinal} disabled={!!busy}>
            전체 문서 서식 받기
          </button>
          <a className="btn btn-ghost" href="/toc">
            목차 고치기
          </a>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '10px 0 0' }}>
          ※ 전체 문서 서식은 <b>모든 차시를 마친 뒤</b> 각 문서를 옮겨 담아 정리하실 때 쓰는
          것입니다. 아직 안 올라왔으면 라지숙 소장에게 문의해 주세요.
        </p>
      </div>
    </>
  );
}
