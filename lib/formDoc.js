'use client';

// 원장님이 올려 주신 **문서별 서식(샘플)** 을 틀로 삼아, 그 문서 하나만 만든다.
//
// 하는 일
//   · 그 샘플의 header.xml(글꼴·글자크기 정의)을 그대로 물려받는다
//   · 샘플 본문에서 가장 많이 쓰인 글자모양·문단모양을 찾아 "본문 서식"으로 쓴다
//   · 제목용으로는 본문보다 큰 글자모양을 찾아 쓴다
//   · 용지 여백 등 쪽 설정(secPr)도 샘플 것을 그대로 쓴다
//
// 그래서 결과 문서가 원장님 샘플과 같은 글씨체·자간·여백으로 나온다.
//
// 주의(과거 교훈)
//   - mimetype 은 압축하지 않고 맨 앞에 넣어야 한글이 연다
//   - linesegarray 는 새로 넣지 않는다 (한글이 다시 계산한다)

import { fileName } from './forms';

const JSZIP_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

// 같은 서식을 여러 번 받지 않도록 담아 둔다
const cache = {};

async function loadForm(kind, phone, onProgress) {
  if (cache[kind]) return cache[kind];
  const JSZip = await loadJSZip();

  if (onProgress) onProgress('문서 서식을 불러오는 중입니다...');
  const ticket = await fetch(
    `/api/sample?kind=${encodeURIComponent(kind)}&phone=${encodeURIComponent(phone)}`
  );
  const info = await ticket.json();
  if (!ticket.ok) throw new Error(info.error || '문서 서식을 열지 못했습니다');

  const res = await fetch(info.url);
  if (!res.ok) throw new Error('문서 서식을 받지 못했습니다');
  cache[kind] = await JSZip.loadAsync(await res.arrayBuffer());
  return cache[kind];
}

/** 맨 바깥 문단들의 위치 (표 안 문단은 건너뛴다) */
function topLevelParagraphs(xml) {
  const out = [];
  let depth = 0;
  let start = -1;
  const re = /<hp:p[\s>]|<\/hp:p>/g;
  let m;
  while ((m = re.exec(xml))) {
    if (m[0] === '</hp:p>') {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        out.push({ start, end: m.index + m[0].length });
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
    .join('')
    .trim();
}

/**
 * 샘플에서 본문 서식과 제목 서식을 찾아낸다.
 * @returns {{body:{para:number,char:number}, head:{para:number,char:number}, title:{para:number,char:number}}}
 */
function findStyles(xml, header) {
  const heightOf = (charId) => {
    const m = header.match(new RegExp(`<hh:charPr id="${charId}"[^>]*height="(\\d+)"`));
    return m ? Number(m[1]) : 0;
  };

  const paras = topLevelParagraphs(xml);
  const seen = []; // { para, char, len, height }
  paras.forEach((p) => {
    const chunk = xml.slice(p.start, p.end);
    const ids = chunk.match(/<hp:p [^>]*paraPrIDRef="(\d+)"[^>]*>\s*<hp:run charPrIDRef="(\d+)"/);
    if (!ids) return;
    const text = paraText(chunk);
    if (!text) return;
    seen.push({
      para: Number(ids[1]),
      char: Number(ids[2]),
      len: text.length,
      height: heightOf(ids[2]),
    });
  });

  // 본문 = 긴 글에서 가장 많이 쓰인 모양
  const count = new Map();
  seen
    .filter((s) => s.len >= 30)
    .forEach((s) => {
      const k = `${s.para}|${s.char}`;
      count.set(k, (count.get(k) || 0) + 1);
    });
  let best = null;
  let top = 0;
  count.forEach((n, k) => {
    if (n > top) {
      top = n;
      best = k;
    }
  });
  const [bp, bc] = (best || '0|0').split('|').map(Number);
  const body = { para: bp, char: bc };
  const bodyHeight = heightOf(bc) || 1000;

  // 제목 = 짧은 글 중 본문보다 큰 글씨
  const bigs = seen.filter((s) => s.len > 0 && s.len <= 40 && s.height > bodyHeight);
  const pick = (arr) => {
    const c = new Map();
    arr.forEach((s) => {
      const k = `${s.para}|${s.char}`;
      c.set(k, (c.get(k) || 0) + 1);
    });
    let b = null;
    let t = 0;
    c.forEach((n, k) => {
      if (n > t) {
        t = n;
        b = k;
      }
    });
    if (!b) return null;
    const [p, ch] = b.split('|').map(Number);
    return { para: p, char: ch };
  };

  const maxH = bigs.length ? Math.max(...bigs.map((s) => s.height)) : 0;
  const title = pick(bigs.filter((s) => s.height === maxH)) || body;
  const head = pick(bigs.filter((s) => s.height < maxH)) || title;

  return { body, head, title };
}

let pid = 800000;
function para(text, style) {
  pid += 1;
  const run = text
    ? `<hp:run charPrIDRef="${style.char}"><hp:t>${esc(text)}</hp:t></hp:run>`
    : `<hp:run charPrIDRef="${style.char}"></hp:run>`;
  return `<hp:p id="${pid}" paraPrIDRef="${style.para}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">${run}</hp:p>`;
}

/**
 * 문서 만들기
 * @param {object} o
 * @param {string} o.kind    문서 종류 (forms.js 의 key)
 * @param {string} o.phone   로그인한 전화번호
 * @param {Array}  o.blocks  [{ kind: 'title'|'head'|'body', text }]
 * @param {string} o.city    지역 (파일 이름에 쓴다)
 * @param {string} o.student 수강생 이름
 * @param {string} o.docName 문서 이름
 * @param {Function} [o.onProgress]
 */
export async function buildFormDoc({ kind, phone, blocks, city, student, docName, onProgress }) {
  const zip = await loadForm(kind, phone, onProgress);
  if (onProgress) onProgress('문서를 만드는 중입니다...');

  const raw = await zip.file('Contents/section0.xml').async('string');
  const header = await zip.file('Contents/header.xml').async('string');
  const styles = findStyles(raw, header);

  // 쪽 설정(여백 등)이 담긴 첫 문단까지를 그대로 가져온다.
  // ★ 첫 문단에 표가 들어 있으면(원장님이 디자인 서식을 올린 경우) 표 안 문단의
  //    첫 </hp:p> 에서 자르면 표가 안 닫혀 파일이 깨진다. 그래서 **첫 최상위 문단
  //    전체**(표 포함)를 통째로 가져온다.
  const secPrAt = raw.indexOf('<hp:secPr');
  if (secPrAt === -1) {
    throw new Error('이 서식 파일에서 쪽 설정을 찾지 못했습니다.');
  }
  const topParas = topLevelParagraphs(raw);
  const firstPara =
    topParas.find((p) => p.start <= secPrAt && secPrAt < p.end) || topParas[0];
  if (!firstPara) {
    throw new Error('이 서식 파일에서 첫 문단을 찾지 못했습니다.');
  }
  const skeletonHead = raw.slice(0, firstPara.end);

  let xml = '';
  blocks.forEach((b) => {
    const style = styles[b.kind] || styles.body;
    String(b.text == null ? '' : b.text)
      .split(/\r?\n/)
      .forEach((line) => {
        xml += para(line, style);
      });
  });

  const sectionXml = `${skeletonHead}${xml}</hs:sec>`;

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

  // 한글은 포장에 엄격하다 — JSZip이 자동으로 넣는 폴더 항목(Contents/ 등)을 빼 원본 hwpx 구조와 맞춘다.
  Object.keys(out.files).forEach((n) => {
    if (out.files[n].dir) delete out.files[n];
  });
  const blob = await out.generateAsync({ type: 'blob', mimeType: 'application/hwp+zip' });
  return { blob, name: fileName({ city, student, docName }) };
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
