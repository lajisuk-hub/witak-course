'use client';

// 예산서 앱(public/budget)의 계산 결과를 원장님 서식의 **관·항·목 코드**로 옮긴다.
//
// 원장님 확인 사항 (2026-07-23)
//   · 연장반          → 322 연장보육료
//   · 야간연장        → "보육료" 수입 항목은 없다.
//                       석식비는 부모부담(세입 221 / 세출 421), 교사 인건비는 지원(세입 311)
//   · 기타지원금      → 324 그 밖의 지원금
//   · 추가·기타 인건비 → 131 기타 인건비 로 합산
//   · 전년도 예산액·증감은 신규위탁이라 **비운다**
//   · 영유아복리비(314)는 앱에 없어 지금은 넣지 않는다 (나중에 한글에서 직접)
//
// 금액 단위: 서식이 "천원" 이므로 원 → 천원으로 바꾼다.

const won = (v) => Math.round(Number(v) || 0);

/** 원 → 천원 (표기용) */
export function toThousand(v) {
  const n = Math.round(won(v) / 1000);
  return n ? n.toLocaleString('ko-KR') : '';
}

const money = (v) => won(v).toLocaleString('ko-KR');

/** 산출기초 한 줄 만들기 — 원장님 승인 형식: `만 0세 540,000원 × 5명 × 12월 = 32,400천원` */
export function basisLine({ label, unit, count, months, days, total }) {
  const parts = [];
  if (label) parts.push(label);
  if (unit) parts.push(`${money(unit)}원`);
  if (count) parts.push(`× ${count}명`);
  if (days) parts.push(`× ${days}일`);
  if (months) parts.push(`× ${months}월`);
  const head = parts.join(' ');
  return total ? `${head} = ${toThousand(total)}천원` : head;
}

function join(lines) {
  return lines.filter(Boolean).join('\n');
}

const AGE_NAME = ['만 0세', '만 1세', '만 2세', '만 3세', '만 4세', '만 5세'];

/**
 * 예산서 앱의 state·calc 를 받아 세입·세출 표에 넣을 값을 만든다.
 * @returns {{income:object, expense:object, totals:{income:number, expense:number}}}
 */
export function toBudgetTables({ state, calc }) {
  const d = state.data;
  const income = {};
  const expense = {};

  const put = (bag, code, amount, basis) => {
    if (!won(amount)) return;
    bag[code] = { amount: toThousand(amount), basis: basis || '' };
  };

  // ───────── 세입 ─────────

  // 111 정부지원보육료 (연령별 + 장애아)
  const feeLines = [];
  ['age0', 'age1', 'age2', 'age3', 'age4', 'age5'].forEach((k, i) => {
    const cnt = d.ages[k];
    if (!cnt) return;
    const fee = d.childcareFees[k];
    feeLines.push(
      basisLine({ label: AGE_NAME[i], unit: fee, count: cnt, months: 12, total: fee * cnt * 12 })
    );
  });
  if (d.ages.disabled) {
    feeLines.push(
      basisLine({
        label: '장애아',
        unit: d.disabledFee,
        count: d.ages.disabled,
        months: 12,
        total: d.disabledFee * d.ages.disabled * 12,
      })
    );
  }
  put(income, '111', calc.govChildcareFee() + calc.disabledChildcareFee(), join(feeLines));

  // 322 연장보육료 (연장반)
  const ex = d.extendedCare || {};
  const exLines = [];
  if (ex.infantCount) {
    exLines.push(
      basisLine({
        label: '영아 연장반',
        unit: ex.infantUnit,
        count: ex.infantCount,
        months: ex.months || 12,
        total: (ex.infantUnit || 0) * ex.infantCount * (ex.months || 12),
      })
    );
  }
  if (ex.preschoolCount) {
    exLines.push(
      basisLine({
        label: '유아 연장반',
        unit: ex.preschoolUnit,
        count: ex.preschoolCount,
        months: ex.months || 12,
        total: (ex.preschoolUnit || 0) * ex.preschoolCount * (ex.months || 12),
      })
    );
  }
  put(income, '322', calc.extendedCareIncome(), join(exLines));

  // 311 인건비 보조금 (야간연장 교사 인건비 지원 포함)
  const supLines = [];
  (d.teachers || []).forEach((t) => {
    if (!t.count) return;
    supLines.push(
      basisLine({
        label: `${t.name || '교직원'} 인건비 지원`,
        unit: t.salary,
        count: t.count,
        months: 12,
        total: (t.salary || 0) * t.count * 12 * (t.supportRate || 1),
      })
    );
  });
  put(income, '311', calc.personnelSupportIncome(), join(supLines));

  // 324 그 밖의 지원금 (시군구 지원 항목)
  const localLines = (d.localSupport || []).map((x) =>
    basisLine({
      label: x.name,
      unit: x.unit,
      count: x.count,
      months: x.months,
      total: (x.unit || 0) * (x.count || 1) * (x.months || 1),
    })
  );
  put(income, '324', calc.localSupportTotal(), join(localLines));

  // 211 특별활동비 (수익자 부담)
  const spLines = (d.specialActivities || []).map((x) =>
    basisLine({
      label: x.name,
      unit: x.fee,
      count: x.count,
      months: x.months,
      total: (x.fee || 0) * (x.count || 0) * (x.months || 0),
    })
  );
  const spTotal = (d.specialActivities || []).reduce(
    (s, x) => s + (x.fee || 0) * (x.count || 0) * (x.months || 0),
    0
  );
  put(income, '211', spTotal, join(spLines));

  // 221 기타 필요경비 (야간연장 석식비 등 부모부담)
  const otherLines = (d.otherParentFees || []).map((x) =>
    basisLine({
      label: x.name,
      unit: x.unit,
      count: x.count,
      months: x.months,
      total: (x.unit || 0) * (x.count || 0) * (x.months || 0),
    })
  );
  const otherTotal = (d.otherParentFees || []).reduce(
    (s, x) => s + (x.unit || 0) * (x.count || 0) * (x.months || 0),
    0
  );
  put(income, '221', otherTotal, join(otherLines));

  // 811 이자수입
  put(income, '811', d.interestIncome, basisLine({ label: '이자수입', total: d.interestIncome }));

  // ───────── 세출 ─────────

  // 111 원장급여 / 112 원장수당
  put(
    expense,
    '111',
    (d.director?.salary || 0) * 12,
    basisLine({
      label: `원장 ${d.director?.grade ?? ''}호봉`,
      unit: d.director?.salary,
      months: 12,
      total: (d.director?.salary || 0) * 12,
    })
  );
  put(
    expense,
    '112',
    calc.directorAllowanceTotal(),
    join(
      (d.directorAllowances || []).map((x) =>
        basisLine({
          label: x.name,
          unit: x.unit,
          count: x.count,
          months: x.months,
          total: (x.unit || 0) * (x.count || 1) * (x.months || 1),
        })
      )
    )
  );

  // 121 보육교직원 급여 / 122 수당
  const tLines = (d.teachers || [])
    .filter((t) => t.count)
    .map((t) =>
      basisLine({
        label: `${t.name || '교직원'} ${t.grade ?? ''}호봉`,
        unit: t.salary,
        count: t.count,
        months: 12,
        total: (t.salary || 0) * t.count * 12,
      })
    );
  const tTotal = (d.teachers || []).reduce((s, t) => s + (t.salary || 0) * (t.count || 0) * 12, 0);
  put(expense, '121', tTotal, join(tLines));
  put(
    expense,
    '122',
    calc.teacherAllowanceTotal(),
    join(
      (d.teacherAllowances || []).map((x) =>
        basisLine({
          label: x.name,
          unit: x.unit,
          count: x.count,
          months: x.months,
          total: (x.unit || 0) * (x.count || 1) * (x.months || 1),
        })
      )
    )
  );

  // 131 기타 인건비 = 추가 인건비 + 기타 인건비
  const extraTotal = (calc.extraPersonnelTotal?.() || 0) + (calc.otherPersonnelTotal?.() || 0);
  const extraLines = [...(d.extraPersonnel || []), ...(d.otherPersonnel || [])].map((x) =>
    basisLine({
      label: x.name,
      unit: x.unit || x.salary,
      count: x.count,
      months: x.months || 12,
      total: (x.unit || x.salary || 0) * (x.count || 1) * (x.months || 12),
    })
  );
  put(expense, '131', extraTotal, join(extraLines));

  // 141 법정부담금 / 142 퇴직금
  put(
    expense,
    '141',
    calc.insuranceTotalNew(),
    '국민연금·건강보험·장기요양·고용보험·산재보험 사업주 부담분'
  );
  put(expense, '142', calc.retirementTotalNew(), '퇴직급여충당금 (1개월분 적립)');

  // 210 관리운영비 (211~217) · 220 업무추진비 (221~223)
  const direct = {
    211: 'receivingCosts',
    212: 'utilityCosts',
    213: 'fuelCosts',
    214: 'travelCosts',
    215: 'vehicleCosts',
    216: 'welfareCosts',
    217: 'etcOpCosts',
    221: 'businessPromoCosts',
    222: 'positionAllowanceCosts',
    223: 'meetingCosts',
    311: 'trainingCosts',
    312: 'materialCosts',
    313: 'eventCosts',
    315: 'mealCosts',
    711: 'facilityCosts',
    712: 'facilityMaintCosts',
    721: 'assetAcquireCosts',
  };
  Object.entries(direct).forEach(([code, key]) => {
    const list = d[key];
    if (!Array.isArray(list) || !list.length) return;
    const total = list.reduce(
      (s, x) => s + (x.unit || 0) * (x.count || 1) * (x.months || 1),
      0
    );
    const lines = list.map((x) =>
      basisLine({
        label: x.name,
        unit: x.unit,
        count: x.count,
        months: x.months,
        total: (x.unit || 0) * (x.count || 1) * (x.months || 1),
      })
    );
    put(expense, code, total, join(lines));
  });

  // 411 특별활동비지출 / 421 기타 필요경비 (수익자 부담)
  put(expense, '411', spTotal, join(spLines));
  put(expense, '421', otherTotal, join(otherLines));

  // 1011 예비비
  put(expense, '1011', d.reserveFund, basisLine({ label: '예비비', total: d.reserveFund }));

  return {
    income,
    expense,
    totals: { income: calc.totalIncome(), expense: calc.totalExpense() },
  };
}
