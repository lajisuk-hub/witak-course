'use client';

// 한글(.hwpx) 통합서류 만들기
// - public/base.hwpx 는 서식 정의(header.xml)만 남긴 가벼운 빈 문서다.
// - 여기서 본문(section0.xml)만 새로 만들어 끼워 넣는다.
// - 교훈(gongmun-maker): mimetype 은 압축하지 않고 맨 앞에 둔다.
//                        linesegarray 는 넣지 않는다(한글이 다시 계산한다).

const JSZIP_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

// tools/build-base.py 가 넣어 둔 글자모양·문단모양 번호 (글꼴은 모두 휴먼명조)
const CH = {
  title: 16, // 22pt 굵게 네이비 — 문서 제목
  toc: 20, //   14pt 굵게 네이비 — 목  차
  heading: 17, // 15pt 굵게 네이비 — 꼭지 제목
  body: 15, //   12pt — 본문
  small: 18, //  10pt 회색 — 작성 요령
  sub: 19, //    13pt — 표지 부제
};
const PA = {
  center: 25, // 가운데 정렬 (표지)
  heading: 26, // 꼭지 제목 (위아래 여백)
  small: 27, //  작성 요령 (들여쓰기)
  body: 28, //   본문
};

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let pid = 100;
function para(text, charId, opts = {}) {
  pid += 1;
  const pageBreak = opts.pageBreak ? '1' : '0';
  const paraId = opts.para == null ? PA.body : opts.para;
  const run = text
    ? `<hp:run charPrIDRef="${charId}"><hp:t>${esc(text)}</hp:t></hp:run>`
    : `<hp:run charPrIDRef="${charId}"></hp:run>`;
  return `<hp:p id="${pid}" paraPrIDRef="${paraId}" styleIDRef="0" pageBreak="${pageBreak}" columnBreak="0" merged="0">${run}</hp:p>`;
}

function multiline(text, charId, opts = {}) {
  const lines = String(text || '').split(/\r?\n/);
  return lines.map((l) => para(l, charId, opts)).join('');
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

/**
 * @param {object} opts
 * @param {string} opts.title      문서 제목 (예: 원주시 국공립○○어린이집 위탁운영계획서)
 * @param {string} opts.subtitle   부제 (원장지원자 등)
 * @param {Array}  opts.items      [{ no, name, body, guide, missing }]
 */
export async function buildHwpx({ title, subtitle, items }) {
  const JSZip = await loadJSZip();

  const res = await fetch('/base.hwpx');
  if (!res.ok) throw new Error('한글 서식 파일을 찾지 못했습니다');
  const baseBuf = await res.arrayBuffer();

  const base = await JSZip.loadAsync(baseBuf);
  const skeleton = await base.file('Contents/section0.xml').async('string');

  // ── 본문 만들기 ────────────────────────────────
  const C = { para: PA.center };
  let body = '';

  // 표지
  for (let i = 0; i < 6; i += 1) body += para('', CH.body, C);
  body += para(title || '위탁운영계획서', CH.title, C);
  body += para('', CH.body, C);
  if (subtitle) body += para(subtitle, CH.sub, C);

  // 목차
  body += para('목  차', CH.toc, { para: PA.center, pageBreak: true });
  body += para('', CH.body, C);
  items.forEach((it, i) => {
    body += para(`${i + 1}.  ${it.name}`, CH.body);
  });

  // 본문 (꼭지마다 새 쪽)
  items.forEach((it, i) => {
    body += para(`${i + 1}. ${it.name}`, CH.heading, { para: PA.heading, pageBreak: true });
    if (it.guide) {
      body += para(`※ ${it.guide}`, CH.small, { para: PA.small });
    }
    body += para('', CH.body);
    if (it.body && it.body.trim()) {
      body += multiline(it.body, CH.body);
    } else {
      body += para('(여기에 직접 작성하세요)', CH.small, { para: PA.small });
    }
  });

  const sectionXml = skeleton.replace('<!--BODY-->', body);

  // ── 다시 압축 (mimetype 을 맨 앞에, 압축 없이) ──
  const out = new JSZip();
  out.file('mimetype', await base.file('mimetype').async('uint8array'), {
    compression: 'STORE',
  });
  const names = Object.keys(base.files).filter(
    (n) => n !== 'mimetype' && n !== 'Contents/section0.xml' && !base.files[n].dir
  );
  for (const n of names) {
    out.file(n, await base.file(n).async('uint8array'), { compression: 'DEFLATE' });
  }
  out.file('Contents/section0.xml', sectionXml, { compression: 'DEFLATE' });

  return out.generateAsync({ type: 'blob', mimeType: 'application/hwp+zip' });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
