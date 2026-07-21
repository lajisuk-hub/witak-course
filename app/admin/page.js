'use client';

import { useEffect, useRef, useState } from 'react';
import { DEFAULT_SECTIONS } from '@/lib/sampleSections';
import { loadSections, saveSections, clearSections } from '@/lib/store';

const PASSWORD = '1234'; // 수강생이 실수로 못 들어오게 막는 용도

export default function Admin() {
  const [ok, setOk] = useState(false);
  const [pw, setPw] = useState('');
  const [list, setList] = useState(DEFAULT_SECTIONS);
  const [open, setOpen] = useState(null);
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    setList(loadSections(DEFAULT_SECTIONS));
  }, []);

  function update(i, key, value) {
    const next = list.map((s, k) => (k === i ? { ...s, [key]: value } : s));
    setList(next);
    saveSections(next);
    setMsg('저장됨');
    setTimeout(() => setMsg(''), 1200);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'witak-sample-sections.json';
    a.click();
  }

  function importJson(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const arr = JSON.parse(r.result);
        if (!Array.isArray(arr)) throw new Error('형식이 맞지 않습니다');
        setList(arr);
        saveSections(arr);
        setMsg('불러왔습니다');
      } catch (err) {
        setMsg('불러오기 실패: ' + err.message);
      }
    };
    r.readAsText(f);
    e.target.value = '';
  }

  function reset() {
    if (!confirm('처음 상태로 되돌릴까요? 지금까지 고친 내용이 사라집니다.')) return;
    clearSections();
    setList(DEFAULT_SECTIONS);
    setMsg('되돌렸습니다');
  }

  if (!ok) {
    return (
      <>
        <div className="head">
          <h1>관리자 화면</h1>
          <p>진행자(원장님) 전용입니다</p>
        </div>
        <div className="wrap" style={{ maxWidth: 420 }}>
          <div className="card">
            <label>비밀번호</label>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setOk(pw === PASSWORD)}
            />
            <div className="row right" style={{ marginTop: 14 }}>
              <a className="btn btn-ghost" href="/">
                돌아가기
              </a>
              <button className="btn" onClick={() => setOk(pw === PASSWORD)}>
                들어가기
              </button>
            </div>
            {pw && pw !== PASSWORD && (
              <p style={{ fontSize: 13, color: '#c0392b' }}>비밀번호가 다릅니다</p>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="head">
        <h1>문서 샘플 관리</h1>
        <p>여기에 넣은 내용이 수강생의 문서 뼈대에 그대로 들어갑니다</p>
      </div>

      <div className="wrap">
        <div className="card">
          <div className="info">
            꼭지 <b>{list.length}개</b>. 고치면 바로 저장됩니다(이 컴퓨터에).
            <br />
            수강생 화면에도 반영하려면 <b>내려받기</b>로 파일을 저장해 개발자에게 전달하세요.
          </div>
          <div className="row">
            <button className="btn btn-ghost btn-sm" onClick={exportJson}>
              내려받기 (JSON)
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
              불러오기
            </button>
            <button className="btn btn-ghost btn-sm" onClick={reset}>
              처음 상태로
            </button>
            <a className="btn btn-ghost btn-sm" href="/">
              수강생 화면 보기
            </a>
            {msg && <span style={{ color: '#2e7d5b', fontSize: 13 }}>{msg}</span>}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            onChange={importJson}
            style={{ display: 'none' }}
          />
        </div>

        {list.map((s, i) => (
          <div className="card" key={s.id} style={{ padding: 16 }}>
            <div
              className="row"
              style={{ cursor: 'pointer', justifyContent: 'space-between' }}
              onClick={() => setOpen(open === i ? null : i)}
            >
              <div>
                <span className="no">{i + 1}</span>
                <b>{s.name}</b>
                {s.body?.trim() ? (
                  <span className="badge ok">내용 있음</span>
                ) : (
                  <span className="badge off">비어 있음</span>
                )}
              </div>
              <span style={{ color: '#6d6a63' }}>{open === i ? '▲' : '▼'}</span>
            </div>

            {open === i && (
              <div style={{ marginTop: 12 }}>
                <label>꼭지 이름</label>
                <input
                  type="text"
                  value={s.name}
                  onChange={(e) => update(i, 'name', e.target.value)}
                />

                <label>관련어 (쉼표로 구분 — 공고문 목차와 짝을 지을 때 씁니다)</label>
                <input
                  type="text"
                  value={(s.keywords || []).join(', ')}
                  onChange={(e) =>
                    update(
                      i,
                      'keywords',
                      e.target.value.split(',').map((v) => v.trim()).filter(Boolean)
                    )
                  }
                />

                <label>작성 요령 (수강생에게 보여줄 주의사항)</label>
                <textarea
                  value={s.guide || ''}
                  onChange={(e) => update(i, 'guide', e.target.value)}
                  style={{ minHeight: 70 }}
                />

                <label>샘플 내용 (한글 파일에 그대로 들어갑니다)</label>
                <textarea
                  value={s.body || ''}
                  onChange={(e) => update(i, 'body', e.target.value)}
                  style={{ minHeight: 200 }}
                  placeholder="여기에 원장님 샘플 문서의 이 꼭지 내용을 붙여넣으세요."
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
