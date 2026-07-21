'use client';

// 한글(.hwpx) 통합서류 만들기
//
// 방법: 원장님 문서 샘플(public/sample.hwpx)을 꼭지 조각으로 잘라 두었다가
//       (lib/sampleMap.json), 수강생의 지자체 목차 순서대로 다시 붙인다.
//       조각을 원본 XML 그대로 쓰기 때문에 표·그림·글자모양이 100% 보존된다.
//
// 주의(과거 교훈)
//   - mimetype 은 압축하지 않고 맨 앞에 넣어야 한글이 연다
//   - linesegarray 는 새로 넣지 않는다 (한글이 다시 계산한다)

import SAMPLE_MAP from './sampleMap.json';

const JSZIP_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let pid = 900000;
function para(text, style, opts = {}) {
  pid += 1;
  const pageBreak = opts.pageBreak ? '1' : '0';
  const run = text
    ? `<hp:run charPrIDRef="${style.char}"><hp:t>${esc(text)}</hp:t></hp:run>`
    : `<hp:run charPrIDRef="${style.char}"></hp:run>`;
  return `<hp:p id="${pid}" paraPrIDRef="${style.para}" styleIDRef="0" pageBreak="${pageBreak}" columnBreak="0" merged="0">${run}</hp:p>`;
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

let cachedZip = null;
async function loadSample(onProgress) {
  if (cachedZip) return cachedZip;
  const JSZip = await loadJSZip();
  if (onProgress) onProgress('문서 샘플을 불러오는 중입니다... (처음 한 번만, 12MB)');
  const res = await fetch('/sample.hwpx');
  if (!res.ok) throw new Error('문서 샘플을 찾지 못했습니다');
  const buf = await res.arrayBuffer();
  cachedZip = await JSZip.loadAsync(buf);
  return cachedZip;
}

/**
 * @param {object} opts
 * @param {string} opts.city       지자체 이름
 * @param {string} opts.center     어린이집 이름
 * @param {string} opts.applicant  원장 지원자 성함
 * @param {Array}  opts.items      [{ name, matchId }] 지자체 목차 순서
 * @param {Function} [opts.onProgress]
 */
export async function buildHwpx({ city, center, applicant, items, onProgress }) {
  const zip = await loadSample(onProgress);
  if (onProgress) onProgress('우리 지자체 목차 순서대로 문서를 짜는 중입니다...');

  const raw = await zip.file('Contents/section0.xml').async('string');
  const { blocks, mapping, styles, skeletonHead } = SAMPLE_MAP;
  const cut = (no) => {
    const b = blocks[no];
    return b ? raw.slice(b.start, b.end) : '';
  };

  // ── 표지 (샘플 표지를 그대로 쓰되 이름만 바꿔 넣는다) ──
  let cover = cut(SAMPLE_MAP.coverBlock);
  cover = cover
    .replace('원장지원자: 000', `원장지원자: ${esc(applicant || '000')}`)
    .replace('00시군구', esc(city || '00시군구'))
    .replace('신규위탁', esc(center ? `${center}어린이집 위탁` : '신규위탁'));

  // ── 목차 (지자체 목차 그대로) ──
  const h1 = styles.heading1 || { para: 0, char: 0 };
  const h2 = styles.heading2 || h1;
  let toc = para('목   차', h1, { pageBreak: true });
  toc += para('', h2);
  items.forEach((it, i) => {
    toc += para(`${i + 1}.  ${it.name}`, h2);
  });

  // ── 본문 (꼭지는 한 번씩만, 목차에 처음 나온 자리에) ──
  const done = new Set();
  const missing = [];
  let body = '';
  items.forEach((it) => {
    const nos = it.matchId ? mapping[it.matchId] : null;
    if (!nos || !nos.length) {
      missing.push(it.name);
      return;
    }
    if (done.has(it.matchId)) return;
    done.add(it.matchId);
    body += nos.map(cut).join('');
  });

  // 샘플에 없어 직접 써야 하는 항목은 뒤에 안내로 모아 둔다
  if (missing.length) {
    body += para('※ 아래 항목은 샘플에 없습니다. 직접 작성하세요.', h1, { pageBreak: true });
    missing.forEach((m) => {
      body += para(`· ${m}`, h2);
    });
  }

  const sectionXml = skeletonHead + cover + toc + body + '</hs:sec>';

  // ── 다시 압축 (mimetype 을 맨 앞에, 압축 없이) ──
  if (onProgress) onProgress('한글 파일로 묶는 중입니다...');
  const JSZip = await loadJSZip();
  const out = new JSZip();
  out.file('mimetype', await zip.file('mimetype').async('uint8array'), { compression: 'STORE' });
  const names = Object.keys(zip.files).filter(
    (n) => n !== 'mimetype' && n !== 'Contents/section0.xml' && !zip.files[n].dir
  );
  for (const n of names) {
    out.file(n, await zip.file(n).async('uint8array'), { compression: 'DEFLATE' });
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
