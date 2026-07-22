'use client';

// "내 위탁 서류" 한 부 만들기.
// 원장님 샘플을 우리 지자체 목차 순서로 재배치하고,
// 지금까지 차시에서 쓴 내용을 제자리에 채워 넣는다.
// 차시를 진행할수록 내용이 쌓여서, 마지막에는 하나의 완성 문서가 된다.

import { loadAll, loadSections, markDone } from './store';
import { DEFAULT_SECTIONS } from './sampleSections';
import { loadWritten } from './written';
import { buildHwpx, downloadBlob } from './hwpx';

/** 목차가 정해졌는지 */
export function hasToc() {
  const d = loadAll();
  return Array.isArray(d.items) && d.items.length > 0;
}

/**
 * 지금까지 쌓인 내용이 모두 들어간 한글 파일을 내려받는다.
 * @param {(msg:string)=>void} onProgress
 */
export async function downloadMergedDoc(onProgress) {
  const d = loadAll();
  if (!hasToc()) throw new Error('먼저 0차시에서 우리 지자체 목차를 정해 주세요.');

  const sections = loadSections(DEFAULT_SECTIONS);
  const blob = await buildHwpx({
    city: d.city,
    center: d.center,
    applicant: d.applicant,
    items: d.items,
    written: loadWritten(sections),
    setting: d.setting,
    onProgress,
  });
  downloadBlob(blob, `${d.city || '위탁'}_위탁운영계획서.hwpx`);
  markDone(0);
}
