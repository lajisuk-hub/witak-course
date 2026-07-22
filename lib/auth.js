'use client';

// 전화번호 로그인. 로그인한 사람 정보는 이 브라우저에만 담아 둔다.
import { useEffect, useState } from 'react';

const KEY = 'witak-me-v1';

export function loadMe() {
  if (typeof window === 'undefined') return null;
  try {
    const me = JSON.parse(localStorage.getItem(KEY) || 'null');
    return me && me.phone ? me : null;
  } catch {
    return null;
  }
}

export function saveMe(me) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(me));
}

export function logout() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}

export function normalizePhone(v) {
  return String(v || '').replace(/[^0-9]/g, '');
}

/**
 * 로그인한 사람을 돌려준다.
 * 로그인 전이면 로그인 화면으로 보낸다.
 * @returns {{me: object|null, ready: boolean}}
 */
export function useMe({ redirect = true } = {}) {
  const [me, setMe] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const found = loadMe();
    if (!found && redirect) {
      const back = window.location.pathname + window.location.search;
      window.location.replace('/login?back=' + encodeURIComponent(back));
      return;
    }
    setMe(found);
    setReady(true);
  }, [redirect]);

  return { me, ready };
}
