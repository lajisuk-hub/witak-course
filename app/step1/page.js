'use client';

import { useEffect, useState } from 'react';
import { loadAll, patch, markDone } from '@/lib/store';
import ContactBar from '@/app/ContactBar';
import { buildDocHwpx, downloadBlob } from '@/lib/hwpx';
import { useMe } from '@/lib/auth';

// 질문 구성·문단 구조·문체 3종·목표 분량은
// 원장님의 "자기소개서 작성 도구 v0.6" 을 그대로 따른다.
const GROUPS = [
  {
    title: '기본 정보',
    desc: '자기소개서 첫머리에 쓰입니다.',
    fields: [
      { key: 'name', label: '성함', required: true, line: true, ph: '예) 라지숙' },
      {
        key: 'centerName',
        label: '지원하는 어린이집명',
        line: true,
        ph: '예) ○○구 ○○국공립어린이집',
      },
      {
        key: 'years',
        label: '현재 경력 연수',
        required: true,
        line: true,
        ph: '예) 보육교사 12년, 원장 5년',
      },
    ],
  },
  {
    title: '지원동기 · 운영철학',
    desc: '키워드 몇 개만 적으셔도 풍부한 문장으로 만들어 드립니다. 부담 없이 적어 주세요.',
    tip: '예) 공공성, 영아 가정 안정 보육, 지역사회 책임감 → 완성된 문장으로 바뀝니다.',
    fields: [
      {
        key: 'reason',
        label: '지원의 핵심 이유',
        required: true,
        hint: '가장 결정적인 동기. 키워드만 적으셔도 됩니다.',
        ph: '키워드 예) 공공성, 영아 가정 보육, 지역사회 책임감\n또는 문장으로) 15년 민간 현장에서 보육의 공공성을 절감해 왔습니다.',
      },
      {
        key: 'philosophy',
        label: '본인의 보육철학',
        required: true,
        hint: '한 문장 또는 키워드로 짧고 명료하게.',
        ph: '키워드 예) 안정 애착, 기다려주는 어른\n또는 문장으로) 아이는 스스로 자라는 힘을 가진 존재이며, 어른은 그 힘을 믿고 기다려주는 동반자입니다.',
      },
    ],
  },
  {
    title: '보육경력 · 전문성',
    desc: '키워드와 핵심 경력만 적어 주세요. 심사 기준에 맞는 문장으로 넓혀 드립니다.',
    tip: '전문 영역에 적으신 내용은 보건복지부 보육교직원 8대 직무역량과 연결해 드립니다.',
    fields: [
      {
        key: 'career',
        label: '주요 경력 요약',
        required: true,
        hint: '기간 · 기관 · 직책을 압축해서.',
        ph: '예) 2010~2020 ○○어린이집 보육교사·주임교사(만3세 담임 5년, 누리과정 운영 책임 5년), 2020~현재 ○○어린이집 원장(정원 80명, 평가인증 A등급 유지)',
      },
      {
        key: 'expertise',
        label: '본인이 가장 자신 있는 전문 영역',
        required: true,
        hint: '쉼표로 구분해 나열만 하셔도 됩니다.',
        ph: '키워드 예) 영아 애착 형성, 부모 상담, 교사 멘토링',
      },
      {
        key: 'achievement',
        label: '가장 자랑스러운 성과 한 가지',
        hint: '숫자나 눈에 띄는 변화가 있으면 더 좋습니다.',
        ph: '예) 부임 첫해 교사 퇴사율 30%였던 어린이집을 3년에 걸쳐 5%로 안정화시켰습니다.',
      },
    ],
  },
  {
    title: '운영 비전',
    desc: '키워드와 핵심 계획만 적어 주세요.',
    fields: [
      {
        key: 'slogan',
        label: '운영 슬로건',
        required: true,
        ph: '예) 아이의 속도를 존중하고 부모와 함께 자라는 어린이집',
      },
      {
        key: 'pillars',
        label: '운영의 3가지 축',
        required: true,
        hint: '영유아 · 부모 · 교사 측면에서 각각 한 줄씩 (키워드만 적으셔도 됩니다).',
        ph: '키워드 예)\n1. 영유아 - 안정애착, 적응 1:1 동행\n2. 부모 - 월 1회 부모참여, 부모 워크숍\n3. 교사 - 자율연구회, 휴게시간',
      },
      {
        key: 'firstYear',
        label: '위탁 첫 해(1년)에 반드시 정착시킬 것',
        required: true,
        ph: '키워드 예) 영아 적응 시스템, 부모회 활성화, 교사 멘토링',
      },
    ],
  },
];

const TONES = [
  { id: 'standard', name: '표준형', desc: '담백하고 정갈하게' },
  { id: 'warm', name: '진정성형', desc: '마음이 묻어나게' },
  { id: 'formal', name: '격식형', desc: '심사 서류답게' },
];

const SECTIONS = [
  { key: 'para1', title: '1. 지원동기 및 보육철학' },
  { key: 'para2', title: '2. 보육경력 및 전문성' },
  { key: 'para3', title: '3. 운영 비전 및 실행 계획' },
];

const SUBTITLE = '국공립어린이집 신규위탁 운영자 모집 지원서';
const ALL_FIELDS = GROUPS.flatMap((g) => g.fields);
const EMPTY = { para1: '', para2: '', para3: '', closing: '' };

export default function Step1() {
  const { me, ready: authed } = useMe();
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState(0); // 0 입력 · 1 결과

  const [form, setForm] = useState({});
  const [tone, setTone] = useState('standard');
  const [draft, setDraft] = useState(EMPTY);

  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [tocReady, setTocReady] = useState(false);

  useEffect(() => {
    if (!authed || !me) return;
    const d = loadAll();
    // 로그인·시작 인터뷰에서 이미 받은 내용을 미리 채워 둔다
    const pre = {
      name: d.profile?.name || me.name || '',
      career: d.answers?.career || '',
      reason: d.answers?.reason || '',
    };
    setTocReady(Array.isArray(d.items) && d.items.length > 0);
    setForm({ ...pre, ...(d.introForm || {}) });
    if (d.introTone) setTone(d.introTone);
    if (d.introDraft?.para1) {
      setDraft({ ...EMPTY, ...d.introDraft });
      setPhase(1);
    }
    setReady(true);
  }, [authed, me]);

  useEffect(() => {
    if (!ready) return;
    patch({ introForm: form, introTone: tone });
  }, [ready, form, tone]);

  const set = (k, v) => setForm({ ...form, [k]: v });
  const setPara = (k, v) => {
    const next = { ...draft, [k]: v };
    setDraft(next);
    patch({ introDraft: next });
  };

  const missing = ALL_FIELDS.filter((f) => f.required && !(form[f.key] || '').trim());
  const canWrite = missing.length === 0;

  async function ask(mode, nextTone) {
    const useTone = nextTone || tone;
    setError('');
    setBusy(
      mode === 'polish'
        ? '글을 다시 정리하는 중입니다... (30초쯤 걸립니다)'
        : '자기소개서를 쓰는 중입니다... (30초쯤 걸립니다)'
    );
    try {
      const res = await fetch('/api/intro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form, tone: useTone, current: draft, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '글을 만들지 못했습니다');
      setDraft(data.draft);
      patch({ introDraft: data.draft });
      setPhase(1);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  function changeTone(id) {
    setTone(id);
    if (draft.para1) ask('polish', id);
  }

  function save() {
    patch({ introDraft: draft });
    markDone(1);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function fullText() {
    let t = `자기소개서\n${SUBTITLE}\n`;
    SECTIONS.forEach((s) => {
      if (draft[s.key]) t += `\n■ ${s.title}\n${draft[s.key]}\n`;
    });
    if (draft.closing) t += `\n${draft.closing}\n`;
    t += `\n지원자  ${form.name || ''}  (인)`;
    return t;
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullText());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('복사에 실패했습니다. 글을 직접 끌어서 복사해 주세요.');
    }
  }

  async function download() {
    setError('');
    setBusy('한글 파일을 만드는 중입니다...');
    try {
      const blocks = [
        { kind: 'title', text: '자 기 소 개 서' },
        { kind: 'note', text: SUBTITLE },
        { kind: 'body', text: '' },
      ];
      SECTIONS.forEach((s) => {
        if (!draft[s.key]) return;
        blocks.push({ kind: 'head', text: s.title });
        blocks.push({ kind: 'body', text: draft[s.key] });
      });
      if (draft.closing) {
        blocks.push({ kind: 'body', text: '' });
        blocks.push({ kind: 'body', text: draft.closing });
      }
      blocks.push({ kind: 'body', text: '' });
      blocks.push({ kind: 'body', text: `지원자   ${form.name || ''}   (인)` });

      const blob = await buildDocHwpx({ blocks, onProgress: setBusy });
      const safe = (form.name || '지원자').replace(/[^\w가-힣]/g, '_');
      downloadBlob(blob, `자기소개서_${safe}.hwpx`);
      patch({ introDraft: draft });
      markDone(1);
    } catch (e) {
      setError('한글 파일 만들기 실패: ' + e.message);
    } finally {
      setBusy('');
    }
  }

  if (!authed || !me || !ready) return null;

  // 목차를 먼저 정리해야 차시로 들어올 수 있다
  if (!tocReady) {
    return (
      <>
        <div className="head">
          <h1>1차시 · 자기소개서 작성하기</h1>
          <p>먼저 하실 일이 있습니다</p>
          <a href="/">← 차시 목록으로</a>
        </div>
        <div className="wrap" style={{ maxWidth: 560 }}>
          <div className="card welcome">
            <h2>먼저 우리 지자체 목차를 정리해 주세요</h2>
            <p>
              자기소개서는 <b>통합 위탁 서류의 한 부분</b>으로 들어갑니다. 그래서 우리 지자체
              목차가 먼저 정해져야 어느 자리에 넣을지 알 수 있습니다.
              <br />
              0차시에서 <b>공고문의 목차를 올리고 문서에 반영</b>하신 뒤 다시 오세요.
            </p>
            <div className="row" style={{ marginTop: 14 }}>
              <a className="btn btn-gold" href="/toc">
                0차시 목차 만들기 하러 가기 →
              </a>
              <a className="btn btn-ghost" href="/">
                차시 목록으로
              </a>
            </div>
          </div>
        </div>
      </>
    );
  }

  const chars = (draft.para1 + draft.para2 + draft.para3 + draft.closing).replace(/\s/g, '').length;
  const pct = Math.min(100, Math.round((chars / 1400) * 100));

  return (
    <>
      <div className="head noprint">
        <h1>1차시 · 자기소개서 작성하기</h1>
        <p>키워드만 적으셔도 심사위원의 시선에 맞는 자기소개서로 만들어 드립니다</p>
        <a href="/">← 차시 목록으로</a>
      </div>

      <div className="wrap">
        <div className="steps noprint">
          <div className={phase === 0 ? 'on' : 'done'}>1. 키워드 적기</div>
          <div className={phase === 1 ? 'on' : ''}>2. 글 확인하고 내려받기</div>
        </div>

        {error && <div className="err">{error}</div>}

        {/* ── 입력 ── */}
        {phase === 0 && (
          <>
            {GROUPS.map((g) => (
              <div className="card" key={g.title}>
                <h2>{g.title}</h2>
                <p className="sub">{g.desc}</p>
                {g.tip && <div className="tip">{g.tip}</div>}

                {g.fields.map((f) => (
                  <div key={f.key}>
                    <label>
                      {f.label}
                      {f.required && <span className="req"> *</span>}
                    </label>
                    {f.hint && <div className="hint">{f.hint}</div>}
                    {f.line ? (
                      <input
                        type="text"
                        value={form[f.key] || ''}
                        onChange={(e) => set(f.key, e.target.value)}
                        placeholder={f.ph}
                      />
                    ) : (
                      <textarea
                        value={form[f.key] || ''}
                        onChange={(e) => set(f.key, e.target.value)}
                        placeholder={f.ph}
                        style={{ minHeight: 100 }}
                      />
                    )}
                  </div>
                ))}
              </div>
            ))}

            <div className="card">
              <h2>어떤 느낌으로 쓸까요?</h2>
              <p className="sub">나중에 언제든 바꿔 볼 수 있습니다.</p>
              <div className="tones">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    className={`tone ${tone === t.id ? 'on' : ''}`}
                    onClick={() => setTone(t.id)}
                  >
                    <b>{t.name}</b>
                    <span>{t.desc}</span>
                  </button>
                ))}
              </div>

              {busy && (
                <div className="info">
                  <span className="spin" style={{ borderColor: '#1a3a5c', borderTopColor: 'transparent' }} />
                  {busy}
                </div>
              )}

              <div className="foot-nav">
                <a className="btn btn-ghost" href="/">
                  나중에 하기
                </a>
                <button className="btn btn-gold" onClick={() => ask('write')} disabled={!!busy || !canWrite}>
                  자기소개서 정리하기
                </button>
              </div>
              {!canWrite && (
                <p style={{ textAlign: 'right', fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
                  아직 안 채운 칸: {missing.map((f) => f.label).join(', ')}
                </p>
              )}
            </div>
          </>
        )}

        {/* ── 결과 ── */}
        {phase === 1 && (
          <>
            <div className="card noprint">
              <h2>자기소개서 초안입니다</h2>
              <p className="sub">
                문단을 <b>직접 고치셔도 됩니다.</b> 고친 내용은 자동으로 저장됩니다.
              </p>

              <div className="tones">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    className={`tone ${tone === t.id ? 'on' : ''}`}
                    onClick={() => changeTone(t.id)}
                    disabled={!!busy}
                  >
                    <b>{t.name}</b>
                    <span>{t.desc}</span>
                  </button>
                ))}
              </div>

              <div className="meter">
                <span>총 분량</span>
                <b>{chars.toLocaleString()}자</b>
                <div className="bar">
                  <i style={{ width: pct + '%' }} />
                </div>
                <span className="target">목표 1,200~1,400자 (A4 한 장)</span>
                {chars > 0 && chars < 1100 && <span className="short">조금 짧습니다</span>}
                {chars > 1550 && <span className="short">조금 깁니다</span>}
              </div>

              {busy && (
                <div className="info">
                  <span className="spin" style={{ borderColor: '#1a3a5c', borderTopColor: 'transparent' }} />
                  {busy}
                </div>
              )}
              {saved && <div className="info">저장했습니다.</div>}

              <div className="row" style={{ marginTop: 4 }}>
                <button className="btn btn-gold" onClick={download} disabled={!!busy || !draft.para1}>
                  한글 파일(.hwpx)로 내려받기
                </button>
                <button className="btn btn-ghost" onClick={copy} disabled={!!busy}>
                  복사
                </button>
                <button className="btn btn-ghost" onClick={() => ask('polish')} disabled={!!busy}>
                  한 번 더 다듬기
                </button>
                <button className="btn btn-ghost" onClick={save} disabled={!!busy}>
                  저장하고 완료 표시
                </button>
                <button className="btn btn-ghost" onClick={() => window.print()} disabled={!!busy}>
                  인쇄 / PDF
                </button>
              </div>
            </div>

            {/* A4 미리보기 (여기서 바로 고칠 수 있다) */}
            <div className="a4">
              <div className="a4-title">자 기 소 개 서</div>
              <div className="a4-sub">{SUBTITLE}</div>

              {SECTIONS.map((s) => (
                <div className="a4-sec" key={s.key}>
                  <h4>{s.title}</h4>
                  <textarea
                    value={draft[s.key]}
                    onChange={(e) => setPara(s.key, e.target.value)}
                    placeholder="(내용을 작성해 주세요)"
                  />
                </div>
              ))}

              <div className="a4-sec">
                <h4>맺음말</h4>
                <textarea
                  value={draft.closing}
                  onChange={(e) => setPara('closing', e.target.value)}
                  placeholder="(내용을 작성해 주세요)"
                />
              </div>

              <div className="a4-sign">
                지원자&nbsp;&nbsp;<b>{form.name || ''}</b>&nbsp;&nbsp;(인)
              </div>
            </div>

            <div className="card welcome noprint">
              <h2>이 글은 문서 어디에 들어가나요?</h2>
              <p>
                여기서 만드신 자기소개서는 통합 위탁 서류의{' '}
                <b>&lsquo;위탁 운영자 상세내역(이력·경력 / 자기소개서)&rsquo;</b> 자리에 자동으로
                들어갑니다.
                <br />
                <a href="/toc">0차시 화면</a>에서 <b>한글 파일 내려받기</b>를 누르시면, 이 내용이
                합쳐진 문서 한 부를 받으실 수 있습니다. 나중에 여기로 돌아와 고치고 다시 받으셔도
                됩니다.
              </p>
            </div>

            <ContactBar />

            <div className="foot-nav noprint">
              <button className="btn btn-ghost" onClick={() => setPhase(0)}>
                키워드 고치기
              </button>
              <a className="btn btn-ghost" href="/">
                차시 목록으로
              </a>
            </div>
          </>
        )}
      </div>
    </>
  );
}
