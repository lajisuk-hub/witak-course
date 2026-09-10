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
 * 주의: 세입 시트의 "인건비 보조금" 줄만 엑셀에서 칸이 밀려 있다.
 *   보육료 줄      → 인원 | 개월(12)   | 시간설명
 *   인건비 보조금 줄 → 인원 | 지원율(0.8) | 개월(12)
 * 그래서 세입 시트에서만 "개월 자리 값이 1 이하면 지원율" 로 보고 뒤 칸을 개월로
 * 읽는다. 세출 시트는 이런 밀림이 없으므로 개월은 항상 그대로 읽어야 한다
 * (안 그러면 "시설비 1개월" 같은 흔한 줄이 "× 100%" 로 잘못 표시된다).
 */
function detailLine({ name, unit, count, months, ratio, total, hasRatio }) {
  let mm = num(months);
  let rate = 0;
  let note = String(ratio ?? '').trim();

  if (hasRatio && mm > 0 && mm <= 1) {
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
 * 엑셀을 읽는 프로그램이 "A칸(맨 앞 빈 여백)"에 값이 하나도 없으면 그 칸을
 * 통째로 건너뛰어, B칸부터 시작하는 경우가 있다(관/항/목 칸이 한 칸씩 앞으로
 * 밀림). 이때는 칸 번호를 그대로 믿으면 안 되고, 실제로 "관","항","목" 글자가
 * 어디 있는지 찾아서 그 위치 기준으로 계산해야 한다.
 * @param {Array<Array>} rows
 * @returns {number} 정상 위치(관=B칸=index1) 대비 밀린 칸 수. 정상이면 0.
 */
function findColOffset(rows) {
  for (const r of rows) {
    for (let i = 0; i + 2 < r.length; i++) {
      if (
        String(r[i] ?? '').trim() === '관' &&
        String(r[i + 1] ?? '').trim() === '항' &&
        String(r[i + 2] ?? '').trim() === '목'
      ) {
        return i - 1;
      }
    }
  }
  return 0;
}

/**
 * 시트 하나를 읽어 { 목코드: {amount, basis} } 로 만든다.
 * @param {Array<Array>} rows  aoa (엑셀 그대로의 줄·칸)
 * @param {boolean} hasRatio   세입 시트는 '시간/비율' 칸이 하나 더 있다
 */
// 이미 받아 두신 **예전 엑셀**도 그대로 살리기 위한 코드 바로잡기.
// 예비비를 관 코드(1000)만 적어 내려보내던 때가 있었는데,
// 원장님 서식의 예비비 칸은 목 코드 1011 이라 자리를 못 찾고 빈 칸이 됐다.
// (1000·1010 은 목 코드로 쓰이는 일이 없어 바꿔도 안전하다)
const CODE_ALIAS = { 1000: '1011', 1010: '1011' };

function readSheet(rows, hasRatio) {
  const off = findColOffset(rows);
  const at = (r, idx) => r[idx + off];
  const out = {};
  let cur = null;

  rows.forEach((r) => {
    const 목 = String(at(r, 3) ?? '').trim(); // D칸
    let m = 목.match(/^(\d{3,4})\s+(.+)$/);
    const directName = String(at(r, 5) ?? '').trim();

    // "예비비"처럼 항목이 목으로 안 나뉘고 관에 코드가 바로 있으면서
    // 그 줄에 산출기초(내용)까지 바로 채워진 경우 — 관/항의 코드를 목으로 본다.
    // (단순 소계 줄인 "100 인건비" 같은 경우는 내용 칸이 비어 있어 여기 안 걸림)
    if (!m && !목 && directName) {
      const 항 = String(at(r, 2) ?? '').trim();
      const 관 = String(at(r, 1) ?? '').trim();
      m = 항.match(/^(\d{3,4})\s+(.+)$/) || 관.match(/^(\d{3,4})\s+(.+)$/);
    }

    if (m) {
      // 새 목 줄
      cur = { code: CODE_ALIAS[m[1]] || m[1], amount: at(r, 4), lines: [], sum: 0 };
      out[cur.code] = cur;

      // 목 줄에 내역이 바로 붙어 있는 경우도 있다 (예: 811 이자수입)
      const name = String(at(r, 5) ?? '').trim();
      if (name) {
        const total = hasRatio ? at(r, 10) : at(r, 9);
        cur.sum += num(total);
        cur.lines.push(
          detailLine({
            name,
            unit: at(r, 6),
            count: at(r, 7),
            months: at(r, 8),
            ratio: hasRatio ? at(r, 9) : '',
            total,
            hasRatio,
          })
        );
      }
      return;
    }

    // 내역 줄 (목 칸은 비어 있고 F칸부터 내용)
    if (!cur) return;
    const name = String(at(r, 5) ?? '').trim();
    if (!name) return;
    const total = hasRatio ? at(r, 10) : at(r, 9);
    cur.sum += num(total);
    cur.lines.push(
      detailLine({
        name,
        unit: at(r, 6),
        count: at(r, 7),
        months: at(r, 8),
        ratio: hasRatio ? at(r, 9) : '',
        total,
        hasRatio,
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
