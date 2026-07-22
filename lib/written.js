'use client';

// 수강생이 차시에서 직접 쓴 글을, 통합 위탁운영계획서의 어느 꼭지에 넣을지 이어 준다.
//
// sampleSections 의 각 꼭지에는 `step`(몇 차시에서 쓰는지)이 붙어 있다.
// 여기서는 차시별로 "그 차시가 만들어 낸 문단들"을 돌려주고,
// buildHwpx 가 해당 꼭지 자리에 샘플 대신 이 문단들을 넣는다.

import { loadAll } from './store';

// 차시 번호 → 문단 블록 [{ kind: 'head' | 'body', text }]
function blocksByStep(data) {
  const out = {};

  // 1차시 · 자기소개서
  const d = data.introDraft;
  if (d && d.para1) {
    const name = data.introForm?.name || data.profile?.name || '';
    const blocks = [
      { kind: 'body', text: '국공립어린이집 신규위탁 운영자 모집 지원서' },
      { kind: 'body', text: '' },
    ];
    [
      ['1. 지원동기 및 보육철학', d.para1],
      ['2. 보육경력 및 전문성', d.para2],
      ['3. 운영 비전 및 실행 계획', d.para3],
    ].forEach(([title, text]) => {
      if (!text) return;
      blocks.push({ kind: 'head', text: title });
      blocks.push({ kind: 'body', text });
    });
    if (d.closing) {
      blocks.push({ kind: 'body', text: '' });
      blocks.push({ kind: 'body', text: d.closing });
    }
    blocks.push({ kind: 'body', text: '' });
    blocks.push({ kind: 'body', text: `지원자   ${name}   (인)` });
    out[1] = blocks;
  }

  return out;
}

/**
 * 꼭지 id → 내가 쓴 문단들.
 * @param {Array} sections DEFAULT_SECTIONS (또는 관리자가 고친 것)
 */
export function loadWritten(sections) {
  const data = loadAll();
  const byStep = blocksByStep(data);
  const out = {};
  (sections || []).forEach((s) => {
    if (s.step && byStep[s.step]) out[s.id] = byStep[s.step];
  });
  return out;
}

/** 내가 직접 쓴 내용이 들어간 차시 번호 목록 */
export function writtenSteps() {
  return Object.keys(blocksByStep(loadAll())).map(Number);
}
