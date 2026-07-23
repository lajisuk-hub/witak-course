'use client';

// 프로그램 만들기 앱에서 받은 **워드(.docx)** 를 읽어
// 연령별 프로그램들을 뽑아낸다. (한 파일에 여러 연령이 들어 있을 수 있다)
//
// 워드 구조 (wmentor-program-planner 출력, 여러 연령이면 연령마다 반복)
//   · 표지 문단들(특색보육 프로그램 / 프로그램명 / 연령 | 키워드)
//   · "▶ 프로그램 목표" 아래 "1. …" 목록
//   · "▶ 프로그램 목적" 아래 한 문단
//   · "▶ 연간 계획표"
//   · 표: 0행=프로그램명(4칸 합침), 1행=머리글, 2행~ 월별 데이터
//     - 영아: 월 칸이 vMerge 로 두 활동에 걸쳐 병합 → 빈 월은 앞 월을 이어받는다
//     - cell1=활동이름, cell2=활동영역(목표들), cell3=놀이설명(단계들)
//
// **연령마다 표가 하나** 이므로, 표를 기준으로 프로그램을 나눈다.
// 각 표 바로 앞의 본문(직전 표 끝 ~ 이 표 시작)에서 그 연령의 목표·목적을 읽는다.

function unescapeXml(s) {
  return String(s == null ? '' : s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function paraTexts(chunk) {
  return (chunk.match(/<w:p\b[\s\S]*?<\/w:p>/g) || []).map((p) => {
    const ts = p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
    return ts.map((t) => unescapeXml(t.replace(/<[^>]+>/g, ''))).join('');
  });
}

function cellParagraphs(tc) {
  return paraTexts(tc);
}

function rowCells(tr) {
  return tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || [];
}

// 표 하나 → { programName, rows }
function parseTable(tblXml) {
  const trs = tblXml.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
  let programName = '';
  if (trs[0]) {
    programName = cellParagraphs(rowCells(trs[0])[0] || '')
      .filter((x) => x.trim())
      .join(' ')
      .trim();
  }
  const rows = [];
  let lastMonth = '';
  for (let i = 2; i < trs.length; i++) {
    const cells = rowCells(trs[i]);
    if (cells.length < 4) continue;
    const c0 = cellParagraphs(cells[0]).filter((x) => x.trim());
    const c1 = cellParagraphs(cells[1]).filter((x) => x.trim());
    const c2 = cellParagraphs(cells[2]).filter((x) => x.trim());
    const c3 = cellParagraphs(cells[3]).filter((x) => x.trim());
    let month = c0.join(' ').trim();
    if (month) lastMonth = month;
    else month = lastMonth;
    rows.push({ month, name: c1.join(' ').trim(), goals: c2, steps: c3 });
  }
  return { programName, rows };
}

// 본문 조각 → { objectives, purpose }
function parseBody(slice) {
  const objectives = [];
  let purpose = '';
  let mode = null;
  for (const raw of paraTexts(slice)) {
    const t = raw.trim();
    if (t.includes('프로그램 목표')) {
      mode = 'obj';
      continue;
    }
    if (t.includes('프로그램 목적')) {
      mode = 'pur';
      continue;
    }
    if (t.includes('연간 계획표')) {
      mode = null;
      continue;
    }
    if (mode === 'obj') {
      if (!t) continue;
      const m = t.match(/^\d+[.)]\s*(.+)$/);
      objectives.push((m ? m[1] : t).trim());
    } else if (mode === 'pur') {
      if (t) {
        purpose = t;
        mode = null;
      }
    }
  }
  return { objectives, purpose };
}

/**
 * @param {ArrayBuffer} buf  .docx 파일 내용
 * @param {any} JSZip
 * @returns {Promise<Array<{programName:string, objectives:string[], purpose:string, rows:Array}>>}
 */
export async function parseProgramDocx(buf, JSZip) {
  const zip = await JSZip.loadAsync(buf);
  const docFile = zip.file('word/document.xml');
  if (!docFile) {
    throw new Error('워드 파일이 아니거나 내용을 읽을 수 없습니다. 프로그램 만들기에서 받은 Word(.docx) 파일을 올려 주세요.');
  }
  const xml = await docFile.async('string');

  // 모든 표(연간 계획표)의 위치
  const tables = [];
  const re = /<w:tbl>[\s\S]*?<\/w:tbl>/g;
  let m;
  while ((m = re.exec(xml))) {
    tables.push({ start: m.index, end: m.index + m[0].length, xml: m[0] });
  }
  if (!tables.length) {
    throw new Error('워드 안에서 연간 계획표를 찾지 못했습니다. 프로그램 만들기에서 연간 계획표까지 만든 뒤 Word로 받아 주세요.');
  }

  const programs = [];
  let prevEnd = 0;
  for (const t of tables) {
    const { objectives, purpose } = parseBody(xml.slice(prevEnd, t.start));
    prevEnd = t.end;
    const { programName, rows } = parseTable(t.xml);
    if (!programName && !rows.length) continue;
    programs.push({ programName, objectives, purpose, rows });
  }
  return programs;
}
