'use client';

import { useEffect, useRef, useState } from 'react';
import { DEFAULT_SECTIONS } from '@/lib/sampleSections';
import { loadAll, patch, loadSections, markDone } from '@/lib/store';
import { readNoticeFile } from '@/lib/readFile';
import { buildFormDoc, downloadBlob } from '@/lib/formDoc';
import { useMe } from '@/lib/auth';
import { DEFAULT_SETTING, FONTS, describeSetting, isEmptySetting } from '@/lib/docSetting';

const STEPS = ['1. 기본 정보', '2. 공고문 목차 올리기', '3. 목차 확인·수정', '4. 문서에 반영'];

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
  const [setting, setSetting] = useState(DEFAULT_SETTING); // 지자체가 정한 문서 설정
  const [showUnused, setShowUnused] = useState(false);
  const fileRef = useRef(null);

  // 저장된 내용 불러오기
  useEffect(() => {
    if (!authed || !me) return;
    const d = loadAll();
    setSections(loadSections(DEFAULT_SECTIONS));
    if (d.city) setCity(d.city);
    if (d.center) setCenter(d.center);
    setApplicant(d.applicant || me.name || '');
    if (d.setting) setSetting({ ...DEFAULT_SETTING, ...d.setting });
    if (Array.isArray(d.items) && d.items.length) {
      setItems(d.items);
      setStep(3);
    }
    setReady(true);
  }, [authed, me]);

  // 자동 저장
  useEffect(() => {
    if (!ready) return;
    patch({ city, center, applicant, items, setting });
  }, [ready, city, center, applicant, items, setting]);

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
      if (data.setting) setSetting({ ...DEFAULT_SETTING, ...data.setting });
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

  // 목차 문서 만들기 — 원장님이 올린 "목차 서식"의 글꼴·여백을 그대로 쓴다
  async function download() {
    setError('');
    setBusy('목차 문서를 만드는 중입니다...');
    try {
      const blocks = [
        { kind: 'title', text: '목       차' },
        { kind: 'body', text: '' },
        ...items.map((it, i) => ({ kind: 'body', text: `${i + 1}.  ${it.name}` })),
      ];
      const { blob, name } = await buildFormDoc({
        kind: 'toc',
        phone: me.phone,
        blocks,
        city,
        student: applicant || me.name,
        docName: '목차',
        onProgress: setBusy,
      });
      downloadBlob(blob, name);
      markDone(0);
    } catch (e) {
      setError('목차 문서 만들기 실패: ' + e.message);
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
                  placeholder="예) 충주"
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
              placeholder="예) 라지숙"
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
            <h2>내가 위탁받고자 하는 지역의 목차를 PDF로 올려 주세요</h2>
            <p className="sub">
              공고문에서 <b>제출서류 목차가 들어 있는 부분</b>을 올려 주시면, 제가 읽어서 정리해
              드립니다. 공고문 전체를 올리셔도 됩니다.
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
            <h2>공고문을 읽어 목차를 이렇게 정리했습니다</h2>
            <div className="info" style={{ marginTop: 0 }}>
              <b>이 목차를 그대로 사용하시겠습니까? 아니면 수정하시겠습니까?</b>
              <br />
              그대로 쓰시려면 맨 아래 <b>이 목차로 문서에 반영하기</b>를 누르세요.
              <br />
              고치시려면 아래에서 <b>이름을 고치거나, 순서를 바꾸거나, 항목을 더하고 빼신 뒤</b>{' '}
              누르시면 됩니다.
            </div>

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

            <h3 className="mini" style={{ marginTop: 26 }}>
              문서 설정 (글꼴 · 여백)
            </h3>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: '0 0 12px' }}>
              지자체마다 <b>글꼴과 여백을 정해 두는 경우</b>가 많습니다. 공고문에서 찾은 것을
              넣어 두었습니다. 틀리면 고쳐 주세요.{' '}
              <b>비워 두면 원장님 샘플 문서 그대로</b> 만들어집니다.
            </p>

            <div className="grid2">
              <div>
                <label>글꼴</label>
                <select
                  value={setting.font}
                  onChange={(e) => setSetting({ ...setting, font: e.target.value })}
                >
                  <option value="">샘플 그대로</option>
                  {FONTS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>본문 글자 크기 (pt)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={setting.size || ''}
                  onChange={(e) =>
                    setSetting({ ...setting, size: Number(e.target.value.replace(/\D/g, '')) || 0 })
                  }
                  placeholder="예) 12 · 비우면 샘플 그대로"
                />
              </div>
              <div>
                <label>줄간격 (%)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={setting.lineSpacing || ''}
                  onChange={(e) =>
                    setSetting({
                      ...setting,
                      lineSpacing: Number(e.target.value.replace(/\D/g, '')) || 0,
                    })
                  }
                  placeholder="예) 160 · 비우면 샘플 그대로"
                />
              </div>
              <div>
                <label>용지 여백 (mm · 상하좌우)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={setting.margin || ''}
                  onChange={(e) =>
                    setSetting({ ...setting, margin: Number(e.target.value.replace(/\D/g, '')) || 0 })
                  }
                  placeholder="예) 20 · 비우면 샘플 그대로"
                />
              </div>
            </div>

            <div className="info" style={{ marginTop: 12 }}>
              지금 설정: <b>{describeSetting(setting)}</b>
              <br />※ 표 안의 글씨와 그림은 샘플 모양 그대로 둡니다. 표가 깨지지 않게 하기
              위해서입니다.
            </div>

            <div className="foot-nav">
              <button className="btn btn-ghost" onClick={() => setStep(1)}>
                이전
              </button>
              <button
                className="btn btn-gold"
                onClick={() => {
                  markDone(0);
                  setStep(3);
                  window.scrollTo({ top: 0 });
                }}
                disabled={!items.length}
              >
                이 목차로 문서에 반영하기 →
              </button>
            </div>
          </div>
        )}

        {/* 4단계 ─ 문서 뼈대 */}
        {step === 3 && (
          <>
            <div className="card done-card">
              <h2>반영했습니다</h2>
              <p>
                원장님 <b>문서 샘플</b>을 {city || '우리 지자체'} 목차 순서(<b>{items.length}가지</b>)
                대로 다시 정리했습니다.
                <br />
                이제 <b>차시를 진행하시면 그 내용이 이 문서의 제자리에 채워집니다.</b>
              </p>
              <div className="row" style={{ marginTop: 14 }}>
                <a className="btn btn-gold" href="/">
                  메인 화면으로 돌아가기 →
                </a>
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: '10px 0 0' }}>
                메인 화면에서 <b>0차시가 완료</b>로 바뀌고, 다음 차시들이 열립니다. 거기서
                자기소개서부터 순서대로 진행하시면 됩니다.
              </p>
            </div>

            <div className="card">
              <h2>정리된 제출서류 {items.length}가지</h2>
              <p className="sub">
                아래 순서가 <b>{city || '우리 지자체'} 공고문이 요구하는 제출 순서</b>입니다.
              </p>

              {items.map((it, i) => (
                <div className="item" key={i}>
                  <div>
                    <span className="no">{i + 1}</span>
                    <span className="name">{it.name}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="card noprint">
              <h2>목차 문서 받기</h2>
              <p className="sub">
                라지숙 소장이 올려 주신 <b>목차 서식</b>(글꼴·여백)에 맞춰, 위 순서대로 정리된
                <b> 목차 문서</b>를 만들어 드립니다.
              </p>
              <div className="info">
                문서 설정: <b>{describeSetting(setting)}</b>
                {isEmptySetting(setting) && (
                  <>
                    <br />
                    지자체가 글꼴이나 여백을 정해 두었다면 <b>목차 다시 고치기</b>에서 넣어 주세요.
                  </>
                )}
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
              <div className="row">
                <button className="btn btn-gold" onClick={download} disabled={!!busy}>
                  목차 문서 내려받기
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
