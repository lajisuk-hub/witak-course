'use client';

import { useEffect, useRef, useState } from 'react';
import { DEFAULT_SECTIONS, STEP_NAMES } from '@/lib/sampleSections';
import { loadAll, patch, loadSections, markDone } from '@/lib/store';
import { readNoticeFile } from '@/lib/readFile';
import { buildHwpx, downloadBlob } from '@/lib/hwpx';
import { loadWritten, writtenSteps } from '@/lib/written';
import { useMe } from '@/lib/auth';

const STEPS = ['1. 기본 정보', '2. 공고문 올리기', '3. 목차 확인', '4. 내 문서 뼈대'];

export default function Home() {
  const { me, ready: authed } = useMe();
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const [sections, setSections] = useState(DEFAULT_SECTIONS);

  const [city, setCity] = useState('');
  const [center, setCenter] = useState('');
  const [applicant, setApplicant] = useState('');

  const [pasted, setPasted] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const [items, setItems] = useState([]); // [{name, matchId}]
  const [myDone, setMyDone] = useState([]); // 내가 직접 쓴 차시 번호
  const fileRef = useRef(null);

  // 저장된 내용 불러오기
  useEffect(() => {
    if (!authed || !me) return;
    const d = loadAll();
    setSections(loadSections(DEFAULT_SECTIONS));
    setMyDone(writtenSteps());
    if (d.city) setCity(d.city);
    if (d.center) setCenter(d.center);
    setApplicant(d.applicant || me.name || '');
    if (Array.isArray(d.items) && d.items.length) {
      setItems(d.items);
      setStep(3);
    }
    setReady(true);
  }, [authed, me]);

  // 자동 저장
  useEffect(() => {
    if (!ready) return;
    patch({ city, center, applicant, items });
  }, [ready, city, center, applicant, items]);

  const sectionById = (id) => sections.find((s) => s.id === id) || null;

  async function analyze(payload) {
    setError('');
    setBusy('공고문을 읽고 목차를 뽑는 중입니다... (20초쯤 걸립니다)');
    try {
      const res = await fetch('/api/toc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, sections }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '목차를 뽑지 못했습니다');
      if (data.cityName && !city) setCity(data.cityName);
      setItems(data.items);
      setStep(2);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  async function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setError('');
    try {
      setBusy('파일을 읽는 중입니다...');
      const payload = await readNoticeFile(f);
      await analyze(payload);
    } catch (err) {
      setError(err.message);
      setBusy('');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  // 목차 편집
  const move = (i, d) => {
    const next = [...items];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };
  const remove = (i) => setItems(items.filter((_, k) => k !== i));
  const rename = (i, name) => setItems(items.map((it, k) => (k === i ? { ...it, name } : it)));
  const relink = (i, matchId) =>
    setItems(items.map((it, k) => (k === i ? { ...it, matchId: matchId || null } : it)));
  const add = () => setItems([...items, { name: '새 항목', matchId: null }]);

  const usedIds = new Set(items.map((it) => it.matchId).filter(Boolean));
  const unused = sections.filter((s) => !usedIds.has(s.id));

  async function download() {
    setError('');
    setBusy('한글 파일을 만드는 중입니다...');
    try {
      const blob = await buildHwpx({
        city,
        center,
        applicant,
        items,
        written: loadWritten(sections),
        onProgress: setBusy,
      });
      const safe = (city || '위탁') + '_위탁운영계획서_뼈대.hwpx';
      downloadBlob(blob, safe);
      markDone(0);
    } catch (e) {
      setError('한글 파일 만들기 실패: ' + e.message);
    } finally {
      setBusy('');
    }
  }

  if (!authed || !me || !ready) return null;

  return (
    <>
      <div className="head">
        <h1>0차시 · 우리 지자체 목차 만들기</h1>
        <p>공고문에 맞춰 제출서류 목차를 자동으로 만들어 드립니다</p>
        <a href="/">← 차시 목록으로</a>
      </div>

      <div className="wrap">
        <div className="steps">
          {STEPS.map((s, i) => (
            <div key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>
              {s}
            </div>
          ))}
        </div>

        {error && <div className="err">{error}</div>}

        {/* 1단계 ─ 기본 정보 */}
        {step === 0 && (
          <div className="card">
            <h2>기본 정보</h2>
            <p className="sub">서류 표지와 제목에 들어갈 내용입니다. 나중에 바꿔도 됩니다.</p>

            <div className="grid2">
              <div>
                <label>지자체 이름</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="예) 원주시"
                />
              </div>
              <div>
                <label>어린이집 이름</label>
                <input
                  type="text"
                  value={center}
                  onChange={(e) => setCenter(e.target.value)}
                  placeholder="예) 행복"
                />
              </div>
            </div>
            <label>원장 지원자 성함</label>
            <input
              type="text"
              value={applicant}
              onChange={(e) => setApplicant(e.target.value)}
              placeholder="예) 홍길동"
            />

            <div className="foot-nav">
              <span />
              <button className="btn" onClick={() => setStep(1)}>
                다음
              </button>
            </div>
          </div>
        )}

        {/* 2단계 ─ 공고문 */}
        {step === 1 && (
          <div className="card">
            <h2>우리 지자체 공고문 올리기</h2>
            <p className="sub">
              공고문을 올리면 AI가 <b>제출서류 목차</b>를 찾아 드립니다.
            </p>

            <div className="drop">
              <p style={{ margin: '0 0 12px' }}>
                <strong>PDF</strong> 또는 <strong>한글(.hwpx)</strong> 파일
              </p>
              <button className="btn" onClick={() => fileRef.current?.click()} disabled={!!busy}>
                파일 고르기
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.hwpx,.txt"
                onChange={onFile}
                style={{ display: 'none' }}
              />
              {fileName && <p style={{ marginTop: 10, fontSize: 13 }}>고른 파일: {fileName}</p>}
            </div>

            <div className="warn">
              옛날 한글 파일(<b>.hwp</b>)은 읽지 못합니다. 한글에서 열고 <b>다른 이름으로 저장 →
              한글 문서 (*.hwpx)</b> 로 바꿔 저장한 뒤 올려주세요.
            </div>

            <label>또는, 공고문의 목차 부분만 붙여넣기</label>
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={'예)\n① 표지\n② 어린이집 위탁신청서\n③ 위탁 운영체 현황\n...'}
            />
            <div className="row right" style={{ marginTop: 10 }}>
              <button
                className="btn btn-ghost"
                onClick={() => analyze({ kind: 'text', text: pasted })}
                disabled={!!busy || pasted.trim().length < 10}
              >
                붙여넣은 내용으로 만들기
              </button>
            </div>

            {busy && (
              <div className="info">
                <span className="spin" style={{ borderColor: '#1a3a5c', borderTopColor: 'transparent' }} />
                {busy}
              </div>
            )}

            <div className="foot-nav">
              <button className="btn btn-ghost" onClick={() => setStep(0)}>
                이전
              </button>
              <span />
            </div>
          </div>
        )}

        {/* 3단계 ─ 목차 확인 */}
        {step === 2 && (
          <div className="card">
            <h2>목차 확인하기</h2>
            <p className="sub">
              AI가 뽑은 목차입니다. <b>틀린 곳은 고치고</b>, 순서도 바꿀 수 있습니다.
            </p>

            {items.map((it, i) => (
              <div className="item" key={i}>
                <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                  <span className="no">{i + 1}</span>
                  <input
                    type="text"
                    value={it.name}
                    onChange={(e) => rename(i, e.target.value)}
                  />
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <select
                    value={it.matchId || ''}
                    onChange={(e) => relink(i, e.target.value)}
                    style={{ flex: '1 1 260px' }}
                  >
                    <option value="">— 연결된 샘플 없음 (직접 작성) —</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button className="btn btn-ghost btn-sm" onClick={() => move(i, -1)}>
                    ↑
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => move(i, 1)}>
                    ↓
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => remove(i)}>
                    삭제
                  </button>
                </div>
              </div>
            ))}

            <button className="btn btn-ghost btn-sm" onClick={add}>
              + 항목 추가
            </button>

            <div className="foot-nav">
              <button className="btn btn-ghost" onClick={() => setStep(1)}>
                이전
              </button>
              <button className="btn" onClick={() => setStep(3)} disabled={!items.length}>
                이대로 문서 뼈대 만들기
              </button>
            </div>
          </div>
        )}

        {/* 4단계 ─ 문서 뼈대 */}
        {step === 3 && (
          <>
            <div className="card">
              <h2>내 지자체 전용 문서 뼈대</h2>
              <p className="sub">
                {city || '우리 지자체'} 공고문 순서대로 정리했습니다. 아래 순서 그대로 서류를
                만들면 됩니다.
              </p>

              {items.map((it, i) => {
                const s = sectionById(it.matchId);
                const mine = s && myDone.includes(s.step);
                return (
                  <div className="item" key={i}>
                    <div>
                      <span className="no">{i + 1}</span>
                      <span className="name">{it.name}</span>
                      {mine ? (
                        <span className="badge mine">내가 쓴 글</span>
                      ) : s ? (
                        <span className="badge ok">샘플 있음</span>
                      ) : (
                        <span className="badge new">직접 작성</span>
                      )}
                    </div>
                    {s && (
                      <div className="meta">
                        {mine
                          ? `▸ ${STEP_NAMES[s.step]}에서 쓰신 내용이 이 자리에 들어갑니다`
                          : `▸ 샘플: ${s.name}`}
                        {!mine && s.step && ` · ${STEP_NAMES[s.step]}에서 작성`}
                        {s.guide && (
                          <>
                            <br />※ {s.guide}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {unused.length > 0 && (
              <div className="card noprint">
                <h2>이번 지자체에서는 안 쓰는 꼭지</h2>
                <p className="sub">
                  샘플에는 있지만 이번 공고문 목차에는 없는 것들입니다. 필요하면 3단계로 돌아가
                  넣으세요.
                </p>
                <ul className="unused">
                  {unused.map((s) => (
                    <li key={s.id}>· {s.name}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="card noprint">
              <h2>내려받기</h2>
              <p className="sub">
                한글 파일을 열면 목차와 각 꼭지가 이미 만들어져 있습니다. 내용만 채우시면 됩니다.
              </p>
              {busy && (
                <div className="info">
                  <span
                    className="spin"
                    style={{ borderColor: '#1a3a5c', borderTopColor: 'transparent' }}
                  />
                  {busy}
                </div>
              )}
              <div className="row">
                <button className="btn btn-gold" onClick={download} disabled={!!busy}>
                  한글 파일(.hwpx) 내려받기
                </button>
                <button className="btn btn-ghost" onClick={() => window.print()}>
                  인쇄 / PDF로 저장
                </button>
              </div>
            </div>

            <div className="foot-nav noprint">
              <button className="btn btn-ghost" onClick={() => setStep(2)}>
                목차 다시 고치기
              </button>
              <a className="btn btn-ghost" href="/admin">
                관리자
              </a>
            </div>
          </>
        )}

        {step < 3 && (
          <p className="noprint" style={{ textAlign: 'center', marginTop: 26, fontSize: 13 }}>
            <a href="/admin" style={{ color: '#6d6a63' }}>
              관리자 화면
            </a>
          </p>
        )}
      </div>
    </>
  );
}
