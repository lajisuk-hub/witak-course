'use client';

import { useEffect, useState } from 'react';
import { loadAll, patch, markDone } from '@/lib/store';
import { useMe } from '@/lib/auth';
import ContactBar from '@/app/ContactBar';
import { buildParentDoc } from '@/lib/parentDoc';
import { downloadBlob } from '@/lib/formDoc';

const THEMES = [
  '생태·숲·자연',
  '그림책·문해력',
  '오감·감각놀이',
  '신체·움직임',
  '음악·예술',
  '전통문화·세시',
  '세계문화·다문화',
  '텃밭·요리',
  '인성·마음',
];
const TARGETS = ['아빠(아버지)', '조부모', '부모', '온 가족'];
const FREQS = ['연 1회', '연 2회', '분기별(연 4회)', '학기별(연 2회)', '월 1회', '수시'];

export default function Step6() {
  const { me, ready: authed } = useMe();
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState('');
  const [customTheme, setCustomTheme] = useState('');
  const [rows, setRows] = useState([
    { target: '아빠(아버지)', freq: '연 2회' },
    { target: '조부모', freq: '연 1회' },
    { target: '온 가족', freq: '연 2회' },
  ]);
  const [generated, setGenerated] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [again, setAgain] = useState(false); // 전에 하신 적이 있는지

  // 전에 쓰신 특색·프로그램·AI 초안을 그대로 다시 보여 준다
  useEffect(() => {
    if (!authed || !me) return;
    const d = loadAll();
    const s = d.parentStep || null;
    if (s) {
      if (s.theme) setTheme(s.theme);
      if (s.customTheme) setCustomTheme(s.customTheme);
      if (Array.isArray(s.rows) && s.rows.length) setRows(s.rows);
      if (Array.isArray(s.generated) && s.generated.length) setGenerated(s.generated);
      setAgain(true);
    }
    setReady(true);
  }, [authed, me]);

  const finalTheme = theme === '직접 입력' ? customTheme.trim() : theme;

  // 화면에서 고칠 때마다 저장해 둔다 (다시 들어와도 남아 있게)
  function keep(part) {
    const d = loadAll();
    patch({ parentStep: { ...(d.parentStep || {}), ...part } });
  }

  function pickTheme(t) {
    setTheme(t);
    setGenerated(null);
    setResult(null);
    keep({ theme: t, generated: null });
  }
  function setRow(i, key, val) {
    setGenerated(null);
    setResult(null);
    setRows((r) => {
      const next = r.map((x, j) => (j === i ? { ...x, [key]: val } : x));
      keep({ rows: next, generated: null });
      return next;
    });
  }
  function addRow() {
    setRows((r) => {
      const next = [...r, { target: '부모', freq: '연 2회' }];
      keep({ rows: next });
      return next;
    });
  }
  function removeRow(i) {
    setRows((r) => {
      const next = r.filter((_, j) => j !== i);
      keep({ rows: next });
      return next;
    });
  }

  async function generate() {
    if (!finalTheme) {
      setError('먼저 우리 원 특색을 골라 주세요.');
      return;
    }
    if (rows.length < 3) {
      setError('심사 요구사항에 맞춰 참여 프로그램을 최소 3가지 넣어 주세요.');
      return;
    }
    setError('');
    setResult(null);
    setBusy('AI가 특색과 연계해 참여 프로그램을 쓰는 중입니다... (20초쯤 걸립니다)');
    try {
      const res = await fetch('/api/parent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: finalTheme, items: rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '작성하지 못했습니다.');
      setGenerated(data.programs);
      keep({ theme, customTheme, rows, generated: data.programs });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function makeDoc() {
    setError('');
    setBusy('한글 문서를 만드는 중입니다...');
    try {
      const d = loadAll();
      const r = await buildParentDoc({
        programs: generated,
        theme: finalTheme,
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
        <p>우리 원 특색과 연계한 부모·가족 참여 프로그램을 AI가 써 드립니다</p>
        <a href="/">← 차시 목록으로</a>
      </div>

      <div className="wrap" style={{ maxWidth: 760 }}>
        {error && <div className="err">{error}</div>}

        {again && (
          <div className="info" style={{ marginBottom: 12 }}>
            <b>전에 쓰신 내용이 그대로 남아 있습니다.</b> 이어서 하셔도 되고, 고쳐서 새로 만드셔도
            됩니다.
          </div>
        )}

        {/* 1. 특색 */}
        <div className="card welcome">
          <h2>① 우리 원 특색을 골라 주세요</h2>
          <p>참여 프로그램을 이 특색과 연계해서 만들어 드립니다. (4차시 특색과 같게 고르시면 좋아요)</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {[...THEMES, '직접 입력'].map((t) => (
              <button
                key={t}
                onClick={() => pickTheme(t)}
                className="drop"
                style={{
                  padding: '8px 14px',
                  cursor: 'pointer',
                  border: theme === t ? '2px solid #1a3a5c' : '1px solid #d8dee6',
                  background: theme === t ? '#eaf0f7' : '#fff',
                  borderRadius: 20,
                  color: '#1a3a5c',
                  fontWeight: theme === t ? 700 : 500,
                }}
              >
                {t}
              </button>
            ))}
          </div>
          {theme === '직접 입력' && (
            <input
              type="text"
              value={customTheme}
              onChange={(e) => {
                setCustomTheme(e.target.value);
                setGenerated(null);
                keep({ customTheme: e.target.value, generated: null });
              }}
              placeholder="예) 그림책 놀이, 생태 텃밭, 세계 문화 체험 …"
              style={{ marginTop: 10, width: '100%', padding: 12, fontSize: 16 }}
            />
          )}
        </div>

        {/* 2. 참여 프로그램 대상·횟수 */}
        <div className="card welcome">
          <h2>② 참여 프로그램의 대상과 횟수를 정해 주세요</h2>
          <p>누가(아빠·조부모·부모·온 가족) 참여하는 프로그램을 몇 번 할지 고르시면 됩니다. (최소 3가지)</p>
          <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
            {rows.map((row, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ width: 20, color: 'var(--muted)' }}>{i + 1}</span>
                <select
                  value={row.target}
                  onChange={(e) => setRow(i, 'target', e.target.value)}
                  style={{ flex: 1, padding: 10, fontSize: 15 }}
                >
                  {TARGETS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <select
                  value={row.freq}
                  onChange={(e) => setRow(i, 'freq', e.target.value)}
                  style={{ flex: 1, padding: 10, fontSize: 15 }}
                >
                  {FREQS.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
                {rows.length > 1 && (
                  <button
                    onClick={() => removeRow(i)}
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '6px 10px' }}
                    title="빼기"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={addRow}>
              + 프로그램 추가
            </button>
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn btn-gold" onClick={generate} disabled={!!busy}>
              {busy && busy.includes('AI') ? 'AI가 쓰는 중...' : 'AI로 참여 프로그램 작성하기'}
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
        </div>

        {/* 3. 결과 + 문서 만들기 */}
        {generated && generated.length > 0 && (
          <div className="card welcome">
            <h2>③ 이렇게 써봤어요 — 마음에 들면 한글 문서로 받으세요</h2>
            <p style={{ color: 'var(--muted)' }}>
              마음에 안 들면 위에서 특색·대상·횟수를 바꿔 <b>다시 작성</b>할 수 있어요.
            </p>
            <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
              {generated.map((p, i) => (
                <div
                  key={i}
                  className="drop"
                  style={{ textAlign: 'left', padding: '12px 16px', borderRadius: 12 }}
                >
                  <div style={{ fontWeight: 700, color: '#1a3a5c' }}>
                    {i + 1}. {p.name}
                  </div>
                  <div style={{ fontSize: 14, marginTop: 4 }}>{p.detail}</div>
                </div>
              ))}
            </div>
            <div className="row" style={{ marginTop: 16, gap: 8 }}>
              <button className="btn btn-gold" onClick={makeDoc} disabled={!!busy}>
                {busy && busy.includes('한글') ? '만드는 중...' : '한글 문서로 만들기 (.hwpx)'}
              </button>
              <button className="btn btn-ghost" onClick={generate} disabled={!!busy}>
                다시 작성
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="card welcome">
            <div className="info">
              <b>{result.name}</b> 을 받았습니다.
              <br />
              「(4) 부모·가족 참여 프로그램」에 {result.programs.length}가지를 넣었습니다:{' '}
              {result.programs.join(', ')}
              <br />
              한글에서 열어 우리 원 상황에 맞게 확인·수정하시면 됩니다.
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <a className="btn btn-ghost" href="/">
                메인으로 →
              </a>
            </div>
          </div>
        )}

        <ContactBar />
      </div>
    </>
  );
}
