'use client';

// 수강생이 쓴 내용은 본인 컴퓨터(브라우저)에만 저장된다.
const KEY = 'witak-course-v1';

export function loadAll() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveAll(data) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    console.error('저장 실패', e);
  }
}

export function patch(part) {
  const cur = loadAll();
  const next = { ...cur, ...part };
  saveAll(next);
  return next;
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
