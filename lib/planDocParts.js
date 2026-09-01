// 3차시 문서 조립기 (순수 함수 — 브라우저 기능을 쓰지 않아 시험하기 쉽다)
//
// 하는 일
//   ① 원장님 샘플(section0.xml)에서 「표준보육과정 기본설명」과 고른 연령의
//      「연간놀이계획안」 조각을 **원본 XML 그대로** 잘라 온다 (표·그림·서식 100% 보존)
//   ② 샘플에 없는 「월간보육계획안」·「하루일지」는 planContent.js 내용으로 표를 그려 붙인다
//   ③ 항목 번호 1) 2) 3) … 을 고른 연령 순서대로 다시 매긴다
//
// 표 모양(테두리·글자모양)은 샘플 안에 이미 있는 표에서 번호를 찾아 그대로 쓴다.
// 그래서 원장님이 서식을 바꿔 올려도 그 서식의 모양을 따라간다.
//
// 주의(과거 교훈): linesegarray 는 새로 넣지 않는다 (한글이 다시 계산한다)

import { PLAN_AGES, MONTHLY_INTRO, DAILY_INTRO } from './planContent';

const TBL_WIDTH = 48215; // 샘플 표 폭(HWPUNIT) — 표를 못 찾았을 때 쓰는 기본값

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 맨 바깥 문단들의 위치 (표 안 문단은 건너뛴다) */
export function topParas(xml) {
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

export function paraText(chunk) {
  return (chunk.match(/<hp:t>([\s\S]*?)<\/hp:t>/g) || [])
    .map((p) => p.replace(/<\/?hp:t>/g, ''))
    .join('')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

/** 문단의 첫 글자덩이(제목 판별용) */
function firstText(chunk) {
  const m = chunk.match(/<hp:t>([\s\S]*?)<\/hp:t>/);
  return m ? m[1].replace(/&amp;/g, '&').trim() : '';
}

/** "3) 2세 연간놀이계획안" 의 앞 번호를 새 번호로 바꾼다 */
function renumber(chunk, no) {
  return chunk.replace(/<hp:t>(\s*)\d+\)/, `<hp:t>$1${no})`);
}

// ───────────────────────── 서식(글자모양·표모양) 찾기 ─────────────────────────

/**
 * 샘플에서 문단 서식을 찾는다.
 *  body : 본문 (가장 많이 쓰인 긴 문단 모양)
 *  head : 항목 제목 "1) …" 모양
 *  sect : 큰 제목 "가. …" 모양
 */
export function findParaStyles(xml) {
  const paras = topParas(xml);
  const counts = new Map();
  let head = null;
  let headAny = null;
  let sect = null;
  let sectAny = null;

  paras.forEach(([a, b]) => {
    const chunk = xml.slice(a, b);
    if (chunk.includes('<hp:tbl ')) return;
    const ids = chunk.match(/<hp:p [^>]*paraPrIDRef="(\d+)"[^>]*>\s*<hp:run charPrIDRef="(\d+)"/);
    if (!ids) return;
    const style = { para: Number(ids[1]), char: Number(ids[2]) };
    const text = firstText(chunk);
    if (!text) return;
    // 항목 제목은 "1) 0세 연간놀이계획안" 모양을 먼저 찾는다 (본문과 글자모양이 다르다)
    if (!head && /^\d+\)\s*만?\s*[0-5]세/.test(text)) head = style;
    if (!headAny && /^\d+\)\s/.test(text)) headAny = style;
    if (!sect && /^[가-하]\.\s*(연간|표준보육과정)/.test(text)) sect = style;
    if (!sectAny && /^[가-하]\.\s/.test(text)) sectAny = style;
    if (text.length >= 30) {
      const k = `${style.para}|${style.char}`;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  });

  let best = null;
  let top = 0;
  counts.forEach((n, k) => {
    if (n > top) {
      top = n;
      best = k;
    }
  });
  const [bp, bc] = (best || '0|0').split('|').map(Number);
  const body = { para: bp, char: bc };
  const headStyle = head || headAny || body;
  return { body, head: headStyle, sect: sect || sectAny || headStyle };
}

/**
 * 샘플에 이미 있는 표에서 표 모양(테두리 번호·칸 글자모양)을 가져온다.
 * 못 찾으면 기본값을 쓴다.
 */
export function findTableStyle(xml, headerXml) {
  const fallback = {
    tblBorder: 7,
    headCell: { border: 11, para: 52, char: 19 },
    keyCell: { border: 11, para: 53, char: 19 },
    bodyCell: { border: 12, para: 54, char: 20 },
    width: TBL_WIDTH,
    outMargin: '<hp:outMargin left="141" right="141" top="141" bottom="141"/>',
    inMargin: '<hp:inMargin left="510" right="510" top="141" bottom="141"/>',
  };

  const tbls = xml.match(/<hp:tbl [\s\S]*?<\/hp:tbl>/g) || [];
  for (const tbl of tbls) {
    // 제목 상자 같은 작은 표는 건너뛰고, 머리글이 있는 진짜 내용 표를 쓴다
    const rowCnt = Number((tbl.match(/<hp:tbl [^>]*rowCnt="(\d+)"/) || [])[1] || 0);
    const colCnt = Number((tbl.match(/<hp:tbl [^>]*colCnt="(\d+)"/) || [])[1] || 0);
    if (rowCnt < 3 || colCnt < 2) continue;
    const head = tbl.match(
      /<hp:tc [^>]*header="1"[^>]*borderFillIDRef="(\d+)"[^>]*>[\s\S]*?<hp:p [^>]*paraPrIDRef="(\d+)"[^>]*>\s*<hp:run charPrIDRef="(\d+)"/
    );
    const body = tbl.match(
      /<hp:tc [^>]*header="0"[^>]*borderFillIDRef="(\d+)"[^>]*>[\s\S]*?<hp:p [^>]*paraPrIDRef="(\d+)"[^>]*>\s*<hp:run charPrIDRef="(\d+)"/
    );
    if (!head || !body) continue;
    const tblBorder = (tbl.match(/<hp:tbl [^>]*borderFillIDRef="(\d+)"/) || [])[1];
    const width = (tbl.match(/<hp:sz width="(\d+)"/) || [])[1];
    const out = (tbl.match(/<hp:outMargin [^>]*\/>/) || [])[0];
    const inn = (tbl.match(/<hp:inMargin [^>]*\/>/) || [])[0];

    // 긴 글이 든 칸의 문단모양(왼쪽 정렬)을 찾아 본문 칸에 쓴다
    const longPara = findLongTextPara(xml, headerXml, Number(body[2]));

    return {
      tblBorder: Number(tblBorder || fallback.tblBorder),
      headCell: { border: Number(head[1]), para: Number(head[2]), char: Number(head[3]) },
      keyCell: { border: Number(body[1]), para: Number(body[2]), char: Number(body[3]) },
      bodyCell: { border: Number(body[1]), para: longPara, char: Number(body[3]) },
      width: Number(width || fallback.width),
      outMargin: out || fallback.outMargin,
      inMargin: inn || fallback.inMargin,
    };
  }
  return fallback;
}

/** 표 안에서 긴 글에 쓰인 문단모양을 찾는다 (왼쪽 정렬을 먼저 고른다) */
function findLongTextPara(xml, headerXml, fallbackPara) {
  // 표 안 문단만 본다 — 본문 문단모양은 위아래 여백이 있어 표 칸이 벌어진다
  const inTables = (xml.match(/<hp:tbl [\s\S]*?<\/hp:tbl>/g) || []).join('');
  const counts = new Map();
  const re = /<hp:p [^>]*paraPrIDRef="(\d+)"[^>]*>\s*<hp:run charPrIDRef="\d+"><hp:t>([\s\S]{25,}?)<\/hp:t>/g;
  let m;
  while ((m = re.exec(inTables))) counts.set(m[1], (counts.get(m[1]) || 0) + 1);
  if (!counts.size) return fallbackPara;

  const aligned = (id) => {
    if (!headerXml) return null;
    const at = headerXml.indexOf(`<hh:paraPr id="${id}"`);
    if (at === -1) return null;
    const end = headerXml.indexOf('</hh:paraPr>', at);
    const one = headerXml.slice(at, end === -1 ? at + 2000 : end);
    const al = one.match(/<hh:align [^>]*horizontal="(\w+)"/);
    return al ? al[1] : null;
  };

  let best = null;
  let bestScore = -1;
  counts.forEach((n, id) => {
    const al = aligned(id);
    const score = n + (al === 'LEFT' || al === 'JUSTIFY' ? 1000 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  });
  return Number(best || fallbackPara);
}

// ───────────────────────────── 문단·표 만들기 ─────────────────────────────

let _uid = 700000000;
function nid() {
  _uid += 1;
  return _uid;
}

export function para(text, style) {
  const run = text
    ? `<hp:run charPrIDRef="${style.char}"><hp:t>${esc(text)}</hp:t></hp:run>`
    : `<hp:run charPrIDRef="${style.char}"></hp:run>`;
  return `<hp:p id="${nid()}" paraPrIDRef="${style.para}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">${run}</hp:p>`;
}

function cell(text, { col, row, width, cellStyle }) {
  const lines = String(text == null ? '' : text).split('\n');
  const inner = lines
    .map(
      (line) =>
        `<hp:p id="${nid()}" paraPrIDRef="${cellStyle.para}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
        `<hp:run charPrIDRef="${cellStyle.char}"><hp:t>${esc(line)}</hp:t></hp:run></hp:p>`
    )
    .join('');
  return (
    `<hp:tc name="" header="${cellStyle.header ? '1' : '0'}" hasMargin="1" protect="0" editable="0" dirty="0" borderFillIDRef="${cellStyle.border}">` +
    `<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">` +
    `${inner}</hp:subList>` +
    `<hp:cellAddr colAddr="${col}" rowAddr="${row}"/><hp:cellSpan colSpan="1" rowSpan="1"/>` +
    `<hp:cellSz width="${width}" height="282"/><hp:cellMargin left="700" right="700" top="600" bottom="600"/></hp:tc>`
  );
}

/**
 * 표 한 개를 문단으로 만든다.
 * @param {string[]} headers 머리글 (없으면 null)
 * @param {Array<string[]>} rows 줄별 칸 내용
 * @param {number[]} ratio 칸 너비 비율
 * @param {object} st findTableStyle 결과
 * @param {number[]} [labelCols] 가운데 정렬할 칸(좁은 이름 칸) 번호
 */
export function table(headers, rows, ratio, st, labelCols) {
  const label = labelCols || [0];
  const cols = ratio.length;
  const total = ratio.reduce((a, b) => a + b, 0);
  const widths = ratio.map((r) => Math.round((st.width * r) / total));
  widths[cols - 1] = st.width - widths.slice(0, cols - 1).reduce((a, b) => a + b, 0);

  const trs = [];
  let row = 0;
  if (headers) {
    trs.push(
      `<hp:tr>${headers
        .map((h, i) =>
          cell(h, {
            col: i,
            row: 0,
            width: widths[i],
            cellStyle: { ...st.headCell, header: true },
          })
        )
        .join('')}</hp:tr>`
    );
    row = 1;
  }
  rows.forEach((r, i) => {
    trs.push(
      `<hp:tr>${r
        .map((v, c) =>
          cell(v, {
            col: c,
            row: row + i,
            width: widths[c],
            cellStyle: label.includes(c) ? st.keyCell : st.bodyCell,
          })
        )
        .join('')}</hp:tr>`
    );
  });

  const rowCnt = rows.length + (headers ? 1 : 0);
  const tbl =
    `<hp:tbl id="${nid()}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="${rowCnt}" colCnt="${cols}" cellSpacing="0" borderFillIDRef="${st.tblBorder}" noAdjust="0">` +
    `<hp:sz width="${st.width}" widthRelTo="ABSOLUTE" height="${rowCnt * 1200}" heightRelTo="ABSOLUTE" protect="0"/>` +
    `<hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>` +
    `${st.outMargin}${st.inMargin}${trs.join('')}</hp:tbl>`;

  return (
    `<hp:p id="${nid()}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
    `<hp:run charPrIDRef="${st.bodyCell.char}">${tbl}<hp:t></hp:t></hp:run></hp:p>`
  );
}

// ───────────────────────── 월간·하루일지 만들기 ─────────────────────────

function monthlyBlock(age, no, styles, tblSt) {
  const m = age.monthly;
  let xml = para(`${no}) ${age.short} 월간보육계획안 (${m.month} 예시)`, styles.head);
  xml += para(`▣ 생활주제 : ${m.theme}   ▣ 보육목표 : ${m.goal}`, styles.body);
  xml += table(
    ['주', '놀이 주제', `예상되는 ${age.band}의 놀이`, '교사의 지원'],
    m.weeks.map((w) => [w.w, w.topic, w.play, w.support]),
    [4, 12, 24, 24],
    tblSt,
    [0, 1]
  );
  xml += table(
    ['구 분', '운영 내용'],
    m.run.map((r) => [r.k, r.v]),
    [12, 52],
    tblSt
  );
  xml += para('', styles.body);
  return xml;
}

function dailyBlock(age, no, styles, tblSt) {
  const d = age.daily;
  let xml = para(`${no}) ${age.short} 하루 일과 및 보육일지`, styles.head);
  xml += para(d.note, styles.body);
  xml += table(
    ['시 간', '일 과', '놀이 및 활동 내용'],
    d.schedule.map((s) => [s.time, s.part, s.content]),
    [12, 16, 36],
    tblSt,
    [0, 1]
  );
  xml += para(`◦ ${age.short} 보육일지 서식 (작성 예시)`, styles.body);
  xml += table(
    ['기록 항목', '작성 내용'],
    d.record.map((r) => [r.k, r.v]),
    [14, 50],
    tblSt
  );
  xml += para('', styles.body);
  return xml;
}

// ───────────────────────────── 전체 조립 ─────────────────────────────

/**
 * 고른 연령으로 3차시 문서의 section0.xml 을 만든다.
 * @param {string} sectionXml 원장님 샘플의 section0.xml
 * @param {string[]} ageKeys  ['0','1', ...] 고른 연령
 * @param {string} [headerXml] 샘플의 header.xml (문단 정렬을 살펴보는 데 쓴다)
 * @returns {{xml:string, used:string[], missing:string[]}}
 */
export function buildPlanSection(sectionXml, ageKeys, headerXml) {
  const xml = sectionXml;
  const paras = topParas(xml);
  if (!paras.length) throw new Error('샘플 문서의 본문을 읽지 못했습니다.');

  const texts = paras.map(([a, b]) => firstText(xml.slice(a, b)));
  const styles = findParaStyles(xml);
  const tblSt = findTableStyle(xml, headerXml);

  // 쪽 설정(여백 등)이 든 첫 문단까지는 그대로 가져온다
  const secPrAt = xml.indexOf('<hp:secPr');
  if (secPrAt === -1) throw new Error('샘플 문서에서 쪽 설정을 찾지 못했습니다.');
  const firstPara = paras.find(([a, b]) => a <= secPrAt && secPrAt < b) || paras[0];
  const head = xml.slice(0, firstPara[1]);
  const firstIdx = paras.indexOf(firstPara);

  // ── 표준보육과정 기본설명: "가. 표준보육과정" 부터 "나. 연간 …" 앞까지 ──
  const explainStart = texts.findIndex(
    (t, i) => i > firstIdx && /표준보육과정/.test(t) && /^[가-하]\./.test(t)
  );
  const yearHead = texts.findIndex((t, i) => i > firstIdx && /^[가-하]\./.test(t) && /연간/.test(t));
  if (explainStart === -1 || yearHead === -1 || yearHead <= explainStart) {
    throw new Error(
      '샘플에서 표준보육과정 설명 부분을 찾지 못했습니다. 라지숙 소장에게 문의해 주세요.'
    );
  }
  // 바로 앞에 "3. 위탁기간 …" 같은 큰 제목이 있으면 함께 가져온다
  let from = explainStart;
  if (from > firstIdx + 1 && /^\d+\.\s/.test(texts[from - 1])) from -= 1;

  const explain = xml.slice(paras[from][0], paras[yearHead][0]);

  // ── 연령별 연간놀이계획안 조각 ──
  const ageAt = {};
  texts.forEach((t, i) => {
    const m = t.match(/^\d+\)\s*만?\s*([0-5])세\s*연간/);
    if (m && ageAt[m[1]] === undefined) ageAt[m[1]] = i;
  });
  // 놀이흐름도 / 하루 일과표 그림 부분
  const flowAt = texts.findIndex((t, i) => i > yearHead && /놀이흐름도/.test(t));

  const marks = Object.values(ageAt).concat(flowAt === -1 ? [] : [flowAt]).sort((a, b) => a - b);
  const endOf = (i) => {
    const next = marks.find((k) => k > i);
    return next === undefined ? paras.length : next;
  };

  const wanted = PLAN_AGES.filter((a) => ageKeys.includes(a.key));
  const used = [];
  const missing = [];

  // ── 나. 연간 놀이계획안 ──
  let out = xml.slice(paras[yearHead][0], paras[yearHead][1]); // "나." 제목
  const yearIntro = paras[yearHead + 1];
  if (yearIntro && !texts[yearHead + 1].match(/^\d+\)/) && !xml.slice(yearIntro[0], yearIntro[1]).includes('<hp:tbl ')) {
    out += xml.slice(yearIntro[0], yearIntro[1]);
  }

  let no = 0;
  wanted.forEach((age) => {
    const i = ageAt[age.key];
    if (i === undefined) {
      missing.push(age.short);
      return;
    }
    no += 1;
    used.push(age.short);
    const block = xml.slice(paras[i][0], paras[endOf(i) - 1][1]);
    out += renumber(block, no);
  });

  if (!used.length) {
    throw new Error('고른 연령의 연간놀이계획안을 샘플에서 찾지 못했습니다.');
  }

  // 놀이흐름도·하루 일과표(그림)는 항상 넣는다
  if (flowAt !== -1) {
    let flow = xml.slice(paras[flowAt][0], paras[paras.length - 1][1]);
    // 7) 8) → 다음 번호로 다시 매긴다
    let n = no;
    flow = flow.replace(/<hp:t>(\s*)\d+\)/g, (_, sp) => {
      n += 1;
      return `<hp:t>${sp}${n})`;
    });
    out += flow;
  }

  // ── 다. 월간보육계획안 (새로 만든 내용) ──
  out += para('', styles.body);
  out += para('다. 연령별 월간보육계획안', styles.sect);
  out += para(MONTHLY_INTRO, styles.body);
  let mno = 0;
  wanted.forEach((age) => {
    if (!used.includes(age.short)) return;
    mno += 1;
    out += monthlyBlock(age, mno, styles, tblSt);
  });

  // ── 라. 하루 일과 및 보육일지 (새로 만든 내용) ──
  out += para('라. 연령별 하루 일과 및 보육일지', styles.sect);
  out += para(DAILY_INTRO, styles.body);
  let dno = 0;
  wanted.forEach((age) => {
    if (!used.includes(age.short)) return;
    dno += 1;
    out += dailyBlock(age, dno, styles, tblSt);
  });

  return { xml: `${head}${explain}${out}</hs:sec>`, used, missing };
}
