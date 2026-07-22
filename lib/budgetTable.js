'use client';

// 원장님 예산서 한글 서식의 **표 칸을 채운다.**
//
// 서식 구조 (확인함)
//   표1 = 세입(데이터 21줄), 표2 = 세출(데이터 36줄)
//   각 줄 = [ …관/항… , 목코드, 목이름, 예산액, 전년도예산액, 증감, 산출기초 ]
//   관·항이 세로 병합이라 줄마다 칸 수가 10/8/6 으로 다르지만,
//   **어느 줄이든 마지막 4칸이 채울 자리**다.
//
// 빈 칸은 <hp:run charPrIDRef="12"/> 모양이라 그 안에 <hp:t> 만 끼우면
// 표 모양·칸 너비·테두리가 그대로 유지된다.

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 겹치지 않는 맨 바깥 <tag> 구간을 찾는다 */
function spans(xml, tag) {
  const out = [];
  let depth = 0;
  let start = -1;
  const re = new RegExp(`<${tag}[\\s>]|</${tag}>`, 'g');
  let m;
  while ((m = re.exec(xml))) {
    if (m[0].startsWith('</')) {
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

function cellText(xml) {
  return (xml.match(/<hp:t>([\s\S]*?)<\/hp:t>/g) || [])
    .map((t) => t.replace(/<\/?hp:t>/g, ''))
    .join('')
    .trim();
}

/** 칸 안의 첫 문단에 글자를 넣는다 (이미 글자가 있으면 그대로 둔다) */
function fillCell(cellXml, text) {
  if (!text) return cellXml;
  if (cellText(cellXml)) return cellXml; // 이미 글자가 있는 칸은 건드리지 않는다

  // <hp:run charPrIDRef="12"/>  또는  <hp:run charPrIDRef="12"></hp:run>
  const selfClose = cellXml.match(/<hp:run charPrIDRef="(\d+)"\s*\/>/);
  if (selfClose) {
    return cellXml.replace(
      selfClose[0],
      `<hp:run charPrIDRef="${selfClose[1]}"><hp:t>${esc(text)}</hp:t></hp:run>`
    );
  }
  const empty = cellXml.match(/<hp:run charPrIDRef="(\d+)"><\/hp:run>/);
  if (empty) {
    return cellXml.replace(
      empty[0],
      `<hp:run charPrIDRef="${empty[1]}"><hp:t>${esc(text)}</hp:t></hp:run>`
    );
  }
  return cellXml;
}

/**
 * 표를 채운다.
 *
 * 주의: 목 코드가 세입·세출에서 겹친다.
 *   111 = 세입 정부지원보육료 / 세출 원장급여
 *   221 = 세입 기타필요경비   / 세출 업무추진비
 *   311 = 세입 인건비보조금   / 세출 교직원연수·연구비
 *   421 = 세입 단기차입금     / 세출 기타필요경비
 *   811 = 세입 이자수입       / 세출 과년도지출
 * 그래서 **표 순서(첫 표 = 세입, 둘째 표 = 세출)로 나눠서** 채운다.
 *
 * @param {string} sectionXml  Contents/section0.xml
 * @param {object} income      세입 { 목코드: { amount, basis } }
 * @param {object} expense     세출 { 목코드: { amount, basis } }
 * @returns {{xml:string, filled:{income:string[],expense:string[]}, missing:string[]}}
 */
export function fillBudgetTables(sectionXml, income = {}, expense = {}) {
  let xml = sectionXml;
  const filled = { income: [], expense: [] };
  const usedIncome = new Set();
  const usedExpense = new Set();

  // 서식 앞쪽에 설명용 표가 여러 개 있을 수 있으므로,
  // **예산서 표만 골라낸다** — 줄이 10줄 넘고 머리글에 '산출기초'가 있는 표.
  const all = spans(xml, 'hp:tbl');
  const budgetTables = all.filter((t) => {
    const tbl = xml.slice(t.start, t.end);
    return spans(tbl, 'hp:tr').length >= 10 && tbl.includes('산출기초');
  });
  if (budgetTables.length < 2) {
    throw new Error(
      '예산서 서식에서 세입·세출 표를 찾지 못했습니다. 서식에 두 표가 들어 있는지 확인해 주세요.'
    );
  }

  // 문서에 나온 순서대로 앞이 세입, 뒤가 세출
  const incomeStart = budgetTables[0].start;

  // 뒤에서부터 고쳐야 앞쪽 위치가 어긋나지 않는다
  const tables = budgetTables.slice().reverse();

  tables.forEach((t) => {
    const isIncome = t.start === incomeStart;
    const values = isIncome ? income : expense;
    const used = isIncome ? usedIncome : usedExpense;
    const bag = isIncome ? filled.income : filled.expense;
    let tbl = xml.slice(t.start, t.end);
    const rows = spans(tbl, 'hp:tr').reverse();

    rows.forEach((r) => {
      let row = tbl.slice(r.start, r.end);
      const cells = spans(row, 'hp:tc');
      if (cells.length < 6) return; // 머리글 줄 등

      // 목코드 = 뒤에서 6번째 칸
      const codeCell = row.slice(cells[cells.length - 6].start, cells[cells.length - 6].end);
      const code = cellText(codeCell).replace(/[^0-9]/g, '');
      if (!code) return;

      const v = values[code];
      if (!v) return;

      // 뒤에서 4칸 = 예산액 · 전년도예산액 · 증감 · 산출기초
      // 신규위탁이라 전년도·증감은 비운다.
      const put = [v.amount || '', '', '', v.basis || ''];
      for (let i = 0; i < 4; i++) {
        const c = cells[cells.length - 4 + i];
        const before = row.slice(c.start, c.end);
        const after = fillCell(before, put[i]);
        if (after !== before) {
          row = row.slice(0, c.start) + after + row.slice(c.end);
          // 길이가 바뀌었으므로 남은 칸 위치를 다시 계산한다
          const recalc = spans(row, 'hp:tc');
          for (let k = 0; k < recalc.length; k++) cells[k] = recalc[k];
        }
      }

      used.add(code);
      bag.push(code);
      tbl = tbl.slice(0, r.start) + row + tbl.slice(r.end);
    });

    xml = xml.slice(0, t.start) + tbl + xml.slice(t.end);
  });

  const missing = [
    ...Object.keys(income).filter((c) => !usedIncome.has(c)).map((c) => `세입 ${c}`),
    ...Object.keys(expense).filter((c) => !usedExpense.has(c)).map((c) => `세출 ${c}`),
  ];
  return { xml, filled, missing };
}
