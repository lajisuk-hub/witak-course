'use client';

// 수강생이 쓴 내용은 본인 컴퓨터(브라우저)에만 저장된다.
//
// 한 컴퓨터를 여러 사람이 쓸 수 있으므로 **전화번호마다 따로** 담아 둔다.
// (예전에는 하나로 뭉뚱그려져서, 다른 번호로 들어가도 앞사람 내용이 남아 있었다)
const BASE = 'witak-course-v1';

function key() {
  if (typeof window === 'undefined') return BASE;
  try {
    const me = JSON.parse(localStorage.getItem('witak-me-v1') || 'null');
    if (me && me.phone) return `${BASE}:${me.phone}`;
  } catch {
    /* 로그인 전이면 아래 기본 자리를 쓴다 */
  }
  return BASE;
}

export function loadAll() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(key()) || '{}');
  } catch {
    return {};
  }
}

export function saveAll(data) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key(), JSON.stringify(data));
  } catch (e) {
    console.error('저장 실패', e);
  }
}

/** 이 전화번호로 쓴 내용을 모두 지운다 (처음부터 다시 하기) */
export function clearAll() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key());
}

export function patch(part) {
  const cur = loadAll();
  const next = { ...cur, ...part };
  saveAll(next);
  return next;
}

// ── 차시 진도 ──
// done: { "0": "2026-07-22T01:00:00.000Z", "1": ... }
export function markDone(step) {
  const cur = loadAll();
  const done = { ...(cur.done || {}) };
  done[String(step)] = new Date().toISOString();
  saveAll({ ...cur, done });
  return done;
}

export function loadDone() {
  return loadAll().done || {};
}

// 관리자가 고친 샘플 (있으면 이걸 우선 사용)
const ADMIN_KEY = 'witak-course-sections-v1';

export function loadSections(fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    if (!raw) return fallback;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length ? arr : fallback;
  } catch {
    return fallback;
  }
}

export function saveSections(arr) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ADMIN_KEY, JSON.stringify(arr));
}

export function clearSections() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ADMIN_KEY);
}
