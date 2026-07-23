'use client';

import { useEffect, useRef, useState } from 'react';
import { loadAll, markDone } from '@/lib/store';
import { useMe } from '@/lib/auth';
import ContactBar from '@/app/ContactBar';
import { buildProgramDoc } from '@/lib/programDoc';
import { downloadBlob } from '@/lib/formDoc';

export default function Step3() {
  const { me, ready: authed } = useMe();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const frameRef = useRef(null);
  const wordRef = useRef(null);

  useEffect(() => {
    if (!authed || !me) return;
    setReady(true);
  }, [authed, me]);

  async function onWord(e) {
    const f = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!f) return;
    if (!/\.docx$/i.test(f.name)) {
      setError('워드 파일(.docx)만 올릴 수 있습니다. 프로그램 만들기에서 [Word 다운로드]로 받은 파일을 올려 주세요.');
      return;
    }

    setError('');
    setResult(null);
    setBusy('워드 파일을 읽는 중입니다...');
    try {
      const d = loadAll();
      const r = await buildProgramDoc({
        file: f,
        phone: me.phone,
        city: d.city,
        student: d.applicant || me.name,
        onProgress: setBusy,
      });
      downloadBlob(r.blob, r.name);
      markDone(3);
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
        <h1>3차시 · 연간–월간–하루일지 계획</h1>
        <p>연령별 특색놀이 프로그램의 목표·목적·연간 계획표를 만듭니다</p>
        <a href="/">← 차시 목록으로</a>
      </div>

      <div className="wrap" style={{ maxWidth: 1100 }}>
        {error && <div className="err">{error}</div>}

        <div className="card welcome">
          <h2>이렇게 하시면 됩니다</h2>
          <p>
            ① 아래 화면에서 <b>키워드 → 연령 → 프로그램명 → 목표·활동</b> 순서대로 답하시면 12개월
            연간 계획표가 자동으로 만들어집니다.
            <br />② 한 연령을 마치면 <b>[➕ 이 연령 저장하고 다른 연령 추가하기]</b>를 눌러 다음 연령을
            이어서 만드세요. (0~1세 → 2세 → 3세 … 원하는 만큼)
            <br />③ 연령을 다 담으셨으면 <b>[전체 연령 하나로 Word 저장]</b>을 누르세요. 담은 연령이
            모두 든 워드 파일 <b>하나</b>가 받아집니다.
            <br />④ 그 워드파일을 <b>맨 아래 칸에 올리시면</b>, 원장님 서식에 연령별 목표·목적·연간표가
            차례대로 채워진 한글 파일 <b>하나</b>가 만들어집니다.
          </p>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <iframe
            ref={frameRef}
            src="/program/index.html"
            title="연간계획 프로그램 만들기"
            style={{ width: '100%', height: '80vh', border: 'none', display: 'block' }}
          />
        </div>

        <div className="card done-card noprint">
          <h2>워드를 올리면 한글 연간계획으로 만들어 드립니다</h2>
          <p>
            위에서 <b>Word(.docx) 다운로드</b>로 받은 파일을 아래에 올리세요. 라지숙 소장 서식의{' '}
            <b>프로그램 목표·목적·연간 계획표</b>가 그대로 채워져 나옵니다.
          </p>

          <div className="drop" style={{ marginTop: 14 }}>
            <p style={{ margin: '0 0 12px' }}>
              프로그램 만들기에서 받은 <strong>워드(.docx)</strong> 파일
            </p>
            <button
              className="btn btn-gold"
              onClick={() => wordRef.current?.click()}
              disabled={!!busy}
            >
              워드 파일 고르기
            </button>
            <input
              ref={wordRef}
              type="file"
              accept=".docx"
              onChange={onWord}
              style={{ display: 'none' }}
            />
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

          {result && (
            <div className="info">
              <b>{result.name}</b> 을 받았습니다.
              <br />
              담긴 연령 프로그램 <b>{result.count}개</b>: {result.programNames.join(', ')}
              <br />
              연간 계획표 합계 {result.totalMonths}줄을 채웠습니다.
            </div>
          )}

          <div className="row" style={{ marginTop: 12 }}>
            <a className="btn btn-ghost" href="/">
              메인으로 →
            </a>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '10px 0 0' }}>
            ※ 파일 이름은 <b>지역_이름_연간계획.hwpx</b> 입니다. 내용을 고치신 뒤 워드를 다시 받아
            올리시면 몇 번이든 새로 만드실 수 있습니다.
          </p>
        </div>

        <ContactBar />
      </div>
    </>
  );
}
