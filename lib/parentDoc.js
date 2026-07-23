'use client';

// 6차시 학부모 참여수업(열린어린이집): 원장님 서식(forms/parent.hwpx)에
// **수강생이 고른 부모·가족 참여 프로그램**으로 "(4) 부모·가족 참여 프로그램" 표를 추가한다.
//
// 서식은 (1) 개방적 환경 / (2) 부모 역량 강화 교육 / (3) 다면적 의사소통 통로 로 끝난다.
// 그 뒤에 (4) 섹션(제목표 + 2열 표)을 서식의 기존 표 스타일 그대로 만들어 붙인다.

import { fileName } from './forms';

const JSZIP_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

const W0 = 9500;
const W1 = 37300;
const TBLW = W0 + W1;

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let _uid = 900000000;
function nid() {
  _uid += 1;
  return _uid;
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

// (4) 제목표 문단 — 서식 (3) 제목표 구조 복제 (셀 borderFill 9, charPr 21, paraPr 24)
function headingPara(title, intro) {
  const cell =
    `<hp:tc name="" header="0" hasMargin="1" protect="0" editable="0" dirty="0" borderFillIDRef="9">` +
    `<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="TOP" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">` +
    `<hp:p id="${nid()}" paraPrIDRef="24" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="21"><hp:t>${esc(title)}</hp:t></hp:run></hp:p>` +
    `</hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/><hp:cellSpan colSpan="1" rowSpan="1"/>` +
    `<hp:cellSz width="${TBLW}" height="282"/><hp:cellMargin left="1000" right="500" top="500" bottom="500"/></hp:tc>`;
  const tbl =
    `<hp:tbl id="${nid()}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="1" colCnt="1" cellSpacing="0" borderFillIDRef="4" noAdjust="0">` +
    `<hp:sz width="${TBLW}" widthRelTo="ABSOLUTE" height="3400" heightRelTo="ABSOLUTE" protect="0"/>` +
    `<hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>` +
    `<hp:outMargin left="141" right="141" top="141" bottom="141"/><hp:inMargin left="510" right="510" top="141" bottom="141"/>` +
    `<hp:tr>${cell}</hp:tr></hp:tbl>`;
  return (
    `<hp:p id="${nid()}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
    `<hp:run charPrIDRef="19">${tbl}<hp:t>${esc(intro)}</hp:t></hp:run></hp:p>`
  );
}

function cell(text, col, row, header) {
  const w = col === 0 ? W0 : W1;
  const bf = header || col === 0 ? 10 : 11;
  const char = header ? 11 : 13;
  const para = header ? 27 : col === 0 ? 28 : 29;
  const hdr = header ? '1' : '0';
  const margin = header
    ? 'left="700" right="700" top="600" bottom="600"'
    : 'left="800" right="800" top="600" bottom="600"';
  return (
    `<hp:tc name="" header="${hdr}" hasMargin="1" protect="0" editable="0" dirty="0" borderFillIDRef="${bf}">` +
    `<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">` +
    `<hp:p id="${nid()}" paraPrIDRef="${para}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${char}"><hp:t>${esc(text)}</hp:t></hp:run></hp:p>` +
    `</hp:subList><hp:cellAddr colAddr="${col}" rowAddr="${row}"/><hp:cellSpan colSpan="1" rowSpan="1"/>` +
    `<hp:cellSz width="${w}" height="282"/><hp:cellMargin ${margin}/></hp:tc>`
  );
}

function tablePara(programs) {
  const R = 1 + programs.length;
  const rows = [`<hp:tr>${cell('참여 프로그램', 0, 0, true)}${cell('세부 운영 내용', 1, 0, true)}</hp:tr>`];
  programs.forEach((p, i) => {
    rows.push(`<hp:tr>${cell(p.name, 0, i + 1)}${cell(p.detail, 1, i + 1)}</hp:tr>`);
  });
  const H = R * 900;
  const tbl =
    `<hp:tbl id="${nid()}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="${R}" colCnt="2" cellSpacing="0" borderFillIDRef="4" noAdjust="0">` +
    `<hp:sz width="${TBLW}" widthRelTo="ABSOLUTE" height="${H}" heightRelTo="ABSOLUTE" protect="0"/>` +
    `<hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>` +
    `<hp:outMargin left="141" right="141" top="141" bottom="141"/><hp:inMargin left="510" right="510" top="141" bottom="141"/>` +
    `${rows.join('')}</hp:tbl>`;
  return (
    `<hp:p id="${nid()}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
    `<hp:run charPrIDRef="19">${tbl}<hp:t/></hp:run></hp:p>`
  );
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

function introFor(theme) {
  const t = theme ? `우리 원의 특색인 「${theme}」과 연계하여 ` : '';
  return ` 부모와 가족이 어린이집 활동에 직접 참여하는 프로그램을 ${t}운영하여, 부모를 보육의 동반자로 세우고 가정과 어린이집의 연계를 강화한다. 위탁심사 요구사항인 3가지 이상 참여 프로그램을 운영한다.`;
}

function buildSection(section, programs, theme) {
  const paras = topParas(section);
  const texts = paras.map(([a, b]) => paraText(section.slice(a, b)));
  const hi = texts.findIndex((t) => t.includes('다면적 의사소통'));
  if (hi < 0 || hi + 1 >= paras.length) {
    throw new Error('학부모 참여 서식 구조를 알아보지 못했습니다. 원장님 열린어린이집 서식이 맞는지 확인해 주세요.');
  }
  const insertAt = paras[hi + 1][1]; // (3) 내용표 다음
  const block = headingPara('(4) 부모·가족 참여 프로그램', introFor(theme)) + tablePara(programs);
  return section.slice(0, insertAt) + block + section.slice(insertAt);
}

/**
 * @param {object} o
 * @param {Array<{name:string,detail:string}>} o.programs  AI가 작성한 참여 프로그램
 * @param {string} [o.theme]  우리 원 특색
 * @param {string} o.phone
 * @param {string} o.city
 * @param {string} o.student
 * @param {Function} [o.onProgress]
 */
export async function buildParentDoc({ programs, theme, phone, city, student, onProgress }) {
  const JSZip = await loadJSZip();

  if (onProgress) onProgress('열린어린이집 서식을 불러오는 중입니다...');
  const ticket = await fetch(`/api/sample?kind=parent&phone=${encodeURIComponent(phone)}`);
  const info = await ticket.json();
  if (!ticket.ok) {
    throw new Error(
      info.error || '서식을 열지 못했습니다. 라지숙 소장이 아직 서식을 올리지 않았을 수 있습니다.'
    );
  }
  const res = await fetch(info.url);
  if (!res.ok) throw new Error('서식을 받지 못했습니다');
  const zip = await JSZip.loadAsync(await res.arrayBuffer());

  if (onProgress) onProgress('참여 프로그램을 서식에 넣는 중입니다...');
  const section = await zip.file('Contents/section0.xml').async('string');
  const newSection = buildSection(section, programs || [], theme);

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
  return {
    blob,
    name: fileName({ city, student, docName: '학부모참여수업' }),
    programs: (programs || []).map((p) => p.name),
  };
}
