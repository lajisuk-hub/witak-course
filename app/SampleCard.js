'use client';

import { useState } from 'react';
import { COURSE } from '@/lib/course';
import { loadAll, loadSections, markDone } from '@/lib/store';
import { DEFAULT_SECTIONS } from '@/lib/sampleSections';
import { loadWritten } from '@/lib/written';
import { buildHwpx, downloadBlob } from '@/lib/hwpx';
import { describeSetting } from '@/lib/docSetting';

// 문서 샘플이 어떻게 쓰이는지 설명하고, 문서를 내려받게 해준다.
export default function SampleCard({ phone }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const d = loadAll();
  const hasToc = Array.isArray(d.items) && d.items.length > 0;
  const doneSteps = COURSE.filter((c) => c.no > 0 && d.done?.[String(c.no)]);

  // ① 지금까지 쌓인 내용이 다 들어간 통합 문서
  async function downloadMerged() {
    setError('');
    setBusy('문서를 만드는 중입니다... (1~2분 걸립니다. 창을 닫지 마세요)');
    try {
      const sections = loadSections(DEFAULT_SECTIONS);
      const blob = await buildHwpx({
        city: d.city,
        center: d.center,
        applicant: d.applicant,
        items: d.items,
        written: loadWritten(sections),
        setting: d.setting,
        onProgress: setBusy,
      });
      downloadBlob(blob, `${d.city || '위탁'}_위탁운영계획서.hwpx`);
      markDone(0);
    } catch (e) {
      setError('문서 만들기 실패: ' + e.message);
    } finally {
      setBusy('');
    }
  }

  // ② 원장님이 만든 원본 그대로
  async function downloadOriginal() {
    setError('');
    setBusy('원본 샘플을 준비하는 중입니다... (12MB)');
    try {
      const res = await fetch(`/api/sample?phone=${encodeURIComponent(phone)}`);
      const info = await res.json();
      if (!res.ok) throw new Error(info.error || '샘플을 열지 못했습니다');
      const a = document.createElement('a');
      a.href = info.url;
      a.download = '원장님_문서샘플_원본.hwpx';
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
        <h2>원장님 문서 샘플이 우리 서류의 뼈대입니다</h2>
        <p>
          라지숙 소장이 만든 <b>문서 샘플</b>을 바탕으로, 우리 지자체 공고문에 맞춰 목차를 다시
          정리해 드립니다. 그리고 <b>차시마다 작성하신 내용이 그 문서의 해당 자리에 자동으로
          들어갑니다.</b>
          <br />
          그래서 과정을 끝까지 마치시면 <b>하나로 완성된 위탁 서류</b>가 됩니다.
        </p>
      </div>

      {/* ── 내 서류 ── */}
      <div className="card">
        <h2>내 위탁 서류</h2>
        <p className="sub">
          우리 지자체 목차 순서로 정리되고, 차시에서 쓴 내용이 채워진 <b>제출용 문서</b>입니다.
        </p>

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
                채워진 내용 — <b>{doneSteps.map((c) => `${c.no}차시 ${c.title}`).join(', ')}</b>
              </>
            ) : (
              <>아직 채워진 차시가 없습니다 (샘플 내용이 그대로 들어갑니다)</>
            )}
          </li>
          <li>
            문서 설정 — <b>{describeSetting(d.setting)}</b>
          </li>
        </ul>

        {busy && (
          <div className="info">
            <span className="spin" style={{ borderColor: '#1a3a5c', borderTopColor: 'transparent' }} />
            {busy}
          </div>
        )}

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn btn-gold" onClick={downloadMerged} disabled={!!busy || !hasToc}>
            내 위탁 서류 한글파일로 받기
          </button>
          <a className="btn btn-ghost" href="/toc">
            목차 고치기
          </a>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '10px 0 0' }}>
          ※ 차시를 더 진행하신 뒤 다시 받으시면, 그동안 쓰신 내용까지 합쳐진 문서가 나옵니다.
          언제든 이전 차시로 돌아가 고치고 다시 받으실 수 있습니다.
        </p>
      </div>

      {/* ── 원본 샘플 ── */}
      <div className="card" style={{ padding: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <b style={{ color: 'var(--navy)' }}>원장님 샘플 원본 (참고용)</b>
            <div className="meta">
              라지숙 소장이 만든 문서 그대로입니다. 목차 재정리도, 내가 쓴 내용도 들어 있지
              않습니다. 본보기로 통째로 보고 싶을 때 받으세요.
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={downloadOriginal} disabled={!!busy}>
            원본 받기
          </button>
        </div>
      </div>
    </>
  );
}
