'use client';

// 8차시 · 면접 코칭 연습하기
// 원본 앱(lajisuk-hub/wmentor-interview-prep)을 이 사이트 안으로 옮겨 심었다.
// 달라진 점: 비밀번호 게이트 없음(이미 전화번호로 들어옴), 하루 10번 한도는 전화번호별로 셈,
//            연습 내용이 저장돼 다시 들어와도 남아 있음.

import { useState, useRef, useCallback, useEffect } from 'react';
import { loadAll, patch, markDone } from '@/lib/store';
import { useMe } from '@/lib/auth';
import ContactBar from '@/app/ContactBar';
import { DAILY_LIMIT } from '@/lib/interviewAreas';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.dataset.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('스크립트를 불러오지 못했습니다: ' + src));
    document.head.appendChild(s);
  });
}

function todayStr() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

export default function Step8() {
  const { me, ready: authed } = useMe();
  const [ready, setReady] = useState(false);

  const [usageCount, setUsageCount] = useState(0);
  const [screen, setScreen] = useState('setup'); // setup · interview · report
  const [phase, setPhase] = useState('choose'); // choose · question

  const [sourceText, setSourceText] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [fileName, setFileName] = useState('');
  const [note, setNote] = useState(null); // {type:'info'|'warn'|'loading', text}

  const [choice, setChoice] = useState(null); // recommend · custom
  const [keyword, setKeyword] = useState('');

  const [currentQ, setCurrentQ] = useState(null);
  const [qNumber, setQNumber] = useState(0);
  const [myAnswer, setMyAnswer] = useState('');
  const [answerResult, setAnswerResult] = useState(null);
  const [answers, setAnswers] = useState([]);

  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [exportMsg, setExportMsg] = useState(null);

  const recommendCountRef = useRef(0);
  const fileRef = useRef(null);

  const limitReached = usageCount >= DAILY_LIMIT;

  // ── 들어올 때: 하루 사용량과 지난번 연습 내용을 되살린다 ──
  useEffect(() => {
    if (!authed || !me) return;
    const d = loadAll();
    const u = d.interviewUsage;
    setUsageCount(u && u.date === todayStr() ? u.count : 0);

    const iv = d.interview;
    if (iv) {
      if (iv.sourceText) setSourceText(iv.sourceText);
      if (iv.fileName) setFileName(iv.fileName);
      if (Array.isArray(iv.answers) && iv.answers.length) {
        setAnswers(iv.answers);
        recommendCountRef.current = iv.recommendCount || 0;
        setQNumber(iv.answers.length);
      }
    }
    setReady(true);
  }, [authed, me]);

  function keep(part) {
    const d = loadAll();
    patch({ interview: { ...(d.interview || {}), ...part } });
  }

  function bumpUsage() {
    const next = usageCount + 1;
    setUsageCount(next);
    patch({ interviewUsage: { date: todayStr(), count: next } });
  }

  // ── PDF에서 글자 뽑기 ──
  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setNote({ type: 'warn', text: 'PDF 파일만 올릴 수 있습니다.' });
      return;
    }
    setFileName(file.name);
    setNote({ type: 'loading', text: 'PDF에서 글자를 읽는 중입니다...' });
    try {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
      const pdfjsLib = window.pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      let full = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        full += content.items.map((it) => it.str).join(' ') + '\n';
      }
      full = full.trim();

      if (full.length < 30) {
        setNote({
          type: 'warn',
          text: '글자를 거의 읽지 못했습니다. 사진으로 스캔한 PDF일 수 있어요. 아래 칸에 내용을 직접 붙여넣어 주세요.',
        });
        return;
      }
      setSourceText(full);
      keep({ sourceText: full, fileName: file.name });
      setNote({
        type: 'info',
        text: `✅ 다 읽었습니다 — 약 ${full.length.toLocaleString()}자를 가져왔습니다.`,
      });
    } catch (err) {
      setNote({ type: 'warn', text: 'PDF를 읽는 중 문제가 생겼습니다: ' + err.message });
    }
  }, []);

  function startInterview() {
    let src = sourceText;
    if (pasteText.trim().length > 30) {
      src = pasteText.trim();
      setSourceText(src);
      keep({ sourceText: src });
    }
    if (!src || src.length < 30) {
      if (!window.confirm('올린 자료가 없습니다.\n자료 없이 일반 면접 질문으로 진행할까요?')) return;
    }
    setError('');
    setChoice(null);
    setKeyword('');
    setScreen('interview');
    setPhase('choose');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function getQuestion() {
    if (limitReached) return;
    if (!choice) {
      setError('질문 방식을 골라 주세요.');
      return;
    }
    if (choice === 'custom' && keyword.trim().length < 2) {
      setError('연습하고 싶은 키워드나 질문을 적어 주세요.');
      return;
    }
    setError('');
    setBusy('심사위원이 질문을 만드는 중입니다...');
    try {
      const asked = answers.map((a) => a.question);
      const nextCount = choice === 'recommend' ? recommendCountRef.current + 1 : 0;
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: choice,
          sourceText,
          recommendCount: nextCount,
          keyword: keyword.trim(),
          askedQuestions: asked,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '질문을 만들지 못했습니다.');
      if (choice === 'recommend') {
        recommendCountRef.current = nextCount;
        keep({ recommendCount: nextCount });
      }
      bumpUsage();
      setCurrentQ(data);
      setQNumber((n) => n + 1);
      setMyAnswer('');
      setAnswerResult(null);
      setPhase('question');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function submitAnswer() {
    setError('');
    setBusy('추천 답안을 쓰는 중입니다...');
    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'answer',
          sourceText,
          question: currentQ.question,
          myAnswer: myAnswer.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '추천 답안을 만들지 못했습니다.');
      setAnswerResult(data);
      const row = {
        question: currentQ.question,
        category: currentQ.category,
        level: currentQ.level,
        source: currentQ.source,
        myAnswer: myAnswer.trim(),
        recommended: data.recommended,
        feedback: data.feedback,
      };
      const next = [...answers, row];
      setAnswers(next);
      keep({ answers: next });
      markDone(8); // 한 문제라도 답하면 이 차시는 시작한 것으로 표시
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  function endInterview() {
    setScreen('report');
    if (answers.length) markDone(8);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function restart() {
    if (!window.confirm('지금까지 연습한 질문과 답변을 지우고 처음부터 다시 할까요?')) return;
    setSourceText('');
    setPasteText('');
    setFileName('');
    setNote(null);
    setChoice(null);
    setKeyword('');
    setCurrentQ(null);
    setQNumber(0);
    setMyAnswer('');
    setAnswerResult(null);
    setAnswers([]);
    setExportMsg(null);
    recommendCountRef.current = 0;
    patch({ interview: null });
    setScreen('setup');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function exportPdf() {
    setExportMsg('인쇄 창이 열리면 프린터를 "PDF로 저장"으로 고르신 뒤 저장하세요.');
    setTimeout(() => window.print(), 400);
  }

  async function exportDocx() {
    setExportMsg('워드 문서를 만드는 중입니다...');
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js');
      await loadScript('https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js');
      const docx = window.docx;
      const saveAs = window.saveAs;
      if (!docx || !saveAs) throw new Error('문서 만들기 도구를 불러오지 못했습니다.');

      const { Document, Packer, Paragraph, TextRun, AlignmentType } = docx;
      const NAVY = '1A3A5C';
      const GOLD = 'C89B4A';
      const children = [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: '면접 코칭 연습 기록', bold: true, size: 36, color: NAVY }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
          children: [
            new TextRun({
              text: `${todayStr()} · ${me.name} 원장님 · 총 ${answers.length}개 질문`,
              size: 20,
              color: GOLD,
            }),
          ],
        }),
      ];

      answers.forEach((a, i) => {
        children.push(
          new Paragraph({
            spacing: { before: 300, after: 80 },
            children: [
              new TextRun({
                text: `Q${i + 1}. [${a.source === 'custom' ? '직접 질문' : '추천 질문'} · ${a.category} · ${a.level === 'easy' ? '쉬운 질문' : '복합 질문'}]`,
                bold: true,
                size: 20,
                color: GOLD,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({ text: a.question, bold: true, size: 24, color: NAVY })],
          }),
          new Paragraph({ children: [new TextRun({ text: '내 답변', bold: true, size: 20 })] }),
          new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({ text: a.myAnswer || '(답변 없음)', size: 20 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: '추천 답안', bold: true, size: 20, color: NAVY })],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({ text: a.recommended, size: 20 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: '피드백', bold: true, size: 20, color: GOLD })],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: a.feedback, size: 20 })],
          })
        );
      });

      const blob = await Packer.toBlob(new Document({ sections: [{ children }] }));
      saveAs(blob, `면접연습기록_${todayStr()}.docx`);
      setExportMsg('✅ 워드 문서를 저장했습니다.');
    } catch (err) {
      setExportMsg('⚠️ 문서를 만들지 못했습니다: ' + err.message + ' — [PDF로 저장]을 이용해 주세요.');
    }
  }

  if (!authed || !me || !ready) return null;

  const left = Math.max(0, DAILY_LIMIT - usageCount);

  return (
    <>
      <div className="head noprint">
        <h1>8차시 · 면접 코칭 연습하기</h1>
        <p>완성한 서류를 넣으면 그 내용으로 심사위원 질문을 연습합니다</p>
        <a href="/">← 차시 목록으로</a>
      </div>

      <div className="wrap" style={{ maxWidth: 820 }}>
        {error && <div className="err noprint">{error}</div>}

        <div className="info noprint" style={{ marginBottom: 12 }}>
          오늘 남은 질문 <b>{left}번</b> (하루 {DAILY_LIMIT}번까지). 날짜가 바뀌면 다시 채워집니다.
        </div>

        {limitReached && (
          <div className="warn noprint">
            <b>🌙 오늘 연습이 마감되었습니다.</b>
            <br />
            내일 다시 이용해 주세요. 지금까지 연습한 내용은 아래에서 계속 보실 수 있습니다.
          </div>
        )}

        {/* ── 1단계 : 자료 넣기 ── */}
        {screen === 'setup' && (
          <div className="card welcome">
            <h2>① 완성한 서류를 넣어 주세요 (PDF)</h2>
            <p>
              지금까지 만드신 <b>운영계획서·자기소개서·특색프로그램</b> 등을 <b>PDF로 저장</b>해서
              올리시면, 그 내용을 읽고 <b>우리 원에 맞는 면접 질문</b>을 만들어 드립니다.
              <br />
              자료가 없으면 그냥 넘어가셔도 됩니다. 일반적인 면접 질문으로 연습합니다.
            </p>

            {sourceText.length >= 30 && (
              <div className="info">
                <b>전에 넣으신 자료가 그대로 남아 있습니다</b> (약 {sourceText.length.toLocaleString()}
                자{fileName ? ` · ${fileName}` : ''}). 그대로 이어서 연습하시려면 아래{' '}
                <b>[모의 면접 시작하기]</b>를 누르세요. 새 자료로 바꾸시려면 아래에서 다시
                올리시면 됩니다.
              </div>
            )}

            <div
              className="drop"
              style={{ marginTop: 14, cursor: 'pointer' }}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
              }}
            >
              <p style={{ margin: '0 0 10px', fontSize: 15 }}>
                📑 <b>PDF 파일</b>을 고르거나 여기로 끌어다 놓으세요
              </p>
              <button className="btn btn-gold" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
                PDF 파일 고르기
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files.length && handleFile(e.target.files[0])}
              />
              {fileName && (
                <p style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--muted)' }}>
                  📎 {fileName}
                </p>
              )}
            </div>

            {note && (
              <div className={note.type === 'warn' ? 'warn' : 'info'} style={{ marginTop: 12 }}>
                {note.type === 'loading' && (
                  <span
                    className="spin"
                    style={{ borderColor: '#1a3a5c', borderTopColor: 'transparent' }}
                  />
                )}
                {note.text}
              </div>
            )}

            <div style={{ marginTop: 18 }}>
              <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#1a3a5c' }}>
                또는 내용을 직접 붙여넣기
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="서류 내용을 여기에 붙여넣으셔도 됩니다."
                style={{ width: '100%', minHeight: 110, padding: 12, fontSize: 15 }}
              />
            </div>

            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn btn-gold" onClick={startInterview}>
                모의 면접 시작하기 →
              </button>
              {answers.length > 0 && (
                <button className="btn btn-ghost" onClick={() => setScreen('report')}>
                  지난 연습 기록 보기 ({answers.length}개)
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── 2단계 : 질문 방식 고르기 ── */}
        {screen === 'interview' && phase === 'choose' && (
          <div className="card welcome">
            <h2>② 어떤 질문을 받으시겠어요?</h2>
            <p>질문마다 자유롭게 바꾸실 수 있습니다.</p>

            <div className="iv-choices">
              <button
                className={`iv-choice${choice === 'recommend' ? ' on' : ''}`}
                onClick={() => setChoice('recommend')}
              >
                <b>📋 추천 질문</b>
                <span>
                  원장 전문성 · 원 운영 · 특색프로그램 · 취약보육 · 예산서 · 교사 · 운영계획서 전반
                  <br />
                  7개 영역을 순서대로, 쉬운 질문과 복합 질문을 번갈아 내 드립니다.
                </span>
              </button>

              <button
                className={`iv-choice${choice === 'custom' ? ' on' : ''}`}
                onClick={() => setChoice('custom')}
              >
                <b>✏️ 직접 질문</b>
                <span>
                  걱정되는 주제를 적으시면 그 주제로 질문을 만들어 드립니다.
                  <br />
                  예) 아동학대 예방 · 학부모 민원 대응 · 교사 이직
                </span>
              </button>
            </div>

            {choice === 'custom' && (
              <div style={{ marginTop: 14 }}>
                <textarea
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="연습하고 싶은 키워드나 질문을 적어 주세요."
                  style={{ width: '100%', minHeight: 80, padding: 12, fontSize: 15 }}
                />
              </div>
            )}

            {busy && (
              <div className="info">
                <span
                  className="spin"
                  style={{ borderColor: '#1a3a5c', borderTopColor: 'transparent' }}
                />
                {busy}
              </div>
            )}

            <div className="row" style={{ marginTop: 16 }}>
              <button
                className="btn btn-gold"
                onClick={getQuestion}
                disabled={!!busy || limitReached}
              >
                {limitReached ? '오늘 이용 마감' : '질문 받기 →'}
              </button>
              <button className="btn btn-ghost" onClick={endInterview}>
                면접 끝내고 기록 보기
              </button>
            </div>
          </div>
        )}

        {/* ── 2단계 : 질문과 답변 ── */}
        {screen === 'interview' && phase === 'question' && currentQ && (
          <div className="card welcome">
            <div className="iv-meta">
              <span>{qNumber}번째 질문</span>
              <span className="badge">{currentQ.category}</span>
              <span className="badge ok">
                {currentQ.level === 'easy' ? '쉬운 질문' : '복합 질문'}
              </span>
            </div>

            <div className="iv-q">
              <div className="iv-q-label">심사위원 질문</div>
              <div className="iv-q-text">{currentQ.question}</div>
            </div>

            <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#1a3a5c' }}>나의 답변</p>
            <textarea
              value={myAnswer}
              onChange={(e) => setMyAnswer(e.target.value)}
              disabled={!!answerResult}
              placeholder="실제 면접처럼 구체적으로 답해 보세요."
              style={{ width: '100%', minHeight: 130, padding: 12, fontSize: 15 }}
            />

            {busy && (
              <div className="info">
                <span
                  className="spin"
                  style={{ borderColor: '#1a3a5c', borderTopColor: 'transparent' }}
                />
                {busy}
              </div>
            )}

            {!answerResult ? (
              <div className="row" style={{ marginTop: 14 }}>
                <button className="btn btn-gold" onClick={submitAnswer} disabled={!!busy}>
                  답변 내고 추천 답안 보기
                </button>
                <button className="btn btn-ghost" onClick={endInterview}>
                  면접 끝내기
                </button>
              </div>
            ) : (
              <>
                <div className="iv-a">
                  <div className="iv-a-label">✨ 추천 답안</div>
                  <div className="iv-body">{answerResult.recommended}</div>
                </div>
                <div className="iv-f">
                  <div className="iv-f-label">📝 내 답변 피드백</div>
                  <div className="iv-body">{answerResult.feedback}</div>
                </div>
                <div className="row" style={{ marginTop: 14 }}>
                  <button
                    className="btn btn-gold"
                    onClick={() => {
                      setChoice(null);
                      setKeyword('');
                      setPhase('choose');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    disabled={limitReached}
                  >
                    {limitReached ? '오늘 이용 마감' : '다음 질문 →'}
                  </button>
                  <button className="btn btn-ghost" onClick={endInterview}>
                    면접 끝내고 기록 보기
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── 3단계 : 연습 기록 ── */}
        {screen === 'report' && (
          <>
            <div className="card done-card noprint">
              <h2>연습 기록</h2>
              <p>
                지금까지 <b>{answers.length}개</b> 질문에 답하셨습니다. 아래에서 복습하시거나 파일로
                저장하세요. 이 기록은 다시 들어오셔도 남아 있습니다.
              </p>
              {answers.length > 0 && (
                <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
                  <button className="btn btn-gold btn-sm" onClick={exportPdf}>
                    📄 PDF로 저장
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={exportDocx}>
                    📝 워드로 저장
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>
                    🖨 인쇄
                  </button>
                </div>
              )}
              {exportMsg && <div className="info">{exportMsg}</div>}
              <div className="row" style={{ marginTop: 14 }}>
                <button
                  className="btn btn-gold"
                  onClick={() => {
                    setScreen('interview');
                    setPhase('choose');
                    setChoice(null);
                  }}
                  disabled={limitReached}
                >
                  {limitReached ? '오늘 이용 마감' : '이어서 더 연습하기 →'}
                </button>
                <button className="btn btn-ghost" onClick={restart}>
                  처음부터 다시 하기
                </button>
                <a className="btn btn-ghost" href="/">
                  메인으로 →
                </a>
              </div>
            </div>

            <div className="card">
              <h2>질문별 복습</h2>
              {answers.length === 0 ? (
                <p>아직 연습한 질문이 없습니다.</p>
              ) : (
                answers.map((a, i) => (
                  <div className="iv-item" key={i}>
                    <div className="iv-item-q">
                      Q{i + 1}. [{a.source === 'custom' ? '직접 질문' : '추천 질문'} · {a.category} ·{' '}
                      {a.level === 'easy' ? '쉬운 질문' : '복합 질문'}]
                      <br />
                      {a.question}
                    </div>
                    <div className="iv-item-mine">
                      <b>내 답변:</b> {a.myAnswer || '(답변 없음)'}
                    </div>
                    <div className="iv-a">
                      <div className="iv-a-label">✨ 추천 답안</div>
                      <div className="iv-body">{a.recommended}</div>
                    </div>
                    <div className="iv-f">
                      <div className="iv-f-label">📝 피드백</div>
                      <div className="iv-body">{a.feedback}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        <ContactBar />
      </div>
    </>
  );
}
