'use client';

// 예산서 앱에서 받은 **엑셀 파일**을 읽어, 한글 예산서 표에 넣을 값으로 바꾼다.
//
// 엑셀 생김새 (앱이 만들어 주는 그대로)
//   시트 '세입' : B=관  C=항  D=목  E=예산액  F=내용 G=단가 H=인원 I=개월 J=시간/비율 K=합계
//   시트 '세출' : B=관  C=항  D=목  E=예산액  F=내용 G=단가 H=인원 I=개월 J=합계
//
//   목 줄        →  D칸에 "111 정부지원보육료", E칸에 금액
//   그 아래 내역 →  F칸부터 "만 0세 | 567000 | 6 | 12 | | 40824000"
//
// 산출기초는 원장님이 승인하신 형식으로 합친다.
//   만 0세 567,000원 × 6명 × 12월 = 40,824천원

const XLSX_SRC = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

async function loadXLSX() {
  if (window.XLSX) return window.XLSX;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = XLSX_SRC;
    s.onload = resolve;
    s.onerror = () => reject(new Error('엑셀 읽기 도구를 불러오지 못했습니다'));
    document.head.appendChild(s);
  });
  return window.XLSX;
}

const num = (v) => {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const money = (v) => Math.round(num(v)).toLocaleString('ko-KR');
const thousand = (v) => {
  const n = Math.round(num(v) / 1000);
  return n ? n.toLocaleString('ko-KR') : '';
};

/**
 * 내역 한 줄을 문장으로 만든다.
 *   만 0세 567,000원 × 6명 × 12월 = 40,824천원
 *   원장 18호봉 3,588,900원 × 1명 × 12월 × 80% = 34,453천원
 *
 * 주의: 인건비 보조금 줄은 엑셀에서 칸이 밀려 있다.
 *   보육료 줄  → 인원 | 개월(12)   | 시간설명
 *   인건비 줄  → 인원 | 지원율(0.8) | 개월(12)
 * 그래서 "개월 자리 값이 1 이하면 지원율" 로 보고 뒤 칸을 개월로 읽는다.
 */
function detailLine({ name, unit, count, months, ratio, total }) {
  let mm = num(months);
  let rate = 0;
  let note = String(ratio ?? '').trim();

  if (mm > 0 && mm <= 1) {
    // 개월 자리에 지원율(0.8 등)이 들어온 경우 → 뒤 칸이 진짜 개월
    rate = mm;
    mm = num(ratio);
    note = '';
  }

  const parts = [name];
  if (num(unit)) parts.push(`${money(unit)}원`);
  if (num(count)) parts.push(`× ${num(count)}명`);
  if (mm) parts.push(`× ${mm}월`);
  if (rate) parts.push(`× ${Math.round(rate * 100)}%`);
  if (note) parts.push(`(${note})`);

  const head = parts.filter(Boolean).join(' ');
  return num(total) ? `${head} = ${thousand(total)}천원` : head;
}

/**
 * 시트 하나를 읽어 { 목코드: {amount, basis} } 로 만든다.
 * @param {Array<Array>} rows  aoa (엑셀 그대로의 줄·칸)
 * @param {boolean} hasRatio   세입 시트는 '시간/비율' 칸이 하나 더 있다
 */
function readSheet(rows, hasRatio) {
  const out = {};
  let cur = null;

  rows.forEach((r) => {
    const 목 = String(r[3] ?? '').trim(); // D칸
    const m = 목.match(/^(\d{3,4})\s+(.+)$/);

    if (m) {
      // 새 목 줄
      cur = { code: m[1], amount: r[4], lines: [], sum: 0 };
      out[cur.code] = cur;

      // 목 줄에 내역이 바로 붙어 있는 경우도 있다 (예: 811 이자수입)
      const name = String(r[5] ?? '').trim();
      if (name) {
        const total = hasRatio ? r[10] : r[9];
        cur.sum += num(total);
        cur.lines.push(
          detailLine({
            name,
            unit: r[6],
            count: r[7],
            months: r[8],
            ratio: hasRatio ? r[9] : '',
            total,
          })
        );
      }
      return;
    }

    // 내역 줄 (목 칸은 비어 있고 F칸부터 내용)
    if (!cur) return;
    const name = String(r[5] ?? '').trim();
    if (!name) return;
    const total = hasRatio ? r[10] : r[9];
    cur.sum += num(total);
    cur.lines.push(
      detailLine({
        name,
        unit: r[6],
        count: r[7],
        months: r[8],
        ratio: hasRatio ? r[9] : '',
        total,
      })
    );
  });

  const result = {};
  Object.values(out).forEach((v) => {
    // 목 줄에 금액이 비어 있는 경우가 있다 (합계가 윗줄 '항'에만 적힌 경우).
    // 그럴 때는 내역들의 합계를 더해 쓴다. 안 그러면 큰 금액이 통째로 빠진다.
    const amount = num(v.amount) || v.sum;
    if (!amount) return; // 정말로 0인 항목은 넣지 않는다
    result[v.code] = {
      amount: thousand(amount),
      basis: v.lines.join('\n'),
    };
  });
  return result;
}

// 예산서 앱이 쓰는 목 코드 → 원장님 서식의 목 코드 (2026-07-23 원장님 확인)
//   · 연장반 보육료는 서식에서 322 연장보육료
//   · 기타지원금은 324 그 밖의 지원금
//   · 추가·기타 인건비는 131 기타 인건비 로 합침
//   · 야간연장은 **석식비 = 부모부담금** 이므로 221 기타 필요경비
const REMAP = {
  income: { 112: '322', 113: '221', 325: '324' },
  expense: { 130: '131', 150: '131' },
};

/** 코드를 바꾸고, 같은 자리로 몰리면 금액을 더하고 산출기초를 잇는다 */
function remap(bag, table) {
  const out = {};
  Object.entries(bag).forEach(([code, v]) => {
    const to = table[code] || code;
    if (!out[to]) {
      out[to] = { ...v };
      return;
    }
    const sum = num(String(out[to].amount).replace(/,/g, '')) + num(String(v.amount).replace(/,/g, ''));
    out[to] = {
      amount: sum ? sum.toLocaleString('ko-KR') : '',
      basis: [out[to].basis, v.basis].filter(Boolean).join('\n'),
    };
  });
  return out;
}

/**
 * 엑셀 파일을 읽는다.
 * @param {File} file
 * @returns {Promise<{income:object, expense:object, totals:{income:number,expense:number}}>}
 */
export async function readBudgetExcel(file) {
  const XLSX = await loadXLSX();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });

  const pick = (want) =>
    wb.SheetNames.find((n) => n.replace(/\s/g, '') === want) ||
    wb.SheetNames.find((n) => n.includes(want));

  const inName = pick('세입');
  const exName = pick('세출');
  if (!inName || !exName) {
    throw new Error(
      '이 엑셀에서 세입·세출 시트를 찾지 못했습니다. 예산서 앱에서 받은 파일이 맞는지 확인해 주세요.'
    );
  }

  const toRows = (name) =>
    XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true });

  const income = remap(readSheet(toRows(inName), true), REMAP.income);
  const expense = remap(readSheet(toRows(exName), false), REMAP.expense);

  const sum = (bag) =>
    Object.values(bag).reduce((s, v) => s + num(String(v.amount).replace(/,/g, '')) * 1000, 0);

  return { income, expense, totals: { income: sum(income), expense: sum(expense) } };
}
