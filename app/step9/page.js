'use client';

// 9차시 · 심사 발표자료(PPT) 만들기
// 수강생이 완성한 위탁 서류를 올리면, 원장님이 정한 10꼭지를 서류에서 뽑아
// 슬라이드 12장(표지·발표순서·10꼭지)과 4분 30초짜리 발표 대본을 만들어 준다.

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadAll, patch, markDone } from '@/lib/store';
import { useMe } from '@/lib/auth';
import ContactBar from '@/app/ContactBar';
import { downloadBlob } from '@/lib/formDoc';
import { readNoticeFile } from '@/lib/readFile';
import {
  PRESENT_SECTIONS,
  TOTAL_SECONDS,
  COVER_SECONDS,
  timeLabel,
  coverScript,
  estimateSeconds,
} from '@/lib/presentPlan';
import { buildPptxBlob, buildScriptText, preloadPptx } from '@/lib/presentDoc';

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';

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

export default function Step9() {
  const { me, ready: authed } = useMe();
  const [ready, setReady] = useState(false);

  const [sourceText, setSourceText] = useState('');
  const [fileName, setFileName] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [center, setCenter] = useState('');
  const [applicant, setApplicant] = useState('');
  const [city, setCity] = useState('');

  const [slides, setSlides] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState(null); // {type:'info'|'warn', text}
  const fileRef = useRef(null);

  useEffect(() => {
    if (!authed || !me) return;
    const d = loadAll();
    setCenter(d.center || '');
    setApplicant(d.applicant || me.name || '');
    setCity(d.city || '');

    const p = d.present;
    if (p && Array.isArray(p.slides) && p.slides.length) {
      setSlides(p.slides);
      if (p.fileName) setFileName(p.fileName);
    }
    // 8차시 면접 연습에서 이미 읽어 둔 서류가 있으면 그대로 쓴다
    const src = (p && p.sourceText) || (d.interview && d.interview.sourceText) || '';
    if (src) {
      setSourceText(src);
      if (!p?.fileName && d.interview?.fileName) setFileName(d.interview.fileName);
    }
    setReady(true);
  }, [authed, me]);

  // 결과가 생기면 파워포인트 도구를 미리 받아 둔다 (단추 누를 때 바로 저장되게)
  useEffect(() => {
    if (slides) preloadPptx();
  }, [slides]);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    const name = (file.name || '').toLowerCase();
    setError('');
    setFileName(file.name);
    setNote({ type: 'info', text: '서류를 읽는 중입니다...' });
    try {
      let text = '';
      if (name.endsWith('.pdf')) {
        await loadScript(PDFJS);
        const pdfjsLib = window.pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        let full = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          full += content.items.map((it) => it.str).join(' ') + '\n';
        }
        text = full.trim();
      } else {
        const r = await readNoticeFile(file);
        text = r.kind === 'text' ? r.text : '';
      }

      if (!text || text.length < 30) {
        setNote({
          type: 'warn',
          text: '글자를 거의 읽지 못했습니다. 사진으로 스캔한 파일일 수 있어요. 아래 칸에 내용을 붙여넣어 주세요.',
        });
        return;
      }
      setSourceText(text);
      patch({ present: { ...(loadAll().present || {}), sourceText: text, fileName: file.name } });
      setNote({
        type: 'info',
        text: `✅ 다 읽었습니다 — 약 ${text.length.toLocaleString()}자를 가져왔습니다.`,
      });
    } catch (err) {
      setNote({ type: 'warn', text: err.message });
    }
  }, []);

  async function make() {
    let src = sourceText;
    if (pasteText.trim().length > 30) {
      src = pasteText.trim();
      setSourceText(src);
    }
    if (!src || src.length < 30) {
      setError('먼저 완성한 위탁 서류를 올리시거나, 내용을 붙여넣어 주세요.');
      return;
    }
    setError('');
    setSlides(null);
    setBusy('서류를 읽고 발표자료를 만드는 중입니다... (40초쯤 걸립니다)');
    try {
      const body = { sourceText: src, center, applicant, city };
      const call = (part) =>
        fetch('/api/present', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, part }),
        }).then(async (r) => {
          const j = await r.json();
          if (!r.ok) throw new Error(j.error || '발표자료를 만들지 못했습니다.');
          return j.slides;
        });

      const [a, b] = await Promise.all([call(1), call(2)]);
      const all = [...a, ...b].sort((x, y) => x.no - y.no);
      if (all.length < PRESENT_SECTIONS.length) {
        setNote({
          type: 'warn',
          text: `${PRESENT_SECTIONS.length}꼭지 중 ${all.length}꼭지만 만들어졌습니다. 다시 한 번 눌러 주세요.`,
        });
      }
      setSlides(all);
      patch({
        present: { ...(loadAll().present || {}), slides: all, sourceText: src, fileName },
        center,
        applicant,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  function editScript(no, value) {
    setSlides((prev) => {
      const next = prev.map((s) => (s.no === no ? { ...s, script: value } : s));
      patch({ present: { ...(loadAll().present || {}), slides: next } });
      return next;
    });
  }

  async function getPptx() {
    setError('');
    try {
      const blob = await buildPptxBlob({ center, applicant, city, slides });
      downloadBlob(blob, `${(center || '어린이집').trim()}_발표자료.pptx`);
      markDone(9);
    } catch (err) {
      setError('발표자료 파일을 만들지 못했습니다: ' + err.message);
    }
  }

  function getScript() {
    const text = buildScriptText({ center, applicant, slides });
    // 한글이 깨지지 않게 BOM을 붙인다 (메모장에서 바로 열림)
    const blob = new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${(center || '어린이집').trim()}_발표대본.txt`);
  }

  if (!authed || !me || !ready) return null;

  // 지금 대본을 그대로 읽으면 몇 분 걸리는지
  const estTotal = slides
    ? estimateSeconds(coverScript(center, applicant)) +
      slides.reduce((sum, s) => sum + estimateSeconds(s.script), 0)
    : 0;

  return (
    <>
      <div className="head noprint">
        <h1>9차시 · 심사 발표자료(PPT) 만들기</h1>
        <p>완성한 서류에서 뽑아 발표자료와 대본을 만들어 드립니다</p>
        <a href="/">← 차시 목록으로</a>
      </div>

      <div className="wrap" style={{ maxWidth: 760 }}>
        {error && <div className="err">{error}</div>}

        <div className="card welcome noprint">
          <h2>완성한 위탁 서류를 올려 주세요</h2>
          <p>
            7차시에서 정리한 <b>전체 서류</b>를 올리시면, 그 안에서 아래 <b>10가지</b>를 뽑아
            발표자료를 만들어 드립니다. 발표 대본도 함께 만들며, <b>전체 시간은 {timeLabel(TOTAL_SECONDS)}</b>에
            맞춥니다.
          </p>
          <ol style={{ margin: '10px 0 0', paddingLeft: 22, lineHeight: 1.9, columns: 2 }}>
            {PRESENT_SECTIONS.map((s) => (
              <li key={s.no}>
                {s.title}
                {s.sub && <span style={{ color: 'var(--muted)', fontSize: 13 }}> ({s.sub})</span>}
              </li>
            ))}
          </ol>

          <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
            <label style={{ fontSize: 14, color: '#1a3a5c', fontWeight: 700 }}>
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
            <label style={{ fontSize: 14, color: '#1a3a5c', fontWeight: 700 }}>
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

          <div className="row" style={{ marginTop: 14, gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
              서류 파일 올리기 (PDF · 한글 .hwpx)
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.hwpx,.txt"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {fileName && (
              <span style={{ fontSize: 14, color: 'var(--muted)', alignSelf: 'center' }}>
                {fileName}
              </span>
            )}
          </div>

          {note && <div className={note.type === 'warn' ? 'warn' : 'info'}>{note.text}</div>}

          {sourceText && (
            <div className="info">
              올려 주신 서류 <b>{sourceText.length.toLocaleString()}자</b>를 가지고 만듭니다.
            </div>
          )}

          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer', color: '#1a3a5c', fontWeight: 700 }}>
              파일이 안 읽히면 여기에 내용을 붙여넣어 주세요
            </summary>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="한글 문서 내용을 전체 선택(Ctrl+A) → 복사(Ctrl+C) 해서 여기에 붙여넣어(Ctrl+V) 주세요."
              rows={6}
              style={{ width: '100%', marginTop: 8 }}
            />
          </details>

          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn btn-gold" onClick={make} disabled={!!busy}>
              {busy ? '만드는 중...' : '발표자료 만들기'}
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

        {slides && (
          <div className="card welcome">
            <h2 className="noprint">이렇게 만들어졌습니다</h2>
            <p className="noprint">
              슬라이드 <b>{slides.length + 2}장</b>(표지 · 발표순서 · 10꼭지)과 발표 대본입니다.
              대본은 아래에서 원장님 말투로 고치셔도 됩니다. 고친 내용이 그대로 파일에 들어갑니다.
            </p>
            <div className="info noprint">
              지금 대본을 또박또박 읽으면 <b>{timeLabel(estTotal)}</b>쯤 걸립니다. (목표{' '}
              {timeLabel(TOTAL_SECONDS)})
              {estTotal > TOTAL_SECONDS + 20 && ' — 조금 기니 덜 중요한 문장을 지워 주세요.'}
              {estTotal < TOTAL_SECONDS - 30 && ' — 조금 짧으니 하고 싶은 말을 더 넣으셔도 됩니다.'}
            </div>

            <div className="row noprint" style={{ marginTop: 12, gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-gold" onClick={getPptx}>
                발표자료 받기 (PPT)
              </button>
              <button className="btn btn-ghost" onClick={getScript}>
                대본만 받기 (글자 파일)
              </button>
              <button className="btn btn-ghost" onClick={() => window.print()}>
                대본 인쇄하기
              </button>
            </div>

            <div className="info noprint">
              PPT는 파워포인트에서 열어 사진과 글자를 마음대로 고치실 수 있습니다. 대본은 각 장의{' '}
              <b>슬라이드 노트</b>에도 함께 들어갑니다.
            </div>

            <div style={{ marginTop: 18, display: 'grid', gap: 14 }}>
              <div
                style={{
                  border: '1px solid #d8dee6',
                  borderRadius: 12,
                  padding: '14px 16px',
                  background: '#1a3a5c',
                  color: '#fff',
                }}
              >
                <div style={{ fontSize: 13, color: '#f0d9a8' }}>
                  표지 · {timeLabel(COVER_SECONDS)}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
                  {center || '○○어린이집'}
                </div>
                <div style={{ fontSize: 14, opacity: 0.9 }}>
                  위탁사업계획 발표 · 위탁 지원자 {applicant || '○○○'}
                </div>
                <div style={{ fontSize: 14, marginTop: 8, lineHeight: 1.7 }}>
                  {coverScript(center, applicant)}
                </div>
              </div>

              {slides.map((s) => (
                <div
                  key={s.no}
                  style={{
                    border: '1px solid #d8dee6',
                    borderRadius: 12,
                    padding: '14px 16px',
                    background: '#fff',
                  }}
                >
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {String(s.no).padStart(2, '0')} · 목표 {timeLabel(s.seconds)} · 지금 대본{' '}
                    {timeLabel(estimateSeconds(s.script))}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1a3a5c', marginTop: 2 }}>
                    {s.title}
                  </div>
                  {s.sub && (
                    <div style={{ fontSize: 14, color: '#2c5580', marginTop: 2 }}>{s.sub}</div>
                  )}
                  <ul style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.8 }}>
                    {(s.bullets || []).map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
                      발표할 때 읽을 말
                    </div>
                    <textarea
                      value={s.script || ''}
                      onChange={(e) => editScript(s.no, e.target.value)}
                      rows={3}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="row noprint" style={{ marginTop: 18, gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-gold" onClick={getPptx}>
                발표자료 받기 (PPT)
              </button>
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
