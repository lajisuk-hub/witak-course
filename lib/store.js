'use client';

// 수강생이 쓴 내용을 담아 두는 곳.
//
// ① 이 컴퓨터(브라우저)에 담고 — 빠르고, 인터넷이 끊겨도 쓰던 것이 남는다
// ② 전화번호로 서버에도 함께 담는다 — 휴대폰에서 하던 것을 컴퓨터에서 이어서 할 수 있다
//
// 한 컴퓨터를 여러 사람이 쓸 수 있으므로 **전화번호마다 따로** 담아 둔다.
// (예전에는 하나로 뭉뚱그려져서, 다른 번호로 들어가도 앞사람 내용이 남아 있었다)
const BASE = 'witak-course-v1';
const ME = 'witak-me-v1';

function myPhone() {
  if (typeof window === 'undefined') return null;
  try {
    const me = JSON.parse(localStorage.getItem(ME) || 'null');
    return me && me.phone ? me.phone : null;
  } catch {
    return null;
  }
}

function key() {
  const phone = myPhone();
  return phone ? `${BASE}:${phone}` : BASE;
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
  const stamped = { ...data, savedAt: new Date().toISOString() };
  try {
    localStorage.setItem(key(), JSON.stringify(stamped));
  } catch (e) {
    console.error('저장 실패', e);
  }
  schedulePush(); // 서버에도 곧 올린다
}

/** 이 전화번호로 쓴 내용을 모두 지운다 (처음부터 다시 하기) */
export function clearAll() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key());
  // 서버에도 "비었다"고 바로 알린다. 안 그러면 다음에 들어올 때 지운 내용이 되살아난다.
  saveAll({});
  pushNow({ force: true });
}

export function patch(part) {
  const cur = loadAll();
  const next = { ...cur, ...part };
  saveAll(next);
  return next;
}

// ── 서버에 함께 담기 ──────────────────────────────
// 글자를 한 자 칠 때마다 올리면 낭비이므로, 잠깐 기다렸다가 한 번에 올린다.
let timer = null;

function syncFlag(phone) {
  return `witak-synced-v1:${phone}`;
}

// 시크릿 모드 등에서 sessionStorage 가 막힐 때를 대비해 화면에도 따로 기억해 둔다
const syncedHere = new Set();

/** 이번에 서버 내용을 한 번이라도 제대로 받아 봤는지 */
function synced(phone) {
  if (syncedHere.has(phone)) return true;
  try {
    return Boolean(sessionStorage.getItem(syncFlag(phone)));
  } catch {
    return false;
  }
}

function schedulePush() {
  if (typeof window === 'undefined') return;
  clearTimeout(timer);
  timer = setTimeout(pushNow, 1500);
}

/** 담긴 내용이 실제로 있는지 (저장한 시각만 있는 건 빈 것으로 본다) */
function hasContent(data) {
  return Object.keys(data || {}).some((k) => k !== 'savedAt');
}

/**
 * 지금 바로 서버에 올린다 (화면을 닫을 때도 부른다).
 *
 * ★ 비어 있으면 올리지 않는다.
 * 다른 기기에서 막 로그인해 이 브라우저가 아직 빈 상태일 때 올려 버리면
 * 서버에 잘 담겨 있던 내용이 지워진다. 실제로 시험하다 겪었다.
 * '처음부터 다시 하기'처럼 정말로 비우려는 때만 force 로 부른다.
 */
export function pushNow({ keepalive = false, force = false } = {}) {
  if (typeof window === 'undefined') return;
  clearTimeout(timer);
  const phone = myPhone();
  if (!phone) return;
  const data = loadAll();
  if (!force && !hasContent(data)) return;
  // 서버 내용을 아직 못 받아 봤으면 올리지 않는다.
  // (못 받은 채로 올리면 서버에 있던 내용을 덮어써 버린다)
  if (!force && !synced(phone)) return;
  try {
    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, data }),
      keepalive,
    }).catch(() => {});
  } catch {
    /* 서버에 못 올려도 이 컴퓨터에는 남아 있으므로 그냥 넘어간다 */
  }
}

/**
 * 서버에 담아 둔 내용을 받아 이 브라우저와 맞춘다.
 * 앱을 열 때 한 번만 한다. 못 받아오면 이 브라우저에 있는 내용으로 그냥 진행한다.
 */
export async function pullRemote() {
  if (typeof window === 'undefined') return;
  const phone = myPhone();
  if (!phone) return;

  if (synced(phone)) return; // 이번에 이미 맞춰 봤다

  let remote = null;
  try {
    const res = await Promise.race([
      fetch(`/api/data?phone=${encodeURIComponent(phone)}`, { cache: 'no-store' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('시간 초과')), 8000)),
    ]);
    if (!res.ok) return;
    const json = await res.json();
    remote = json.data && typeof json.data === 'object' ? json.data : null;
  } catch {
    return; // 인터넷이 느리거나 끊겼다 — 이 컴퓨터 내용으로 진행
  }

  syncedHere.add(phone);
  try {
    sessionStorage.setItem(syncFlag(phone), '1');
  } catch {
    /* 시크릿 모드 등에서 막혀도 이 아래는 그대로 진행한다 */
  }

  const local = loadAll();
  const localTime = Date.parse(local.savedAt || '') || 0;
  const remoteTime = remote ? Date.parse(remote.savedAt || '') || 0 : -1;

  if (!remote) {
    if (hasContent(local)) pushNow(); // 서버에 아직 없으면 올려 둔다
    return;
  }

  // 나중에 저장된 쪽을 기준으로 삼고, 끝낸 차시 표시(✓)는 양쪽을 합친다
  const newer = remoteTime >= localTime ? remote : local;
  const older = remoteTime >= localTime ? local : remote;
  const merged = { ...newer, done: { ...(older.done || {}), ...(newer.done || {}) } };

  try {
    localStorage.setItem(key(), JSON.stringify(merged));
  } catch (e) {
    console.error('저장 실패', e);
  }

  // 이 브라우저 것이 더 최신이었으면 서버를 맞춰 준다
  if (JSON.stringify(merged) !== JSON.stringify(remote)) pushNow();
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
