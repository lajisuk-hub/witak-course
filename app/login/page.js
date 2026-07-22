'use client';

import { useEffect, useState } from 'react';
import { loadMe, saveMe, normalizePhone } from '@/lib/auth';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [askName, setAskName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [back, setBack] = useState('/');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setBack(p.get('back') || '/');
    const me = loadMe();
    if (me) setPhone(me.phone);
  }, []);

  const digits = normalizePhone(phone);
  const okPhone = /^01[0-9]{8,9}$/.test(digits);

  async function submit() {
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '들어가지 못했습니다');

      if (data.needName) {
        setAskName(true);
        setBusy(false);
        return;
      }
      saveMe(data.student);
      window.location.replace(back);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <>
      <div className="head">
        <h1>국공립 신규위탁 과정</h1>
        <p>전화번호로 들어오시면 됩니다</p>
      </div>

      <div className="wrap" style={{ maxWidth: 480 }}>
        {error && <div className="err">{error}</div>}

        <div className="card">
          <h2>전화번호를 넣어 주세요</h2>
          <p className="sub">
            따로 비밀번호는 없습니다. <b>전화번호가 곧 열쇠</b>입니다.
          </p>

          <label>전화번호</label>
          <input
            type="text"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && okPhone && !busy && submit()}
            placeholder="01092304025"
            style={{ fontSize: 20, letterSpacing: 1 }}
          />
          <div className="hint">
            <b>하이픈(-) 없이 숫자만</b> 넣어 주세요. 예) 01092304025
          </div>

          {askName && (
            <>
              <div className="info">처음 오셨네요. 성함만 알려 주시면 됩니다.</div>
              <label>성함</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && name.trim() && !busy && submit()}
                placeholder="예) 홍길동"
                autoFocus
              />
            </>
          )}

          <div style={{ marginTop: 18 }}>
            <button
              className="btn btn-gold"
              style={{ width: '100%', padding: '14px' }}
              onClick={submit}
              disabled={busy || !okPhone || (askName && !name.trim())}
            >
              {busy ? '들어가는 중...' : askName ? '시작하기' : '들어가기'}
            </button>
          </div>

          {!okPhone && phone.length > 0 && (
            <p style={{ fontSize: 13, color: 'var(--warn)', marginTop: 8 }}>
              전화번호 형식이 맞지 않습니다. 010으로 시작하는 숫자 11자리를 넣어 주세요.
            </p>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
          문의 · 라지숙 소장
        </p>
      </div>
    </>
  );
}
