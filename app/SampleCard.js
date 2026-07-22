'use client';

import { FORMS } from '@/lib/forms';
import { loadAll } from '@/lib/store';

// 문서가 어떻게 만들어지고 모이는지 안내하고, 마지막 전체 서식을 받게 해준다.
export default function SampleCard() {
  const d = loadAll();
  const hasToc = Array.isArray(d.items) && d.items.length > 0;
  // 끝낸 차시를 '문서 이름'으로 보여 준다
  const madeDocs = FORMS.filter((f) => f.step != null && d.done?.[String(f.step)]);
  const restDocs = FORMS.filter((f) => f.step != null && !d.done?.[String(f.step)]);

  return (
    <>
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
            {madeDocs.length > 0 ? (
              <>
                만든 문서 — <b>{madeDocs.map((f) => f.name).join(', ')}</b>
              </>
            ) : (
              <>아직 만든 문서가 없습니다</>
            )}
          </li>
          {restDocs.length > 0 && (
            <li>남은 문서 — {restDocs.map((f) => f.name).join(', ')}</li>
          )}
        </ul>

        <div className="row" style={{ marginTop: 12 }}>
          <a className="btn btn-ghost" href="/toc">
            목차 다시 보기 · 고치기
          </a>
        </div>
      </div>

    </>
  );
}
