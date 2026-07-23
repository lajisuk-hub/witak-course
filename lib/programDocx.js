'use client';

// 프로그램 만들기 앱에서 받은 **워드(.docx)** 를 읽어
// 프로그램명 · 목표 · 목적 · 연간 계획표를 뽑아낸다.
//
// 워드 구조 (wmentor-program-planner 출력)
//   · 본문 문단: "▶ 프로그램 목표" 아래 "1. …" 목록, "▶ 프로그램 목적" 아래 한 문단
//   · 표: 0행=프로그램명(4칸 합침), 1행=머리글, 2행~ 월별 데이터
//     - 영아: 월 칸이 vMerge 로 두 활동에 걸쳐 병합 → 빈 월은 앞 월을 이어받는다
//     - cell1=활동이름, cell2=활동영역(목표들), cell3=놀이설명(단계들)

function unescapeXml(s) {
  return String(s == null ? '' : s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

// 한 셀(<w:tc>) 안의 문단들을 줄 배열로 (문단마다 한 줄)
function cellParagraphs(tc) {
  const out = [];
  const ps = tc.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
  for (const p of ps) {
    const ts = p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
    const text = ts.map((t) => unescapeXml(t.replace(/<[^>]+>/g, ''))).join('');
    out.push(text);
  }
  return out;
}

function rowCells(tr) {
  return tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || [];
}

/**
 * @param {ArrayBuffer} buf  .docx 파일 내용
 * @param {any} JSZip
 * @returns {Promise<{programName:string, objectives:string[], purpose:string, rows:Array}>}
 */
export async function parseProgramDocx(buf, JSZip) {
  const zip = await JSZip.loadAsync(buf);
  const docFile = zip.file('word/document.xml');
  if (!docFile) {
    throw new Error('워드 파일이 아니거나 내용을 읽을 수 없습니다. 프로그램 만들기에서 받은 Word(.docx) 파일을 올려 주세요.');
  }
  const xml = await docFile.async('string');

  const tblMatch = xml.match(/<w:tbl>[\s\S]*<\/w:tbl>/);
  if (!tblMatch) {
    throw new Error('워드 안에서 연간 계획표를 찾지 못했습니다. 프로그램 만들기에서 연간 계획표까지 만든 뒤 Word로 받아 주세요.');
  }
  const tbl = tblMatch[0];
  const trs = tbl.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];

  // 프로그램명 = 0행 첫 칸
  let programName = '';
  if (trs[0]) {
    programName = cellParagraphs(rowCells(trs[0])[0] || '')
      .filter((x) => x.trim())
      .join(' ')
      .trim();
  }

  // 2행부터 데이터
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
    rows.push({
      month,
      name: c1.join(' ').trim(),
      goals: c2,
      steps: c3,
    });
  }

  // 본문(표 바깥) 문단 → 목표·목적
  const body = xml.slice(0, tblMatch.index) + xml.slice(tblMatch.index + tbl.length);
  const bodyParas = (body.match(/<w:p\b[\s\S]*?<\/w:p>/g) || []).map((p) => {
    const ts = p.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
    return ts.map((t) => unescapeXml(t.replace(/<[^>]+>/g, ''))).join('');
  });

  const objectives = [];
  let purpose = '';
  let mode = null;
  for (const raw of bodyParas) {
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

  return { programName, objectives, purpose, rows };
}
