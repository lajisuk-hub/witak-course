'use client';

// 3차시 · 연간–월간–하루일지 계획
// 우리 원에 있는 반(연령)을 고르면
//   · 표준보육과정 기본설명 (항상 포함)
//   · 고른 연령의 연간놀이계획안 (원장님 샘플 원본 그대로)
//   · 고른 연령의 월간보육계획안 · 하루 일과/보육일지 (앱이 만들어 넣는 샘플)
// 이 담긴 한글 문서를 만들어 드린다.

import { useEffect, useState } from 'react';
import { loadAll, patch, markDone } from '@/lib/store';
import { useMe } from '@/lib/auth';
import ContactBar from '@/app/ContactBar';
import { downloadBlob } from '@/lib/formDoc';
import { buildProgramPlanDoc, downloadWholeSample } from '@/lib/programPlanDoc';
import { PLAN_AGES } from '@/lib/planContent';

export default function Step3() {
  const { me, ready: authed } = useMe();
  const [ready, setReady] = useState(false);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [again, setAgain] = useState(false);
  // 연간놀이계획안을 'new'(열두 달 완성본) 로 할지 'sample'(원장님 원본 표) 로 할지
  const [yearPlan, setYearPlan] = useState('new');

  // 전에 고르신 연령을 그대로 다시 보여 준다
  useEffect(() => {
    if (!authed || !me) return;
    const d = loadAll();
    if (Array.isArray(d.planAges) && d.planAges.length) {
      setPicked(d.planAges);
      setAgain(true);
    }
    if (d.planYear === 'sample' || d.planYear === 'new') setYearPlan(d.planYear);
    setReady(true);
  }, [authed, me]);

  function toggle(key) {
    setResult(null);
    setPicked((p) => {
      const next = p.includes(key) ? p.filter((k) => k !== key) : [...p, key];
      patch({ planAges: next });
      return next;
    });
  }

  function allAges() {
    setResult(null);
    const next = PLAN_AGES.map((a) => a.key);
    patch({ planAges: next });
    setPicked(next);
  }

  async function make() {
    if (!picked.length) {
      setError('우리 원에 있는 반을 한 개 이상 골라 주세요.');
      return;
    }
    setError('');
    setResult(null);
    setBusy('문서를 만드는 중입니다...');
    try {
      const d = loadAll();
      const ordered = PLAN_AGES.filter((a) => picked.includes(a.key)).map((a) => a.key);
      const r = await buildProgramPlanDoc({
        ages: ordered,
        yearPlan,
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

  async function wholeSample() {
    setError('');
    setBusy('원장님 샘플을 불러오는 중입니다...');
    try {
      const blob = await downloadWholeSample(me.phone);
      downloadBlob(blob, '연간월간하루일지_원본샘플.hwpx');
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
        <p>개정 표준보육과정·놀이중심을 반영한 보육사업계획입니다</p>
        <a href="/">← 차시 목록으로</a>
      </div>

      <div className="wrap" style={{ maxWidth: 680 }}>
        {error && <div className="err">{error}</div>}

        {again && (
          <div className="info" style={{ marginBottom: 12 }}>
            <b>전에 고르신 반이 그대로 남아 있습니다.</b> 그대로 다시 받으셔도 되고, 체크를 고쳐서
            새로 만드셔도 됩니다.
          </div>
        )}

        <div className="card welcome">
          <h2>우리 원에 있는 반을 골라 주세요</h2>
          <p>
            고르신 연령에 맞춰 <b>연간 → 월간 → 하루일지</b>가 이어지는 한글 문서를 만들어
            드립니다.
            <br />
            <b>표준보육과정 기본설명</b>(구성방향·5개 영역·구성의 중점·평가·환류체계)은 심사 서류에
            꼭 들어가므로 <b>항상 함께</b> 들어갑니다.
          </p>

          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
            {PLAN_AGES.map((a) => {
              const on = picked.includes(a.key);
              return (
                <button
                  key={a.key}
                  onClick={() => toggle(a.key)}
                  className="drop"
                  style={{
                    textAlign: 'left',
                    cursor: 'pointer',
                    padding: '14px 16px',
                    border: on ? '2px solid #1a3a5c' : '1px solid #d8dee6',
                    background: on ? '#eaf0f7' : '#fff',
                    borderRadius: 12,
                    fontSize: 16,
                    color: '#1a3a5c',
                    fontWeight: on ? 700 : 500,
                  }}
                >
                  {on ? '☑' : '⬜'} {a.label} <span style={{ fontWeight: 400, fontSize: 14 }}>
                    ({a.band}반 · 연간 + 월간 + 하루일지)
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 8, fontSize: 14, color: 'var(--muted)' }}>
            고른 반: {picked.length}개{' '}
            <button
              onClick={allAges}
              style={{
                marginLeft: 6,
                border: 'none',
                background: 'none',
                color: '#1a3a5c',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              0~5세 모두 고르기
            </button>
          </div>

          <div style={{ marginTop: 18 }}>
            <b style={{ color: '#1a3a5c' }}>연간 놀이계획안은 어느 것으로 넣을까요?</b>
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              {[
                {
                  key: 'new',
                  title: '열두 달 완성본 (추천)',
                  desc:
                    '3월부터 이듬해 2월까지 열두 달을 모두 채우고, 달마다 표준보육과정 5개 영역·행사·안전교육·인성 프로그램을 함께 적은 표입니다.',
                },
                {
                  key: 'sample',
                  title: '라지숙 소장 원본 표 그대로',
                  desc:
                    '원장님이 올려 주신 연간놀이계획안 표를 그대로 넣습니다. (오타·문체만 다듬습니다)',
                },
              ].map((o) => {
                const on = yearPlan === o.key;
                return (
                  <button
                    key={o.key}
                    onClick={() => {
                      setResult(null);
                      setYearPlan(o.key);
                      patch({ planYear: o.key });
                    }}
                    className="drop"
                    style={{
                      textAlign: 'left',
                      cursor: 'pointer',
                      padding: '12px 14px',
                      border: on ? '2px solid #1a3a5c' : '1px solid #d8dee6',
                      background: on ? '#eaf0f7' : '#fff',
                      borderRadius: 12,
                      color: '#1a3a5c',
                    }}
                  >
                    <div style={{ fontWeight: on ? 700 : 600, fontSize: 15 }}>
                      {on ? '◉' : '○'} {o.title}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{o.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn btn-gold" onClick={make} disabled={!!busy}>
              {busy ? '만드는 중...' : '문서 만들기 (한글 .hwpx)'}
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

          {result && (
            <div className="info">
              <b>{result.name}</b> 을 받았습니다.
              <br />
              담긴 반 {result.used.length}개: {result.used.join(', ')} — 반마다 연간(
              {yearPlan === 'new' ? '열두 달 완성본' : '원본 표'}) · 월간(3월 예시) · 주간(3월 1주
              예시) · 하루 일과표와 보육일지 서식이 들어 있습니다. 앞뒤로 발달 특성, 편성·운영·평가
              절차, 연장보육 계획, 기록·평가 서식도 함께 들어갑니다.
              <br />
              {result.missing.length > 0 && (
                <>
                  <b>{result.missing.join(', ')}</b>는 원장님 샘플에 연간놀이계획안이 없어 빠졌습니다.
                  <br />
                </>
              )}
              한글에서 열어 우리 원 반 이름·시간·정원에 맞게 고쳐 쓰시면 됩니다.
            </div>
          )}

          <div className="row" style={{ marginTop: 14, gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={wholeSample} disabled={!!busy}>
              원장님 샘플 원본 전체 받기
            </button>
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
