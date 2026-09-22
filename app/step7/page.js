'use client';

// 7차시 · 전체문서 정리하고 내용 보충
// (원장님 방침) 앱이 자동으로 합치지 않는다.
// 원장님이 관리자 화면에 올려 주신 **전체 문서 샘플(final)** 을 수강생이 내려받아,
// 그 안에 지금까지 차시별로 만든 문서를 직접 옮겨 정리한다.
//
// 정리를 마치고 PDF로 저장한 서류를 올리면 네 갈래로 점검해 준다 (2026-09-23 추가):
//   목차 맞춤 · 번호 순서 · 인터뷰 반영 · 위탁 서류로서의 매력 → 보완할 곳을 한눈에.

import { useCallback, useEffect, useRef, useState } from 'react';
import { markDone, loadDone, loadAll, patch } from '@/lib/store';
import { useMe } from '@/lib/auth';
import ContactBar from '@/app/ContactBar';
import { downloadBlob } from '@/lib/formDoc';
import { readNoticeFile } from '@/lib/readFile';
import { COURSE, CONTACT_LINE } from '@/lib/course';
import { VULN_AREAS } from '@/lib/vulnerableDoc';
import { AREAS, GRADES, STATUS, interviewText, mergeReview } from '@/lib/reviewPlan';

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.dataset.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('도구를 불러오지 못했습니다'));
    document.head.appendChild(s);
  });
}

/** PDF → 글자. 쪽마다 [쪽 N] 표시를 넣고, 줄 끝(hasEOL)은 줄바꿈으로 살린다. */
async function pdfToText(file) {
  await loadScript(PDFJS);
  const pdfjsLib = window.pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  let full = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let t = '';
    for (const it of content.items) {
      t += it.str;
      t += it.hasEOL ? '\n' : ' ';
    }
    full += `\n[쪽 ${i}]\n${t.replace(/[ \t]+\n/g, '\n').trim()}\n`;
  }
  return { text: full.trim(), pages: pdf.numPages };
}

function Badge({ text, map }) {
  const s = map[text] || { color: '#6d6a63', bg: '#f1efe9' };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 700,
        color: s.color,
        background: s.bg,
        whiteSpace: 'nowrap',
      }}
    >
      {s.label || text}
    </span>
  );
}

function Stars({ n }) {
  const v = Math.max(0, Math.min(5, Math.round(n || 0)));
  return (
    <span style={{ color: '#c89b4a', letterSpacing: 1, fontSize: 15 }} aria-label={`5점 만점에 ${v}점`}>
      {'★'.repeat(v)}
      <span style={{ color: '#d9d4c8' }}>{'★'.repeat(5 - v)}</span>
    </span>
  );
}

export default function Step7() {
  const { me, ready: authed } = useMe();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [got, setGot] = useState(false);
  const [done, setDone] = useState({});
  // 표지 만들기용 — 어린이집 이름 · 지원자 이름 (0차시에서 적으신 것을 그대로 가져온다)
  const [center, setCenter] = useState('');
  const [applicant, setApplicant] = useState('');
  const [copied, setCopied] = useState(false);

  // 완성 서류 점검
  const fileRef = useRef(null);
  const [srcText, setSrcText] = useState('');
  const [srcName, setSrcName] = useState('');
  const [srcPages, setSrcPages] = useState(0);
  const [note, setNote] = useState(null); // {type:'info'|'warn', text}
  const [checking, setChecking] = useState('');
  const [review, setReview] = useState(null); // {items, summaries, priorities, at, fileName}

  useEffect(() => {
    if (!authed || !me) return;
    setDone(loadDone());
    const d = loadAll();
    setCenter(d.center || '');
    setApplicant(d.applicant || me.name || '');
    if (d.review && d.review.summaries) setReview(d.review);
    setReady(true);
  }, [authed, me]);

  // 챗GPT에 넣을 문장
  const coverPrompt =
    `이 로고를 이용해서 ${(center || '00').trim()} 위탁사업계획서 ` +
    `지원자 ${(applicant || '000').trim()} A4 사이즈 표지를 만들어줘`;

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(coverPrompt);
    } catch {
      // 옛 브라우저에서도 복사되게 한다
      const t = document.createElement('textarea');
      t.value = coverPrompt;
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      document.body.removeChild(t);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function getSample() {
    setError('');
    setBusy('전체 문서 샘플을 불러오는 중입니다...');
    try {
      const t = await fetch(`/api/sample?kind=final&phone=${encodeURIComponent(me.phone)}`);
      const info = await t.json();
      if (!t.ok) {
        throw new Error(
          info.error || '아직 전체 문서 샘플이 올라오지 않았습니다. 라지숙 소장에게 문의해 주세요.'
        );
      }
      const res = await fetch(info.url);
      if (!res.ok) throw new Error('샘플을 받지 못했습니다');
      const blob = await res.blob();
      downloadBlob(blob, '전체문서_샘플.hwpx');
      markDone(7);
      setDone(loadDone());
      setGot(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  // ── 완성 서류 점검 ──────────────────────────────
  const handleFile = useCallback(async (file) => {
    if (!file) return;
    const name = (file.name || '').toLowerCase();
    setError('');
    setReview(null);
    setSrcName(file.name);
    setNote({ type: 'info', text: '서류를 읽는 중입니다...' });
    try {
      let text = '';
      let pages = 0;
      if (name.endsWith('.pdf')) {
        const r = await pdfToText(file);
        text = r.text;
        pages = r.pages;
      } else {
        const r = await readNoticeFile(file);
        text = r.kind === 'text' ? r.text : '';
      }
      // 글자가 거의 없으면 사진으로 저장한 PDF다
      if (!text || text.replace(/\[쪽 \d+\]/g, '').trim().length < 300) {
        setSrcText('');
        setNote({
          type: 'warn',
          text: '글자를 거의 읽지 못했습니다. 한글에서 [인쇄 → PDF로 저장]이 아니라 [파일 → PDF로 저장하기]로 저장한 파일을 올려 주세요. 사진으로 스캔한 파일은 읽을 수 없습니다.',
        });
        return;
      }
      setSrcText(text);
      setSrcPages(pages);
      setNote({
        type: 'info',
        text: `✅ 다 읽었습니다 — ${pages ? `${pages}쪽, ` : ''}약 ${text.length.toLocaleString()}자. 아래 [서류 점검받기]를 눌러 주세요.`,
      });
    } catch (err) {
      setNote({ type: 'warn', text: err.message });
    }
  }, []);

  async function runReview() {
    if (!srcText) {
      setError('먼저 정리한 서류(PDF)를 올려 주세요.');
      return;
    }
    setError('');
    setReview(null);
    setChecking('서류 전체를 읽고 네 갈래로 살펴보는 중입니다... (40초쯤 걸립니다)');
    try {
      const d = loadAll();
      const vulnAreas = (Array.isArray(d.vulnPicked) ? d.vulnPicked : [])
        .map((k) => (VULN_AREAS.find((a) => a.key === k) || {}).label)
        .filter(Boolean);
      const base = {
        sourceText: srcText,
        toc: Array.isArray(d.items) ? d.items.map((it) => it.name) : [],
        interview: interviewText(d, vulnAreas),
        center: d.center || center,
        applicant: d.applicant || applicant,
        city: d.city || '',
      };
      const call = (part) =>
        fetch('/api/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...base, part }),
        }).then(async (r) => {
          const j = await r.json();
          if (!r.ok) throw new Error(j.error || '점검하지 못했습니다.');
          return j;
        });

      const [a, b] = await Promise.all([call('structure'), call('content')]);
      const merged = {
        ...mergeReview(a, b),
        truncated: !!(a.truncated || b.truncated),
        fileName: srcName,
        pages: srcPages,
        chars: srcText.length,
        tocCount: base.toc.length,
        hasInterview: !!base.interview,
        at: new Date().toISOString(),
      };
      setReview(merged);
      patch({ review: merged });
      setTimeout(() => {
        document.getElementById('review-result')?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking('');
    }
  }

  function printReview() {
    document.body.classList.add('print-review');
    const off = () => {
      document.body.classList.remove('print-review');
      window.removeEventListener('afterprint', off);
    };
    window.addEventListener('afterprint', off);
    window.print();
  }

  if (!authed || !me || !ready) return null;

  // 0~6차시 중 끝낸 것 / 아직 안 한 것
  const madeSteps = COURSE.filter((c) => c.no >= 0 && c.no <= 6);
  const finished = madeSteps.filter((c) => done[String(c.no)]);
  const left = madeSteps.filter((c) => !done[String(c.no)]);

  const byArea = (key) => {
    const rows = review ? review.items.filter((it) => it.area === key) : [];
    // '문제 없음' 줄은 다른 문제가 하나도 없을 때만 보여 준다
    return rows.length > 1 ? rows.filter((it) => !/문제\s*없음/.test(it.name)) : rows;
  };
  const strengths = byArea('매력').filter((it) => /강점/.test(it.name));
  const fixes = byArea('매력').filter((it) => !/강점/.test(it.name));
  const needFix = review
    ? review.items.filter((it) => /^(없음|안됨|문제|보완|순서다름|부족|일부반영)$/.test(it.status)).length
    : 0;

  return (
    <>
      <div className="head noprint">
        <h1>7차시 · 전체문서 정리하고 내용 보충</h1>
        <p>지금까지 만든 문서를 하나의 제출 서류로 정리합니다</p>
        <a href="/">← 차시 목록으로</a>
      </div>

      <div className="wrap" style={{ maxWidth: 700 }}>
        {error && <div className="err">{error}</div>}

        <div className="card welcome">
          <h2>이 차시는 이렇게 진행합니다</h2>
          <p>
            아래 <b>[전체 문서 샘플 받기]</b>를 누르면 라지숙 소장이 준비한{' '}
            <b>전체 문서 한글 파일</b>을 받으실 수 있습니다.
            <br />
            지금까지 차시마다 만들어 받으신 한글 파일들을 <b>이 샘플 문서 안의 해당 자리에</b>{' '}
            복사해 붙여 넣어 정리하시면, 그것이 곧 제출 서류가 됩니다.
          </p>

          <div className="warn" style={{ marginTop: 12 }}>
            <b>보완이 필요한 부분은 꼭 요청해 주세요.</b>
            <br />
            정리하시다가 <b>내용이 비어 있거나 부족한 부분</b>, <b>우리 원에 맞게 고쳐야 할 부분</b>
            이 보이면 혼자 끙끙대지 마시고 반드시 알려 주세요. 그 부분만 따로 봐 드립니다.
            <br />
            {CONTACT_LINE}
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn btn-gold" onClick={getSample} disabled={!!busy}>
              {busy ? '불러오는 중...' : '전체 문서 샘플 받기 (한글 .hwpx)'}
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

          {got && (
            <div className="info">
              전체 문서 샘플을 받았습니다. 한글에서 열어, 지금까지 만든 문서를 자리에 맞게 옮겨
              정리해 주세요.
            </div>
          )}
        </div>

        {/* ── 완성 서류 점검 ── */}
        <div className="card welcome review-card" id="review">
          <h2>정리를 마쳤으면 서류를 점검받으세요</h2>
          <p>
            한글에서 정리한 전체 서류를 <b>[파일 → PDF로 저장하기]</b>로 저장한 뒤 여기에 올리면,
            네 갈래로 살펴 <b>보완할 곳을 한눈에</b> 알려 드립니다.
          </p>
          <ul style={{ margin: '10px 0 0', paddingLeft: 20, lineHeight: 1.9, fontSize: 14.5 }}>
            {AREAS.map((a) => (
              <li key={a.key}>
                <b>{a.title}</b> — {a.desc}
              </li>
            ))}
          </ul>

          <div className="row" style={{ marginTop: 16, gap: 8, flexWrap: 'wrap' }}>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.hwpx"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files && e.target.files[0])}
            />
            <button
              className="btn btn-ghost"
              onClick={() => fileRef.current && fileRef.current.click()}
              disabled={!!checking}
            >
              정리한 서류 올리기 (PDF · 한글 .hwpx)
            </button>
            <button
              className="btn btn-gold"
              onClick={runReview}
              disabled={!srcText || !!checking}
            >
              {checking ? '살펴보는 중...' : '서류 점검받기'}
            </button>
          </div>

          {note && <div className={note.type === 'warn' ? 'warn' : 'info'}>{note.text}</div>}

          {checking && (
            <div className="info">
              <span
                className="spin"
                style={{ borderColor: '#1a3a5c', borderTopColor: 'transparent' }}
              />
              {checking}
            </div>
          )}

          {review && (
            <div id="review-result" style={{ marginTop: 18 }}>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
                {review.fileName ? `${review.fileName} · ` : ''}
                {review.pages ? `${review.pages}쪽 · ` : ''}
                {new Date(review.at).toLocaleString('ko-KR')} 점검
                {review.tocCount ? '' : ' · 0차시 목차가 없어 서류 안의 목차 쪽을 기준으로 봤습니다'}
              </div>

              {review.truncated && (
                <div className="warn">
                  서류가 너무 길어 앞 15만 자까지만 살폈습니다. 뒤쪽은 나눠서 다시 올려 주세요.
                </div>
              )}

              {/* 네 갈래 한눈에 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 10,
                }}
              >
                {AREAS.map((a) => {
                  const s = review.summaries[a.key];
                  const g = s ? GRADES[s.grade] || GRADES['보통'] : null;
                  return (
                    <div
                      key={a.key}
                      style={{
                        border: `1px solid ${g ? g.color : '#e3ddd2'}`,
                        background: g ? g.bg : '#fff',
                        borderRadius: 12,
                        padding: '12px 14px',
                      }}
                    >
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>{a.title}</div>
                      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800, color: g ? g.color : '#6d6a63' }}>
                        {g ? g.label : '—'}
                      </div>
                      {a.key === '매력' && s && s.score > 0 && (
                        <div style={{ marginTop: 2 }}>
                          <Stars n={s.score} />{' '}
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{s.score}/5</span>
                        </div>
                      )}
                      {s && s.text && (
                        <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>
                          {s.text}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 지금 바로 고칠 것 */}
              {review.priorities.length > 0 && (
                <div className="warn" style={{ marginTop: 14 }}>
                  <b>지금 바로 고칠 것 {needFix ? `(보완 표시 ${needFix}곳)` : ''}</b>
                  <ol style={{ margin: '6px 0 0', paddingLeft: 20, lineHeight: 1.8 }}>
                    {review.priorities.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* 목차 대조표 */}
              <ReviewTable
                title="① 목차에 맞게 정리됐나"
                rows={byArea('목차')}
                empty="목차 대조 결과가 없습니다."
              />

              {/* 번호 순서 */}
              <ReviewTable
                title="② 번호 순서가 맞나"
                rows={byArea('번호')}
                empty="번호 순서에서 문제를 찾지 못했습니다."
              />

              {/* 인터뷰 반영 */}
              <ReviewTable
                title="③ 인터뷰 내용이 반영됐나"
                rows={byArea('인터뷰')}
                empty={
                  review.hasInterview
                    ? '인터뷰 반영 결과가 없습니다.'
                    : '앱에 적어 둔 인터뷰가 없습니다. 1차시 자기소개서 인터뷰를 먼저 적으시면 대조해 드립니다.'
                }
              />

              {/* 매력 */}
              <div style={{ marginTop: 18 }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 16, color: 'var(--navy)' }}>
                  ④ 위탁 서류로서 매력적인가
                </h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: 10,
                  }}
                >
                  <div style={{ background: '#eaf5ef', borderRadius: 10, padding: '10px 14px' }}>
                    <b style={{ color: '#2e7d5b' }}>잘 살린 부분</b>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.7, fontSize: 14 }}>
                      {strengths.length ? (
                        strengths.map((it, i) => (
                          <li key={i}>
                            {it.note}
                            {it.page && <span style={{ color: 'var(--muted)' }}> ({it.page}쪽)</span>}
                          </li>
                        ))
                      ) : (
                        <li>—</li>
                      )}
                    </ul>
                  </div>
                  <div style={{ background: '#fdf0e4', borderRadius: 10, padding: '10px 14px' }}>
                    <b style={{ color: '#b5651d' }}>고치면 더 좋아질 부분</b>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.7, fontSize: 14 }}>
                      {fixes.length ? (
                        fixes.map((it, i) => (
                          <li key={i}>
                            {it.note}
                            {it.page && <span style={{ color: 'var(--muted)' }}> ({it.page}쪽)</span>}
                          </li>
                        ))
                      ) : (
                        <li>—</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="row noprint" style={{ marginTop: 16, gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-ghost" onClick={printReview}>
                  점검 결과 인쇄하기
                </button>
                <button className="btn btn-ghost" onClick={runReview} disabled={!srcText || !!checking}>
                  다시 점검받기
                </button>
              </div>
              <p style={{ marginTop: 10, fontSize: 13, color: 'var(--muted)' }}>
                고친 뒤 다시 PDF로 저장해 올리면 몇 번이든 다시 점검받을 수 있습니다. 결과는 AI가
                본 것이니 참고하시고, 판단이 어려우면 라지숙 소장에게 물어보세요.
              </p>
            </div>
          )}
        </div>

        <div className="card welcome">
          <h2>표지도 만들어 붙이세요 (챗GPT)</h2>
          <p>
            우리 <b>시·군·구 로고</b>를 넣은 표지를 챗GPT가 그려 줍니다. 아래 순서대로만 하시면
            됩니다.
          </p>
          <ol style={{ margin: '10px 0 0', paddingLeft: 20, lineHeight: 2 }}>
            <li>
              우리 <b>시·군·구 누리집</b>에서 로고(심벌·마크) 그림을 컴퓨터에 저장합니다.
            </li>
            <li>
              <b>챗GPT</b>를 열고, 저장한 <b>로고 그림을 올립니다.</b>
            </li>
            <li>
              아래 <b>[문장 복사하기]</b>를 눌러 챗GPT 입력칸에 붙여 넣고 보냅니다.
            </li>
            <li>만들어진 표지 그림을 저장해 전체 문서 맨 앞에 넣으시면 됩니다.</li>
          </ol>

          <figure style={{ margin: '14px 0 0' }}>
            <img
              src="/cover-sample.png"
              alt="챗GPT에 화성특례시 로고를 올리고 문장을 넣어 만든 표지 예시"
              style={{
                width: '100%',
                maxWidth: 540,
                display: 'block',
                borderRadius: 10,
                border: '1px solid #d8dee6',
              }}
            />
            <figcaption style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
              라지숙 소장이 실제로 해 본 화면입니다. <b>로고 그림을 올리고</b> 아래 문장을 넣었더니
              이런 표지가 나왔습니다.
            </figcaption>
          </figure>

          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
            <label style={{ display: 'block', fontSize: 14, color: '#1a3a5c', fontWeight: 700 }}>
              어린이집 이름
              <input
                type="text"
                value={center}
                placeholder="예) 멘토어린이집"
                onChange={(e) => {
                  setCenter(e.target.value);
                  patch({ center: e.target.value });
                }}
                style={{ width: '100%', marginTop: 4, fontWeight: 400 }}
              />
            </label>
            <label style={{ display: 'block', fontSize: 14, color: '#1a3a5c', fontWeight: 700 }}>
              지원자 이름
              <input
                type="text"
                value={applicant}
                placeholder="예) 라지숙"
                onChange={(e) => {
                  setApplicant(e.target.value);
                  patch({ applicant: e.target.value });
                }}
                style={{ width: '100%', marginTop: 4, fontWeight: 400 }}
              />
            </label>
          </div>

          <div
            style={{
              marginTop: 12,
              padding: '12px 14px',
              background: '#f6f8fb',
              border: '1px solid #d8dee6',
              borderRadius: 10,
              fontSize: 15,
              lineHeight: 1.7,
              color: '#1a3a5c',
            }}
          >
            {coverPrompt}
          </div>

          <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-gold" onClick={copyPrompt}>
              {copied ? '복사했습니다 ✓' : '문장 복사하기'}
            </button>
            <a
              className="btn btn-ghost"
              href="https://chatgpt.com/"
              target="_blank"
              rel="noreferrer"
            >
              챗GPT 열기 →
            </a>
          </div>

          {copied && (
            <div className="info">
              문장을 복사했습니다. 챗GPT에 <b>로고 그림을 먼저 올린 뒤</b> 입력칸을 누르고
              <b> Ctrl + V</b>로 붙여 넣어 주세요.
            </div>
          )}
        </div>

        <div className="card welcome">
          <h2>지금까지 만드신 문서</h2>
          {finished.length === 0 ? (
            <p>아직 완성한 차시가 없습니다. 0차시부터 하나씩 진행해 주세요.</p>
          ) : (
            <ul style={{ margin: '6px 0 0', paddingLeft: 20, lineHeight: 1.9 }}>
              {finished.map((c) => (
                <li key={c.no}>
                  <b>✓ {c.no}차시</b> · {c.title}
                </li>
              ))}
            </ul>
          )}

          {left.length > 0 && (
            <>
              <p style={{ marginTop: 14 }}>
                <b>아직 남은 차시</b>입니다. 여기부터 마저 하시면 전체 문서가 채워집니다.
              </p>
              <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                {left.map((c) => (
                  <a className="btn btn-ghost btn-sm" key={c.no} href={c.href || '/'}>
                    {c.no}차시 {c.title} →
                  </a>
                ))}
              </div>
            </>
          )}

          <div className="row" style={{ marginTop: 16 }}>
            <a className="btn btn-ghost" href="/">
              메인으로 →
            </a>
          </div>
        </div>

        <ContactBar />
      </div>
    </>
  );
}

/** 항목 | 상태 | 쪽 | 설명 표 */
function ReviewTable({ title, rows, empty }) {
  return (
    <div style={{ marginTop: 18 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 16, color: 'var(--navy)' }}>{title}</h3>
      {rows.length === 0 ? (
        <div className="info" style={{ margin: 0 }}>{empty}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 14,
              background: '#fff',
              border: '1px solid var(--line)',
              borderRadius: 10,
            }}
          >
            <thead>
              <tr style={{ background: '#f4f1ea', color: 'var(--navy)' }}>
                <th style={{ textAlign: 'left', padding: '8px 10px', width: '32%' }}>항목</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', width: 90 }}>상태</th>
                <th style={{ textAlign: 'left', padding: '8px 10px', width: 50 }}>쪽</th>
                <th style={{ textAlign: 'left', padding: '8px 10px' }}>설명</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((it, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 600, verticalAlign: 'top' }}>{it.name}</td>
                  <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                    <Badge text={it.status} map={STATUS} />
                  </td>
                  <td style={{ padding: '8px 10px', verticalAlign: 'top', color: 'var(--muted)' }}>
                    {it.page || '-'}
                  </td>
                  <td style={{ padding: '8px 10px', verticalAlign: 'top', lineHeight: 1.6 }}>{it.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
