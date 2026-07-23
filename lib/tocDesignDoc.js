'use client';

// 0차시 목차 — 원장님이 올린 **디자인 목차 서식(forms/toc.hwpx)** 을 그대로 쓰되,
// 각 챕터·항목의 **제목 글자만** 지자체 목차 항목으로 바꿔치기하고 지역을 채운다.
// 장식선·박스·페이지번호 등 **디자인은 절대 건드리지 않는다.** (가장 안전)
//
// 항목이 안 맞으면 원래 템플릿 제목을 그대로 두므로 디자인이 깨질 일이 없다.

import { fileName } from './forms';

const JSZIP_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

// 템플릿 챕터 제목(정확 문자열) → 샘플 꼭지 id
const CHAPTER_MAP = {
  '어린이집 위탁 신청서': 'cover',
  '위탁 운영체 현황': 'org-status',
  '위탁 운영자 상세내역': 'applicant',
};
// 템플릿 Ⅳ 소항목 번호 → 샘플 꼭지 id
const SUB_MAP = {
  1: 'plan-basic',
  2: 'plan-hr',
  3: 'plan-curriculum',
  4: 'manage-overall',
  5: 'facility',
  6: 'budget',
};

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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

function applyReplacements(section, nameByKokji, city) {
  let s = section;

  // 1) 챕터 제목 바꿔치기 (정확 문자열 → 지자체 항목명)
  for (const [old, kid] of Object.entries(CHAPTER_MAP)) {
    const nm = (nameByKokji[kid] || '').trim();
    if (nm && nm !== old) {
      s = s.replace(`<hp:t>${old}</hp:t>`, `<hp:t>${esc(nm)}</hp:t>`);
    }
  }

  // 2) Ⅳ 소항목: "N. 제목      00" 에서 제목만 교체 (총 길이 유지 → 00 위치 보존)
  s = s.replace(/<hp:t>(\d+\.\s+[^<]*?\s{2,}0+\s*)<\/hp:t>/g, (full, inner) => {
    const mm = inner.match(/^(\d+)\.\s*(.+?)(\s{2,})(0+)(\s*)$/);
    if (!mm) return full;
    const num = Number(mm[1]);
    const title = mm[2];
    const gap = mm[3];
    const zeros = mm[4];
    const tail = mm[5];
    const kid = SUB_MAP[num];
    const nm = kid ? (nameByKokji[kid] || '').trim() : '';
    if (!nm || nm === title) return full;
    const newGap = ' '.repeat(Math.max(2, gap.length + title.length - nm.length));
    return `<hp:t>${num}. ${esc(nm)}${newGap}${zeros}${tail}</hp:t>`;
  });

  // 3) 지역: 00시군구 → 도시명
  if (city && city.trim()) {
    s = s.split('00시군구').join(esc(city.trim()));
  }

  return s;
}

/**
 * @param {object} o
 * @param {Array<{name:string,matchId:string|null}>} o.items  /toc 에서 정리한 목차 항목
 * @param {string} o.city
 * @param {string} o.phone
 * @param {string} o.student
 * @param {Function} [o.onProgress]
 */
export async function buildTocDesignDoc({ items, city, phone, student, onProgress }) {
  const JSZip = await loadJSZip();

  if (onProgress) onProgress('목차 서식을 불러오는 중입니다...');
  const ticket = await fetch(`/api/sample?kind=toc&phone=${encodeURIComponent(phone)}`);
  const info = await ticket.json();
  if (!ticket.ok) {
    throw new Error(info.error || '목차 서식을 열지 못했습니다. 라지숙 소장에게 문의해 주세요.');
  }
  const res = await fetch(info.url);
  if (!res.ok) throw new Error('목차 서식을 받지 못했습니다');
  const zip = await JSZip.loadAsync(await res.arrayBuffer());

  if (onProgress) onProgress('디자인에 우리 지자체 목차를 반영하는 중입니다...');
  const section = await zip.file('Contents/section0.xml').async('string');

  // 꼭지 id → 지자체 항목명 (먼저 나온 것 우선)
  const nameByKokji = {};
  (items || []).forEach((it) => {
    if (it && it.matchId && !nameByKokji[it.matchId]) nameByKokji[it.matchId] = it.name;
  });

  const newSection = applyReplacements(section, nameByKokji, city);

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

  const blob = await out.generateAsync({ type: 'blob', mimeType: 'application/hwp+zip' });
  return { blob, name: fileName({ city, student, docName: '목차' }) };
}
