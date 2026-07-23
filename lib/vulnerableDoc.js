'use client';

// 5차시 취약보육: 원장님 서식(forms/vulnerable.hwpx)에서
// **수강생이 고른 영역만 남긴** 맞춤 한글 문서를 만든다.
//
// 서식 구조(원장님이 올린 완성형 템플릿)
//   바. 취약보육 운영계획 등 / 운영철학 / 소개문(①②③④) / 근거법령
//   1) 영아 보육  2) 장애아 통합보육  3) 야간 연장 보육  4) 다문화 영유아 보육
//   5) 취약보육 통합 운영 체계
//
// 하는 일
//   · 고르지 않은 영역(제목표+내용표 두 문단)을 통째로 뺀다
//   · 남은 영역 제목의 "N)" 번호를 1)2)3)…로 다시 매긴다
//   · 소개문(①②③)과 "N대 취약보육", 통합체계 번호·"위 N개 영역"을 맞춘다
//   운영철학·근거법령·통합운영체계는 항상 포함한다.

import { fileName } from './forms';

const JSZIP_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

export const VULN_AREAS = [
  { key: 'infant', label: '영아 보육 (만 0~2세)', head: '영아 보육', intro: '영아 보육' },
  { key: 'disabled', label: '장애아 통합보육', head: '장애아 통합보육', intro: '장애아 통합보육' },
  { key: 'extended', label: '시간연장·야간연장 보육', head: '야간 연장 보육', intro: '시간연장 보육' },
  { key: 'multicultural', label: '다문화 영유아 보육', head: '다문화 영유아 보육', intro: '다문화 영유아 보육' },
];

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥'];
const OLD_P3 =
  '① 영아 보육 / ② 장애아 통합보육 / ③ 시간연장 보육 / ④ 다문화 영유아 보육 — 위탁심사 요구사항인 2개 이상 영역을 충족하며, 영유아의 다양한 욕구에 부응하는 맞춤형 보육을 통합적으로 실시한다.';
const P3_SUFFIX =
  ' — 위탁심사 요구사항인 2개 이상 영역을 충족하며, 영유아의 다양한 욕구에 부응하는 맞춤형 보육을 통합적으로 실시한다.';

async function loadJSZip() {
  if (window.JSZip) return window.JSZip;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = JSZIP_SRC;
    s.onload = resolve;
    s.onerror = () => reject(new Error('압축 도구를 불러오지 못했습니다'));
    document.head.appendChild(s);
  });
  return window.JSZip;
}

function topParas(xml) {
  const out = [];
  let depth = 0;
  let start = -1;
  const re = /<hp:p[\s>]|<\/hp:p>/g;
  let m;
  while ((m = re.exec(xml))) {
    if (m[0] === '</hp:p>') {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        out.push([start, m.index + m[0].length]);
        start = -1;
      }
    } else {
      if (depth === 0) start = m.index;
      depth += 1;
    }
  }
  return out;
}

function paraText(chunk) {
  return (chunk.match(/<hp:t>([\s\S]*?)<\/hp:t>/g) || [])
    .map((p) => p.replace(/<\/?hp:t>/g, ''))
    .join('');
}

function renumberFirstHeading(chunk, n) {
  return chunk.replace(/(<hp:t>)\s*\d+\)/, (mm, a) => `${a}${n})`);
}

function buildSection(section, selected) {
  const paras = topParas(section);
  const chunks = paras.map(([a, b]) => section.slice(a, b));
  const texts = chunks.map(paraText);

  const findHead = (headtext) => {
    for (let i = 0; i < texts.length; i++) {
      if (/^\s*\d+\)/.test(texts[i]) && texts[i].slice(0, 30).includes(headtext)) return i;
    }
    return -1;
  };
  const areaIdx = {};
  VULN_AREAS.forEach((a) => {
    areaIdx[a.key] = findHead(a.head);
  });
  const integIdx = texts.findIndex((t) => t.includes('취약보육 통합 운영 체계'));
  if (Object.values(areaIdx).some((v) => v < 0) || integIdx < 0) {
    throw new Error('취약보육 서식 구조를 알아보지 못했습니다. 원장님 취약보육 서식이 맞는지 확인해 주세요.');
  }

  const firstAreaStart = paras[Math.min(...Object.values(areaIdx))][0];
  const prefix0 = section.slice(0, firstAreaStart);
  const suffix0 = section.slice(paras[integIdx][0]);

  const selOrdered = VULN_AREAS.filter((a) => selected.includes(a.key));
  const N = selOrdered.length;

  let middle = '';
  selOrdered.forEach((a, i) => {
    const hi = areaIdx[a.key];
    middle += renumberFirstHeading(chunks[hi], i + 1) + chunks[hi + 1];
  });

  // 소개문 재작성 + "N대 취약보육"
  const newP3 = selOrdered.map((a, i) => `${CIRCLED[i]} ${a.intro}`).join(' / ') + P3_SUFFIX;
  let prefix = prefix0.replace(OLD_P3, newP3);
  prefix = prefix.replace('4대 취약보육', `${N}대 취약보육`);

  // 통합체계 번호 = N+1, "위 N개 영역"
  let suffix = suffix0.replace(/(<hp:t>)\s*\d+\)/, (mm, a) => `${a}${N + 1})`);
  suffix = suffix.replace('위 4개 영역', `위 ${N}개 영역`);

  return prefix + middle + suffix;
}

/**
 * @param {object} o
 * @param {string[]} o.selected  고른 영역 key 배열 (VULN_AREAS 참고, 최소 1개)
 * @param {string} o.phone
 * @param {string} o.city
 * @param {string} o.student
 * @param {Function} [o.onProgress]
 */
export async function buildVulnerableDoc({ selected, phone, city, student, onProgress }) {
  const JSZip = await loadJSZip();

  if (onProgress) onProgress('취약보육 서식을 불러오는 중입니다...');
  const ticket = await fetch(`/api/sample?kind=vulnerable&phone=${encodeURIComponent(phone)}`);
  const info = await ticket.json();
  if (!ticket.ok) {
    throw new Error(
      info.error || '취약보육 서식을 열지 못했습니다. 라지숙 소장이 아직 서식을 올리지 않았을 수 있습니다.'
    );
  }
  const res = await fetch(info.url);
  if (!res.ok) throw new Error('취약보육 서식을 받지 못했습니다');
  const zip = await JSZip.loadAsync(await res.arrayBuffer());

  if (onProgress) onProgress('고르신 영역으로 문서를 만드는 중입니다...');
  const section = await zip.file('Contents/section0.xml').async('string');
  const newSection = buildSection(section, selected);

  if (onProgress) onProgress('한글 파일로 묶는 중입니다...');
  const out = new JSZip();
  out.file('mimetype', await zip.file('mimetype').async('uint8array'), { compression: 'STORE' });
  const names = Object.keys(zip.files).filter(
    (n) => n !== 'mimetype' && n !== 'Contents/section0.xml' && !zip.files[n].dir
  );
  for (const n of names) {
    out.file(n, await zip.file(n).async('uint8array'), { compression: 'DEFLATE' });
  }
  out.file('Contents/section0.xml', newSection, { compression: 'DEFLATE' });

  // 한글은 포장에 엄격하다 — JSZip이 자동으로 넣는 폴더 항목(Contents/ 등)을 빼 원본 hwpx 구조와 맞춘다.
  Object.keys(out.files).forEach((n) => {
    if (out.files[n].dir) delete out.files[n];
  });
  const blob = await out.generateAsync({ type: 'blob', mimeType: 'application/hwp+zip' });
  const names2 = VULN_AREAS.filter((a) => selected.includes(a.key)).map((a) => a.intro);
  return { blob, name: fileName({ city, student, docName: '취약보육' }), areas: names2 };
}
