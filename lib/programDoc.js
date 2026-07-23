'use client';

// 프로그램 만들기 앱에서 받은 워드(.docx)를 읽어,
// 원장님 **연간계획 한글 서식(forms/program.hwpx)** 을 채워 내려받는다.
//
// 워드 한 파일에 **여러 연령**이 들어 있을 수 있다(원장님 요청).
// 그러면 서식의 한 연령 블록(다. 연령별 특색놀이 프로그램 …)을 연령 수만큼 반복해 넣는다.
//
// 하는 일
//   1. 워드에서 연령별 프로그램들을 뽑는다 (programDocx.js → 배열)
//   2. 서식의 header.xml 에 표 본문용 글자모양(10pt)·가운데 문단모양을 추가한다
//   3. 서식 section0.xml 을 [머리(secPr+첫 제목)] + [연령블록×N] + [꼬리(</hs:sec>)] 로 다시 짠다
//        각 블록 = 다.제목 + 프로그램명 상자 + 목표 + 목적 + 연간 계획표(12개월 격자표)
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
// charPr 9 = 10pt(표 본문), charPr 10 = 흰 굵은 글씨(머리글용)
// paraPr 20 = 가운데 정렬
// borderFill 6 = 머리글(네이비 채움), borderFill 7 = 월 칸(옅은 파랑) — 둘 다 격자선은 borderFill 4와 같음
function patchHeader(header) {
  let h = header;

  // charPr 9 = char8 복제, 10pt (표 본문)
  const char8 = h.match(/<hh:charPr id="8"[\s\S]*?<\/hh:charPr>/);
  if (char8 && !/<hh:charPr id="9"/.test(h)) {
    const char9 = char8[0].replace('id="8"', 'id="9"').replace('height="1200"', 'height="1000"');
    h = h.replace('</hh:charProperties>', char9 + '</hh:charProperties>');
    h = h.replace(/(<hh:charProperties itemCnt=")(\d+)(")/, (m, a, n, b) => a + (Number(n) + 1) + b);
  }
  // charPr 10 = char7(굵게) 복제, 글자색 흰색 (네이비 머리글 위에 쓴다)
  const char7 = h.match(/<hh:charPr id="7"[\s\S]*?<\/hh:charPr>/);
  if (char7 && !/<hh:charPr id="10"/.test(h)) {
    const char10 = char7[0]
      .replace('id="7"', 'id="10"')
      .replace('textColor="#000000"', 'textColor="#FFFFFF"');
    h = h.replace('</hh:charProperties>', char10 + '</hh:charProperties>');
    h = h.replace(/(<hh:charProperties itemCnt=")(\d+)(")/, (m, a, n, b) => a + (Number(n) + 1) + b);
  }

  // paraPr 20 = 가운데 정렬 (머리글·월)
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

  // borderFill 6·7 = borderFill 4(격자선) + 배경색
  const bf4 = h.match(/<hh:borderFill id="4"[\s\S]*?<\/hh:borderFill>/);
  if (bf4 && !/<hh:borderFill id="6"/.test(h)) {
    const withFill = (id, color) =>
      bf4[0]
        .replace('id="4"', `id="${id}"`)
        .replace(
          '</hh:borderFill>',
          `<hc:fillBrush><hc:winBrush faceColor="${color}" hatchColor="#000000" alpha="0"/></hc:fillBrush></hh:borderFill>`
        );
    const bf6 = withFill(6, '#1A3A5C'); // 머리글 네이비
    const bf7 = withFill(7, '#EAF0F7'); // 월 칸 옅은 파랑
    h = h.replace('</hh:borderFills>', bf6 + bf7 + '</hh:borderFills>');
    h = h.replace(/(<hh:borderFills itemCnt=")(\d+)(")/, (m, a, n, b) => a + (Number(n) + 2) + b);
  }

  return h;
}

// ---------- 문단/표 빌더 ----------
let _uid = 900000000;
function nid() {
  _uid += 1;
  return _uid;
}

function para(text, charRef, paraRef, pageBreak) {
  const pb = pageBreak ? 1 : 0;
  return (
    `<hp:p id="${nid()}" paraPrIDRef="${paraRef}" styleIDRef="0" pageBreak="${pb}" columnBreak="0" merged="0">` +
    `<hp:run charPrIDRef="${charRef}"><hp:t>${esc(text)}</hp:t></hp:run></hp:p>`
  );
}

const WIDTHS = [3400, 8600, 13000, 21800]; // 합 46800
const TBLW = WIDTHS.reduce((a, b) => a + b, 0);

function cell(lines, charRef, paraRef, colAddr, rowAddr, width, borderFill) {
  const bf = borderFill || 4;
  const ls = lines && lines.length ? lines : [''];
  const inner = ls.map((x) => para(x, charRef, paraRef)).join('');
  return (
    `<hp:tc name="" header="0" hasMargin="1" protect="0" editable="0" dirty="0" borderFillIDRef="${bf}">` +
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
  // 머리글: 네이비 배경(borderFill 6) + 흰 굵은 글씨(charPr 10) + 가운데(paraPr 20)
  const hdr = ['월', '활동(놀이) 이름', '활동 영역', '놀이 설명'];
  let cells = '';
  for (let c = 0; c < 4; c++) cells += cell([hdr[c]], 10, 20, c, r, WIDTHS[c], 6);
  rowsXml.push(`<hp:tr>${cells}</hp:tr>`);
  r += 1;
  for (const d of rows) {
    cells = '';
    // 월: 옅은 파랑(borderFill 7) + 가운데 / 이름: 흰 바탕 + 가운데 / 영역·설명: 흰 바탕 + 왼쪽
    cells += cell([d.month], 9, 20, 0, r, WIDTHS[0], 7);
    cells += cell([d.name], 9, 20, 1, r, WIDTHS[1], 4);
    cells += cell(d.goals && d.goals.length ? d.goals : [''], 9, 0, 2, r, WIDTHS[2], 4);
    cells += cell(d.steps && d.steps.length ? d.steps : [''], 9, 0, 3, r, WIDTHS[3], 4);
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

// ---------- section0.xml 다시 짜기 ----------
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

function buildMultiSection(section, programs) {
  const paras = topParas(section);
  const chunk = (i) => section.slice(paras[i][0], paras[i][1]);
  const txt = (i) => paraText(chunk(i));

  let boxIdx = -1;
  let annualIdx = -1;
  for (let i = 0; i < paras.length; i++) {
    if (boxIdx === -1 && chunk(i).includes('<hp:tbl')) boxIdx = i;
    if (txt(i).includes('연간 계획표')) annualIdx = i;
  }
  if (boxIdx === -1 || annualIdx === -1) {
    throw new Error('서식에서 프로그램명 상자·연간 계획표 자리를 찾지 못했습니다. 원장님 연간계획 서식이 맞는지 확인해 주세요.');
  }

  const head = section.slice(0, paras[0][1]); // secPr + "다. 연령별 특색놀이 프로그램"(첫 연령 제목)
  const tail = section.slice(paras[annualIdx][1]); // "</hs:sec>"
  const boxTemplate = chunk(boxIdx); // 프로그램명 상자 (P1)

  const titleBox = (name) =>
    boxTemplate
      .replace(/(<hp:tbl id=")\d+(")/, (mm, a, b) => a + nid() + b)
      .replace(/(<hp:t>)[\s\S]*?(<\/hp:t>)/, (mm, a, b) => a + esc(name) + b);

  const blockFor = (p, isFirst) => {
    let s = '';
    if (!isFirst) s += para('다. 연령별 특색놀이 프로그램', 7, 0, true); // 다음 연령은 새 쪽에서
    s += titleBox(p.programName || '');
    s += para('1) 프로그램 목표', 7, 0);
    s += (p.objectives || []).map((o) => para(o, 8, 0)).join('');
    s += para('2) 프로그램 목적', 7, 0);
    s += para(p.purpose || '', 8, 0);
    s += para('3) 연간 계획표', 7, 0);
    s += annualTableParagraph(p.rows || []);
    return s;
  };

  let body = '';
  programs.forEach((p, i) => {
    body += blockFor(p, i === 0);
  });
  return head + body + tail;
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
  const programs = await parseProgramDocx(await file.arrayBuffer(), JSZip);
  if (!programs.length || !programs.some((p) => p.programName && p.rows.length)) {
    throw new Error('워드에서 프로그램 내용을 찾지 못했습니다. 프로그램 만들기에서 연간 계획표까지 만든 파일이 맞는지 확인해 주세요.');
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
  const newSection = buildMultiSection(section, programs);

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
    count: programs.length,
    programNames: programs.map((p) => p.programName),
    totalMonths: programs.reduce((a, p) => a + (p.rows ? p.rows.length : 0), 0),
  };
}
