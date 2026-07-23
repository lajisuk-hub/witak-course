'use client';

// 프로그램 만들기 앱에서 받은 워드(.docx)를 읽어,
// 원장님 **연간계획 한글 서식(forms/program.hwpx)** 을 채워 내려받는다.
//
// 하는 일
//   1. 워드에서 프로그램명·목표·목적·연간표를 뽑는다 (programDocx.js)
//   2. 서식의 header.xml 에 표 본문용 글자모양(10pt)·가운데 문단모양을 추가한다
//   3. 서식 section0.xml 에서
//        · 프로그램명 상자의 글자를 바꾸고
//        · "1) 프로그램 목표" 아래 목록을 새 목표로 교체
//        · "2) 프로그램 목적" 아래 문단을 새 목적으로 교체
//        · "3) 연간 계획표" 뒤에 12개월 표를 새로 만들어 넣는다
//   4. 표 모양(격자)은 서식에 이미 있는 borderFill(4) 를 그대로 쓴다
//
// 과거 교훈
//   - mimetype 은 압축 없이 맨 앞
//   - 표 셀의 여러 줄은 줄마다 <hp:p> 문단을 따로 (linesegarray 는 넣지 않음 → 한글이 다시 계산)

import { parseProgramDocx } from './programDocx';
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

// ---------- header.xml 에 스타일 추가 ----------
// charPr 9 = char8 복제, 10pt (표 본문) / paraPr 20 = 가운데 정렬 (머리글·월)
function patchHeader(header) {
  let h = header;
  const char8 = h.match(/<hh:charPr id="8"[\s\S]*?<\/hh:charPr>/);
  if (char8 && !/<hh:charPr id="9"/.test(h)) {
    const char9 = char8[0].replace('id="8"', 'id="9"').replace('height="1200"', 'height="1000"');
    h = h.replace('</hh:charProperties>', char9 + '</hh:charProperties>');
    h = h.replace(/(<hh:charProperties itemCnt=")(\d+)(")/, (m, a, n, b) => a + (Number(n) + 1) + b);
  }
  const pp0 = h.match(/<hh:paraPr id="0"[\s\S]*?<\/hh:paraPr>/);
  if (pp0 && !/<hh:paraPr id="20"/.test(h)) {
    const pp20 = pp0[0]
      .replace('id="0"', 'id="20"')
      .replace(
        /<hh:align horizontal="\w+" vertical="\w+"\/>/,
        '<hh:align horizontal="CENTER" vertical="CENTER"/>'
      );
    h = h.replace('</hh:paraProperties>', pp20 + '</hh:paraProperties>');
    h = h.replace(/(<hh:paraProperties itemCnt=")(\d+)(")/, (m, a, n, b) => a + (Number(n) + 1) + b);
  }
  return h;
}

// ---------- 문단/표 빌더 ----------
let _uid = 900000000;
function nid() {
  _uid += 1;
  return _uid;
}

function para(text, charRef, paraRef) {
  return (
    `<hp:p id="${nid()}" paraPrIDRef="${paraRef}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
    `<hp:run charPrIDRef="${charRef}"><hp:t>${esc(text)}</hp:t></hp:run></hp:p>`
  );
}

const WIDTHS = [3400, 8600, 13000, 21800]; // 합 46800
const TBLW = WIDTHS.reduce((a, b) => a + b, 0);

function cell(lines, charRef, paraRef, colAddr, rowAddr, width) {
  const ls = lines && lines.length ? lines : [''];
  const inner = ls.map((x) => para(x, charRef, paraRef)).join('');
  return (
    `<hp:tc name="" header="0" hasMargin="1" protect="0" editable="0" dirty="0" borderFillIDRef="4">` +
    `<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">` +
    `${inner}</hp:subList>` +
    `<hp:cellAddr colAddr="${colAddr}" rowAddr="${rowAddr}"/>` +
    `<hp:cellSpan colSpan="1" rowSpan="1"/>` +
    `<hp:cellSz width="${width}" height="600"/>` +
    `<hp:cellMargin left="510" right="510" top="141" bottom="141"/>` +
    `</hp:tc>`
  );
}

function annualTableParagraph(rows) {
  const rowsXml = [];
  let r = 0;
  const hdr = ['월', '활동(놀이) 이름', '활동 영역', '놀이 설명'];
  let cells = '';
  for (let c = 0; c < 4; c++) cells += cell([hdr[c]], 7, 20, c, r, WIDTHS[c]);
  rowsXml.push(`<hp:tr>${cells}</hp:tr>`);
  r += 1;
  for (const d of rows) {
    cells = '';
    cells += cell([d.month], 9, 20, 0, r, WIDTHS[0]);
    cells += cell([d.name], 9, 20, 1, r, WIDTHS[1]);
    cells += cell(d.goals && d.goals.length ? d.goals : [''], 9, 0, 2, r, WIDTHS[2]);
    cells += cell(d.steps && d.steps.length ? d.steps : [''], 9, 0, 3, r, WIDTHS[3]);
    rowsXml.push(`<hp:tr>${cells}</hp:tr>`);
    r += 1;
  }
  const H = r * 600;
  const tbl =
    `<hp:tbl id="${nid()}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="${r}" colCnt="4" cellSpacing="0" borderFillIDRef="4" noAdjust="0">` +
    `<hp:sz width="${TBLW}" widthRelTo="ABSOLUTE" height="${H}" heightRelTo="ABSOLUTE" protect="0"/>` +
    `<hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>` +
    `<hp:outMargin left="141" right="141" top="141" bottom="141"/>` +
    `<hp:inMargin left="510" right="510" top="141" bottom="141"/>` +
    `${rowsXml.join('')}</hp:tbl>`;
  return (
    `<hp:p id="${nid()}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
    `<hp:run charPrIDRef="8">${tbl}<hp:t/></hp:run></hp:p>`
  );
}

// ---------- section0.xml 편집 ----------
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

function buildSection(section, data) {
  const paras = topParas(section);
  const txt = (i) => paraText(section.slice(paras[i][0], paras[i][1]));

  let goalH = null;
  let purH = null;
  let annH = null;
  for (let i = 0; i < paras.length; i++) {
    const t = txt(i);
    if (goalH === null && t.includes('프로그램 목표')) goalH = i;
    else if (purH === null && t.includes('프로그램 목적')) purH = i;
    else if (annH === null && t.includes('연간 계획표')) annH = i;
  }
  if (goalH === null || purH === null || annH === null) {
    throw new Error('서식에서 목표·목적·연간 계획표 자리를 찾지 못했습니다. 원장님 연간계획 서식이 맞는지 확인해 주세요.');
  }

  const goalStart = paras[goalH + 1][0];
  const goalEnd = paras[purH - 1][1];
  const purStart = paras[purH + 1][0];
  const purEnd = paras[annH - 1][1];
  const annAt = paras[annH][1];

  // 프로그램명 상자 = 첫 표가 든 문단 (보통 P1)
  let boxIdx = 1;
  for (let i = 0; i < paras.length; i++) {
    if (section.slice(paras[i][0], paras[i][1]).includes('<hp:tbl')) {
      boxIdx = i;
      break;
    }
  }
  const [boxS, boxE] = paras[boxIdx];
  const boxChunk = section.slice(boxS, boxE);
  const newBox = boxChunk.replace(
    /(<hp:t>)[\s\S]*?(<\/hp:t>)/,
    (mm, a, b) => a + esc(data.programName) + b
  );

  const objXml = data.objectives.map((o) => para(o, 8, 0)).join('');
  const purXml = para(data.purpose, 8, 0);
  const annXml = annualTableParagraph(data.rows);

  // 뒤(offset 큰 곳)부터 바꿔 앞 offset 을 보존:
  //   annAt > purEnd > goalEnd > boxE  (박스가 맨 앞)
  let s = section;
  s = s.slice(0, annAt) + annXml + s.slice(annAt);
  s = s.slice(0, purStart) + purXml + s.slice(purEnd);
  s = s.slice(0, goalStart) + objXml + s.slice(goalEnd);
  s = s.slice(0, boxS) + newBox + s.slice(boxE);
  return s;
}

/**
 * @param {object} o
 * @param {File}   o.file     프로그램 만들기 앱에서 받은 워드(.docx)
 * @param {string} o.phone    로그인한 전화번호
 * @param {string} o.city     지역
 * @param {string} o.student  수강생 이름
 * @param {Function} [o.onProgress]
 */
export async function buildProgramDoc({ file, phone, city, student, onProgress }) {
  const JSZip = await loadJSZip();

  if (onProgress) onProgress('워드 파일을 읽는 중입니다...');
  const data = await parseProgramDocx(await file.arrayBuffer(), JSZip);
  if (!data.programName) {
    throw new Error('워드에서 프로그램명을 찾지 못했습니다. 프로그램 만들기에서 연간 계획표까지 만든 파일이 맞는지 확인해 주세요.');
  }
  if (!data.rows.length) {
    throw new Error('워드에서 연간 계획표 내용을 찾지 못했습니다.');
  }

  if (onProgress) onProgress('연간계획 서식을 불러오는 중입니다...');
  const ticket = await fetch(`/api/sample?kind=program&phone=${encodeURIComponent(phone)}`);
  const info = await ticket.json();
  if (!ticket.ok) {
    throw new Error(
      info.error || '연간계획 서식을 열지 못했습니다. 라지숙 소장이 아직 서식을 올리지 않았을 수 있습니다.'
    );
  }
  const res = await fetch(info.url);
  if (!res.ok) throw new Error('연간계획 서식을 받지 못했습니다');
  const zip = await JSZip.loadAsync(await res.arrayBuffer());

  if (onProgress) onProgress('서식에 내용을 채우는 중입니다...');
  const header = await zip.file('Contents/header.xml').async('string');
  const section = await zip.file('Contents/section0.xml').async('string');
  const newHeader = patchHeader(header);
  const newSection = buildSection(section, data);

  if (onProgress) onProgress('한글 파일로 묶는 중입니다...');
  const out = new JSZip();
  out.file('mimetype', await zip.file('mimetype').async('uint8array'), { compression: 'STORE' });
  const names = Object.keys(zip.files).filter(
    (n) =>
      n !== 'mimetype' &&
      n !== 'Contents/section0.xml' &&
      n !== 'Contents/header.xml' &&
      !zip.files[n].dir
  );
  for (const n of names) {
    out.file(n, await zip.file(n).async('uint8array'), { compression: 'DEFLATE' });
  }
  out.file('Contents/header.xml', newHeader, { compression: 'DEFLATE' });
  out.file('Contents/section0.xml', newSection, { compression: 'DEFLATE' });

  const blob = await out.generateAsync({ type: 'blob', mimeType: 'application/hwp+zip' });
  return {
    blob,
    name: fileName({ city, student, docName: '연간계획' }),
    programName: data.programName,
    months: data.rows.length,
    objectives: data.objectives.length,
  };
}
