'use client';

// 3차시 · 연간–월간–하루일지 문서 만들기 (브라우저에서 조립한다)
//
// 원장님 샘플(forms/program.hwpx)을 받아
//   · 표준보육과정 기본설명 (항상)
//   · 고른 연령의 연간놀이계획안 (원본 그대로 — 표·그림 보존)
//   · 연령별 월간보육계획안 · 하루 일과/보육일지 (planContent.js 내용으로 새로 그림)
// 을 담은 한글 파일을 만든다.
//
// 서버에서 조립하지 않는 이유: 샘플이 커서 서버 응답 용량 제한(4.5MB)에 걸린다.

import { fileName } from './forms';
import { buildPlanSection } from './planDocParts';

const JSZIP_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

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

let cached = null;
async function loadSample(phone, onProgress) {
  if (cached) return cached;
  const JSZip = await loadJSZip();
  if (onProgress) onProgress('원장님 샘플을 불러오는 중입니다...');
  const ticket = await fetch(`/api/sample?kind=program&phone=${encodeURIComponent(phone)}`);
  const info = await ticket.json();
  if (!ticket.ok) {
    throw new Error(info.error || '샘플을 열지 못했습니다. 라지숙 소장에게 문의해 주세요.');
  }
  const res = await fetch(info.url);
  if (!res.ok) throw new Error('샘플을 받지 못했습니다');
  cached = await JSZip.loadAsync(await res.arrayBuffer());
  return cached;
}

/** 새 본문에서 쓰이지 않는 그림은 빼서 파일을 가볍게 만든다 */
function usedImages(sectionXml, headerXml) {
  const ids = new Set();
  const grab = (text) => {
    const re = /binaryItemIDRef="([^"]+)"/g;
    let m;
    while ((m = re.exec(String(text || '')))) ids.add(m[1]);
  };
  grab(sectionXml);
  grab(headerXml);
  return ids;
}

/**
 * @param {object} o
 * @param {string[]} o.ages    고른 연령 ['0','1',...]
 * @param {string} o.phone
 * @param {string} [o.city]
 * @param {string} [o.student]
 * @param {Function} [o.onProgress]
 */
export async function buildProgramPlanDoc({ ages, phone, city, student, onProgress }) {
  const JSZip = await loadJSZip();
  const zip = await loadSample(phone, onProgress);

  if (onProgress) onProgress('고르신 연령으로 문서를 만드는 중입니다...');
  const section = await zip.file('Contents/section0.xml').async('string');
  const header = await zip.file('Contents/header.xml').async('string');
  const { xml, used, missing } = buildPlanSection(section, ages, header);

  if (onProgress) onProgress('한글 파일로 묶는 중입니다...');
  const keep = usedImages(xml, header);
  let hpf = await zip.file('Contents/content.hpf').async('string');

  const out = new JSZip();
  out.file('mimetype', await zip.file('mimetype').async('uint8array'), { compression: 'STORE' });

  const names = Object.keys(zip.files).filter(
    (n) =>
      n !== 'mimetype' &&
      n !== 'Contents/section0.xml' &&
      n !== 'Contents/content.hpf' &&
      !zip.files[n].dir
  );
  for (const n of names) {
    const img = n.match(/^BinData\/(.+)\.[a-zA-Z]+$/);
    if (img && !keep.has(img[1])) {
      // 안 쓰는 그림 — 파일과 목록에서 함께 뺀다
      hpf = hpf.replace(
        new RegExp(`<opf:item id="${img[1]}"[^>]*/>`, 'g'),
        ''
      );
      continue;
    }
    out.file(n, await zip.file(n).async('uint8array'), { compression: 'DEFLATE' });
  }
  out.file('Contents/content.hpf', hpf, { compression: 'DEFLATE' });
  out.file('Contents/section0.xml', xml, { compression: 'DEFLATE' });

  // 한글은 포장에 엄격하다 — JSZip이 자동으로 넣는 폴더 항목을 빼 원본 hwpx 구조와 맞춘다.
  Object.keys(out.files).forEach((n) => {
    if (out.files[n].dir) delete out.files[n];
  });
  const blob = await out.generateAsync({ type: 'blob', mimeType: 'application/hwp+zip' });

  return {
    blob,
    name: fileName({ city, student, docName: '연간월간하루일지' }),
    used,
    missing,
  };
}

/** 원장님 샘플 원본을 그대로 받는다 (참고용) */
export async function downloadWholeSample(phone) {
  const ticket = await fetch(`/api/sample?kind=program&phone=${encodeURIComponent(phone)}`);
  const info = await ticket.json();
  if (!ticket.ok) throw new Error(info.error || '샘플을 열지 못했습니다.');
  const res = await fetch(info.url);
  if (!res.ok) throw new Error('샘플을 받지 못했습니다');
  return res.blob();
}
