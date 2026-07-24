'use client';

// 7차시 · 전체문서 정리하고 내용 보충
// (원장님 방침) 앱이 자동으로 합치지 않는다.
// 원장님이 관리자 화면에 올려 주신 **전체 문서 샘플(final)** 을 수강생이 내려받아,
// 그 안에 지금까지 차시별로 만든 문서를 직접 옮겨 정리한다.

import { useEffect, useState } from 'react';
import { markDone, loadDone } from '@/lib/store';
import { useMe } from '@/lib/auth';
import ContactBar from '@/app/ContactBar';
import { downloadBlob } from '@/lib/formDoc';
import { COURSE, CONTACT_LINE } from '@/lib/course';

export default function Step7() {
  const { me, ready: authed } = useMe();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [got, setGot] = useState(false);
  const [done, setDone] = useState({});

  useEffect(() => {
    if (!authed || !me) return;
    setDone(loadDone());
    setReady(true);
  }, [authed, me]);

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

  if (!authed || !me || !ready) return null;

  // 0~6차시 중 끝낸 것 / 아직 안 한 것
  const madeSteps = COURSE.filter((c) => c.no >= 0 && c.no <= 6);
  const finished = madeSteps.filter((c) => done[String(c.no)]);
  const left = madeSteps.filter((c) => !done[String(c.no)]);

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
