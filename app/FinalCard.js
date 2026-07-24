'use client';

import { FORMS } from '@/lib/forms';
import { loadAll } from '@/lib/store';

// 맨 마지막 단계 안내 — 실제 진행은 7차시(/step7)에서 한다.
// (전에는 여기서 바로 서식을 받게 했는데, 7차시와 겹쳐서 한 곳으로 모았다)
export default function FinalCard() {
  const d = loadAll();
  const docs = FORMS.filter((f) => f.step != null);
  const made = docs.filter((f) => d.done?.[String(f.step)]);
  const rest = docs.filter((f) => !d.done?.[String(f.step)]);
  const allDone = rest.length === 0 && made.length > 0;

  return (
    <>
      <h2 className="section">마지막 단계</h2>

      <div className={`card ${allDone ? 'done-card' : ''}`}>
        <h2>
          전체문서 정리하고 내용 보충 (7차시)
          {allDone && <span className="badge ok">지금 하실 차례</span>}
        </h2>
        <p className="sub">
          모든 문서를 만드신 뒤 <b>7차시</b>에서 <b>전체 문서 샘플</b>을 받아, 그동안 만든 문서들을
          그 안에 옮겨 담아 한 부로 완성하시면 됩니다.
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

        <div className="row" style={{ marginTop: 12 }}>
          <a className={`btn ${allDone ? 'btn-gold' : 'btn-ghost'}`} href="/step7">
            7차시 전체문서 정리하러 가기 →
          </a>
        </div>
        {!allDone && (
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '10px 0 0' }}>
            ※ 아직 만들 문서가 남아 있습니다. 남은 차시를 먼저 마치셔도 되고, 미리 샘플만 받아
            보셔도 됩니다.
          </p>
        )}
      </div>
    </>
  );
}
