// =============================================================
// 어린이집 예산서 연습 게임 - 메인 앱
// =============================================================

// 2026년 기준 상수 (매년 업데이트 필요)
const CONSTANTS = {
  YEAR: 2026,
  // 4대보험 요율 (사업주 부담)
  INSURANCE: {
    nationalPension: 0.045,      // 국민연금 사업주부담 (2026년 9.5%의 50%)
    healthInsurance: 0.03595,    // 건강보험 사업주부담 (2026년 7.19%의 50%)
    longTermCare: 0.1314,        // 장기요양보험 (건강보험료 대비 13.14%)
    employment: 0.009,           // 고용보험 사업주부담 (실업급여 1.8%의 50%)
    industrial: 0.0079,          // 산재보험 (보육업종 기본, 업종별 상이)
    retirement: 1/12,            // 퇴직적립금 (연간 1개월분)
  },
  // 인건비 지원율 기본값
  SUPPORT_RATE: {
    director: 0.8,      // 원장 80%
    infant: 0.8,        // 영아반 교사 80%
    preschool: 0.3,     // 유아반 교사 30%
    disabled: 0.8,      // 장애아 전담교사 80%
    cook: 1.0,          // 조리원 100%
    aidPartial: 0.3,    // 보조/연장교사 정부지원 30% (4대보험용)
  },
  // 2025년 기준 보육료 기본값 (원, 월)
  DEFAULT_CHILDCARE_FEE: {
    age0: 567000,
    age1: 452000,
    age2: 375000,
    age3: 280000,
    age4: 280000,
    age5: 280000,
  },
};

// =============================================================
// 앱 상태 관리
// =============================================================
// =============================================================
// 교사 헬퍼 함수 (직접 작성 직책 지원)
// =============================================================
const TEACHER_TYPE_LABEL = {
  infant: '영아반 교사',
  preschool: '유아반 교사',
  disabled: '장애교사',
  aid: '보조교사',
  extended: '연장교사',
  night: '야간연장교사',
  cook: '조리원',
  custom: '직접 작성'
};

// 교사의 표시용 라벨 가져오기 (직접 작성 시 customName 사용)
function getTeacherLabel(t) {
  if (t.type === 'custom') {
    return (t.customName && t.customName.trim()) ? t.customName.trim() : '직접 작성';
  }
  return TEACHER_TYPE_LABEL[t.type] || t.type;
}

// 교사가 4대보험 그룹 B인지 판별 (보조/연장만, 직접 작성은 그룹 A로 처리)
function isGroupB(t) {
  return t.type === 'aid' || t.type === 'extended';
}

const state = {
  currentStep: 0,
  totalSteps: 25,
  data: {
    // 1. 기본 정보
    capacity: 0,
    // 2. 연령별 정원
    ages: { age0: 0, age1: 0, age2: 0, age3: 0, age4: 0, age5: 0, disabled: 0 },
    // 4. 보육료
    childcareFees: { ...CONSTANTS.DEFAULT_CHILDCARE_FEE },
    disabledFee: 532000,
    // 5. 교직원 정보
    director: { grade: 18, salary: 3588900, allowance: 0 },
    teachers: [], // [{name, type: 'infant'|'preschool'|'aid'|'extended'|'disabled'|'cook'|'night', grade, salary, count, supportRate}]
    // 7. 야간연장/장애아
    hasNightCare: false,
    nightCareCount: 0,
    // 7-2. 연장반 보육료 (영아/유아)
    extendedCare: {
      infantUnit: 2000,    // 영아 시간당 단가 (보통 2,000원)
      infantCount: 0,      // 영아 연장반 이용 인원
      preschoolUnit: 1000, // 유아 시간당 단가 (보통 1,000원)
      preschoolCount: 0,   // 유아 연장반 이용 인원
      months: 12,          // 운영 개월 수
    },
    // 8. 수익자 부담
    specialActivities: [], // [{name, fee, count, months}]
    otherParentFees: [],   // [{name, unit, count, months}]
    // 9. 지원율 확인
    supportRates: { ...CONSTANTS.SUPPORT_RATE },
    industrialRate: 0.0079,
    // 10. 시/군/구 지원 항목 (수기)
    localSupport: [],  // [{name, unit, count, months}]
    // 세입 기타
    interestIncome: 20000,
    // 12-15. 세출 항목들
    // 인건비 (세입에서 복사 + 수당 추가)
    directorAllowances: [],   // 원장 수당 [{name, unit, count, months}]
    teacherAllowances: [],     // 교직원 수당
    otherPersonnel: [],        // 기타 인건비 (대체교사 등 - 4대보험 미포함)
    extraPersonnel: [],        // 추가 인건비 (조리보조교사 등 정규 교직원 - 4대보험 포함, 세입 미반영)
    // 관리운영비
    receivingCosts: [],        // 211 수용비 및 수수료
    utilityCosts: [],          // 212 공공요금 및 제세공과금
    fuelCosts: [],             // 213 연료비
    travelCosts: [],           // 214 여비
    vehicleCosts: [],          // 215 차량비
    welfareCosts: [],          // 216 복리후생비
    // 업무추진비
    businessPromoCosts: [],    // 221 업무추진비
    positionAllowanceCosts: [],// 222 직책급
    meetingCosts: [],          // 223 회의비
    // 보육활동비
    trainingCosts: [],         // 311 교직원 연수 연구비
    materialCosts: [],         // 312 교재교구 구입비
    eventCosts: [],            // 313 행사비
    mealCosts: [],             // 315 급간식비
    // 수익자부담 지출 (세입에서 자동 복사)
    parentFeeExpenses: [],
    // 재산조성비
    facilityCosts: [],         // 711 시설비
    facilityMaintCosts: [],    // 712 시설비유지비
    assetAcquireCosts: [],     // 721 자산취득비
    // 예비비
    reserveFund: 0,
    expensesInitialized: false, // 세출 샘플 자동 채우기 여부
    
    // 이전 버전 호환용 (빈 배열)
    operatingCosts: [],
    activityCosts: [],
    assetCosts: [],
  },
};

// =============================================================
// 유틸리티 함수
// =============================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const fmt = (n) => Math.round(n || 0).toLocaleString('ko-KR');
const num = (v) => parseFloat(v) || 0;

// 합계 계산기
const calc = {
  // 정원 합계
  totalCapacity: () => {
    const a = state.data.ages;
    return (a.age0 || 0) + (a.age1 || 0) + (a.age2 || 0) + 
           (a.age3 || 0) + (a.age4 || 0) + (a.age5 || 0) + (a.disabled || 0);
  },
  infantCount: () => {
    const a = state.data.ages;
    return (a.age0 || 0) + (a.age1 || 0) + (a.age2 || 0);
  },
  preschoolCount: () => {
    const a = state.data.ages;
    return (a.age3 || 0) + (a.age4 || 0) + (a.age5 || 0);
  },
  // 정부지원 보육료 (세입)
  govChildcareFee: () => {
    const a = state.data.ages;
    const f = state.data.childcareFees;
    return (a.age0 * f.age0 + a.age1 * f.age1 + a.age2 * f.age2 + 
            a.age3 * f.age3 + a.age4 * f.age4 + a.age5 * f.age5) * 12;
  },
  // 장애아 보육료
  disabledChildcareFee: () => {
    return (state.data.ages.disabled || 0) * (state.data.disabledFee || 0) * 12;
  },
  // 교사 연봉(세입용 - 지원율 반영)
  teacherSupportTotal: () => {
    let total = 0;
    // 원장
    const d = state.data.director;
    total += d.salary * 12 * state.data.supportRates.director;
    // 교사들
    const rateMap = {
      infant: 0.8, preschool: 0.3, disabled: 0.8,
      aid: 1.0, extended: 1.0, night: 0.8, cook: 1.0
    };
    state.data.teachers.forEach(t => {
      const rate = t.supportRate !== undefined ? t.supportRate : (rateMap[t.type] !== undefined ? rateMap[t.type] : 0.8);
      total += t.salary * 12 * (t.count || 1) * rate;
    });
    return total;
  },
  // 교사 연봉(세출용 - 100%)
  teacherFullTotal: () => {
    const d = state.data.director;
    let total = d.salary * 12;
    state.data.teachers.forEach(t => {
      total += t.salary * 12 * (t.count || 1);
    });
    return total;
  },
  // 4대보험/퇴직금 지원율 맵 (세입 보조금 계산용)
  // 보조교사/연장교사만 30%, 나머지는 80% 지원
  insuranceSupportRate: (teacherType) => {
    const rateMap = {
      aid: 0.3,       // 보조교사 30%
      extended: 0.3,  // 연장교사 30%
      // 나머지는 모두 80%
      infant: 0.8, preschool: 0.8, disabled: 0.8,
      night: 0.8, cook: 0.8,
    };
    return rateMap[teacherType] !== undefined ? rateMap[teacherType] : 0.8;
  },
  
  // === 세입 4대보험 계산 (그룹 A / 그룹 B 분리) ===
  // 그룹 A: 80% 4대보험 지원 그룹 (원장, 영아, 유아, 장애, 야간연장, 조리)
  //   - 각자의 "지원받은 급여"가 4대보험 산정기준
  //   - 지원받은 급여 × 요율 = 지원금
  // 그룹 B: 30% 4대보험 지원 그룹 (보조, 연장)
  //   - 급여 100% 지원 받음 → 전체 급여 × 30%가 4대보험 산정기준
  //   - 산정기준 × 요율 = 지원금
  
  // 그룹 A의 4대보험 산정기준 (= 교사별 지원받은 급여의 합)
  insuranceBaseGroupA: () => {
    const d = state.data.director;
    // 원장은 급여 80% 지원
    let total = d.salary * 12 * state.data.supportRates.director;
    // 그룹 A 교사들 (보조/연장 제외): 각자의 지원율 × 급여
    state.data.teachers.forEach(t => {
      if (isGroupB(t)) return; // 그룹 B는 제외
      const salaryRate = t.supportRate !== undefined ? t.supportRate : 
        ({infant:0.8,preschool:0.3,disabled:0.8,night:0.8,cook:1.0,custom:0.8}[t.type] || 0.8);
      total += t.salary * 12 * (t.count || 1) * salaryRate;
    });
    return total;
  },
  
  // 그룹 B의 4대보험 산정기준 (= 연장/보조 급여 × 30%)
  insuranceBaseGroupB: () => {
    let groupBSalary = 0;
    state.data.teachers.forEach(t => {
      if (isGroupB(t)) {
        groupBSalary += t.salary * 12 * (t.count || 1); // 100% 급여
      }
    });
    return groupBSalary * 0.3; // 30%만 산정기준
  },
  
  // 전체 4대보험 산정기준 합
  insuranceWeightedBase: () => {
    return calc.insuranceBaseGroupA() + calc.insuranceBaseGroupB();
  },
  
  // 그룹 B 전체 급여 (표시용)
  groupBFullSalary: () => {
    let total = 0;
    state.data.teachers.forEach(t => {
      if (isGroupB(t)) {
        total += t.salary * 12 * (t.count || 1);
      }
    });
    return total;
  },
  
  // 원장 수당
  directorAllowance: () => {
    return (state.data.director.allowance || 0) * 12 + 450000;  // 명절휴가비 포함
  },
  // 4대보험 (급여 전체 기준 - 세출용)
  insuranceTotal: () => {
    const base = calc.teacherFullTotal();
    const ins = CONSTANTS.INSURANCE;
    const health = base * ins.healthInsurance;
    return base * ins.nationalPension 
         + health
         + health * ins.longTermCare
         + base * ins.employment
         + base * state.data.industrialRate;
  },
  // 4대보험 세입 지원금 (그룹 A + 그룹 B)
  insuranceSupportIncomeAmount: () => {
    const weightedBase = calc.insuranceWeightedBase();
    const ins = CONSTANTS.INSURANCE;
    const health = weightedBase * ins.healthInsurance;
    return weightedBase * ins.nationalPension 
         + health
         + health * ins.longTermCare
         + weightedBase * ins.employment
         + weightedBase * state.data.industrialRate;
  },
  // 퇴직적립금 (급여 전체 기준)
  retirementTotal: () => {
    return calc.teacherFullTotal() * CONSTANTS.INSURANCE.retirement;
  },
  // 퇴직적립금 세입 지원금 (그룹 A + 그룹 B)
  retirementSupportIncomeAmount: () => {
    return calc.insuranceWeightedBase() * CONSTANTS.INSURANCE.retirement;
  },
  // 인건비 전체
  personnelTotal: () => {
    return calc.teacherFullTotal() + calc.directorAllowance() + calc.insuranceTotal() + calc.retirementTotal();
  },
  // 수익자 부담 세입
  parentFeeIncome: () => {
    let total = 0;
    state.data.specialActivities.forEach(a => {
      total += (a.unit || a.fee || 0) * (a.count || 0) * (a.months || 0);
    });
    state.data.otherParentFees.forEach(a => {
      total += (a.unit || a.fee || 0) * (a.count || 0) * (a.months || 0);
    });
    return total;
  },
  // 연장반 보육료 (영아/유아 합계)
  // 시간당 단가 × 이용인원 × 월 평균(시간×일) × 개월
  // 보건복지부 표준: 1일 1시간 × 20일 = 월 20시간 기준
  extendedCareIncome: () => {
    const e = state.data.extendedCare;
    if (!e) return 0;
    const monthlyHours = 20; // 월 20시간 (1시간 × 20일)
    const infant = (e.infantUnit || 0) * (e.infantCount || 0) * monthlyHours * (e.months || 12);
    const preschool = (e.preschoolUnit || 0) * (e.preschoolCount || 0) * monthlyHours * (e.months || 12);
    return infant + preschool;
  },
  extendedCareInfant: () => {
    const e = state.data.extendedCare;
    if (!e) return 0;
    return (e.infantUnit || 0) * (e.infantCount || 0) * 20 * (e.months || 12);
  },
  extendedCarePreschool: () => {
    const e = state.data.extendedCare;
    if (!e) return 0;
    return (e.preschoolUnit || 0) * (e.preschoolCount || 0) * 20 * (e.months || 12);
  },
  // 야간연장 보육료 (평균 이용시간 2시간 × 단가 4,000원 × 인원 × 20일 × 12개월)
  // 월 야간연장 보육료 = (아동 1인 평균 이용시간 × 단가) × 이용아동수 × 운영일수
  // 연 = 월 × 12개월
  nightCareIncome: () => {
    if (!state.data.hasNightCare) return 0;
    const count = state.data.nightCareCount || 0;
    const hourlyRate = 4000;   // 시간당 단가
    const avgHours = 2;        // 아동 1인 평균 이용시간 (실제 평균)
    const monthlyDays = 20;    // 월 20일
    const months = 12;         // 12개월
    return count * hourlyRate * avgHours * monthlyDays * months;
  },
  // 시/군/구 지원
  localSupportTotal: () => {
    let total = 0;
    state.data.localSupport.forEach(a => {
      total += (a.unit || 0) * (a.count || 0) * (a.months || 0);
    });
    return total;
  },
  // 세입 인건비 보조금 (급여만 기준, 4대보험도 교사별 지원율 반영)
  personnelSupportIncome: () => {
    // ① 교사 급여 지원분 (지원율 반영: 영아 80% / 유아 30% 등)
    const teacherSupport = calc.teacherSupportTotal();
    // ② 4대보험/퇴직금 지원분 (보조/연장 30%, 나머지 80%)
    const insuranceSupport = calc.insuranceSupportIncomeAmount() + calc.retirementSupportIncomeAmount();
    return teacherSupport + insuranceSupport;
  },
  // 운영비
  operatingTotal: () => {
    return state.data.operatingCosts.reduce((s, x) => 
      s + (x.unit || 0) * (x.count || 0) * (x.months || 0), 0);
  },
  // 보육활동비
  activityTotal: () => {
    return state.data.activityCosts.reduce((s, x) =>
      s + (x.unit || 0) * (x.count || 0) * (x.months || 0), 0);
  },
  // 수익자부담 지출
  parentFeeExpense: () => {
    return state.data.parentFeeExpenses.reduce((s, x) =>
      s + (x.unit || 0) * (x.count || 0) * (x.months || 0), 0);
  },
  // 재산조성비
  assetTotal: () => {
    return state.data.assetCosts.reduce((s, x) =>
      s + (x.unit || 0) * (x.count || 0) * (x.months || 0), 0);
  },
  
  // ── 세분화된 세출 항목 합계 ──
  sumList: (key) => {
    return (state.data[key] || []).reduce((s, x) =>
      s + (x.unit || 0) * (x.count || 0) * (x.months || 0), 0);
  },
  // 원장 수당 합계
  directorAllowanceTotal: () => calc.sumList('directorAllowances'),
  // 교직원 수당 합계
  teacherAllowanceTotal: () => calc.sumList('teacherAllowances'),
  // 수당 총합 (4대보험 산정 기준에 포함)
  allAllowanceTotal: () => calc.directorAllowanceTotal() + calc.teacherAllowanceTotal(),
  // 기타 인건비 합계 (대체교사 등 - 4대보험 미포함, 인건비 총액에는 포함)
  otherPersonnelTotal: () => calc.sumList('otherPersonnel'),
  // 추가 인건비 합계 (조리보조교사 등 정규 교직원 - 4대보험 포함, 세입 미반영)
  extraPersonnelTotal: () => {
    return (state.data.extraPersonnel || []).reduce((sum, t) => {
      return sum + (t.salary || 0) * (t.months || 12) * (t.count || 1);
    }, 0);
  },
  // 관리운영비 항목별
  receivingTotal: () => calc.sumList('receivingCosts'),
  utilityTotal: () => calc.sumList('utilityCosts'),
  fuelTotal: () => calc.sumList('fuelCosts'),
  travelTotal: () => calc.sumList('travelCosts'),
  vehicleTotal: () => calc.sumList('vehicleCosts'),
  welfareTotal: () => calc.sumList('welfareCosts'),
  // 관리운영비 전체
  managementTotal: () => {
    return calc.receivingTotal() + calc.utilityTotal() + calc.fuelTotal()
         + calc.travelTotal() + calc.vehicleTotal() + calc.welfareTotal();
  },
  // 업무추진비 항목별
  businessPromoTotal: () => calc.sumList('businessPromoCosts'),
  positionAllowanceTotal: () => calc.sumList('positionAllowanceCosts'),
  meetingTotal: () => calc.sumList('meetingCosts'),
  // 업무추진비 전체
  promoTotal: () => {
    return calc.businessPromoTotal() + calc.positionAllowanceTotal() + calc.meetingTotal();
  },
  // 보육활동비 항목별
  trainingTotal: () => calc.sumList('trainingCosts'),
  materialTotal: () => calc.sumList('materialCosts'),
  eventTotal: () => calc.sumList('eventCosts'),
  mealTotal: () => calc.sumList('mealCosts'),
  // 보육활동비 전체 (신규)
  childcareActivityTotal: () => {
    return calc.trainingTotal() + calc.materialTotal() + calc.eventTotal() + calc.mealTotal();
  },
  // 재산조성비 항목별
  facilityTotal: () => calc.sumList('facilityCosts'),
  facilityMaintTotal: () => calc.sumList('facilityMaintCosts'),
  assetAcquireTotal: () => calc.sumList('assetAcquireCosts'),
  // 재산조성비 전체 (신규)
  propertyTotal: () => {
    return calc.facilityTotal() + calc.facilityMaintTotal() + calc.assetAcquireTotal();
  },
  
  // 4대보험 산정 기준 (급여 + 수당 + 추가 인건비 / 기타 인건비는 제외)
  insuranceBase: () => {
    return calc.teacherFullTotal() + calc.allAllowanceTotal() + calc.extraPersonnelTotal();
  },
  // 4대보험 (세출 - 수당 포함된 신규 계산)
  insuranceTotalNew: () => {
    const base = calc.insuranceBase();
    const ins = CONSTANTS.INSURANCE;
    const health = base * ins.healthInsurance;
    return base * ins.nationalPension
         + health
         + health * ins.longTermCare
         + base * ins.employment
         + base * state.data.industrialRate;
  },
  retirementTotalNew: () => {
    return calc.insuranceBase() * CONSTANTS.INSURANCE.retirement;
  },
  // 인건비 전체 (급여 + 수당 + 추가 + 4대보험 + 퇴직 + 기타)
  personnelTotalNew: () => {
    return calc.teacherFullTotal() + calc.allAllowanceTotal()
         + calc.extraPersonnelTotal()
         + calc.insuranceTotalNew() + calc.retirementTotalNew()
         + calc.otherPersonnelTotal();
  },
  
  // 세입 총액
  totalIncome: () => {
    return calc.govChildcareFee() + calc.disabledChildcareFee() 
         + calc.parentFeeIncome() + calc.personnelSupportIncome() 
         + calc.localSupportTotal() + (state.data.interestIncome || 0)
         + calc.extendedCareIncome() + calc.nightCareIncome();
  },
  // 세출 총액 (신규 구조 기준)
  totalExpense: () => {
    return calc.personnelTotalNew()
         + calc.managementTotal() + calc.promoTotal()
         + calc.childcareActivityTotal()
         + calc.parentFeeExpense()
         + calc.propertyTotal()
         + (state.data.reserveFund || 0);
  },
};

// =============================================================
// 세출 샘플 자동 채우기 (세입 → 세출로 넘어갈 때 1회 실행)
// =============================================================
function initializeExpenseSamples() {
  if (state.data.expensesInitialized) return;

  const cap = calc.totalCapacity() || 50;
  const staffCount = 1 + state.data.teachers.reduce((s, t) => s + (t.count || 1), 0);
  const teacherOnlyCount = state.data.teachers.reduce((s, t) => s + (t.count || 1), 0);

  // 원장 수당 샘플 (STEP 5에서 직무수당은 안 받으므로 기본값 적용)
  state.data.directorAllowances = [
    { name: '직무수당', unit: 400000, count: 1, months: 12 },
    { name: '명절휴가비', unit: 150000, count: 1, months: 3 },
  ];

  // 교직원 수당 샘플
  state.data.teacherAllowances = [
    { name: '주임수당', unit: 100000, count: 2, months: 12 },
    { name: '연차 및 시간외수당', unit: 50000, count: 5, months: 12 },
    { name: '명절휴가비', unit: 100000, count: teacherOnlyCount, months: 3 },
  ];

  // 211 수용비 및 수수료
  state.data.receivingCosts = [
    { name: '사무용품비', unit: 50000, count: 1, months: 6 },
    { name: '생활용품', unit: 50000, count: 1, months: 12 },
    { name: '화장실용품', unit: 10000, count: 1, months: 12 },
    { name: '컴퓨터 유지비', unit: 50000, count: 1, months: 12 },
    { name: '프린터 유지비', unit: 30000, count: 1, months: 12 },
    { name: '전자출결시스템', unit: 200000, count: 1, months: 1 },
    { name: '태그비용', unit: 5000, count: cap, months: 1 },
    { name: '어린이집 보안유지비', unit: 30000, count: 1, months: 12 },
    { name: '주방용품', unit: 50000, count: 1, months: 12 },
    { name: '공기청정기 렌탈', unit: 300000, count: 1, months: 12 },
    { name: '협회비 및 대외협력', unit: 200000, count: 1, months: 12 },
    { name: '방역물품', unit: 30000, count: 1, months: 12 },
    { name: '비상약품', unit: 20000, count: 1, months: 6 },
    { name: '교사용 도서', unit: 300000, count: 1, months: 6 },
  ];

  // 212 공공요금 및 제세공과금
  state.data.utilityCosts = [
    { name: '통신비', unit: 70000, count: 1, months: 12 },
    { name: '도시가스비', unit: 20000, count: 1, months: 12 },
    { name: '전기요금', unit: 20000, count: 1, months: 12 },
    { name: '난방비', unit: 500000, count: 1, months: 12 },
    { name: '수도요금', unit: 20000, count: 1, months: 12 },
  ];

  // 213 연료비
  state.data.fuelCosts = [
    { name: '취사연료비', unit: 50000, count: 1, months: 12 },
  ];

  // 214 여비
  state.data.travelCosts = [
    { name: '원장 출장비', unit: 50000, count: 1, months: 6 },
    { name: '교사 출장비', unit: 50000, count: 2, months: 6 },
  ];

  // 215 차량비 (기본 비움)
  state.data.vehicleCosts = [];

  // 216 복리후생비
  state.data.welfareCosts = [
    { name: '교직원 단체복', unit: 30000, count: staffCount, months: 1 },
    { name: '교직원 앞치마', unit: 25000, count: staffCount, months: 1 },
    { name: '교직원 생일케이크', unit: 50000, count: staffCount, months: 1 },
    { name: '교직원 힐링캠프', unit: 70000, count: staffCount, months: 1 },
  ];

  // 221 업무추진비
  state.data.businessPromoCosts = [
    { name: '교직원 경조사비', unit: 100000, count: staffCount, months: 1 },
    { name: '노인정방문', unit: 70000, count: 1, months: 2 },
  ];

  // 222 직책급
  state.data.positionAllowanceCosts = [
    { name: '원장직책급', unit: 300000, count: 1, months: 12 },
  ];

  // 223 회의비
  state.data.meetingCosts = [
    { name: '운영위원회', unit: 70000, count: 1, months: 4 },
    { name: '부모회의', unit: 50000, count: 5, months: 2 },
    { name: '교사회의', unit: 70000, count: 1, months: 12 },
  ];

  // 311 교직원 연수 연구비
  state.data.trainingCosts = [
    { name: '역량강화(자기개발)', unit: 30000, count: staffCount, months: 1 },
    { name: '위생교육(조리사)', unit: 50000, count: 1, months: 2 },
    { name: '교사교육', unit: 50000, count: staffCount, months: 1 },
  ];

  // 312 교재교구 구입비
  state.data.materialCosts = [
    { name: '표준보육과정(영아반)', unit: 10000, count: cap, months: 12 },
    { name: '숲체험', unit: 15000, count: cap, months: 10 },
    { name: '교재교구비(지원금 집행)', unit: 1000000, count: 1, months: 1 },
  ];

  // 313 행사비
  state.data.eventCosts = [
    { name: '입학식 및 오리엔테이션', unit: 10000, count: cap, months: 1 },
    { name: '생일 및 성탄절', unit: 20000, count: cap, months: 1 },
    { name: '추석 및 구정행사', unit: 20000, count: cap, months: 1 },
    { name: '여름철 물놀이', unit: 15000, count: cap, months: 1 },
    { name: '아버지교육프로그램', unit: 20000, count: cap, months: 2 },
    { name: '맘스힐링외 부모참여', unit: 10000, count: cap, months: 6 },
  ];

  // 315 급간식비
  state.data.mealCosts = [
    { name: '급간식비 (1일 4,000원 × 20일)', unit: 80000, count: cap, months: 12 },
  ];

  // 수익자부담 지출 (세입에서 자동 복사)
  const parentExpenses = [];
  state.data.specialActivities.forEach(a => {
    parentExpenses.push({
      name: a.name || '특별활동',
      unit: a.unit || a.fee || 0,
      count: a.count || 0,
      months: a.months || 12
    });
  });
  state.data.otherParentFees.forEach(a => {
    parentExpenses.push({
      name: a.name || '기타경비',
      unit: a.unit || a.fee || 0,
      count: a.count || 0,
      months: a.months || 12
    });
  });
  state.data.parentFeeExpenses = parentExpenses;

  // 재산조성비
  state.data.facilityCosts = [
    { name: '시설비', unit: 100000, count: 1, months: 3 },
  ];
  state.data.facilityMaintCosts = [
    { name: '시설유지비', unit: 50000, count: 1, months: 3 },
    { name: '비품수선비', unit: 50000, count: 1, months: 4 },
  ];
  state.data.assetAcquireCosts = [
    { name: '비품구입비', unit: 100000, count: 1, months: 4 },
    { name: '자산취득비', unit: 1000000, count: 1, months: 1 },
  ];

  state.data.expensesInitialized = true;
}

// =============================================================
// 예산 잔액 카운터 HTML (세출 단계에서 상단에 표시)
// =============================================================
function budgetTrackerHTML() {
  const income = calc.totalIncome();
  const expense = calc.totalExpense();
  const remaining = income - expense;
  let statusClass = 'tracker-ok';
  let statusIcon = '💰';
  let statusText = `남은 예산: <b>${fmt(remaining)}원</b>`;
  if (income === 0) {
    statusClass = 'tracker-empty';
    statusIcon = '📝';
    statusText = '세입을 먼저 입력해주세요';
  } else if (remaining === 0) {
    statusClass = 'tracker-perfect';
    statusIcon = '🎯';
    statusText = `딱 맞아요! 세입 = 세출 👏`;
  } else if (remaining < 0) {
    statusClass = 'tracker-over';
    statusIcon = '⚠️';
    statusText = `예산 초과: <b>${fmt(Math.abs(remaining))}원</b>`;
  } else if (income > 0 && remaining < income * 0.1) {
    // 10% 미만 남음
    statusIcon = '⚡';
    statusText = `남은 예산: <b>${fmt(remaining)}원</b> (얼마 안 남았어요!)`;
  }
  const pct = income > 0 ? Math.min(100, (expense/income)*100) : 0;
  return `
    <div class="budget-tracker ${statusClass}" id="budgetTracker">
      <div class="tracker-header">
        <div class="tracker-item">
          <span class="tracker-emoji">💵</span>
          <span class="tracker-label">세입 총액</span>
          <span class="tracker-value">${fmt(income)}원</span>
        </div>
        <div class="tracker-arrow">→</div>
        <div class="tracker-item">
          <span class="tracker-emoji">📝</span>
          <span class="tracker-label">세출 누적</span>
          <span class="tracker-value" id="trackerExpense">${fmt(expense)}원</span>
        </div>
      </div>
      <div class="tracker-bar-wrap">
        <div class="tracker-bar" id="trackerBar" style="width: ${pct}%"></div>
      </div>
      <div class="tracker-status" id="trackerStatus">
        <span class="tracker-status-icon">${statusIcon}</span>
        <span class="tracker-status-text">${statusText}</span>
      </div>
    </div>
  `;
}

// =============================================================
// 단계별 화면 렌더링
// =============================================================
const steps = [
  // 0. 시작 화면
  () => `
    <div class="card welcome">
      <div class="welcome-icon">📋</div>
      <h2>어린이집 예산서<br>같이 만들어봐요!</h2>
      <p>질문에 답하면서 하나씩<br>예산서를 완성해보는 연습 게임이에요.</p>
      <div class="feature-list">
        <div class="feature-item">
          <div class="emoji">🧮</div>
          <div class="text">자동 계산</div>
        </div>
        <div class="feature-item">
          <div class="emoji">✨</div>
          <div class="text">2026년 최신 기준</div>
        </div>
        <div class="feature-item">
          <div class="emoji">📊</div>
          <div class="text">엑셀 다운로드</div>
        </div>
        <div class="feature-item">
          <div class="emoji">💡</div>
          <div class="text">함께 확인</div>
        </div>
      </div>
      <div class="info-box">
        <strong>🎯 이 게임이 도와드릴 것</strong><br>
        세입·세출 예산서의 흐름을 자연스럽게 따라가며, 4대보험·교사 인건비 지원율 같은 복잡한 계산을 자동으로 처리해드려요.
      </div>
    </div>
  `,

  // 1. 정원
  () => `
    <div class="card step">
      <span class="step-badge">STEP 1 / 24</span>
      <h2 class="card-title">🏠 우리 어린이집 정원은?</h2>
      <p class="card-subtitle">전체 정원 몇 명인가요?</p>
      <div class="form-group">
        <label class="form-label">전체 정원</label>
        <input type="number" class="form-input" id="capacityInput" 
               value="${state.data.capacity || ''}" placeholder="예: 77" min="0" />
        <p class="form-hint">💡 다음 단계에서 연령별로 나누어 입력할 거예요.</p>
      </div>
    </div>
  `,

  // 2. 연령별 정원
  () => {
    const cap = state.data.capacity || 0;
    const assigned = calc.totalCapacity();
    const remaining = cap - assigned;
    let statusClass = 'counter-ok';
    let statusIcon = '😊';
    let statusText = `남은 인원: <b>${remaining}명</b>`;
    if (cap === 0) {
      statusClass = 'counter-empty';
      statusIcon = '📝';
      statusText = '전체 정원을 먼저 입력해주세요 (STEP 1)';
    } else if (remaining === 0 && assigned > 0) {
      statusClass = 'counter-perfect';
      statusIcon = '🎉';
      statusText = `정원과 <b>딱 맞아요!</b> 👏`;
    } else if (remaining < 0) {
      statusClass = 'counter-over';
      statusIcon = '⚠️';
      statusText = `정원 초과 <b>${Math.abs(remaining)}명!</b>`;
    }
    return `
    <div class="card step">
      <span class="step-badge">STEP 2 / 24</span>
      <h2 class="card-title">👶 연령별 정원을 알려주세요</h2>
      <p class="card-subtitle">각 연령별로 몇 명씩 있나요?</p>
      
      <div class="capacity-counter ${statusClass}" id="capacityCounter">
        <div class="counter-top">
          <span class="counter-icon">👥</span>
          <span class="counter-label">전체 정원</span>
          <span class="counter-main"><b id="capTotal">${cap}</b>명</span>
        </div>
        <div class="counter-bar-wrap">
          <div class="counter-bar" id="capBar" style="width: ${cap > 0 ? Math.min(100, (assigned/cap)*100) : 0}%"></div>
        </div>
        <div class="counter-bottom">
          <span class="counter-assigned">배정: <b id="capAssigned">${assigned}</b>명</span>
          <span class="counter-status" id="capStatus">
            <span class="counter-status-icon">${statusIcon}</span>
            <span class="counter-status-text">${statusText}</span>
          </span>
        </div>
      </div>
      
      <div class="age-grid">
        ${['age0','age1','age2','age3','age4','age5'].map((k, i) => `
          <div class="age-item">
            <label>만 ${i}세</label>
            <input type="number" data-age="${k}" value="${state.data.ages[k] || ''}" min="0" />
            <span class="unit">명</span>
          </div>
        `).join('')}
        <div class="age-item">
          <label>장애아</label>
          <input type="number" data-age="disabled" value="${state.data.ages.disabled || ''}" min="0" />
          <span class="unit">명</span>
        </div>
      </div>
      <div class="info-box">
        <strong>💡 영아/유아 구분</strong><br>
        <b>영아반</b> = 만 0, 1, 2세 (인건비 80% 지원)<br>
        <b>유아반</b> = 만 3, 4, 5세 (인건비 30% 지원)
      </div>
    </div>
  `;
  },

  // 3. 정원 확인
  () => {
    const a = state.data.ages;
    const total = calc.totalCapacity();
    return `
      <div class="card step">
        <span class="step-badge">STEP 3 / 24 · 확인</span>
        <h2 class="card-title">✅ 반 구성을 확인해볼까요?</h2>
        <p class="card-subtitle">입력하신 정원을 다시 확인해주세요.</p>
        <div class="class-list">
          ${a.age0 ? `<div class="class-card"><span class="class-name">만 0세반</span><span class="class-count">${a.age0}명</span></div>` : ''}
          ${a.age1 ? `<div class="class-card"><span class="class-name">만 1세반</span><span class="class-count">${a.age1}명</span></div>` : ''}
          ${a.age2 ? `<div class="class-card"><span class="class-name">만 2세반</span><span class="class-count">${a.age2}명</span></div>` : ''}
          ${a.age3 ? `<div class="class-card"><span class="class-name">만 3세반</span><span class="class-count">${a.age3}명</span></div>` : ''}
          ${a.age4 ? `<div class="class-card"><span class="class-name">만 4세반</span><span class="class-count">${a.age4}명</span></div>` : ''}
          ${a.age5 ? `<div class="class-card"><span class="class-name">만 5세반</span><span class="class-count">${a.age5}명</span></div>` : ''}
          ${a.disabled ? `<div class="class-card"><span class="class-name">장애아</span><span class="class-count">${a.disabled}명</span></div>` : ''}
        </div>
        <div class="big-total">
          <div class="label">전체 정원</div>
          <div class="value">${fmt(total)}<span class="unit">명</span></div>
        </div>
        <div class="result-grid">
          <div class="result-card">
            <div class="label">영아반 (0~2세)</div>
            <div class="value">${fmt(calc.infantCount())}</div>
            <div class="unit">명</div>
          </div>
          <div class="result-card">
            <div class="label">유아반 (3~5세)</div>
            <div class="value">${fmt(calc.preschoolCount())}</div>
            <div class="unit">명</div>
          </div>
        </div>
        ${total !== state.data.capacity && state.data.capacity > 0 ? `
          <div class="warn-box">
            <strong>⚠️ 확인 필요</strong><br>
            처음 입력한 전체 정원(${state.data.capacity}명)과 합계(${total}명)가 달라요. 이전으로 돌아가 수정해주세요.
          </div>
        ` : ''}
      </div>
    `;
  },

  // 4. 보육료
  () => {
    const ages = state.data.ages;
    const fees = state.data.childcareFees;
    // 정원이 있는 연령만 필터링
    const activeAges = [0,1,2,3,4,5].filter(i => (ages['age'+i] || 0) > 0);
    const hasDisabled = (ages.disabled || 0) > 0;
    const hasAny = activeAges.length > 0 || hasDisabled;
    
    // 상세 산출표 행 생성
    const detailRows = activeAges.map(i => {
      const count = ages['age'+i] || 0;
      const fee = fees['age'+i] || 0;
      const total = fee * count * 12;
      return `<tr>
        <td>만 ${i}세</td>
        <td>${fmt(fee)}원</td>
        <td>${count}명</td>
        <td>12개월</td>
        <td class="total-cell">${fmt(total)}원</td>
      </tr>`;
    }).join('');
    const disabledRow = hasDisabled ? `<tr>
      <td>장애아</td>
      <td>${fmt(state.data.disabledFee || 0)}원</td>
      <td>${ages.disabled}명</td>
      <td>12개월</td>
      <td class="total-cell">${fmt((state.data.disabledFee || 0) * ages.disabled * 12)}원</td>
    </tr>` : '';
    
    const totalFee = calc.govChildcareFee() + calc.disabledChildcareFee();
    
    return `
    <div class="card step">
      <span class="step-badge">STEP 4 / 24</span>
      <h2 class="card-title">💰 정부지원 보육료</h2>
      <p class="card-subtitle">2026년 기준 보육료를 확인하고 필요시 수정해주세요.</p>
      
      ${!hasAny ? `
        <div class="warn-box">
          <strong>⚠️ 정원이 입력되지 않았어요!</strong><br>
          이전(STEP 2)으로 돌아가 연령별 정원을 먼저 입력해주세요.
        </div>
      ` : `
        <div class="info-box">
          <strong>📌 안내</strong><br>
          정원이 있는 연령만 표시됩니다. (정원 0명인 연령은 생략)<br>
          보육료를 수정하려면 아래 칸의 숫자를 바꿔주세요.
        </div>
        
        <div class="age-grid">
          ${activeAges.map(i => `
            <div class="age-item">
              <label>만 ${i}세 (월 단가)</label>
              <input type="number" data-fee="age${i}" value="${fees['age'+i] || 0}" min="0" />
              <span class="unit">원 · 정원 ${ages['age'+i]}명</span>
            </div>
          `).join('')}
          ${hasDisabled ? `
            <div class="age-item">
              <label>장애아 (월 단가)</label>
              <input type="number" data-fee="disabled" value="${state.data.disabledFee || 0}" min="0" />
              <span class="unit">원 · 정원 ${ages.disabled}명</span>
            </div>
          ` : ''}
        </div>
        
        <h3 class="section-title">📊 상세 산출내역</h3>
        <table class="budget-table">
          <thead>
            <tr><th>연령</th><th>월 단가</th><th>인원</th><th>기간</th><th>연 합계</th></tr>
          </thead>
          <tbody id="feeDetailBody">
            ${detailRows}
            ${disabledRow}
            <tr class="subtotal-row">
              <td colspan="4">총 합계</td>
              <td class="total-cell" id="feeDetailTotal">${fmt(totalFee)}원</td>
            </tr>
          </tbody>
        </table>
        
        <div class="tip-box" style="margin-top: 16px;">
          <strong>💡 계산 공식</strong><br>
          연령별 월 단가 × 해당 연령 정원 × 12개월 = 연간 보육료<br>
          2026년 최신 보육료는 보건복지부 고시를 확인해주세요.
        </div>
        
        <div class="big-total">
          <div class="label">예상 정부지원 보육료 (연)</div>
          <div class="value" id="feeTotal">${fmt(totalFee)}<span class="unit">원</span></div>
        </div>
      `}
    </div>
    `;
  },

  // 5. 교직원 정보
  () => {
    const d = state.data.director;
    const dAnnual = (d.salary || 0) * 12;
    return `
    <div class="card step">
      <span class="step-badge">STEP 5 / 24</span>
      <h2 class="card-title">👩‍🏫 교직원 인건비 (기본 급여)</h2>
      <p class="card-subtitle">원장님과 교사분들의 호봉과 <b>월급</b>만 입력해주세요. 수당은 세출 단계에서 따로 입력해요!</p>
      
      <div class="info-box">
        <strong>📌 여기서는 "기본 급여"만 입력해요</strong><br>
        • 직무수당, 명절휴가비 등 <b>수당은 세출 단계(STEP 14)</b>에서 입력합니다.<br>
        • 여기서는 호봉표 기준 <b>월급여</b>만 넣어주세요.<br>
        • 연봉은 월급 × 12개월로 자동 계산됩니다.
      </div>
      
      <h3 style="font-family: var(--font-display); color: var(--color-primary-dark); margin: 20px 0 10px; font-size: 1.1rem;">원장</h3>
      <div class="teacher-row-header director-header">
        <span>구분</span><span>호봉</span><span>월급 (원)</span><span>× 12개월 = 연봉</span>
      </div>
      <div class="teacher-row director-row">
        <input type="text" value="원장" readonly style="background: var(--color-bg-soft);" />
        <input type="number" id="directorGrade" value="${d.grade}" min="1" max="30" placeholder="호봉" />
        <input type="number" id="directorSalary" value="${d.salary}" min="0" placeholder="예: 3588900" />
        <div class="annual-display" id="directorAnnual">${fmt(dAnnual)}원</div>
      </div>
      
      <h3 style="font-family: var(--font-display); color: var(--color-primary-dark); margin: 20px 0 10px; font-size: 1.1rem;">
        교사
        <span style="font-size: 0.8rem; color: var(--color-text-soft); font-family: var(--font-body);">
          (필요한 만큼 추가해주세요)
        </span>
      </h3>
      <div class="teacher-row-header">
        <span>구분</span><span>호봉</span><span>월급 (원)</span><span>인원 (명)</span><span>지원율 (%)</span><span></span>
      </div>
      <div id="teachersList">
        ${renderTeacherRows()}
      </div>
      <button class="btn-add" id="btnAddTeacher">+ 교사 추가</button>
      
      <div class="tip-box">
        <strong>💡 교사 구분 (세입 지원율 기본값)</strong><br>
        • <b>영아반 교사</b>: 만 0~2세 담당 (급여 80%, 4대보험 80%)<br>
        • <b>유아반 교사</b>: 만 3~5세 담당 (급여 30%, 4대보험 80%)<br>
        • <b>장애아 전담교사</b>: (급여 80%, 4대보험 80%)<br>
        • <b>보조교사</b>: (급여 100%, 4대보험 30%) ← 급여는 전액 지원!<br>
        • <b>연장교사</b>: (급여 100%, 4대보험 30%) ← 급여는 전액 지원!<br>
        • <b>야간연장교사</b>: (급여 80%, 4대보험 80%)<br>
        • <b>조리원</b>: (급여 100%, 4대보험 80%)<br>
        • <b>✏️ 직접 작성</b>: 위 분류에 없는 직책 자유 입력 (4대보험은 그룹 A 80%로 자동 처리)<br>
        <br>
        <i style="color: var(--color-text-soft);">※ 지원율(%)은 기본값이 자동 입력되지만, 필요하면 수정 가능해요.</i>
      </div>
    </div>
    `;
  },

  // 6. 세입 작성 시작 안내
  () => `
    <div class="card step">
      <span class="step-badge">STEP 6 / 24 · 세입 시작</span>
      <h2 class="card-title">📥 이제 세입을 작성해요</h2>
      <p class="card-subtitle">세입(收入) = 들어오는 돈입니다.</p>
      <div class="info-box">
        <strong>세입 예산서에 들어갈 항목</strong><br>
        1️⃣ 정부지원 보육료 (앞서 입력완료)<br>
        2️⃣ 수익자 부담수입 (특별활동비 등)<br>
        3️⃣ 보조금 및 지원금 (인건비, 4대보험, 기타)<br>
        4️⃣ 시/군/구 지원 항목<br>
        5️⃣ 잡수입 (이자수입 등)
      </div>
      <div class="tip-box">
        <strong>📌 중요 원칙</strong><br>
        세입 총액은 반드시 세출 총액과 <b>정확히 일치</b>해야 해요. 예산서 작성 후 검증 단계에서 자동으로 확인해드립니다.
      </div>
    </div>
  `,

  // 7. 야간연장/기타 세입 옵션
  () => {
    const count = state.data.nightCareCount || 0;
    const nightTotal = calc.nightCareIncome();
    return `
    <div class="card step">
      <span class="step-badge">STEP 7 / 24</span>
      <h2 class="card-title">🌙 야간연장 보육은 운영하시나요?</h2>
      <p class="card-subtitle">야간연장 보육 아동이 있으면 추가 수입이 생겨요.</p>
      <div class="radio-group">
        <div class="radio-item">
          <input type="radio" name="night" id="nightYes" value="yes" ${state.data.hasNightCare ? 'checked' : ''} />
          <label for="nightYes">네, 운영해요</label>
        </div>
        <div class="radio-item">
          <input type="radio" name="night" id="nightNo" value="no" ${!state.data.hasNightCare ? 'checked' : ''} />
          <label for="nightNo">아니요</label>
        </div>
      </div>
      <div id="nightDetail" style="${state.data.hasNightCare ? '' : 'display:none'}; margin-top: 20px;">
        <div class="form-group">
          <label class="form-label">야간연장 아동 수</label>
          <input type="number" class="form-input" id="nightCount" 
                 value="${count}" min="0" placeholder="명" />
          <p class="form-hint">💡 야간연장 보육은 19시~24시 사이의 추가 보육이에요.</p>
        </div>
        
        <div class="info-box">
          <strong>📐 야간연장 보육료 계산 공식</strong><br>
          <b style="color: var(--color-primary-dark); font-size: 1rem;">월 보육료 = 평균 이용시간 × 단가 × 인원 × 운영일수</b><br>
          <b style="color: var(--color-primary-dark); font-size: 1rem;">연 보육료 = 월 보육료 × 12개월</b><br>
          <br>
          • 아동 1인 <b>평균 이용시간: 2시간</b> (모든 아동이 24시까지 있지 않음)<br>
          • 시간당 단가: <b>4,000원</b> (보건복지부 기준)<br>
          • 월 운영일수: <b>20일</b> (평일 기준)
        </div>
        
        <div class="calc-formula" id="nightCareFormula">
          <span class="formula-label">🧮 야간연장 보육료 산출:</span><br>
          <span class="formula-expr" style="display: block; margin-top: 8px;">
            <b>[월 보육료]</b> <b>2시간</b> × <b>4,000원</b> × <b>${count}명</b> × <b>20일</b> = <b class="formula-result">${fmt(nightTotal / 12)}원</b><br>
            <b>[연 보육료]</b> <b>${fmt(nightTotal / 12)}원</b> × <b>12개월</b> = <b class="formula-result">${fmt(nightTotal)}원</b>
          </span>
        </div>
        
        <div class="big-total" style="margin-top: 16px;">
          <div class="label">야간연장 보육료 (연)</div>
          <div class="value" id="nightCareGrandTotal">${fmt(nightTotal)}<span class="unit">원</span></div>
        </div>
      </div>
    </div>
    `;
  },

  // 8. 연장반 보육료 (영아/유아)
  () => {
    const e = state.data.extendedCare || {};
    const infantUnit = e.infantUnit || 0;
    const infantCount = e.infantCount || 0;
    const preschoolUnit = e.preschoolUnit || 0;
    const preschoolCount = e.preschoolCount || 0;
    const months = e.months || 12;
    const infantTotal = calc.extendedCareInfant();
    const preschoolTotal = calc.extendedCarePreschool();
    const grandTotal = infantTotal + preschoolTotal;
    return `
    <div class="card step">
      <span class="step-badge">STEP 8 / 24</span>
      <h2 class="card-title">⏰ 연장반 보육료</h2>
      <p class="card-subtitle">평일 16시 이후 운영하는 연장반 이용 아동의 보육료를 입력해주세요.</p>
      
      <div class="info-box">
        <strong>📌 연장반 보육료 계산 공식</strong><br>
        <b style="color: var(--color-primary-dark); font-size: 1rem;">시간당 단가 × 이용 인원 × 20시간/월 × 개월 수</b><br>
        • 표준 보육시간(9시간) 이후 추가 보육에 대한 비용이에요.<br>
        • 월 20시간 = 1일 1시간 × 20일 (평일 기준)<br>
        • 시간당 단가는 어린이집마다 다를 수 있어요.<br>
        &nbsp;&nbsp;- <b>영아반(만 0~2세)</b>: 보통 <b>2,000원</b><br>
        &nbsp;&nbsp;- <b>유아반(만 3~5세)</b>: 보통 <b>1,000원</b>
      </div>
      
      <h3 class="section-title">영아반 연장반 (만 0~2세)</h3>
      <div class="teacher-row-header extended-care-header">
        <span>구분</span><span>시간당 단가 (원)</span><span>인원 (명)</span><span>개월</span>
      </div>
      <div class="teacher-row extended-care-row">
        <input type="text" value="영아 연장반" readonly style="background: var(--color-bg-soft);" />
        <input type="number" id="extendedInfantUnit" value="${infantUnit}" min="0" step="100" placeholder="예: 2000" />
        <input type="number" id="extendedInfantCount" value="${infantCount}" min="0" placeholder="명" />
        <input type="number" id="extendedMonths1" value="${months}" min="0" max="12" readonly style="background: var(--color-bg-soft);" />
      </div>
      <div class="calc-formula" id="extendedInfantFormula">
        <span class="formula-label">영아반 연장보육료 산출:</span><br>
        <span class="formula-expr">
          <b>${fmt(infantUnit)}원</b> × <b>${infantCount}명</b> × <b>20시간</b> × <b>${months}개월</b>
          = <b class="formula-result">${fmt(infantTotal)}원</b>
        </span>
      </div>
      
      <h3 class="section-title">유아반 연장반 (만 3~5세)</h3>
      <div class="teacher-row-header extended-care-header">
        <span>구분</span><span>시간당 단가 (원)</span><span>인원 (명)</span><span>개월</span>
      </div>
      <div class="teacher-row extended-care-row">
        <input type="text" value="유아 연장반" readonly style="background: var(--color-bg-soft);" />
        <input type="number" id="extendedPreschoolUnit" value="${preschoolUnit}" min="0" step="100" placeholder="예: 1000" />
        <input type="number" id="extendedPreschoolCount" value="${preschoolCount}" min="0" placeholder="명" />
        <input type="number" id="extendedMonths2" value="${months}" min="0" max="12" readonly style="background: var(--color-bg-soft);" />
      </div>
      <div class="calc-formula" id="extendedPreschoolFormula">
        <span class="formula-label">유아반 연장보육료 산출:</span><br>
        <span class="formula-expr">
          <b>${fmt(preschoolUnit)}원</b> × <b>${preschoolCount}명</b> × <b>20시간</b> × <b>${months}개월</b>
          = <b class="formula-result">${fmt(preschoolTotal)}원</b>
        </span>
      </div>
      
      <div class="form-group" style="margin-top: 20px;">
        <label class="form-label">운영 개월 수 (영아/유아 공통)</label>
        <input type="number" class="form-input" id="extendedMonths" 
               value="${months}" min="0" max="12" placeholder="12" />
        <p class="form-hint">💡 연장반을 1년 내내 운영하면 12개월, 학기 중에만 운영하면 해당 개월 수를 입력해주세요.</p>
      </div>
      
      <div class="big-total">
        <div class="label">연장반 보육료 합계 (연)</div>
        <div class="value" id="extendedCareGrandTotal">${fmt(grandTotal)}<span class="unit">원</span></div>
      </div>
      
      <div class="tip-box" style="margin-top: 16px;">
        <strong>💡 참고</strong><br>
        연장반 보육료를 운영하지 않는다면 <b>인원을 0명</b>으로 두고 다음으로 넘어가세요.
      </div>
    </div>
    `;
  },

  // 9. 수익자 부담수입 (특별활동 + 기타필요경비)
  () => `
    <div class="card step">
      <span class="step-badge">STEP 9 / 24</span>
      <h2 class="card-title">💸 수익자 부담수입</h2>
      <p class="card-subtitle">부모님이 내는 돈(특별활동비, 현장학습비 등)을 입력해주세요.</p>
      
      <h3 style="font-family: var(--font-display); color: var(--color-primary-dark); margin: 16px 0 10px; font-size: 1.1rem;">특별활동비</h3>
      <table class="budget-table">
        <thead>
          <tr><th>활동명</th><th>단가/월</th><th>인원</th><th>개월</th><th>합계</th><th></th></tr>
        </thead>
        <tbody id="specialTable">
          ${renderFeeRows('specialActivities')}
        </tbody>
      </table>
      <button class="btn-add" data-add="specialActivities">+ 특별활동 추가</button>
      
      <h3 style="font-family: var(--font-display); color: var(--color-primary-dark); margin: 20px 0 10px; font-size: 1.1rem;">기타필요경비</h3>
      <table class="budget-table">
        <thead>
          <tr><th>항목명</th><th>단가</th><th>인원</th><th>개월</th><th>합계</th><th></th></tr>
        </thead>
        <tbody id="otherTable">
          ${renderFeeRows('otherParentFees')}
        </tbody>
      </table>
      <button class="btn-add" data-add="otherParentFees">+ 기타경비 추가</button>
      
      <div class="tip-box">
        <strong>💡 자주 넣는 항목</strong><br>
        특별활동: 체육 / 영어 / 오감 (보통 1만원)<br>
        기타경비: 입학준비금(가방), 현장학습비, 행사비, 야간연장석식비
      </div>
      
      <div class="big-total">
        <div class="label">수익자 부담수입 합계 (연)</div>
        <div class="value" id="parentFeeTotal">${fmt(calc.parentFeeIncome())}<span class="unit">원</span></div>
      </div>
    </div>
  `,

  // 9. 인건비 지원율 확인
  () => `
    <div class="card step">
      <span class="step-badge">STEP 10 / 24 · 핵심!</span>
      <h2 class="card-title">📌 인건비 지원율 확인</h2>
      <p class="card-subtitle">2026년 국공립어린이집 기본 지원율입니다. 맞는지 확인해주세요.</p>
      
      <div class="info-box">
        <strong>📋 2026년 기본 지원율 (급여 기준)</strong><br>
        • <b>원장</b>: 80% · <b>영아반 교사</b>: 80% · <b>장애아 전담교사</b>: 80% · <b>야간연장교사</b>: 80%<br>
        • <b>유아반 교사</b>: 30% (누리과정 보육료로 보조)<br>
        • <b>보조교사, 연장교사, 조리사</b>: 100% 지원<br>
        <br>
        <span style="color: var(--color-primary-dark); font-weight: 700;">⚠️ 4대보험 지원율은 급여 지원율과 달라요!</span><br>
        • 4대보험 30%: 보조/연장교사<br>
        • 4대보험 80%: 나머지 전부 (조리사 포함)
      </div>
      
      <h3 style="font-family: var(--font-display); color: var(--color-primary-dark); margin: 16px 0 10px;">지원율 직접 수정 (필요시)</h3>
      <div class="support-rate-group">
        <div class="support-rate-item">
          <label>원장</label>
          <div class="input-row">
            <input type="number" data-rate="director" value="${(state.data.supportRates.director*100).toFixed(0)}" min="0" max="100" />
            <span class="percent">%</span>
          </div>
        </div>
        <div class="support-rate-item">
          <label>영아반 교사</label>
          <div class="input-row">
            <input type="number" data-rate="infant" value="${(state.data.supportRates.infant*100).toFixed(0)}" min="0" max="100" />
            <span class="percent">%</span>
          </div>
        </div>
        <div class="support-rate-item">
          <label>유아반 교사</label>
          <div class="input-row">
            <input type="number" data-rate="preschool" value="${(state.data.supportRates.preschool*100).toFixed(0)}" min="0" max="100" />
            <span class="percent">%</span>
          </div>
        </div>
        <div class="support-rate-item">
          <label>장애교사</label>
          <div class="input-row">
            <input type="number" data-rate="disabled" value="${(state.data.supportRates.disabled*100).toFixed(0)}" min="0" max="100" />
            <span class="percent">%</span>
          </div>
        </div>
        <div class="support-rate-item">
          <label>조리원</label>
          <div class="input-row">
            <input type="number" data-rate="cook" value="${(state.data.supportRates.cook*100).toFixed(0)}" min="0" max="100" />
            <span class="percent">%</span>
          </div>
        </div>
      </div>
      
      <div class="tip-box">
        <strong>💡 왜 유아반은 30%만?</strong><br>
        유아반은 누리과정 보육료(학부모 지원)가 상대적으로 크기 때문에, 인건비는 30%만 지원되고 나머지는 어린이집에서 보육료로 충당합니다. 이게 예산서를 어렵게 만드는 핵심 포인트예요!
      </div>
    </div>
  `,

  // 10. 4대보험 요율
  () => {
    const base = calc.teacherFullTotal();  // 급여만 기준
    const ins = CONSTANTS.INSURANCE;
    const health = base * ins.healthInsurance;
    const ltCare = health * ins.longTermCare;
    const pension = base * ins.nationalPension;
    const employment = base * ins.employment;
    const industrial = base * state.data.industrialRate;
    const retirement = base * ins.retirement;
    const insTotal = pension + health + ltCare + employment + industrial;
    return `
    <div class="card step">
      <span class="step-badge">STEP 11 / 24</span>
      <h2 class="card-title">🏥 4대보험 요율 (2026년 최신)</h2>
      <p class="card-subtitle">2026년 최신 요율이 자동 적용됩니다.</p>
      
      <div class="info-box">
        <strong>⚙️ 2026년 최신 요율 자동 적용 중</strong><br>
        • <b>국민연금</b>: 사업주 4.5% 부담 (2026년 9.5%의 절반)<br>
        • <b>건강보험</b>: 사업주 3.595% 부담 (2026년 7.19%의 절반)<br>
        • <b>장기요양보험</b>: 건강보험료 × 13.14%<br>
        • <b>고용보험</b>: 사업주 0.9% 부담<br>
        • <b>산재보험</b>: 업종별 상이 (아래 직접 입력)<br>
        • <b>퇴직적립금</b>: 연간 1개월분 (8.33%)
      </div>
      
      <div class="form-group" style="margin-top: 20px;">
        <label class="form-label">산재보험 요율 (%)</label>
        <input type="number" class="form-input" id="industrialRate" 
               value="${(state.data.industrialRate*100).toFixed(2)}" 
               step="0.01" min="0" max="10" />
        <p class="form-hint">💡 어린이집 업종은 보통 0.7~0.9% 사이입니다. 근로복지공단(1588-0075)에서 정확한 요율 확인 가능.</p>
      </div>
      
      <h3 class="section-title">📊 상세 산출내역 (급여만 기준)</h3>
      
      <!-- 산정기준액이 어떻게 나왔는지 교사별 표시 -->
      <div class="info-box" style="margin-bottom: 12px;">
        <strong>📐 1단계: 산정 기준액 = 원장 급여 + 교사 전체 급여</strong><br>
        4대보험과 퇴직적립금은 모두 이 <b>기준액</b>에 요율을 곱해서 계산해요.
      </div>
      
      <h4 class="detail-subtitle">🧮 교사별 연 급여 구성</h4>
      <table class="budget-table">
        <thead><tr><th>구분</th><th>월급</th><th>인원</th><th>개월</th><th>연 급여</th></tr></thead>
        <tbody>
          <tr>
            <td>원장 ${state.data.director.grade}호봉</td>
            <td>${fmt(state.data.director.salary)}원</td>
            <td>1명</td>
            <td>12개월</td>
            <td class="total-cell">${fmt(state.data.director.salary * 12)}원</td>
          </tr>
          ${state.data.teachers.map(t => {
            const typeMap = {
              infant: '영아반 교사', preschool: '유아반 교사', disabled: '장애교사',
              aid: '보조교사', extended: '연장교사', night: '야간연장교사', cook: '조리원'
            };
            return `<tr>
              <td>${getTeacherLabel(t)} ${t.grade || ''}호봉</td>
              <td>${fmt(t.salary)}원</td>
              <td>${t.count || 1}명</td>
              <td>12개월</td>
              <td class="total-cell">${fmt(t.salary * 12 * (t.count || 1))}원</td>
            </tr>`;
          }).join('')}
          <tr class="total-row">
            <td colspan="4">산정 기준액 합계</td>
            <td>${fmt(base)}원</td>
          </tr>
        </tbody>
      </table>
      
      <div class="warn-box" style="margin: 16px 0;">
        <strong>💡 세입 vs 세출 4대보험 차이</strong><br>
        • <b>세출 (실제 납부)</b>: 교직원 급여 전체(100%)에 대해 납부<br>
        • <b>세입 (정부 지원)</b>: 교사 유형별 지원율 차등 적용<br>
        &nbsp;&nbsp;- 보조/연장교사: <b>30%</b>만 지원<br>
        &nbsp;&nbsp;- 그 외 교직원: <b>80%</b> 지원<br>
        세입 상세는 STEP 14(세입 완료) 페이지에서 확인할 수 있어요!
      </div>
      
      <h4 class="detail-subtitle">🧮 2단계: 요율별 산출 과정</h4>
      <div class="info-box" style="margin-bottom: 12px;">
        <strong>📚 각 보험의 계산 공식</strong><br>
        • <b>국민연금</b>: 전체 요율 9.0%의 <b>절반(4.5%)</b>을 사업주가 부담<br>
        &nbsp;&nbsp;&nbsp;→ 산정기준 × 4.5%<br>
        • <b>건강보험</b>: 전체 요율 7.19%의 <b>절반(3.595%)</b>을 사업주가 부담<br>
        &nbsp;&nbsp;&nbsp;→ 산정기준 × 3.595%<br>
        • <b>장기요양보험</b>: <b>건강보험료</b>에 13.14% 추가<br>
        &nbsp;&nbsp;&nbsp;→ 건강보험료 × 13.14% (주의! 산정기준이 아닌 건보료 기준)<br>
        • <b>고용보험</b>: 사업주 부담 0.9%<br>
        &nbsp;&nbsp;&nbsp;→ 산정기준 × 0.9%<br>
        • <b>산재보험</b>: 업종별 상이 (어린이집 보통 0.7~0.9%)<br>
        &nbsp;&nbsp;&nbsp;→ 산정기준 × 산재요율<br>
        • <b>퇴직적립금</b>: 연간 1개월분 = 연봉의 1/12 ≒ 8.33%<br>
        &nbsp;&nbsp;&nbsp;→ 산정기준 ÷ 12 = 월 평균급여 1개월분
      </div>
      
      <table class="budget-table" id="insuranceDetailTable">
        <thead>
          <tr><th>항목</th><th>산정 기준</th><th>요율</th><th>연 금액</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>국민연금 (사업주)</td>
            <td>${fmt(base)}원</td>
            <td>${(ins.nationalPension*100).toFixed(2)}%</td>
            <td class="total-cell">${fmt(pension)}원</td>
          </tr>
          <tr>
            <td>건강보험 (사업주)</td>
            <td>${fmt(base)}원</td>
            <td>${(ins.healthInsurance*100).toFixed(3)}%</td>
            <td class="total-cell">${fmt(health)}원</td>
          </tr>
          <tr>
            <td>장기요양보험</td>
            <td>${fmt(health)}원 <small>(건보료)</small></td>
            <td>${(ins.longTermCare*100).toFixed(2)}%</td>
            <td class="total-cell">${fmt(ltCare)}원</td>
          </tr>
          <tr>
            <td>고용보험 (사업주)</td>
            <td>${fmt(base)}원</td>
            <td>${(ins.employment*100).toFixed(2)}%</td>
            <td class="total-cell">${fmt(employment)}원</td>
          </tr>
          <tr>
            <td>산재보험</td>
            <td>${fmt(base)}원</td>
            <td id="industrialRateCell">${(state.data.industrialRate*100).toFixed(2)}%</td>
            <td class="total-cell" id="industrialAmountCell">${fmt(industrial)}원</td>
          </tr>
          <tr class="subtotal-row">
            <td colspan="3">4대보험 소계</td>
            <td class="total-cell" id="insuranceSubtotal">${fmt(insTotal)}원</td>
          </tr>
          <tr>
            <td>퇴직적립금</td>
            <td>${fmt(base)}원</td>
            <td>1/12 (8.33%)</td>
            <td class="total-cell">${fmt(retirement)}원</td>
          </tr>
          <tr class="total-row">
            <td colspan="3">4대보험 + 퇴직적립금 합계</td>
            <td id="insuranceGrandTotal">${fmt(insTotal + retirement)}원</td>
          </tr>
        </tbody>
      </table>
      
      <!-- 학습용 공식 해설 - 그룹 A / 그룹 B 분리 -->
      <div class="calc-formula" style="margin-top: 16px;">
        <span class="formula-label">🎓 세입 4대보험 지원금 직접 계산해보기 (중요!)</span>
        
        <div style="margin-top: 14px; padding: 12px; background: #FFF9E6; border-radius: 8px; border: 2px solid var(--color-accent);">
          <b style="color: var(--color-primary-dark);">💡 핵심 원리</b><br>
          <span style="font-size: 0.95rem; line-height: 1.8;">
            세입 4대보험 지원금은 <b>두 그룹으로 나눠서 따로 계산</b>해야 해요!<br><br>
            <b>🅰️ 그룹 A (4대보험 80% 지원)</b>: 원장, 영아반, 유아반, 장애, 야간연장, 조리사<br>
            &nbsp;&nbsp;→ 각자의 <b>지원받은 급여</b>가 바로 4대보험 산정기준<br>
            &nbsp;&nbsp;→ (급여가 이미 80%/30%/100% 지원으로 계산돼 있음)<br><br>
            <b>🅱️ 그룹 B (4대보험 30% 지원)</b>: 연장교사, 보조교사<br>
            &nbsp;&nbsp;→ 급여는 100% 지원받지만, 4대보험은 30%만 지원<br>
            &nbsp;&nbsp;→ <b>전체 급여 × 30%</b>가 4대보험 산정기준
          </span>
        </div>
        
        <!-- 그룹 A 계산 -->
        <div style="margin-top: 14px; padding: 12px; background: white; border-radius: 8px; border-left: 4px solid var(--color-primary);">
          <b style="color: var(--color-primary-dark);">📌 STEP 1. 🅰️ 그룹 A 산정기준 (4대보험 80% 지원)</b><br>
          <span style="font-size: 0.95rem; font-variant-numeric: tabular-nums; line-height: 1.7;">
            ${(() => {
              const typeMap = {
                infant: '영아반 교사', preschool: '유아반 교사', disabled: '장애교사',
                night: '야간연장교사', cook: '조리원'
              };
              const d = state.data.director;
              const dRate = state.data.supportRates.director;
              const dSupport = d.salary * 12 * dRate;
              let html = `각 교사의 <b>지원받은 급여</b>가 산정기준이에요:<br><br>`;
              html += `• <b>원장 ${d.grade}호봉</b>: ${fmt(d.salary)}원 × 12개월 × ${(dRate*100).toFixed(0)}% = <b class="formula-result">${fmt(dSupport)}원</b><br>`;
              state.data.teachers.forEach(t => {
                if (isGroupB(t)) return;
                const salaryRate = t.supportRate !== undefined ? t.supportRate : 0.8;
                const annual = t.salary * 12 * (t.count || 1);
                const support = annual * salaryRate;
                html += `• <b>${getTeacherLabel(t)} ${t.grade || ''}호봉 (${t.count || 1}명)</b>: ${fmt(t.salary)}원 × 12개월 × ${t.count || 1}명 × ${(salaryRate*100).toFixed(0)}% = <b class="formula-result">${fmt(support)}원</b><br>`;
              });
              html += `<br><b style="color: var(--color-primary); font-size: 1.05rem;">🅰️ 그룹 A 산정기준 합계: ${fmt(calc.insuranceBaseGroupA())}원</b>`;
              return html;
            })()}
          </span>
        </div>
        
        <!-- 그룹 B 계산 -->
        <div style="margin-top: 10px; padding: 12px; background: white; border-radius: 8px; border-left: 4px solid var(--color-accent);">
          <b style="color: var(--color-primary-dark);">📌 STEP 2. 🅱️ 그룹 B 산정기준 (4대보험 30% 지원)</b><br>
          <span style="font-size: 0.95rem; font-variant-numeric: tabular-nums; line-height: 1.7;">
            ${(() => {
              const groupB = state.data.teachers.filter(t => isGroupB(t));
              if (groupB.length === 0) {
                return '<i style="color: var(--color-text-soft);">보조교사/연장교사가 없어요. 그룹 B 없이 진행!</i>';
              }
              let html = `급여는 100% 받지만, <b>전체의 30%만</b> 4대보험 산정기준이에요:<br><br>`;
              let fullTotal = 0;
              groupB.forEach(t => {
                const annual = t.salary * 12 * (t.count || 1);
                fullTotal += annual;
                html += `• <b>${getTeacherLabel(t)} ${t.grade || ''}호봉 (${t.count || 1}명)</b>: ${fmt(t.salary)}원 × 12개월 × ${t.count || 1}명 = <b class="formula-result">${fmt(annual)}원</b> (100% 지원)<br>`;
              });
              html += `<br>연장/보조교사 급여 합계: <b>${fmt(fullTotal)}원</b><br>`;
              html += `× 30% = <b style="color: var(--color-primary); font-size: 1.05rem;">🅱️ 그룹 B 산정기준: ${fmt(calc.insuranceBaseGroupB())}원</b>`;
              return html;
            })()}
          </span>
        </div>
        
        <!-- 산정기준 합산 -->
        <div style="margin-top: 10px; padding: 12px; background: white; border-radius: 8px; border-left: 4px solid var(--color-primary);">
          <b style="color: var(--color-primary-dark);">📌 STEP 3. 총 산정기준액 = 🅰️ + 🅱️</b><br>
          <span style="font-size: 1rem; font-variant-numeric: tabular-nums;">
            ${fmt(calc.insuranceBaseGroupA())}원 (🅰️) + ${fmt(calc.insuranceBaseGroupB())}원 (🅱️)<br>
            <b style="color: var(--color-primary); font-size: 1.15rem;">= 최종 산정기준: ${fmt(calc.insuranceWeightedBase())}원</b>
          </span>
        </div>
        
        <!-- 4대보험 요율 적용 -->
        <div style="margin-top: 10px; padding: 12px; background: white; border-radius: 8px; border-left: 4px solid var(--color-primary);">
          <b style="color: var(--color-primary-dark);">📌 STEP 4. 최종 산정기준에 요율 적용</b><br>
          <span class="formula-expr" style="display: block; margin-top: 8px; font-variant-numeric: tabular-nums;">
            ${(() => {
              const wBase = calc.insuranceWeightedBase();
              const ins = CONSTANTS.INSURANCE;
              const wHealth = wBase * ins.healthInsurance;
              return `
                <b>국민연금</b>: ${fmt(wBase)}원 × 4.5% = <b class="formula-result">${fmt(wBase * ins.nationalPension)}원</b><br>
                <b>건강보험</b>: ${fmt(wBase)}원 × 3.595% = <b class="formula-result">${fmt(wHealth)}원</b><br>
                <b>장기요양</b>: ${fmt(wHealth)}원 × 13.14% = <b class="formula-result">${fmt(wHealth * ins.longTermCare)}원</b>
                <span style="font-size: 0.85rem; color: var(--color-text-soft);">※ 건보료 기준!</span><br>
                <b>고용보험</b>: ${fmt(wBase)}원 × 0.9% = <b class="formula-result">${fmt(wBase * ins.employment)}원</b><br>
                <b>산재보험</b>: ${fmt(wBase)}원 × ${(state.data.industrialRate*100).toFixed(2)}% = <b class="formula-result">${fmt(wBase * state.data.industrialRate)}원</b><br>
                <b>퇴직적립금</b>: ${fmt(wBase)}원 ÷ 12 = <b class="formula-result">${fmt(wBase * ins.retirement)}원</b>
              `;
            })()}
          </span>
        </div>
        
        <!-- 최종 합계 -->
        <div style="margin-top: 10px; padding: 12px; background: linear-gradient(135deg, #FFF5E9 0%, #FFEFE0 100%); border-radius: 8px; border: 2px solid var(--color-primary);">
          <b style="color: var(--color-primary-dark);">📌 STEP 5. 최종 4대보험 + 퇴직금 지원금</b><br>
          <span style="font-size: 1.05rem; font-variant-numeric: tabular-nums;">
            <b>4대보험 소계</b>: <b class="formula-result">${fmt(calc.insuranceSupportIncomeAmount())}원</b><br>
            <b>퇴직적립금</b>: <b class="formula-result">${fmt(calc.retirementSupportIncomeAmount())}원</b><br>
            <b style="color: var(--color-primary); font-size: 1.2rem;">합계: ${fmt(calc.insuranceSupportIncomeAmount() + calc.retirementSupportIncomeAmount())}원</b>
          </span>
        </div>
        
        <div style="margin-top: 10px; padding: 12px; background: #FDEDEE; border-radius: 8px; border-left: 4px solid var(--color-danger);">
          <b style="color: var(--color-danger);">⚠️ 자주 하는 실수!</b><br>
          <span style="font-size: 0.9rem; line-height: 1.6;">
            연장/보조교사는 <b>급여 100% 지원</b>을 받으니까 4대보험도 100%로 착각하기 쉬워요. 
            실제로는 <b>4대보험은 30%만</b> 지원되니 반드시 분리해서 계산하세요!
          </span>
        </div>
      </div>
      
      <div class="result-grid">
        <div class="result-card">
          <div class="label">예상 4대보험 (급여만 기준, 연)</div>
          <div class="value" id="insuranceCardTotal">${fmt(insTotal)}</div>
          <div class="unit">원</div>
          <div class="form-hint" style="margin-top:4px;">※ 세출에서 수당 입력 후 최종 확정됨</div>
        </div>
        <div class="result-card">
          <div class="label">예상 퇴직적립금 (급여만, 연)</div>
          <div class="value">${fmt(retirement)}</div>
          <div class="unit">원</div>
        </div>
      </div>
    </div>
    `;
  },

  // 11. 시/군/구 지원 항목 (수기)
  () => `
    <div class="card step">
      <span class="step-badge">STEP 12 / 24</span>
      <h2 class="card-title">🏛️ 시/군/구 지원 항목</h2>
      <p class="card-subtitle">지자체마다 다르니 직접 입력해주세요.</p>
      
      <table class="budget-table">
        <thead>
          <tr><th>지원 항목명</th><th>단가</th><th>인원</th><th>개월</th><th>합계</th><th></th></tr>
        </thead>
        <tbody id="localSupportTable">
          ${renderFeeRows('localSupport')}
        </tbody>
      </table>
      <button class="btn-add" data-add="localSupport">+ 지원 항목 추가</button>
      
      <div class="tip-box">
        <strong>💡 자주 있는 지원 항목 (참고용)</strong><br>
        • 기본보육료 / 연장보육료 (영아/유아)<br>
        • 공공형 운영비<br>
        • 급식비 시지원 (예: 아동당 10,000원)<br>
        • 냉난방비<br>
        • 교재교구비<br>
        • 영아지원금 (예: 아동당 10,000원)<br>
        지역마다 다르니 지자체에서 받은 안내문을 참고하세요!
      </div>
      
      <div class="big-total">
        <div class="label">시/군/구 지원 합계 (연)</div>
        <div class="value" id="localTotal">${fmt(calc.localSupportTotal())}<span class="unit">원</span></div>
      </div>
    </div>
  `,

  // 12. 이자수입 / 기타 잡수입
  () => `
    <div class="card step">
      <span class="step-badge">STEP 13 / 24</span>
      <h2 class="card-title">💳 잡수입</h2>
      <p class="card-subtitle">이자수입 같은 작은 수입입니다.</p>
      <div class="form-group">
        <label class="form-label">연간 이자수입 (원)</label>
        <input type="number" class="form-input" id="interestInput" 
               value="${state.data.interestIncome || 0}" min="0" />
        <p class="form-hint">💡 통장 이자 예상액을 적어주세요. 보통 1~5만원 정도.</p>
      </div>
    </div>
  `,

  // 13. 세입 완료 - 중간 검토
  () => {
    const income = calc.totalIncome();
    const ages = state.data.ages;
    const fees = state.data.childcareFees;
    const activeAges = [0,1,2,3,4,5].filter(i => (ages['age'+i] || 0) > 0);
    const hasDisabled = (ages.disabled || 0) > 0;
    const ins = CONSTANTS.INSURANCE;
    const insBase = calc.teacherFullTotal();  // 수당 전 기준
    const health = insBase * ins.healthInsurance;
    
    return `
      <div class="card step">
        <span class="step-badge">STEP 14 / 24 · 세입 완료</span>
        <h2 class="card-title">🎉 세입 작성 완료!</h2>
        <p class="card-subtitle">각 파트별 산출내역을 상세히 확인해볼게요.</p>
        
        <!-- 1. 정부지원 보육료 -->
        <details class="detail-section" open>
          <summary class="detail-summary">
            <span class="detail-icon">💰</span>
            <span class="detail-title">정부지원 보육료</span>
            <span class="detail-value">${fmt(calc.govChildcareFee() + calc.disabledChildcareFee())}원</span>
          </summary>
          <div class="detail-body">
            <table class="budget-table">
              <thead><tr><th>연령</th><th>월 단가</th><th>인원</th><th>기간</th><th>연 합계</th></tr></thead>
              <tbody>
                ${activeAges.map(i => {
                  const count = ages['age'+i] || 0;
                  const fee = fees['age'+i] || 0;
                  return `<tr><td>만 ${i}세</td><td>${fmt(fee)}원</td><td>${count}명</td><td>12개월</td><td class="total-cell">${fmt(fee * count * 12)}원</td></tr>`;
                }).join('')}
                ${hasDisabled ? `<tr><td>장애아</td><td>${fmt(state.data.disabledFee)}원</td><td>${ages.disabled}명</td><td>12개월</td><td class="total-cell">${fmt(state.data.disabledFee * ages.disabled * 12)}원</td></tr>` : ''}
                <tr class="subtotal-row"><td colspan="4">소계</td><td class="total-cell">${fmt(calc.govChildcareFee() + calc.disabledChildcareFee())}원</td></tr>
              </tbody>
            </table>
          </div>
        </details>
        
        <!-- 2. 수익자 부담수입 -->
        ${calc.parentFeeIncome() > 0 ? `
        <details class="detail-section">
          <summary class="detail-summary">
            <span class="detail-icon">💸</span>
            <span class="detail-title">수익자 부담수입</span>
            <span class="detail-value">${fmt(calc.parentFeeIncome())}원</span>
          </summary>
          <div class="detail-body">
            <h4 class="detail-subtitle">특별활동비</h4>
            <table class="budget-table">
              <thead><tr><th>항목</th><th>단가</th><th>인원</th><th>개월</th><th>합계</th></tr></thead>
              <tbody>
                ${state.data.specialActivities.map(a => {
                  const u = a.unit || a.fee || 0;
                  return `<tr><td>${a.name || '-'}</td><td>${fmt(u)}원</td><td>${a.count || 0}명</td><td>${a.months || 0}개월</td><td class="total-cell">${fmt(u * (a.count || 0) * (a.months || 0))}원</td></tr>`;
                }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--color-text-soft);">없음</td></tr>'}
              </tbody>
            </table>
            <h4 class="detail-subtitle">기타필요경비</h4>
            <table class="budget-table">
              <thead><tr><th>항목</th><th>단가</th><th>인원</th><th>개월</th><th>합계</th></tr></thead>
              <tbody>
                ${state.data.otherParentFees.map(a => {
                  const u = a.unit || a.fee || 0;
                  return `<tr><td>${a.name || '-'}</td><td>${fmt(u)}원</td><td>${a.count || 0}명</td><td>${a.months || 0}개월</td><td class="total-cell">${fmt(u * (a.count || 0) * (a.months || 0))}원</td></tr>`;
                }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--color-text-soft);">없음</td></tr>'}
                <tr class="subtotal-row"><td colspan="4">수익자부담 총계</td><td class="total-cell">${fmt(calc.parentFeeIncome())}원</td></tr>
              </tbody>
            </table>
          </div>
        </details>
        ` : ''}
        
        <!-- 3. 인건비 보조금 -->
        <details class="detail-section">
          <summary class="detail-summary">
            <span class="detail-icon">👩‍🏫</span>
            <span class="detail-title">인건비 보조금</span>
            <span class="detail-value">${fmt(calc.personnelSupportIncome())}원</span>
          </summary>
          <div class="detail-body">
            <div class="info-box" style="margin-bottom: 12px;">
              <strong>📐 인건비 보조금 구성</strong><br>
              <b>① 교직원 급여 지원</b><br>
              &nbsp;&nbsp;- 원장, 영아반, 장애, 야간연장: <b>80%</b> 지원<br>
              &nbsp;&nbsp;- 유아반 교사: <b>30%</b> 지원<br>
              &nbsp;&nbsp;- 보조/연장/조리사: <b>100%</b> 지원<br>
              <b>② 4대보험 + 퇴직적립금 지원</b><br>
              &nbsp;&nbsp;- 보조/연장교사: <b>30%</b> 지원<br>
              &nbsp;&nbsp;- 그 외 교직원(조리사 포함): <b>80%</b> 지원<br>
              <span style="color: var(--color-primary-dark); font-weight: 700;">※ 주의: 조리사는 <b>급여 100%</b> 지원이지만, <b>4대보험은 80%</b>만 지원돼요!</span>
            </div>
            
            <h4 class="detail-subtitle">① 교직원 급여 지원</h4>
            <table class="budget-table">
              <thead><tr><th>구분</th><th>월급</th><th>인원</th><th>급여<br>지원율</th><th>연 지원액</th></tr></thead>
              <tbody>
                <tr>
                  <td>원장 ${state.data.director.grade}호봉</td>
                  <td>${fmt(state.data.director.salary)}원</td>
                  <td>1명</td>
                  <td>${(state.data.supportRates.director*100).toFixed(0)}%</td>
                  <td class="total-cell">${fmt(state.data.director.salary * 12 * state.data.supportRates.director)}원</td>
                </tr>
                ${state.data.teachers.map(t => {
                  const typeMap = {
                    infant: '영아반 교사', preschool: '유아반 교사', disabled: '장애교사',
                    aid: '보조교사', extended: '연장교사', night: '야간연장교사', cook: '조리원'
                  };
                  // supportRate가 없으면 타입별 기본값 사용
                  const rateMap = {
                    infant: 0.8, preschool: 0.3, disabled: 0.8,
                    aid: 1.0, extended: 1.0, night: 0.8, cook: 1.0
                  };
                  const rate = t.supportRate !== undefined ? t.supportRate : (rateMap[t.type] !== undefined ? rateMap[t.type] : 0.8);
                  const total = t.salary * 12 * (t.count || 1) * rate;
                  return `<tr>
                    <td>${getTeacherLabel(t)} ${t.grade || ''}호봉</td>
                    <td>${fmt(t.salary)}원</td>
                    <td>${t.count || 1}명</td>
                    <td>${(rate*100).toFixed(0)}%</td>
                    <td class="total-cell">${fmt(total)}원</td>
                  </tr>`;
                }).join('')}
                <tr class="subtotal-row"><td colspan="4">급여 지원 소계</td><td class="total-cell">${fmt(calc.teacherSupportTotal())}원</td></tr>
              </tbody>
            </table>
            
            <h4 class="detail-subtitle">② 4대보험 + 퇴직적립금 (세입 지원금, 2026년 기준)</h4>
            <div class="info-box" style="margin-bottom: 12px;">
              <strong>📐 4대보험/퇴직 지원율은 급여 지원율과 별개예요!</strong><br>
              • <b>보조/연장교사</b>: 4대보험 <b>30%</b>만 지원<br>
              • <b>그 외 교직원</b>(원장, 영아반, 유아반, 장애아, 야간연장, <b>조리사</b>): <b>80%</b> 지원<br>
              <br>
              아래는 각 교사의 <b>가중 산정기준</b>을 먼저 구한 뒤, 요율을 곱해 계산한 지원금이에요.
            </div>
            
            <h4 class="detail-subtitle" style="margin-top: 16px;">교사별 4대보험 지원 산정기준</h4>
            <table class="budget-table">
              <thead><tr><th>구분</th><th>연 급여</th><th>급여<br>지원율</th><th>4대보험<br>지원율</th><th>가중 산정기준</th></tr></thead>
              <tbody>
                <tr>
                  <td>원장 ${state.data.director.grade}호봉</td>
                  <td>${fmt(state.data.director.salary * 12)}원</td>
                  <td>${(state.data.supportRates.director*100).toFixed(0)}%</td>
                  <td>80%</td>
                  <td class="total-cell">${fmt(state.data.director.salary * 12 * 0.8)}원</td>
                </tr>
                ${state.data.teachers.map(t => {
                  const typeMap = {
                    infant: '영아반 교사', preschool: '유아반 교사', disabled: '장애교사',
                    aid: '보조교사', extended: '연장교사', night: '야간연장교사', cook: '조리원'
                  };
                  const rateMap = {
                    infant: 0.8, preschool: 0.3, disabled: 0.8,
                    aid: 1.0, extended: 1.0, night: 0.8, cook: 1.0
                  };
                  const salaryRate = t.supportRate !== undefined ? t.supportRate : (rateMap[t.type] !== undefined ? rateMap[t.type] : 0.8);
                  const insRate = calc.insuranceSupportRate(t.type);
                  const annual = t.salary * 12 * (t.count || 1);
                  const weighted = annual * insRate;
                  // 급여와 4대보험 지원율이 다르면 강조
                  const isDiff = Math.abs(salaryRate - insRate) > 0.001;
                  return `<tr ${isDiff ? 'style="background: #FFF9F0;"' : ''}>
                    <td>${getTeacherLabel(t)} ${t.grade || ''}호봉 (${t.count || 1}명)</td>
                    <td>${fmt(annual)}원</td>
                    <td>${(salaryRate*100).toFixed(0)}%</td>
                    <td${isDiff ? ' style="color: var(--color-primary-dark); font-weight: 700;"' : ''}>${(insRate*100).toFixed(0)}%</td>
                    <td class="total-cell">${fmt(weighted)}원</td>
                  </tr>`;
                }).join('')}
                <tr class="subtotal-row"><td colspan="4">가중 산정기준 합계</td><td class="total-cell">${fmt(calc.insuranceWeightedBase())}원</td></tr>
              </tbody>
            </table>
            <div class="tip-box" style="margin-top: 8px; font-size: 0.85rem;">
              💡 연한 배경 표시는 <b>급여 지원율과 4대보험 지원율이 다른</b> 교사예요 (조리사, 보조/연장교사)
            </div>
            
            <h4 class="detail-subtitle" style="margin-top: 16px;">요율별 지원 금액</h4>
            <table class="budget-table">
              <thead><tr><th>항목</th><th>가중 산정기준</th><th>요율</th><th>연 지원금</th></tr></thead>
              <tbody>
                ${(() => {
                  const wBase = calc.insuranceWeightedBase();
                  const wHealth = wBase * ins.healthInsurance;
                  return `
                    <tr><td>국민연금(사업주)</td><td>${fmt(wBase)}원</td><td>${(ins.nationalPension*100).toFixed(2)}%</td><td class="total-cell">${fmt(wBase * ins.nationalPension)}원</td></tr>
                    <tr><td>건강보험(사업주)</td><td>${fmt(wBase)}원</td><td>${(ins.healthInsurance*100).toFixed(3)}%</td><td class="total-cell">${fmt(wHealth)}원</td></tr>
                    <tr><td>장기요양보험</td><td>${fmt(wHealth)}원 <small>(건보료)</small></td><td>${(ins.longTermCare*100).toFixed(2)}%</td><td class="total-cell">${fmt(wHealth * ins.longTermCare)}원</td></tr>
                    <tr><td>고용보험(사업주)</td><td>${fmt(wBase)}원</td><td>${(ins.employment*100).toFixed(2)}%</td><td class="total-cell">${fmt(wBase * ins.employment)}원</td></tr>
                    <tr><td>산재보험</td><td>${fmt(wBase)}원</td><td>${(state.data.industrialRate*100).toFixed(2)}%</td><td class="total-cell">${fmt(wBase * state.data.industrialRate)}원</td></tr>
                    <tr class="subtotal-row"><td colspan="3">4대보험 지원금 소계</td><td class="total-cell">${fmt(calc.insuranceSupportIncomeAmount())}원</td></tr>
                    <tr><td>퇴직적립금</td><td>${fmt(wBase)}원</td><td>1/12 (8.33%)</td><td class="total-cell">${fmt(calc.retirementSupportIncomeAmount())}원</td></tr>
                    <tr class="total-row"><td colspan="3">4대보험 + 퇴직 지원금 합계</td><td>${fmt(calc.insuranceSupportIncomeAmount() + calc.retirementSupportIncomeAmount())}원</td></tr>
                  `;
                })()}
              </tbody>
            </table>
            
            <div class="big-total" style="margin-top: 16px;">
              <div class="label">인건비 보조금 합계</div>
              <div class="value">${fmt(calc.personnelSupportIncome())}<span class="unit">원</span></div>
            </div>
          </div>
        </details>
        
        <!-- 3-B. 연장반 보육료 -->
        ${calc.extendedCareIncome() > 0 ? `
        <details class="detail-section">
          <summary class="detail-summary">
            <span class="detail-icon">⏰</span>
            <span class="detail-title">연장반 보육료</span>
            <span class="detail-value">${fmt(calc.extendedCareIncome())}원</span>
          </summary>
          <div class="detail-body">
            <div class="info-box" style="margin-bottom: 12px;">
              <strong>📐 계산 공식</strong><br>
              시간당 단가 × 이용 인원 × 월 20시간(1시간 × 20일) × ${state.data.extendedCare.months || 12}개월
            </div>
            <table class="budget-table">
              <thead><tr><th>구분</th><th>시간당 단가</th><th>인원</th><th>월 시간</th><th>개월</th><th>연 합계</th></tr></thead>
              <tbody>
                ${(state.data.extendedCare.infantCount || 0) > 0 ? `
                <tr>
                  <td>영아 연장반</td>
                  <td>${fmt(state.data.extendedCare.infantUnit || 0)}원</td>
                  <td>${state.data.extendedCare.infantCount}명</td>
                  <td>20시간</td>
                  <td>${state.data.extendedCare.months || 12}개월</td>
                  <td class="total-cell">${fmt(calc.extendedCareInfant())}원</td>
                </tr>` : ''}
                ${(state.data.extendedCare.preschoolCount || 0) > 0 ? `
                <tr>
                  <td>유아 연장반</td>
                  <td>${fmt(state.data.extendedCare.preschoolUnit || 0)}원</td>
                  <td>${state.data.extendedCare.preschoolCount}명</td>
                  <td>20시간</td>
                  <td>${state.data.extendedCare.months || 12}개월</td>
                  <td class="total-cell">${fmt(calc.extendedCarePreschool())}원</td>
                </tr>` : ''}
                <tr class="subtotal-row"><td colspan="5">연장반 보육료 총계</td><td class="total-cell">${fmt(calc.extendedCareIncome())}원</td></tr>
              </tbody>
            </table>
          </div>
        </details>
        ` : ''}
        
        <!-- 3-C. 야간연장 보육료 -->
        ${calc.nightCareIncome() > 0 ? `
        <details class="detail-section">
          <summary class="detail-summary">
            <span class="detail-icon">🌙</span>
            <span class="detail-title">야간연장 보육료</span>
            <span class="detail-value">${fmt(calc.nightCareIncome())}원</span>
          </summary>
          <div class="detail-body">
            <div class="info-box" style="margin-bottom: 12px;">
              <strong>📐 계산 공식</strong><br>
              <b>월 보육료</b> = 평균 이용시간(2시간) × 단가(4,000원) × 인원 × 20일<br>
              <b>연 보육료</b> = 월 보육료 × 12개월<br>
              <small>※ 19시~24시 야간연장 보육. 아동별 이용시간이 달라 평균 2시간으로 산정</small>
            </div>
            <table class="budget-table">
              <thead><tr><th>구분</th><th>평균 시간</th><th>시간당 단가</th><th>인원</th><th>월 일수</th><th>월 보육료</th><th>개월</th><th>연 합계</th></tr></thead>
              <tbody>
                <tr>
                  <td>야간연장 보육료</td>
                  <td>2시간</td>
                  <td>4,000원</td>
                  <td>${state.data.nightCareCount || 0}명</td>
                  <td>20일</td>
                  <td>${fmt(calc.nightCareIncome() / 12)}원</td>
                  <td>12개월</td>
                  <td class="total-cell">${fmt(calc.nightCareIncome())}원</td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
        ` : ''}
        
        <!-- 4. 시/군/구 지원금 -->
        ${calc.localSupportTotal() > 0 ? `
        <details class="detail-section">
          <summary class="detail-summary">
            <span class="detail-icon">🏛️</span>
            <span class="detail-title">시/군/구 지원금</span>
            <span class="detail-value">${fmt(calc.localSupportTotal())}원</span>
          </summary>
          <div class="detail-body">
            <table class="budget-table">
              <thead><tr><th>항목</th><th>단가</th><th>인원</th><th>개월</th><th>합계</th></tr></thead>
              <tbody>
                ${state.data.localSupport.map(a => `<tr><td>${a.name || '-'}</td><td>${fmt(a.unit || 0)}원</td><td>${a.count || 0}</td><td>${a.months || 0}개월</td><td class="total-cell">${fmt((a.unit || 0) * (a.count || 0) * (a.months || 0))}원</td></tr>`).join('')}
                <tr class="subtotal-row"><td colspan="4">시/군/구 지원 총계</td><td class="total-cell">${fmt(calc.localSupportTotal())}원</td></tr>
              </tbody>
            </table>
          </div>
        </details>
        ` : ''}
        
        <!-- 5. 잡수입 -->
        ${state.data.interestIncome > 0 ? `
        <details class="detail-section">
          <summary class="detail-summary">
            <span class="detail-icon">💳</span>
            <span class="detail-title">잡수입 (이자수입)</span>
            <span class="detail-value">${fmt(state.data.interestIncome)}원</span>
          </summary>
          <div class="detail-body">
            <table class="budget-table">
              <thead><tr><th>항목</th><th>금액</th></tr></thead>
              <tbody>
                <tr><td>이자수입 (연간 예상)</td><td class="total-cell">${fmt(state.data.interestIncome)}원</td></tr>
              </tbody>
            </table>
          </div>
        </details>
        ` : ''}
        
        <div class="big-total" style="margin-top: 24px;">
          <div class="label">🎯 세입 총액 (연)</div>
          <div class="value">${fmt(income)}<span class="unit">원</span></div>
        </div>
        
        <div class="success-box">
          <strong>✨ 잘하셨어요!</strong><br>
          위 항목들을 클릭하면 상세 내역이 펼쳐져요. 이제 세출(지출)을 작성하러 갈게요. 세출 총액은 세입 총액과 같아야 해요.
        </div>
      </div>
    `;
  },

  // 14. 인건비 (세입에서 복사 확인 + 수당)
  () => {
    const d = state.data.director;
    const typeMap = {
      infant: '영아반 교사', preschool: '유아반 교사', disabled: '장애교사',
      aid: '보조교사', extended: '연장교사', night: '야간연장교사', cook: '조리원'
    };
    const teacherRows = state.data.teachers.map(t => `<tr>
      <td>${getTeacherLabel(t)} ${t.grade || ''}호봉</td>
      <td>${fmt(t.salary)}원</td>
      <td>${t.count || 1}명</td>
      <td>12개월</td>
      <td class="total-cell">${fmt(t.salary * 12 * (t.count || 1))}원</td>
    </tr>`).join('');
    
    const salaryOnlyTotal = calc.teacherFullTotal();
    const allowanceTotal = calc.allAllowanceTotal();
    const otherPersonnelTotal = calc.otherPersonnelTotal();
    const extraPersonnelTotal = calc.extraPersonnelTotal();
    const grandTotal = salaryOnlyTotal + allowanceTotal + otherPersonnelTotal + extraPersonnelTotal;
    
    return `
    ${budgetTrackerHTML()}
    <div class="card step">
      <span class="step-badge">STEP 15 / 24 · 세출 인건비</span>
      <h2 class="card-title">👩‍🏫 인건비 (급여 + 수당)</h2>
      <p class="card-subtitle">세입에서 입력한 급여를 불러와서 확인한 뒤, 수당을 추가로 입력해주세요.</p>
      
      <div class="info-box">
        <strong>📋 세출 인건비 계산 흐름</strong><br>
        <b>1단계 [급여 확인]</b> → 세입에서 작성한 급여 불러오기 (수정 불가)<br>
        <b>2단계 [수당 입력]</b> → 직무수당, 명절휴가비 등 추가<br>
        <b>3단계 [4대보험 계산]</b> → 다음 페이지에서 급여+수당 기준으로 자동 계산
      </div>
      
      <!-- 1단계: 급여 확인 -->
      <h3 class="section-title">1️⃣ 급여 확인 (세입에서 불러옴)</h3>
      
      <h4 style="font-family: var(--font-display); color: var(--color-primary-dark); margin: 16px 0 8px; font-size: 1rem;">원장 급여</h4>
      <table class="budget-table">
        <thead><tr><th>구분</th><th>월급</th><th>인원</th><th>개월</th><th>연 합계</th></tr></thead>
        <tbody>
          <tr>
            <td>원장 ${d.grade}호봉</td>
            <td>${fmt(d.salary)}원</td>
            <td>1명</td>
            <td>12개월</td>
            <td class="total-cell">${fmt(d.salary * 12)}원</td>
          </tr>
        </tbody>
      </table>
      
      <h4 style="font-family: var(--font-display); color: var(--color-primary-dark); margin: 20px 0 8px; font-size: 1rem;">보육교직원 급여</h4>
      <table class="budget-table">
        <thead><tr><th>구분</th><th>월급</th><th>인원</th><th>개월</th><th>연 합계</th></tr></thead>
        <tbody>${teacherRows}</tbody>
      </table>
      
      <div class="subtotal-display" style="font-size: 1rem; padding: 14px 18px; background: var(--color-bg-soft); border-radius: var(--radius-md); margin-top: 12px;">
        <b>① 급여 소계 (연):</b> <span style="color: var(--color-primary); font-size: 1.1rem;"><b>${fmt(salaryOnlyTotal)}원</b></span>
      </div>
      
      <div class="warn-box" style="margin-top: 12px;">
        <strong>⚠️ 확인하세요!</strong><br>
        위 인건비가 맞나요? 추가할 인원이 있다면 <b>이전으로 돌아가</b> STEP 5에서 수정해주세요. (세입과 연동되어야 하기 때문에 여기서는 수정 불가)
      </div>
      
      <!-- 2단계: 수당 입력 -->
      <h3 class="section-title" style="margin-top: 32px;">2️⃣ 수당 입력</h3>
      
      <h4 style="font-family: var(--font-display); color: var(--color-primary-dark); margin: 16px 0 8px; font-size: 1rem;">원장 수당 ✏️</h4>
      <div class="tip-box" style="margin-bottom: 12px;">
        💡 직무수당, 명절휴가비 등을 <b>월액(원)</b>으로 입력해주세요.
      </div>
      <table class="budget-table">
        <thead><tr><th>항목명</th><th>월 단가</th><th>인원</th><th>개월</th><th>합계</th><th></th></tr></thead>
        <tbody id="directorAllowancesTable">${renderFeeRows('directorAllowances')}</tbody>
      </table>
      <button class="btn-add" data-add="directorAllowances">+ 원장 수당 추가</button>
      <div class="subtotal-display">
        원장 수당 소계: <b id="directorAllowSubtotal">${fmt(calc.directorAllowanceTotal())}원</b>
      </div>
      
      <h4 style="font-family: var(--font-display); color: var(--color-primary-dark); margin: 20px 0 8px; font-size: 1rem;">보육교직원 수당 ✏️</h4>
      <div class="tip-box" style="margin-bottom: 12px;">
        💡 주임수당, 시간외수당, 명절휴가비 등을 <b>월액(원)</b>으로 입력해주세요.
      </div>
      <table class="budget-table">
        <thead><tr><th>항목명</th><th>월 단가</th><th>인원</th><th>개월</th><th>합계</th><th></th></tr></thead>
        <tbody id="teacherAllowancesTable">${renderFeeRows('teacherAllowances')}</tbody>
      </table>
      <button class="btn-add" data-add="teacherAllowances">+ 교직원 수당 추가</button>
      <div class="subtotal-display">
        교직원 수당 소계: <b id="teacherAllowSubtotal">${fmt(calc.teacherAllowanceTotal())}원</b>
      </div>
      
      <div class="subtotal-display" style="font-size: 1rem; padding: 14px 18px; background: var(--color-bg-soft); border-radius: var(--radius-md); margin-top: 12px;">
        <b>② 수당 소계 (연):</b> <span style="color: var(--color-primary); font-size: 1.1rem;"><b id="allowanceGrandSubtotal">${fmt(allowanceTotal)}원</b></span>
      </div>
      
      <!-- ③ 기타 인건비 섹션 (4대보험 미포함) -->
      <h4 style="font-family: var(--font-display); color: #6c3a8e; margin: 28px 0 8px; font-size: 1rem;">③ 기타 인건비 ✏️ <span style="font-size: 0.82rem; color: var(--color-text-soft); font-weight: 400;">(세입에서 안 받지만 자체 지출하는 인건비)</span></h4>
      <div class="tip-box" style="margin-bottom: 12px; background: #f5f0ff; border-left: 3px solid #8a4faf;">
        💡 <b>대체교사, 대체조리사</b> 등 비정기 인건비를 입력하세요. (월액 × 인원 × 개월)<br>
        ⚠️ <b>4대보험은 포함되지 않습니다</b> (별도 처리 - 인건비 합계에만 추가).
      </div>
      <table class="budget-table">
        <thead><tr><th>항목명</th><th>월 단가</th><th>인원</th><th>개월</th><th>합계</th><th></th></tr></thead>
        <tbody id="otherPersonnelTable">${renderFeeRows('otherPersonnel')}</tbody>
      </table>
      <button class="btn-add" data-add="otherPersonnel">+ 기타 인건비 추가</button>
      <div class="subtotal-display" style="background: #e8dcf5; color: #4d2a66;">
        <b>③ 기타 인건비 소계 (연):</b> <span style="color: #6c3a8e; font-size: 1.1rem;"><b id="otherPersonnelSubtotal">${fmt(otherPersonnelTotal)}원</b></span>
      </div>
      
      <!-- ④ 추가 인건비 섹션 (4대보험 포함, 세입 미반영) -->
      <h4 style="font-family: var(--font-display); color: #2c6b2f; margin: 28px 0 8px; font-size: 1rem;">④ 추가 인건비 ✏️ <span style="font-size: 0.82rem; color: var(--color-text-soft); font-weight: 400;">(세입 미반영 정규 교직원, 4대보험 포함)</span></h4>
      <div class="tip-box" style="margin-bottom: 12px; background: #e0f0dd; border-left: 3px solid #5a9b50; color: #244e26;">
        💡 <b>조리보조교사</b> 등 세입에 반영되지 않는 정규 교직원을 입력하세요.<br>
        🧮 계산: <b>월급 × 개월 × 인원 = 연 합계</b><br>
        ✅ <b>4대보험 산정에 포함됩니다</b> (정규 교직원이므로).
      </div>
      <div class="teacher-row-header" style="grid-template-columns: 2fr 1.3fr 0.8fr 0.8fr 1.3fr 0.7fr; background: #d4ead0; color: #2c6b2f;">
        <span>구분</span><span>월급 (원)</span><span>인원</span><span>개월</span><span>연 합계</span><span></span>
      </div>
      <div id="extraPersonnelList">${renderExtraPersonnelRows()}</div>
      <button class="btn-add" id="btnAddExtraPersonnel" style="border-color: #5a9b50; color: #5a9b50;">+ 추가 인건비 추가</button>
      <div class="subtotal-display" style="background: #d4ead0; color: #2c6b2f;">
        <b>④ 추가 인건비 소계 (연):</b> <span style="color: #2c6b2f; font-size: 1.1rem;"><b id="extraPersonnelSubtotal">${fmt(extraPersonnelTotal)}원</b></span>
      </div>
      
      <!-- 5단계: 급여 + 수당 + 추가 합계 → 4대보험 연결 안내 -->
      <h3 class="section-title" style="margin-top: 32px;">5️⃣ 다음 페이지에서 4대보험 자동 계산</h3>
      <div class="info-box">
        <strong>📐 4대보험 산정 기준</strong><br>
        다음 페이지에서 <b>① 급여 + ② 수당 + ④ 추가 인건비</b> 를 합한 금액을 기준으로 4대보험과 퇴직적립금이 자동 계산됩니다.<br>
        <i style="color: #6c3a8e;">(③ 기타 인건비는 비정기 지출이라 4대보험 산정에서 제외)</i><br>
        <br>
        <span style="font-size: 1rem;">① 급여 <b>${fmt(salaryOnlyTotal)}원</b> + ② 수당 <b id="allowanceFormulaSum">${fmt(allowanceTotal)}원</b> + ④ 추가 <b id="extraFormulaSum">${fmt(extraPersonnelTotal)}원</b></span><br>
        <span style="font-size: 1.05rem; color: var(--color-primary-dark); font-weight: 700;">= 4대보험 산정기준액 <b id="insuranceBaseFormula">${fmt(salaryOnlyTotal + allowanceTotal + extraPersonnelTotal)}원</b></span>
      </div>
      
      <div class="big-total">
        <div class="label">인건비 합계 (급여 + 수당 + 기타 + 추가, 연)</div>
        <div class="value" id="personnelGrandTotal">${fmt(grandTotal)}<span class="unit">원</span></div>
      </div>
    </div>
    `;
  },

  // 15. 4대보험 + 퇴직금 자동 계산
  () => {
    const base = calc.insuranceBase();
    const ins = CONSTANTS.INSURANCE;
    const salaryOnly = calc.teacherFullTotal();
    const allowanceT = calc.allAllowanceTotal();
    const health = base * ins.healthInsurance;
    const ltCare = health * ins.longTermCare;
    const pension = base * ins.nationalPension;
    const employment = base * ins.employment;
    const industrial = base * state.data.industrialRate;
    const retirement = base * ins.retirement;
    const insTotal = calc.insuranceTotalNew();
    return `
    ${budgetTrackerHTML()}
    <div class="card step">
      <span class="step-badge">STEP 16 / 24 · 세출 4대보험</span>
      <h2 class="card-title">🏥 4대보험 & 퇴직금 (자동 계산)</h2>
      <p class="card-subtitle">2026년 최신 요율로 자동 계산했어요! 산출 과정도 확인해보세요.</p>
      
      <!-- 1단계: 산정기준 해설 -->
      <h3 class="section-title">1️⃣ 산정 기준액 확인</h3>
      <div class="info-box">
        <strong>📐 4대보험과 퇴직금의 산정 기준</strong><br>
        세출에서는 <b>급여 + 수당 전체</b>를 기준으로 4대보험과 퇴직금이 계산돼요.<br>
        (수당도 실제 지급되는 급여의 일부이기 때문이에요!)
      </div>
      
      <table class="budget-table">
        <thead><tr><th>구분</th><th>연 금액</th></tr></thead>
        <tbody>
          <tr><td>① 급여 (원장 + 교직원 전체)</td><td class="total-cell">${fmt(salaryOnly)}원</td></tr>
          <tr><td>② 수당 (원장 수당 + 교직원 수당)</td><td class="total-cell">${fmt(allowanceT)}원</td></tr>
          <tr class="total-row"><td>산정 기준액 (① + ②)</td><td>${fmt(base)}원</td></tr>
        </tbody>
      </table>
      
      <!-- 2단계: 각 보험의 계산 공식 학습 -->
      <h3 class="section-title">2️⃣ 각 보험의 계산 공식 (학습)</h3>
      <div class="info-box">
        <strong>📚 2026년 기준 요율 해설</strong><br>
        • <b>국민연금</b>: 전체 9.0% 중 <b>사업주 4.5%</b> 부담<br>
        &nbsp;&nbsp;&nbsp;→ 산정기준 × 4.5%<br>
        • <b>건강보험</b>: 전체 7.19% 중 <b>사업주 3.595%</b> 부담<br>
        &nbsp;&nbsp;&nbsp;→ 산정기준 × 3.595%<br>
        • <b>장기요양보험</b>: <b>건강보험료</b>를 기준으로 13.14%<br>
        &nbsp;&nbsp;&nbsp;⚠️ 주의! 산정기준이 아니라 <b>건보료</b>에 곱함<br>
        • <b>고용보험</b>: 사업주 <b>0.9%</b> 부담<br>
        &nbsp;&nbsp;&nbsp;→ 산정기준 × 0.9%<br>
        • <b>산재보험</b>: 업종별 상이 (어린이집 0.7~0.9%)<br>
        &nbsp;&nbsp;&nbsp;→ 산정기준 × 산재요율 (현재 ${(state.data.industrialRate*100).toFixed(2)}%)<br>
        • <b>퇴직적립금</b>: 연간 1개월분 = 연봉의 1/12 ≒ 8.33%<br>
        &nbsp;&nbsp;&nbsp;→ 산정기준 ÷ 12
      </div>
      
      <!-- 3단계: 실제 산출표 -->
      <h3 class="section-title">3️⃣ 요율별 산출 결과</h3>
      <table class="budget-table">
        <thead><tr><th>항목</th><th>산정 기준</th><th>요율</th><th>연 금액</th></tr></thead>
        <tbody>
          <tr>
            <td>국민연금 (사업주)</td>
            <td>${fmt(base)}원</td>
            <td>${(ins.nationalPension*100).toFixed(2)}%</td>
            <td class="total-cell">${fmt(pension)}원</td>
          </tr>
          <tr>
            <td>건강보험 (사업주)</td>
            <td>${fmt(base)}원</td>
            <td>${(ins.healthInsurance*100).toFixed(3)}%</td>
            <td class="total-cell">${fmt(health)}원</td>
          </tr>
          <tr>
            <td>장기요양보험</td>
            <td>${fmt(health)}원 <small>(건보료)</small></td>
            <td>${(ins.longTermCare*100).toFixed(2)}%</td>
            <td class="total-cell">${fmt(ltCare)}원</td>
          </tr>
          <tr>
            <td>고용보험 (사업주)</td>
            <td>${fmt(base)}원</td>
            <td>${(ins.employment*100).toFixed(2)}%</td>
            <td class="total-cell">${fmt(employment)}원</td>
          </tr>
          <tr>
            <td>산재보험</td>
            <td>${fmt(base)}원</td>
            <td>${(state.data.industrialRate*100).toFixed(2)}%</td>
            <td class="total-cell">${fmt(industrial)}원</td>
          </tr>
          <tr class="subtotal-row">
            <td colspan="3">4대보험 소계</td>
            <td class="total-cell">${fmt(insTotal)}원</td>
          </tr>
          <tr>
            <td>퇴직적립금</td>
            <td>${fmt(base)}원</td>
            <td>1/12 (8.33%)</td>
            <td class="total-cell">${fmt(retirement)}원</td>
          </tr>
          <tr class="total-row">
            <td colspan="3">4대보험 + 퇴직금 합계</td>
            <td>${fmt(insTotal + retirement)}원</td>
          </tr>
        </tbody>
      </table>
      
      <!-- 4단계: 직접 계산해보기 - 처음부터 끝까지 상세히 -->
      <div class="calc-formula" style="margin-top: 16px;">
        <span class="formula-label">🎓 직접 계산해보기 (처음부터 끝까지!)</span>
        
        <div style="margin-top: 14px; padding: 12px; background: white; border-radius: 8px; border-left: 4px solid var(--color-primary);">
          <b style="color: var(--color-primary-dark);">📌 STEP 1. 교직원 수 확인</b><br>
          <span style="font-size: 0.95rem;">
            ${(() => {
              const typeMap = {
                infant: '영아반 교사', preschool: '유아반 교사', disabled: '장애교사',
                aid: '보조교사', extended: '연장교사', night: '야간연장교사', cook: '조리원'
              };
              const totalStaff = 1 + state.data.teachers.reduce((s, t) => s + (t.count || 1), 0);
              let html = `• <b>원장</b>: 1명<br>`;
              state.data.teachers.forEach(t => {
                html += `• <b>${getTeacherLabel(t)}</b>: ${t.count || 1}명<br>`;
              });
              html += `<b style="color: var(--color-primary);">→ 총 교직원: ${totalStaff}명</b>`;
              return html;
            })()}
          </span>
        </div>
        
        <div style="margin-top: 10px; padding: 12px; background: white; border-radius: 8px; border-left: 4px solid var(--color-primary);">
          <b style="color: var(--color-primary-dark);">📌 STEP 2. 개별 연 급여 계산</b><br>
          <span style="font-size: 0.95rem; font-variant-numeric: tabular-nums;">
            ${(() => {
              const typeMap = {
                infant: '영아반 교사', preschool: '유아반 교사', disabled: '장애교사',
                aid: '보조교사', extended: '연장교사', night: '야간연장교사', cook: '조리원'
              };
              const d = state.data.director;
              let html = `• <b>원장 ${d.grade}호봉</b>: ${fmt(d.salary)}원 × 12개월 × 1명 = <b class="formula-result">${fmt(d.salary * 12)}원</b><br>`;
              state.data.teachers.forEach(t => {
                const annual = t.salary * 12 * (t.count || 1);
                html += `• <b>${getTeacherLabel(t)} ${t.grade || ''}호봉</b>: ${fmt(t.salary)}원 × 12개월 × ${t.count || 1}명 = <b class="formula-result">${fmt(annual)}원</b><br>`;
              });
              html += `<b style="color: var(--color-primary);">① 급여 합계: ${fmt(salaryOnly)}원</b>`;
              return html;
            })()}
          </span>
        </div>
        
        <div style="margin-top: 10px; padding: 12px; background: white; border-radius: 8px; border-left: 4px solid var(--color-primary);">
          <b style="color: var(--color-primary-dark);">📌 STEP 3. 수당 계산 (단가 × 인원 × 개월)</b><br>
          <span style="font-size: 0.95rem; font-variant-numeric: tabular-nums;">
            ${(() => {
              let html = '<b>원장 수당:</b><br>';
              if (state.data.directorAllowances.length === 0) {
                html += '&nbsp;&nbsp;(없음)<br>';
              } else {
                state.data.directorAllowances.forEach(a => {
                  const t = (a.unit || 0) * (a.count || 0) * (a.months || 0);
                  html += `&nbsp;&nbsp;• ${a.name || '-'}: ${fmt(a.unit || 0)}원 × ${a.count || 0}명 × ${a.months || 0}개월 = <b class="formula-result">${fmt(t)}원</b><br>`;
                });
              }
              html += '<b>교직원 수당:</b><br>';
              if (state.data.teacherAllowances.length === 0) {
                html += '&nbsp;&nbsp;(없음)<br>';
              } else {
                state.data.teacherAllowances.forEach(a => {
                  const t = (a.unit || 0) * (a.count || 0) * (a.months || 0);
                  html += `&nbsp;&nbsp;• ${a.name || '-'}: ${fmt(a.unit || 0)}원 × ${a.count || 0}명 × ${a.months || 0}개월 = <b class="formula-result">${fmt(t)}원</b><br>`;
                });
              }
              html += `<b style="color: var(--color-primary);">② 수당 합계: ${fmt(allowanceT)}원</b>`;
              return html;
            })()}
          </span>
        </div>
        
        <div style="margin-top: 10px; padding: 12px; background: white; border-radius: 8px; border-left: 4px solid var(--color-primary);">
          <b style="color: var(--color-primary-dark);">📌 STEP 4. 산정 기준액 = ① 급여 + ② 수당</b><br>
          <span style="font-size: 1rem; font-variant-numeric: tabular-nums;">
            ${fmt(salaryOnly)}원 + ${fmt(allowanceT)}원<br>
            <b style="color: var(--color-primary); font-size: 1.15rem;">= 산정 기준액: ${fmt(base)}원</b>
          </span>
        </div>
        
        <div style="margin-top: 10px; padding: 12px; background: white; border-radius: 8px; border-left: 4px solid var(--color-primary);">
          <b style="color: var(--color-primary-dark);">📌 STEP 5. 각 보험료 계산 (산정기준 × 요율)</b><br>
          <span class="formula-expr" style="display: block; margin-top: 8px; font-variant-numeric: tabular-nums;">
            <b>국민연금</b>: ${fmt(base)}원 × 4.5% = <b class="formula-result">${fmt(pension)}원</b><br>
            <b>건강보험</b>: ${fmt(base)}원 × 3.595% = <b class="formula-result">${fmt(health)}원</b><br>
            <b>장기요양</b>: ${fmt(health)}원 × 13.14% = <b class="formula-result">${fmt(ltCare)}원</b>
            <span style="font-size: 0.85rem; color: var(--color-text-soft);">※ 건보료 기준!</span><br>
            <b>고용보험</b>: ${fmt(base)}원 × 0.9% = <b class="formula-result">${fmt(employment)}원</b><br>
            <b>산재보험</b>: ${fmt(base)}원 × ${(state.data.industrialRate*100).toFixed(2)}% = <b class="formula-result">${fmt(industrial)}원</b><br>
            <b>퇴직적립금</b>: ${fmt(base)}원 ÷ 12 = <b class="formula-result">${fmt(retirement)}원</b>
          </span>
        </div>
        
        <div style="margin-top: 10px; padding: 12px; background: linear-gradient(135deg, #FFF5E9 0%, #FFEFE0 100%); border-radius: 8px; border: 2px solid var(--color-primary);">
          <b style="color: var(--color-primary-dark);">📌 STEP 6. 최종 합계</b><br>
          <span style="font-size: 0.95rem; font-variant-numeric: tabular-nums;">
            4대보험 소계 = ${fmt(pension)} + ${fmt(health)} + ${fmt(ltCare)} + ${fmt(employment)} + ${fmt(industrial)} = <b class="formula-result">${fmt(insTotal)}원</b><br>
            <b style="color: var(--color-primary); font-size: 1.15rem;">4대보험 + 퇴직금 합계: ${fmt(insTotal + retirement)}원</b>
          </span>
        </div>
      </div>
      
      <div class="tip-box" style="margin-top: 16px;">
        <strong>💡 참고</strong><br>
        • 산재보험 요율은 STEP 11에서 입력한 값이에요 (현재: ${(state.data.industrialRate*100).toFixed(2)}%)<br>
        • 2026년 요율 기준: 국민연금 9.0%, 건강보험 7.19%, 장기요양 13.14%<br>
        • 요율을 바꾸고 싶으면 STEP 11로 돌아가세요!
      </div>
    </div>
    `;
  },

  // 16. 관리운영비 (수용비, 공공요금, 연료비, 여비, 차량비, 복리후생비)
  () => `
    ${budgetTrackerHTML()}
    <div class="card step">
      <span class="step-badge">STEP 17 / 24 · 세출 관리운영비</span>
      <h2 class="card-title">🏢 관리운영비</h2>
      <p class="card-subtitle">샘플을 미리 채워두었어요. 필요 없는 항목은 삭제해주세요.</p>
      
      <h3 class="section-title">211 수용비 및 수수료</h3>
      <table class="budget-table">
        <thead><tr><th>항목명</th><th>단가</th><th>인원/횟수</th><th>개월</th><th>합계</th><th></th></tr></thead>
        <tbody id="receivingTable">${renderFeeRows('receivingCosts')}</tbody>
      </table>
      <button class="btn-add" data-add="receivingCosts">+ 수용비 항목 추가</button>
      <div class="subtotal-display">소계: <b>${fmt(calc.receivingTotal())}원</b></div>
      
      <h3 class="section-title">212 공공요금 및 제세공과금</h3>
      <table class="budget-table">
        <thead><tr><th>항목명</th><th>단가</th><th>인원/횟수</th><th>개월</th><th>합계</th><th></th></tr></thead>
        <tbody id="utilityTable">${renderFeeRows('utilityCosts')}</tbody>
      </table>
      <button class="btn-add" data-add="utilityCosts">+ 공공요금 항목 추가</button>
      <div class="subtotal-display">소계: <b>${fmt(calc.utilityTotal())}원</b></div>
      
      <h3 class="section-title">213 연료비</h3>
      <table class="budget-table">
        <thead><tr><th>항목명</th><th>단가</th><th>인원/횟수</th><th>개월</th><th>합계</th><th></th></tr></thead>
        <tbody id="fuelTable">${renderFeeRows('fuelCosts')}</tbody>
      </table>
      <button class="btn-add" data-add="fuelCosts">+ 연료비 항목 추가</button>
      <div class="subtotal-display">소계: <b>${fmt(calc.fuelTotal())}원</b></div>
      
      <h3 class="section-title">214 여비</h3>
      <table class="budget-table">
        <thead><tr><th>항목명</th><th>단가</th><th>인원/횟수</th><th>개월</th><th>합계</th><th></th></tr></thead>
        <tbody id="travelTable">${renderFeeRows('travelCosts')}</tbody>
      </table>
      <button class="btn-add" data-add="travelCosts">+ 여비 항목 추가</button>
      <div class="subtotal-display">소계: <b>${fmt(calc.travelTotal())}원</b></div>
      
      <h3 class="section-title">215 차량비</h3>
      <table class="budget-table">
        <thead><tr><th>항목명</th><th>단가</th><th>인원/횟수</th><th>개월</th><th>합계</th><th></th></tr></thead>
        <tbody id="vehicleTable">${renderFeeRows('vehicleCosts')}</tbody>
      </table>
      <button class="btn-add" data-add="vehicleCosts">+ 차량비 항목 추가</button>
      <div class="subtotal-display">소계: <b>${fmt(calc.vehicleTotal())}원</b></div>
      
      <h3 class="section-title">216 복리후생비</h3>
      <table class="budget-table">
        <thead><tr><th>항목명</th><th>단가</th><th>인원/횟수</th><th>개월</th><th>합계</th><th></th></tr></thead>
        <tbody id="welfareTable">${renderFeeRows('welfareCosts')}</tbody>
      </table>
      <button class="btn-add" data-add="welfareCosts">+ 복리후생비 항목 추가</button>
      <div class="subtotal-display">소계: <b>${fmt(calc.welfareTotal())}원</b></div>
      
      <div class="big-total">
        <div class="label">관리운영비 합계 (연)</div>
        <div class="value">${fmt(calc.managementTotal())}<span class="unit">원</span></div>
      </div>
    </div>
  `,

  // 17. 업무추진비 (업무추진비, 직책급, 회의비)
  () => `
    ${budgetTrackerHTML()}
    <div class="card step">
      <span class="step-badge">STEP 18 / 24 · 세출 업무추진비</span>
      <h2 class="card-title">📌 업무추진비</h2>
      <p class="card-subtitle">업무추진비, 직책급, 회의비를 확인해주세요.</p>
      
      <h3 class="section-title">221 업무추진비</h3>
      <table class="budget-table">
        <thead><tr><th>항목명</th><th>단가</th><th>인원/횟수</th><th>개월</th><th>합계</th><th></th></tr></thead>
        <tbody id="businessPromoTable">${renderFeeRows('businessPromoCosts')}</tbody>
      </table>
      <button class="btn-add" data-add="businessPromoCosts">+ 업무추진비 항목 추가</button>
      <div class="subtotal-display">소계: <b>${fmt(calc.businessPromoTotal())}원</b></div>
      
      <h3 class="section-title">222 직책급</h3>
      <table class="budget-table">
        <thead><tr><th>항목명</th><th>단가</th><th>인원</th><th>개월</th><th>합계</th><th></th></tr></thead>
        <tbody id="positionAllowanceTable">${renderFeeRows('positionAllowanceCosts')}</tbody>
      </table>
      <button class="btn-add" data-add="positionAllowanceCosts">+ 직책급 항목 추가</button>
      <div class="subtotal-display">소계: <b>${fmt(calc.positionAllowanceTotal())}원</b></div>
      
      <h3 class="section-title">223 회의비</h3>
      <table class="budget-table">
        <thead><tr><th>항목명</th><th>단가</th><th>인원</th><th>횟수</th><th>합계</th><th></th></tr></thead>
        <tbody id="meetingTable">${renderFeeRows('meetingCosts')}</tbody>
      </table>
      <button class="btn-add" data-add="meetingCosts">+ 회의비 항목 추가</button>
      <div class="subtotal-display">소계: <b>${fmt(calc.meetingTotal())}원</b></div>
      
      <div class="big-total">
        <div class="label">업무추진비 합계 (연)</div>
        <div class="value">${fmt(calc.promoTotal())}<span class="unit">원</span></div>
      </div>
    </div>
  `,

  // 18. 보육활동비 (연수비, 교재교구비, 행사비, 급간식비)
  () => `
    ${budgetTrackerHTML()}
    <div class="card step">
      <span class="step-badge">STEP 19 / 24 · 세출 보육활동비</span>
      <h2 class="card-title">🎨 보육활동비</h2>
      <p class="card-subtitle">아이들을 위한 활동 비용이에요. 가장 중요한 부분!</p>
      
      <h3 class="section-title">311 교직원 연수 연구비</h3>
      <table class="budget-table">
        <thead><tr><th>항목명</th><th>단가</th><th>인원</th><th>횟수</th><th>합계</th><th></th></tr></thead>
        <tbody id="trainingTable">${renderFeeRows('trainingCosts')}</tbody>
      </table>
      <button class="btn-add" data-add="trainingCosts">+ 연수비 항목 추가</button>
      <div class="subtotal-display">소계: <b>${fmt(calc.trainingTotal())}원</b></div>
      
      <h3 class="section-title">312 교재교구 구입비</h3>
      <table class="budget-table">
        <thead><tr><th>항목명</th><th>단가</th><th>인원</th><th>개월</th><th>합계</th><th></th></tr></thead>
        <tbody id="materialTable">${renderFeeRows('materialCosts')}</tbody>
      </table>
      <button class="btn-add" data-add="materialCosts">+ 교재교구비 항목 추가</button>
      <div class="subtotal-display">소계: <b>${fmt(calc.materialTotal())}원</b></div>
      
      <h3 class="section-title">313 행사비</h3>
      <table class="budget-table">
        <thead><tr><th>항목명</th><th>단가</th><th>인원</th><th>횟수</th><th>합계</th><th></th></tr></thead>
        <tbody id="eventTable">${renderFeeRows('eventCosts')}</tbody>
      </table>
      <button class="btn-add" data-add="eventCosts">+ 행사비 항목 추가</button>
      <div class="subtotal-display">소계: <b>${fmt(calc.eventTotal())}원</b></div>
      
      <h3 class="section-title">315 급간식비</h3>
      <div class="tip-box" style="margin-bottom: 12px;">
        <strong>💡 급간식비 계산 공식</strong><br>
        1일 4,000원 × 20일 = 월 80,000원 × 정원(${calc.totalCapacity()}명) × 12개월 = <b>${fmt(80000 * calc.totalCapacity() * 12)}원</b>
      </div>
      <table class="budget-table">
        <thead><tr><th>항목명</th><th>월 단가</th><th>인원</th><th>개월</th><th>합계</th><th></th></tr></thead>
        <tbody id="mealTable">${renderFeeRows('mealCosts')}</tbody>
      </table>
      <button class="btn-add" data-add="mealCosts">+ 급간식비 항목 추가</button>
      <div class="subtotal-display">소계: <b>${fmt(calc.mealTotal())}원</b></div>
      
      <div class="big-total">
        <div class="label">보육활동비 합계 (연)</div>
        <div class="value">${fmt(calc.childcareActivityTotal())}<span class="unit">원</span></div>
      </div>
    </div>
  `,

  // 19. 수익자부담 지출 (세입에서 자동 복사, 확인만)
  () => {
    const parentIn = calc.parentFeeIncome();
    const parentOut = calc.parentFeeExpense();
    const balanced = Math.abs(parentIn - parentOut) < 1;
    return `
    ${budgetTrackerHTML()}
    <div class="card step">
      <span class="step-badge">STEP 20 / 24 · 세출 수익자부담</span>
      <h2 class="card-title">💸 수익자부담 지출 (자동 불러오기)</h2>
      <p class="card-subtitle">세입에서 작성한 특별활동비·기타필요경비를 그대로 불러왔어요.</p>
      
      <div class="info-box">
        <strong>🔗 왜 세입과 같아야 하나요?</strong><br>
        부모님께 받은 돈은 <b>그대로 지출</b>되어야 해요. 그래서 세입의 수익자부담 = 세출의 수익자부담이어야 합니다!
      </div>
      
      <h3 class="section-title">특별활동비 + 기타필요경비</h3>
      <table class="budget-table">
        <thead><tr><th>항목명</th><th>단가</th><th>인원</th><th>개월</th><th>합계</th><th></th></tr></thead>
        <tbody id="parentExpTable">${renderFeeRows('parentFeeExpenses')}</tbody>
      </table>
      <button class="btn-add" data-add="parentFeeExpenses">+ 수익자부담 항목 추가</button>
      
      <ul class="check-list" style="margin-top: 20px;">
        <li class="${balanced ? 'ok' : 'warn'}">
          <span class="check-icon">${balanced ? '✅' : '⚠️'}</span>
          <span class="check-label">세입 수익자부담</span>
          <span class="check-value">${fmt(parentIn)}원</span>
        </li>
        <li class="${balanced ? 'ok' : 'warn'}">
          <span class="check-icon">${balanced ? '✅' : '⚠️'}</span>
          <span class="check-label">세출 수익자부담</span>
          <span class="check-value">${fmt(parentOut)}원</span>
        </li>
      </ul>
      
      ${!balanced ? `
        <div class="warn-box" style="margin-top: 16px;">
          <strong>⚠️ 세입과 세출이 달라요!</strong><br>
          차이: ${fmt(Math.abs(parentIn - parentOut))}원. 세입(STEP 8)으로 돌아가거나, 위에서 항목을 수정해주세요.
        </div>
      ` : `
        <div class="success-box" style="margin-top: 16px;">
          <strong>✨ 세입 = 세출, 딱 맞아요!</strong>
        </div>
      `}
    </div>
    `;
  },

  // 20. 재산조성비
  () => `
    ${budgetTrackerHTML()}
    <div class="card step">
      <span class="step-badge">STEP 21 / 24 · 세출 재산조성비</span>
      <h2 class="card-title">🏗️ 재산조성비</h2>
      <p class="card-subtitle">시설비, 시설유지비, 자산취득비를 입력해주세요.</p>
      
      <h3 class="section-title">711 시설비</h3>
      <table class="budget-table">
        <thead><tr><th>항목명</th><th>단가</th><th>인원/횟수</th><th>개월</th><th>합계</th><th></th></tr></thead>
        <tbody id="facilityTable">${renderFeeRows('facilityCosts')}</tbody>
      </table>
      <button class="btn-add" data-add="facilityCosts">+ 시설비 항목 추가</button>
      <div class="subtotal-display">소계: <b>${fmt(calc.facilityTotal())}원</b></div>
      
      <h3 class="section-title">712 시설비유지비</h3>
      <table class="budget-table">
        <thead><tr><th>항목명</th><th>단가</th><th>인원/횟수</th><th>개월</th><th>합계</th><th></th></tr></thead>
        <tbody id="facilityMaintTable">${renderFeeRows('facilityMaintCosts')}</tbody>
      </table>
      <button class="btn-add" data-add="facilityMaintCosts">+ 시설유지비 항목 추가</button>
      <div class="subtotal-display">소계: <b>${fmt(calc.facilityMaintTotal())}원</b></div>
      
      <h3 class="section-title">721 자산취득비</h3>
      <table class="budget-table">
        <thead><tr><th>항목명</th><th>단가</th><th>인원/횟수</th><th>개월</th><th>합계</th><th></th></tr></thead>
        <tbody id="assetAcquireTable">${renderFeeRows('assetAcquireCosts')}</tbody>
      </table>
      <button class="btn-add" data-add="assetAcquireCosts">+ 자산취득비 항목 추가</button>
      <div class="subtotal-display">소계: <b>${fmt(calc.assetAcquireTotal())}원</b></div>
      
      <div class="big-total">
        <div class="label">재산조성비 합계 (연)</div>
        <div class="value">${fmt(calc.propertyTotal())}<span class="unit">원</span></div>
      </div>
    </div>
  `,

  // 21. 세출 상세 산출표 (각 항목별 상세)
  () => {
    const typeMap = {
      infant: '영아반 교사', preschool: '유아반 교사', disabled: '장애교사',
      aid: '보조교사', extended: '연장교사', night: '야간연장교사', cook: '조리원'
    };
    const d = state.data.director;
    const salaryOnly = calc.teacherFullTotal();
    const allowanceT = calc.allAllowanceTotal();
    const insBase = calc.insuranceBase();
    const insTotal = calc.insuranceTotalNew();
    const retTotal = calc.retirementTotalNew();
    const personnelTotal = calc.personnelTotalNew();
    
    // 섹션별 상세 행 생성 헬퍼
    const listRows = (items) => items.map(a => {
      const total = (a.unit || 0) * (a.count || 0) * (a.months || 0);
      return `<tr><td>${a.name || '-'}</td><td>${fmt(a.unit || 0)}원</td><td>${a.count || 0}</td><td>${a.months || 0}개월</td><td class="total-cell">${fmt(total)}원</td></tr>`;
    }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--color-text-soft);">항목 없음</td></tr>';
    
    return `
      ${budgetTrackerHTML()}
      <div class="card step">
        <span class="step-badge">STEP 22 / 24 · 세출 상세</span>
        <h2 class="card-title">📋 세출 작성 완료! 상세 산출내역</h2>
        <p class="card-subtitle">세입처럼 각 항목별로 어떻게 산출됐는지 자세히 확인해볼게요.</p>
        
        <!-- 1. 인건비 -->
        <details class="detail-section" open>
          <summary class="detail-summary">
            <span class="detail-icon">👩‍🏫</span>
            <span class="detail-title">인건비 (급여 + 수당 + 4대보험 + 퇴직)</span>
            <span class="detail-value">${fmt(personnelTotal)}원</span>
          </summary>
          <div class="detail-body">
            <h4 class="detail-subtitle">① 교직원 급여 (세입에서 불러옴)</h4>
            <table class="budget-table">
              <thead><tr><th>구분</th><th>월급</th><th>인원</th><th>개월</th><th>연 합계</th></tr></thead>
              <tbody>
                <tr>
                  <td>원장 ${d.grade}호봉</td>
                  <td>${fmt(d.salary)}원</td>
                  <td>1명</td>
                  <td>12개월</td>
                  <td class="total-cell">${fmt(d.salary * 12)}원</td>
                </tr>
                ${state.data.teachers.map(t => `<tr>
                  <td>${getTeacherLabel(t)} ${t.grade || ''}호봉</td>
                  <td>${fmt(t.salary)}원</td>
                  <td>${t.count || 1}명</td>
                  <td>12개월</td>
                  <td class="total-cell">${fmt(t.salary * 12 * (t.count || 1))}원</td>
                </tr>`).join('')}
                <tr class="subtotal-row"><td colspan="4">급여 소계</td><td class="total-cell">${fmt(salaryOnly)}원</td></tr>
              </tbody>
            </table>
            
            <h4 class="detail-subtitle" style="margin-top: 16px;">② 원장 수당</h4>
            <table class="budget-table">
              <thead><tr><th>항목</th><th>월 단가</th><th>인원</th><th>개월</th><th>합계</th></tr></thead>
              <tbody>
                ${listRows(state.data.directorAllowances)}
                <tr class="subtotal-row"><td colspan="4">원장 수당 소계</td><td class="total-cell">${fmt(calc.directorAllowanceTotal())}원</td></tr>
              </tbody>
            </table>
            
            <h4 class="detail-subtitle" style="margin-top: 16px;">③ 교직원 수당</h4>
            <table class="budget-table">
              <thead><tr><th>항목</th><th>월 단가</th><th>인원</th><th>개월</th><th>합계</th></tr></thead>
              <tbody>
                ${listRows(state.data.teacherAllowances)}
                <tr class="subtotal-row"><td colspan="4">교직원 수당 소계</td><td class="total-cell">${fmt(calc.teacherAllowanceTotal())}원</td></tr>
              </tbody>
            </table>
            
            ${state.data.extraPersonnel && state.data.extraPersonnel.length > 0 ? `
            <h4 class="detail-subtitle" style="margin-top: 16px; color: #2c6b2f;">④ 추가 인건비 (정규 교직원, 4대보험 포함)</h4>
            <div class="info-box" style="margin-bottom: 12px; background: #e0f0dd; border-left: 3px solid #5a9b50; color: #244e26;">
              💡 조리보조교사 등 세입에 반영되지 않는 정규 교직원입니다. (4대보험 산정에 포함)
            </div>
            <table class="budget-table">
              <thead><tr><th>구분</th><th>월급</th><th>인원</th><th>개월</th><th>연 합계</th></tr></thead>
              <tbody>
                ${state.data.extraPersonnel.map(t => {
                  const label = t.type === 'custom' ? (t.customName || '직접 작성') : ({
                    cookAssist: '조리보조교사', aid: '보조교사', extended: '연장교사',
                    substitute: '대체교사', driver: '운전기사', office: '사무원'
                  }[t.type] || '교직원');
                  const annual = (t.salary || 0) * (t.months || 12) * (t.count || 1);
                  return `<tr><td>${label}</td><td>${fmt(t.salary)}원</td><td>${t.count || 1}명</td><td>${t.months || 12}개월</td><td class="total-cell">${fmt(annual)}원</td></tr>`;
                }).join('')}
                <tr class="subtotal-row"><td colspan="4">추가 인건비 소계</td><td class="total-cell">${fmt(calc.extraPersonnelTotal())}원</td></tr>
              </tbody>
            </table>
            ` : ''}
            
            <h4 class="detail-subtitle" style="margin-top: 16px;">⑤ 4대보험 + 퇴직적립금 (급여+수당+추가 기준)</h4>
            <div class="info-box" style="margin-bottom: 12px;">
              산정기준 = 급여(${fmt(salaryOnly)}) + 수당(${fmt(allowanceT)})${calc.extraPersonnelTotal() > 0 ? ` + 추가(${fmt(calc.extraPersonnelTotal())})` : ''} = <b>${fmt(insBase)}원</b>
            </div>
            <table class="budget-table">
              <thead><tr><th>항목</th><th>요율</th><th>연 금액</th></tr></thead>
              <tbody>
                <tr><td>국민연금 (사업주)</td><td>4.5%</td><td class="total-cell">${fmt(insBase * CONSTANTS.INSURANCE.nationalPension)}원</td></tr>
                <tr><td>건강보험 (사업주)</td><td>3.595%</td><td class="total-cell">${fmt(insBase * CONSTANTS.INSURANCE.healthInsurance)}원</td></tr>
                <tr><td>장기요양보험</td><td>건보료 × 13.14%</td><td class="total-cell">${fmt(insBase * CONSTANTS.INSURANCE.healthInsurance * CONSTANTS.INSURANCE.longTermCare)}원</td></tr>
                <tr><td>고용보험 (사업주)</td><td>0.9%</td><td class="total-cell">${fmt(insBase * CONSTANTS.INSURANCE.employment)}원</td></tr>
                <tr><td>산재보험</td><td>${(state.data.industrialRate*100).toFixed(2)}%</td><td class="total-cell">${fmt(insBase * state.data.industrialRate)}원</td></tr>
                <tr class="subtotal-row"><td colspan="2">4대보험 소계</td><td class="total-cell">${fmt(insTotal)}원</td></tr>
                <tr><td>퇴직적립금</td><td>1/12 (8.33%)</td><td class="total-cell">${fmt(retTotal)}원</td></tr>
                <tr class="total-row"><td colspan="2">4대보험 + 퇴직 합계</td><td>${fmt(insTotal + retTotal)}원</td></tr>
              </tbody>
            </table>
            
            ${state.data.otherPersonnel && state.data.otherPersonnel.length > 0 ? `
            <h4 class="detail-subtitle" style="margin-top: 16px; color: #6c3a8e;">⑥ 기타 인건비 (4대보험 미포함)</h4>
            <div class="info-box" style="margin-bottom: 12px; background: #f5f0ff; border-left: 3px solid #8a4faf;">
              💡 대체교사, 대체조리사 등 자체 부담 인건비입니다. (4대보험 산정에서 제외)
            </div>
            <table class="budget-table">
              <thead><tr><th>항목</th><th>월 단가</th><th>인원</th><th>개월</th><th>합계</th></tr></thead>
              <tbody>
                ${listRows(state.data.otherPersonnel)}
                <tr class="subtotal-row"><td colspan="4">기타 인건비 소계</td><td class="total-cell">${fmt(calc.otherPersonnelTotal())}원</td></tr>
              </tbody>
            </table>
            ` : ''}
            
            <div class="big-total" style="margin-top: 16px;">
              <div class="label">인건비 총합계 (급여 + 수당 + 추가 + 4대보험/퇴직 + 기타)</div>
              <div class="value">${fmt(personnelTotal)}<span class="unit">원</span></div>
            </div>
          </div>
        </details>
        
        <!-- 2. 관리운영비 -->
        <details class="detail-section">
          <summary class="detail-summary">
            <span class="detail-icon">🏢</span>
            <span class="detail-title">관리운영비 (수용비, 공공요금, 연료비, 여비, 차량비, 복리후생비)</span>
            <span class="detail-value">${fmt(calc.managementTotal())}원</span>
          </summary>
          <div class="detail-body">
            <h4 class="detail-subtitle">211 수용비 및 수수료</h4>
            <table class="budget-table"><thead><tr><th>항목</th><th>단가</th><th>인원</th><th>개월</th><th>합계</th></tr></thead><tbody>${listRows(state.data.receivingCosts)}<tr class="subtotal-row"><td colspan="4">소계</td><td class="total-cell">${fmt(calc.receivingTotal())}원</td></tr></tbody></table>
            
            <h4 class="detail-subtitle" style="margin-top: 16px;">212 공공요금 및 제세공과금</h4>
            <table class="budget-table"><thead><tr><th>항목</th><th>단가</th><th>인원</th><th>개월</th><th>합계</th></tr></thead><tbody>${listRows(state.data.utilityCosts)}<tr class="subtotal-row"><td colspan="4">소계</td><td class="total-cell">${fmt(calc.utilityTotal())}원</td></tr></tbody></table>
            
            <h4 class="detail-subtitle" style="margin-top: 16px;">213 연료비</h4>
            <table class="budget-table"><thead><tr><th>항목</th><th>단가</th><th>인원</th><th>개월</th><th>합계</th></tr></thead><tbody>${listRows(state.data.fuelCosts)}<tr class="subtotal-row"><td colspan="4">소계</td><td class="total-cell">${fmt(calc.fuelTotal())}원</td></tr></tbody></table>
            
            <h4 class="detail-subtitle" style="margin-top: 16px;">214 여비</h4>
            <table class="budget-table"><thead><tr><th>항목</th><th>단가</th><th>인원</th><th>개월</th><th>합계</th></tr></thead><tbody>${listRows(state.data.travelCosts)}<tr class="subtotal-row"><td colspan="4">소계</td><td class="total-cell">${fmt(calc.travelTotal())}원</td></tr></tbody></table>
            
            <h4 class="detail-subtitle" style="margin-top: 16px;">215 차량비</h4>
            <table class="budget-table"><thead><tr><th>항목</th><th>단가</th><th>인원</th><th>개월</th><th>합계</th></tr></thead><tbody>${listRows(state.data.vehicleCosts)}<tr class="subtotal-row"><td colspan="4">소계</td><td class="total-cell">${fmt(calc.vehicleTotal())}원</td></tr></tbody></table>
            
            <h4 class="detail-subtitle" style="margin-top: 16px;">216 복리후생비</h4>
            <table class="budget-table"><thead><tr><th>항목</th><th>단가</th><th>인원</th><th>개월</th><th>합계</th></tr></thead><tbody>${listRows(state.data.welfareCosts)}<tr class="subtotal-row"><td colspan="4">소계</td><td class="total-cell">${fmt(calc.welfareTotal())}원</td></tr></tbody></table>
            
            <div class="big-total" style="margin-top: 16px;">
              <div class="label">관리운영비 총합계</div>
              <div class="value">${fmt(calc.managementTotal())}<span class="unit">원</span></div>
            </div>
          </div>
        </details>
        
        <!-- 3. 업무추진비 -->
        <details class="detail-section">
          <summary class="detail-summary">
            <span class="detail-icon">📌</span>
            <span class="detail-title">업무추진비 (업무추진비, 직책급, 회의비)</span>
            <span class="detail-value">${fmt(calc.promoTotal())}원</span>
          </summary>
          <div class="detail-body">
            <h4 class="detail-subtitle">221 업무추진비</h4>
            <table class="budget-table"><thead><tr><th>항목</th><th>단가</th><th>인원</th><th>개월</th><th>합계</th></tr></thead><tbody>${listRows(state.data.businessPromoCosts)}<tr class="subtotal-row"><td colspan="4">소계</td><td class="total-cell">${fmt(calc.businessPromoTotal())}원</td></tr></tbody></table>
            
            <h4 class="detail-subtitle" style="margin-top: 16px;">222 직책급</h4>
            <table class="budget-table"><thead><tr><th>항목</th><th>단가</th><th>인원</th><th>개월</th><th>합계</th></tr></thead><tbody>${listRows(state.data.positionAllowanceCosts)}<tr class="subtotal-row"><td colspan="4">소계</td><td class="total-cell">${fmt(calc.positionAllowanceTotal())}원</td></tr></tbody></table>
            
            <h4 class="detail-subtitle" style="margin-top: 16px;">223 회의비</h4>
            <table class="budget-table"><thead><tr><th>항목</th><th>단가</th><th>인원</th><th>횟수</th><th>합계</th></tr></thead><tbody>${listRows(state.data.meetingCosts)}<tr class="subtotal-row"><td colspan="4">소계</td><td class="total-cell">${fmt(calc.meetingTotal())}원</td></tr></tbody></table>
            
            <div class="big-total" style="margin-top: 16px;">
              <div class="label">업무추진비 총합계</div>
              <div class="value">${fmt(calc.promoTotal())}<span class="unit">원</span></div>
            </div>
          </div>
        </details>
        
        <!-- 4. 보육활동비 -->
        <details class="detail-section">
          <summary class="detail-summary">
            <span class="detail-icon">🎨</span>
            <span class="detail-title">보육활동비 (연수비, 교재교구비, 행사비, 급간식비)</span>
            <span class="detail-value">${fmt(calc.childcareActivityTotal())}원</span>
          </summary>
          <div class="detail-body">
            <h4 class="detail-subtitle">311 교직원 연수 연구비</h4>
            <table class="budget-table"><thead><tr><th>항목</th><th>단가</th><th>인원</th><th>횟수</th><th>합계</th></tr></thead><tbody>${listRows(state.data.trainingCosts)}<tr class="subtotal-row"><td colspan="4">소계</td><td class="total-cell">${fmt(calc.trainingTotal())}원</td></tr></tbody></table>
            
            <h4 class="detail-subtitle" style="margin-top: 16px;">312 교재교구 구입비</h4>
            <table class="budget-table"><thead><tr><th>항목</th><th>단가</th><th>인원</th><th>개월</th><th>합계</th></tr></thead><tbody>${listRows(state.data.materialCosts)}<tr class="subtotal-row"><td colspan="4">소계</td><td class="total-cell">${fmt(calc.materialTotal())}원</td></tr></tbody></table>
            
            <h4 class="detail-subtitle" style="margin-top: 16px;">313 행사비</h4>
            <table class="budget-table"><thead><tr><th>항목</th><th>단가</th><th>인원</th><th>횟수</th><th>합계</th></tr></thead><tbody>${listRows(state.data.eventCosts)}<tr class="subtotal-row"><td colspan="4">소계</td><td class="total-cell">${fmt(calc.eventTotal())}원</td></tr></tbody></table>
            
            <h4 class="detail-subtitle" style="margin-top: 16px;">315 급간식비</h4>
            <table class="budget-table"><thead><tr><th>항목</th><th>월 단가</th><th>인원</th><th>개월</th><th>합계</th></tr></thead><tbody>${listRows(state.data.mealCosts)}<tr class="subtotal-row"><td colspan="4">소계</td><td class="total-cell">${fmt(calc.mealTotal())}원</td></tr></tbody></table>
            
            <div class="big-total" style="margin-top: 16px;">
              <div class="label">보육활동비 총합계</div>
              <div class="value">${fmt(calc.childcareActivityTotal())}<span class="unit">원</span></div>
            </div>
          </div>
        </details>
        
        <!-- 5. 수익자부담 지출 -->
        ${calc.parentFeeExpense() > 0 ? `
        <details class="detail-section">
          <summary class="detail-summary">
            <span class="detail-icon">💸</span>
            <span class="detail-title">수익자부담 지출 (세입에서 자동 복사)</span>
            <span class="detail-value">${fmt(calc.parentFeeExpense())}원</span>
          </summary>
          <div class="detail-body">
            <table class="budget-table"><thead><tr><th>항목</th><th>단가</th><th>인원</th><th>개월</th><th>합계</th></tr></thead><tbody>${listRows(state.data.parentFeeExpenses)}<tr class="total-row"><td colspan="4">수익자부담 지출 총계</td><td>${fmt(calc.parentFeeExpense())}원</td></tr></tbody></table>
          </div>
        </details>
        ` : ''}
        
        <!-- 6. 재산조성비 -->
        ${calc.propertyTotal() > 0 ? `
        <details class="detail-section">
          <summary class="detail-summary">
            <span class="detail-icon">🏗️</span>
            <span class="detail-title">재산조성비 (시설비, 시설유지비, 자산취득비)</span>
            <span class="detail-value">${fmt(calc.propertyTotal())}원</span>
          </summary>
          <div class="detail-body">
            <h4 class="detail-subtitle">711 시설비</h4>
            <table class="budget-table"><thead><tr><th>항목</th><th>단가</th><th>인원</th><th>개월</th><th>합계</th></tr></thead><tbody>${listRows(state.data.facilityCosts)}<tr class="subtotal-row"><td colspan="4">소계</td><td class="total-cell">${fmt(calc.facilityTotal())}원</td></tr></tbody></table>
            
            <h4 class="detail-subtitle" style="margin-top: 16px;">712 시설유지비</h4>
            <table class="budget-table"><thead><tr><th>항목</th><th>단가</th><th>인원</th><th>개월</th><th>합계</th></tr></thead><tbody>${listRows(state.data.facilityMaintCosts)}<tr class="subtotal-row"><td colspan="4">소계</td><td class="total-cell">${fmt(calc.facilityMaintTotal())}원</td></tr></tbody></table>
            
            <h4 class="detail-subtitle" style="margin-top: 16px;">721 자산취득비</h4>
            <table class="budget-table"><thead><tr><th>항목</th><th>단가</th><th>인원</th><th>개월</th><th>합계</th></tr></thead><tbody>${listRows(state.data.assetAcquireCosts)}<tr class="subtotal-row"><td colspan="4">소계</td><td class="total-cell">${fmt(calc.assetAcquireTotal())}원</td></tr></tbody></table>
          </div>
        </details>
        ` : ''}
        
        <!-- 7. 예비비 -->
        ${state.data.reserveFund > 0 ? `
        <details class="detail-section">
          <summary class="detail-summary">
            <span class="detail-icon">💰</span>
            <span class="detail-title">예비비</span>
            <span class="detail-value">${fmt(state.data.reserveFund)}원</span>
          </summary>
          <div class="detail-body">
            <div class="info-box">
              예비비는 세입과 세출의 차액을 조정하는 항목이에요. 예상치 못한 지출이 발생했을 때 사용합니다.
            </div>
          </div>
        </details>
        ` : ''}
        
        <div class="big-total" style="margin-top: 24px;">
          <div class="label">🎯 세출 총액 (연)</div>
          <div class="value">${fmt(calc.totalExpense())}<span class="unit">원</span></div>
        </div>
        
        <div class="success-box">
          <strong>✨ 세출 작성 완료!</strong><br>
          다음 페이지에서 세입과 세출을 비교해볼게요.
        </div>
      </div>
    `;
  },

  // 22. 세입 vs 세출 비교 + 최종 검토 + 예비비
  () => {
    const income = calc.totalIncome();
    const expense = calc.totalExpense();
    const diff = income - expense;
    const isBalanced = Math.abs(diff) < 1;
    
    const parentIn = calc.parentFeeIncome();
    const parentOut = calc.parentFeeExpense();
    const parentBalanced = Math.abs(parentIn - parentOut) < 1;
    const parentDiff = parentIn - parentOut;
    
    // 특별활동비 세입 vs 세출 비교
    const specialIn = state.data.specialActivities.reduce((s, a) => s + (a.unit || a.fee || 0) * (a.count || 0) * (a.months || 0), 0);
    const specialOutItems = state.data.parentFeeExpenses.filter(a => (a.name || '').includes('특별') || (a.name || '').includes('활동'));
    const specialOut = specialOutItems.reduce((s, a) => s + (a.unit || 0) * (a.count || 0) * (a.months || 0), 0);
    
    // 기타필요경비 세입 vs 세출 비교
    const otherIn = state.data.otherParentFees.reduce((s, a) => s + (a.unit || a.fee || 0) * (a.count || 0) * (a.months || 0), 0);
    
    // 세입 항목별
    const govFee = calc.govChildcareFee() + calc.disabledChildcareFee();
    const extFee = calc.extendedCareIncome();
    const nightFee = calc.nightCareIncome();
    const personnelSupport = calc.personnelSupportIncome();
    const localSupport = calc.localSupportTotal();
    const interest = state.data.interestIncome || 0;
    
    // 세출 항목별
    const personnel = calc.personnelTotalNew();
    const mgmt = calc.managementTotal();
    const promo = calc.promoTotal();
    const activity = calc.childcareActivityTotal();
    const parentExp = calc.parentFeeExpense();
    const property = calc.propertyTotal();
    const reserve = state.data.reserveFund || 0;
    
    // 실수 감지 - 자주 발생하는 오류들
    const errors = [];
    if (!isBalanced) {
      errors.push({
        icon: '💥',
        title: '세입과 세출이 맞지 않아요',
        detail: `차액이 ${fmt(Math.abs(diff))}원 있어요. ${diff > 0 ? '세입이 더 많으니 예비비에 넣거나 세출을 늘려야 해요.' : '세출이 더 많아요! 수당이나 보조금을 다시 확인해주세요.'}`
      });
    }
    if (!parentBalanced) {
      errors.push({
        icon: '⚠️',
        title: '수익자부담 세입 ≠ 세출',
        detail: `학부모에게 받은 돈(${fmt(parentIn)}원)과 쓴 돈(${fmt(parentOut)}원)이 달라요! 차이: ${fmt(Math.abs(parentDiff))}원. 수익자부담은 반드시 일치해야 해요.`
      });
    }
    if (reserve === 0 && !isBalanced && diff > 0) {
      errors.push({
        icon: '💰',
        title: '예비비가 0원이에요',
        detail: '세입 > 세출일 때는 차액을 예비비로 넣어주세요.'
      });
    }
    if (personnel < calc.teacherFullTotal()) {
      errors.push({
        icon: '👩‍🏫',
        title: '인건비에 수당/4대보험이 빠진 것 같아요',
        detail: '세출 인건비는 급여 + 수당 + 4대보험 + 퇴직적립금이 모두 포함돼야 해요.'
      });
    }
    
    return `
      ${budgetTrackerHTML()}
      <div class="card step">
        <span class="step-badge">STEP 23 / 24 · 최종 검토</span>
        <h2 class="card-title">🔍 세입 vs 세출 관-항-목 비교</h2>
        <p class="card-subtitle">관항목별로 세밀하게 비교해서 실수를 찾아볼게요.</p>
        
        <!-- 실수 감지 박스 -->
        ${errors.length > 0 ? `
          <div class="warn-box" style="margin-top: 16px;">
            <strong style="font-size: 1.1rem;">🚨 확인이 필요한 부분이 ${errors.length}개 있어요!</strong>
            <ul style="margin-top: 10px; padding-left: 0; list-style: none;">
              ${errors.map(e => `
                <li style="margin-top: 8px; padding: 10px; background: white; border-radius: 6px; border-left: 4px solid var(--color-danger);">
                  <b>${e.icon} ${e.title}</b><br>
                  <span style="font-size: 0.9rem; color: var(--color-text-soft);">${e.detail}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        ` : `
          <div class="success-box" style="margin-top: 16px;">
            <strong>✅ 모든 체크 항목을 통과했어요!</strong><br>
            세입과 세출이 균형을 이루고, 수익자부담도 일치합니다. 완벽해요!
          </div>
        `}
        
        <!-- 균형 체크 -->
        <h3 class="section-title" style="margin-top: 24px;">🎯 균형 체크</h3>
        <ul class="check-list">
          <li class="${isBalanced ? 'ok' : 'warn'}">
            <span class="check-icon">${isBalanced ? '✅' : '❌'}</span>
            <span class="check-label">세입 총액 = 세출 총액</span>
            <span class="check-value">${isBalanced ? '일치!' : `차이 ${fmt(Math.abs(diff))}원`}</span>
          </li>
          <li class="${parentBalanced ? 'ok' : 'warn'}">
            <span class="check-icon">${parentBalanced ? '✅' : '❌'}</span>
            <span class="check-label">수익자부담: 세입 = 세출</span>
            <span class="check-value">${parentBalanced ? '일치!' : `차이 ${fmt(Math.abs(parentDiff))}원`}</span>
          </li>
          <li class="${state.data.reserveFund > 0 ? 'ok' : 'warn'}">
            <span class="check-icon">${state.data.reserveFund > 0 ? '✅' : '⚠️'}</span>
            <span class="check-label">예비비 설정</span>
            <span class="check-value">${state.data.reserveFund > 0 ? fmt(state.data.reserveFund)+'원' : '미설정'}</span>
          </li>
        </ul>
        
        <!-- 관항목별 상세 비교 테이블 -->
        <h3 class="section-title" style="margin-top: 24px;">📊 관항목별 상세 비교</h3>
        
        <div class="compare-wrapper">
          <!-- 💰 세입 쪽 -->
          <div class="compare-column compare-income">
            <h4 class="compare-header">💰 세입 (총 ${fmt(income)}원)</h4>
            
            <details class="compare-section" open>
              <summary>📖 01 보육료 <b>${fmt(govFee + extFee + nightFee)}원</b></summary>
              <div class="compare-body">
                <div class="compare-item">
                  <span>11 보육료</span>
                  <b>${fmt(govFee + extFee + nightFee)}원</b>
                </div>
                <div class="compare-sub">
                  • 111 정부지원보육료: <b>${fmt(govFee)}원</b><br>
                  ${extFee > 0 ? `• 112 연장반 보육료: <b>${fmt(extFee)}원</b><br>` : ''}
                  ${nightFee > 0 ? `• 113 야간연장 보육료: <b>${fmt(nightFee)}원</b>` : ''}
                </div>
              </div>
            </details>
            
            <details class="compare-section">
              <summary>📖 02 수익자부담수입 <b>${fmt(parentIn)}원</b></summary>
              <div class="compare-body">
                <div class="compare-item">
                  <span>21 선택적 보육활동비</span>
                  <b>${fmt(specialIn)}원</b>
                </div>
                <div class="compare-sub">
                  • 211 특별활동비: <b>${fmt(specialIn)}원</b> (${state.data.specialActivities.length}개 항목)
                </div>
                <div class="compare-item">
                  <span>22 기타필요경비</span>
                  <b>${fmt(otherIn)}원</b>
                </div>
                <div class="compare-sub">
                  • 221 기타필요경비: <b>${fmt(otherIn)}원</b> (${state.data.otherParentFees.length}개 항목)
                </div>
              </div>
            </details>
            
            <details class="compare-section">
              <summary>📖 03 보조금 <b>${fmt(personnelSupport + localSupport)}원</b></summary>
              <div class="compare-body">
                <div class="compare-item">
                  <span>31 인건비 보조금</span>
                  <b>${fmt(personnelSupport)}원</b>
                </div>
                <div class="compare-sub">
                  • 급여 지원: <b>${fmt(calc.teacherSupportTotal())}원</b><br>
                  • 4대보험 지원: <b>${fmt(calc.insuranceSupportIncomeAmount())}원</b><br>
                  • 퇴직적립금 지원: <b>${fmt(calc.retirementSupportIncomeAmount())}원</b>
                </div>
                ${localSupport > 0 ? `
                <div class="compare-item">
                  <span>32 기타 보조금 (시/군/구)</span>
                  <b>${fmt(localSupport)}원</b>
                </div>
                <div class="compare-sub">
                  • ${state.data.localSupport.length}개 항목
                </div>
                ` : ''}
              </div>
            </details>
            
            ${interest > 0 ? `
            <details class="compare-section">
              <summary>📖 04 잡수입 <b>${fmt(interest)}원</b></summary>
              <div class="compare-body">
                <div class="compare-item">
                  <span>41 기타잡수입</span>
                  <b>${fmt(interest)}원</b>
                </div>
                <div class="compare-sub">
                  • 411 이자수입: <b>${fmt(interest)}원</b>
                </div>
              </div>
            </details>
            ` : ''}
          </div>
          
          <!-- 💸 세출 쪽 -->
          <div class="compare-column compare-expense">
            <h4 class="compare-header">💸 세출 (총 ${fmt(expense)}원)</h4>
            
            <details class="compare-section" open>
              <summary>📖 01 인건비 <b>${fmt(personnel)}원</b></summary>
              <div class="compare-body">
                <div class="compare-item">
                  <span>11 인건비</span>
                  <b>${fmt(personnel)}원</b>
                </div>
                <div class="compare-sub">
                  • 급여: <b>${fmt(calc.teacherFullTotal())}원</b><br>
                  • 수당: <b>${fmt(calc.allAllowanceTotal())}원</b><br>
                  • 4대보험: <b>${fmt(calc.insuranceTotalNew())}원</b><br>
                  • 퇴직적립금: <b>${fmt(calc.retirementTotalNew())}원</b>
                </div>
              </div>
            </details>
            
            <details class="compare-section">
              <summary>📖 02 업무추진비 <b>${fmt(promo)}원</b></summary>
              <div class="compare-body">
                <div class="compare-item"><span>221 업무추진비</span><b>${fmt(calc.businessPromoTotal())}원</b></div>
                <div class="compare-item"><span>222 직책급</span><b>${fmt(calc.positionAllowanceTotal())}원</b></div>
                <div class="compare-item"><span>223 회의비</span><b>${fmt(calc.meetingTotal())}원</b></div>
              </div>
            </details>
            
            <details class="compare-section">
              <summary>📖 03 운영비 <b>${fmt(mgmt + activity)}원</b></summary>
              <div class="compare-body">
                <div class="compare-sub" style="background: #FFF5E9; padding: 8px; border-radius: 4px; margin-bottom: 8px;"><b>관리운영비 ${fmt(mgmt)}원</b></div>
                <div class="compare-item"><span>311 수용비 및 수수료</span><b>${fmt(calc.receivingTotal())}원</b></div>
                <div class="compare-item"><span>312 공공요금</span><b>${fmt(calc.utilityTotal())}원</b></div>
                <div class="compare-item"><span>313 연료비</span><b>${fmt(calc.fuelTotal())}원</b></div>
                <div class="compare-item"><span>314 여비</span><b>${fmt(calc.travelTotal())}원</b></div>
                <div class="compare-item"><span>315 차량비</span><b>${fmt(calc.vehicleTotal())}원</b></div>
                <div class="compare-item"><span>316 복리후생비</span><b>${fmt(calc.welfareTotal())}원</b></div>
                <div class="compare-sub" style="background: #FFF5E9; padding: 8px; border-radius: 4px; margin: 12px 0 8px;"><b>보육활동비 ${fmt(activity)}원</b></div>
                <div class="compare-item"><span>321 교직원 연수</span><b>${fmt(calc.trainingTotal())}원</b></div>
                <div class="compare-item"><span>322 교재교구</span><b>${fmt(calc.materialTotal())}원</b></div>
                <div class="compare-item"><span>323 행사비</span><b>${fmt(calc.eventTotal())}원</b></div>
                <div class="compare-item"><span>324 급간식비</span><b>${fmt(calc.mealTotal())}원</b></div>
              </div>
            </details>
            
            ${parentExp > 0 ? `
            <details class="compare-section">
              <summary>📖 04 수익자부담 지출 <b>${fmt(parentExp)}원</b></summary>
              <div class="compare-body">
                <div class="compare-item">
                  <span>41 수익자부담 경비</span>
                  <b>${fmt(parentExp)}원</b>
                </div>
                <div class="compare-sub">
                  • ${state.data.parentFeeExpenses.length}개 항목<br>
                  <small style="color: var(--color-text-soft);">※ 세입 수익자부담과 반드시 같아야 함</small>
                </div>
              </div>
            </details>
            ` : ''}
            
            ${property > 0 ? `
            <details class="compare-section">
              <summary>📖 05 재산조성비 <b>${fmt(property)}원</b></summary>
              <div class="compare-body">
                <div class="compare-item"><span>711 시설비</span><b>${fmt(calc.facilityTotal())}원</b></div>
                <div class="compare-item"><span>712 시설유지비</span><b>${fmt(calc.facilityMaintTotal())}원</b></div>
                <div class="compare-item"><span>721 자산취득비</span><b>${fmt(calc.assetAcquireTotal())}원</b></div>
              </div>
            </details>
            ` : ''}
            
            ${reserve > 0 ? `
            <details class="compare-section">
              <summary>📖 06 예비비 <b>${fmt(reserve)}원</b></summary>
              <div class="compare-body">
                <div class="compare-item">
                  <span>61 예비비</span>
                  <b>${fmt(reserve)}원</b>
                </div>
                <div class="compare-sub">
                  세입과 세출의 차액을 조정하는 항목
                </div>
              </div>
            </details>
            ` : ''}
          </div>
        </div>
        
        <!-- 수익자부담 집중 검증 -->
        <h3 class="section-title" style="margin-top: 24px;">🔗 수익자부담 집중 검증</h3>
        <div class="info-box">
          <strong>💡 수익자부담은 왜 중요할까?</strong><br>
          학부모가 낸 돈(세입)과 그 돈으로 쓴 비용(세출)은 반드시 일치해야 해요! 차이가 있으면 회계 감사에서 문제가 생겨요.
        </div>
        <table class="budget-table">
          <thead>
            <tr><th>항목</th><th>세입</th><th>세출</th><th>차액</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>특별활동비 / 보육활동비</td>
              <td>${fmt(specialIn)}원</td>
              <td>${fmt(specialOut)}원</td>
              <td class="${Math.abs(specialIn - specialOut) < 1 ? 'total-cell' : ''}" style="${Math.abs(specialIn - specialOut) < 1 ? 'color: var(--color-success);' : 'color: var(--color-danger); font-weight: 700;'}">
                ${Math.abs(specialIn - specialOut) < 1 ? '✅ 일치' : '❌ ' + fmt(Math.abs(specialIn - specialOut)) + '원'}
              </td>
            </tr>
            <tr>
              <td>기타필요경비</td>
              <td>${fmt(otherIn)}원</td>
              <td>${fmt(parentExp - specialOut)}원</td>
              <td class="${Math.abs(otherIn - (parentExp - specialOut)) < 1 ? 'total-cell' : ''}" style="${Math.abs(otherIn - (parentExp - specialOut)) < 1 ? 'color: var(--color-success);' : 'color: var(--color-danger); font-weight: 700;'}">
                ${Math.abs(otherIn - (parentExp - specialOut)) < 1 ? '✅ 일치' : '❌ ' + fmt(Math.abs(otherIn - (parentExp - specialOut))) + '원'}
              </td>
            </tr>
            <tr class="total-row">
              <td>수익자부담 합계</td>
              <td>${fmt(parentIn)}원</td>
              <td>${fmt(parentExp)}원</td>
              <td>${parentBalanced ? '✅ 일치' : '❌ ' + fmt(Math.abs(parentDiff)) + '원'}</td>
            </tr>
          </tbody>
        </table>
        
        <!-- 차액 요약 -->
        <h3 class="section-title" style="margin-top: 24px;">💰 전체 차액 요약</h3>
        <div class="summary-box">
          <div class="summary-row"><span class="label">세입 총액</span><span class="value">${fmt(income)}원</span></div>
          <div class="summary-row"><span class="label">세출 총액</span><span class="value">${fmt(expense)}원</span></div>
          <div class="summary-row"><span class="label">차액 (세입 - 세출)</span><span class="value" style="color: ${isBalanced ? 'var(--color-success)' : 'var(--color-danger)'}">${fmt(diff)}원</span></div>
        </div>
        
        ${!isBalanced ? `
          <div class="warn-box" style="margin-top: 16px;">
            <strong>⚠️ 세입과 세출이 일치하지 않아요!</strong><br>
            차액(${fmt(Math.abs(diff))}원)을 <b>예비비</b>에 넣거나, 다른 항목을 조정해주세요.
          </div>
          <div class="form-group" style="margin-top: 16px;">
            <label class="form-label">예비비 설정</label>
            <input type="number" class="form-input" id="reserveInput" 
                   value="${state.data.reserveFund || 0}" min="0" />
            ${diff > 0 ? `
              <button class="btn btn-primary btn-small" id="autoReserve" style="margin-top: 8px;">
                자동으로 차액(${fmt(diff)}원)만큼 예비비 설정
              </button>
            ` : ''}
          </div>
        ` : `
          <div class="success-box" style="margin-top: 16px;">
            <strong>🎉 완벽해요!</strong><br>
            세입과 세출이 정확히 일치합니다. 다음 페이지에서 엑셀로 다운로드하세요!
          </div>
        `}
        
        <!-- 초급자를 위한 체크리스트 -->
        <h3 class="section-title" style="margin-top: 24px;">📝 회계 초급자를 위한 마지막 체크리스트</h3>
        <ul class="check-list">
          <li class="${personnel >= calc.teacherFullTotal() ? 'ok' : 'warn'}">
            <span class="check-icon">${personnel >= calc.teacherFullTotal() ? '✅' : '⚠️'}</span>
            <span class="check-label">세출 인건비에 수당 + 4대보험 + 퇴직 포함됐나요?</span>
            <span class="check-value">${fmt(personnel)}원</span>
          </li>
          <li class="${parentBalanced ? 'ok' : 'warn'}">
            <span class="check-icon">${parentBalanced ? '✅' : '⚠️'}</span>
            <span class="check-label">수익자부담 세입 = 세출인가요?</span>
            <span class="check-value">${parentBalanced ? '일치!' : '불일치!'}</span>
          </li>
          <li class="${isBalanced ? 'ok' : 'warn'}">
            <span class="check-icon">${isBalanced ? '✅' : '⚠️'}</span>
            <span class="check-label">세입 = 세출 (총액)</span>
            <span class="check-value">${isBalanced ? '일치!' : `차이 ${fmt(Math.abs(diff))}원`}</span>
          </li>
          <li class="${(calc.mealTotal() + calc.trainingTotal()) > 0 ? 'ok' : 'warn'}">
            <span class="check-icon">${(calc.mealTotal() + calc.trainingTotal()) > 0 ? '✅' : '⚠️'}</span>
            <span class="check-label">급간식비, 연수비 등 필수 운영비가 입력됐나요?</span>
            <span class="check-value">${fmt(calc.mealTotal() + calc.trainingTotal())}원</span>
          </li>
        </ul>
        
        <!-- 엑셀 다운로드로 이동 안내 -->
        <div class="next-cta-box">
          <div class="next-cta-icon">📥</div>
          <div class="next-cta-content">
            <h4>다음 단계: 엑셀 파일 다운로드!</h4>
            <p>검토가 끝났다면 아래 <b>"다음 →"</b> 버튼을 눌러 엑셀 파일로 다운로드하세요.</p>
          </div>
        </div>
      </div>
    `;
  },

  // 22. 엑셀 다운로드 (마지막 완성 페이지)
  () => {
    const income = calc.totalIncome();
    const expense = calc.totalExpense();
    const isBalanced = Math.abs(income - expense) < 1;
    const today = new Date();
    const dateStr = `${today.getFullYear()}년 ${today.getMonth()+1}월 ${today.getDate()}일`;
    
    return `
    <div class="card step finish-card">
      <span class="step-badge">STEP 24 / 24 · 완료</span>
      
      <div class="finish-box">
        <div class="finish-icon">🎊</div>
        <h2 style="font-family: var(--font-display); color: var(--color-primary-dark); font-size: 1.8rem; margin: 8px 0;">예산서 작성 완료!</h2>
        <p style="color: var(--color-text-soft); margin-bottom: 20px;">${dateStr} · 수고하셨어요! 🎉</p>
        
        <!-- 최종 요약 카드 -->
        <div class="finish-summary">
          <div class="finish-stat">
            <div class="finish-stat-label">💰 세입 총액</div>
            <div class="finish-stat-value">${fmt(income)}<span>원</span></div>
          </div>
          <div class="finish-stat">
            <div class="finish-stat-label">💸 세출 총액</div>
            <div class="finish-stat-value">${fmt(expense)}<span>원</span></div>
          </div>
          <div class="finish-stat ${isBalanced ? 'balanced' : 'unbalanced'}">
            <div class="finish-stat-label">${isBalanced ? '✅ 균형 상태' : '⚠️ 불균형'}</div>
            <div class="finish-stat-value">${isBalanced ? '완벽!' : fmt(Math.abs(income - expense)) + '원 차이'}</div>
          </div>
        </div>
        
        <!-- 큰 다운로드 버튼 -->
        <button class="download-btn" id="btnDownload">
          📥 엑셀 파일 다운로드
        </button>
        <p class="download-hint">💡 다운로드 버튼을 누르면 컴퓨터에 엑셀 파일이 저장돼요!</p>
        
        <!-- 파일 구성 안내 -->
        <div class="file-info-box">
          <h3>📝 생성되는 엑셀 파일 구성</h3>
          <div class="file-info-grid">
            <div class="file-info-item">
              <div class="file-info-icon">📊</div>
              <div class="file-info-text">
                <b>시트 1: 세입세출 총괄표</b><br>
                <span>비중(%) 포함 한눈에 보기</span>
              </div>
            </div>
            <div class="file-info-item">
              <div class="file-info-icon">💰</div>
              <div class="file-info-text">
                <b>시트 2: 세입 상세 내역</b><br>
                <span>관-항-목별 산출기초 포함</span>
              </div>
            </div>
            <div class="file-info-item">
              <div class="file-info-icon">💸</div>
              <div class="file-info-text">
                <b>시트 3: 세출 상세 내역</b><br>
                <span>모든 비목별 세부 산출</span>
              </div>
            </div>
            <div class="file-info-item">
              <div class="file-info-icon">📋</div>
              <div class="file-info-text">
                <b>시트 4: 기본정보 요약</b><br>
                <span>정원, 교직원 구성, 4대보험 요율</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 활용 팁 -->
        <div class="usage-tip-box">
          <h3>💡 엑셀 파일 활용 팁</h3>
          <ul>
            <li>✏️ <b>그대로 제출 가능</b> - 국공립 어린이집 위탁 서류에 바로 활용</li>
            <li>🧮 <b>엑셀 수식 내장!</b> - 단가, 인원, 개월만 수정하면 <b>합계가 자동 재계산</b>돼요</li>
            <li>📱 <b>보육통합정보시스템</b>에 옮겨 입력할 때 참고 자료로 사용</li>
            <li>📚 <b>강의/교육 자료</b>로 사용 가능</li>
            <li>🔄 <b>매년 갱신 시</b> 수정해서 재사용</li>
          </ul>
          <div style="margin-top: 12px; padding: 10px 14px; background: white; border-radius: 6px; border-left: 4px solid var(--color-primary);">
            <b>📐 엑셀에 포함된 수식 예시</b><br>
            <span style="font-size: 0.85rem; color: var(--color-text-soft); font-family: monospace;">
              • 합계 = 단가 × 인원 × 개월 <span style="color:var(--color-primary)">(G*H*I)</span><br>
              • 세입/세출 총액 = SUM(합계 열 전체)<br>
              • 비중(%) = 각 항목 / 총액
            </span>
          </div>
        </div>
        
        <!-- 처음부터 다시 시작 -->
        <div class="finish-actions">
          <button class="btn btn-ghost btn-small" id="btnReset">
            🔄 처음부터 다시 시작하기
          </button>
          <a href="#" onclick="window.scrollTo({top:0,behavior:'smooth'});return false;" class="btn btn-ghost btn-small">
            ⬆️ 맨 위로
          </a>
        </div>
        
        <!-- 마지막 메시지 -->
        <div class="thank-you-message">
          <p><b>🌟 끝까지 완성하신 것을 축하드립니다!</b></p>
          <p style="font-size: 0.9rem; color: var(--color-text-soft); margin-top: 8px;">
            이 예산서 연습이 도움이 되었길 바라요.<br>
            실제 예산 작성 시에도 이 흐름을 기억해주세요! 💪
          </p>
        </div>
      </div>
    </div>
    `;
  },
];

// =============================================================
// 교사 행 렌더링
// =============================================================
function renderTeacherRows() {
  if (state.data.teachers.length === 0) {
    // 기본 교사 한 줄 추가
    state.data.teachers.push({ type: 'infant', grade: 4, salary: 2127000, count: 1, supportRate: 0.8 });
  }
  // 기존 교사 중 supportRate가 없는 경우 보정
  state.data.teachers.forEach(t => {
    if (t.supportRate === undefined) {
      const rateMap = {
        infant: 0.8, preschool: 0.3, disabled: 0.8,
        aid: 1.0, extended: 1.0, night: 0.8, cook: 1.0, custom: 0.8
      };
      t.supportRate = rateMap[t.type] !== undefined ? rateMap[t.type] : 0.8;
    }
    // 직접 작성(custom) 행 customName 기본값 보정
    if (t.type === 'custom' && t.customName === undefined) {
      t.customName = '';
    }
  });
  return state.data.teachers.map((t, i) => {
    const annual = (t.salary || 0) * 12 * (t.count || 1);
    const isCustom = t.type === 'custom';
    const supportPct = ((t.supportRate || 0) * 100).toFixed(0);
    
    // 첫 칸: 직접 작성이면 input, 아니면 select
    const firstColumn = isCustom
      ? `<input type="text" class="custom-type-input" data-teacher-idx="${i}" data-field="customName" value="${t.customName || ''}" placeholder="✏️ 직책명을 입력하세요 (예: 차량기사)" />`
      : `<select data-teacher-idx="${i}" data-field="type">
          <option value="infant" ${t.type==='infant'?'selected':''}>영아반 교사 (급여 80%)</option>
          <option value="preschool" ${t.type==='preschool'?'selected':''}>유아반 교사 (급여 30%)</option>
          <option value="disabled" ${t.type==='disabled'?'selected':''}>장애아 교사 (급여 80%)</option>
          <option value="aid" ${t.type==='aid'?'selected':''}>보조교사 (급여 100%)</option>
          <option value="extended" ${t.type==='extended'?'selected':''}>연장교사 (급여 100%)</option>
          <option value="night" ${t.type==='night'?'selected':''}>야간연장교사 (급여 80%)</option>
          <option value="cook" ${t.type==='cook'?'selected':''}>조리원 (급여 100%)</option>
          <option value="custom" ${t.type==='custom'?'selected':''}>✏️ 직접 작성</option>
        </select>`;
    
    return `
    <div class="teacher-row">
      ${firstColumn}
      <input type="number" data-teacher-idx="${i}" data-field="grade" value="${t.grade || 1}" min="1" max="30" placeholder="호봉" />
      <input type="number" data-teacher-idx="${i}" data-field="salary" value="${t.salary || 0}" min="0" placeholder="월급" />
      <input type="number" data-teacher-idx="${i}" data-field="count" value="${t.count || 1}" min="1" placeholder="인원" />
      <input type="number" data-teacher-idx="${i}" data-field="supportRatePct" value="${supportPct}" min="0" max="100" step="1" placeholder="지원율%" title="급여 지원율 (%)" />
      <button class="btn-danger" data-teacher-remove="${i}">삭제</button>
    </div>
    <div class="teacher-annual-row" data-annual-idx="${i}">
      ↳ 연 <b>${fmt(annual)}원</b> (월급 × 12개월 × ${t.count || 1}명)
    </div>
  `;
  }).join('');
}

// =============================================================
// 추가 인건비 행 렌더링 (조리보조교사 등 정규 교직원, 4대보험 포함)
// =============================================================
function renderExtraPersonnelRows() {
  const items = state.data.extraPersonnel || [];
  if (items.length === 0) {
    return '<div style="text-align: center; color: var(--color-text-soft); padding: 16px; background: white; border-radius: 8px; border: 1px dashed #c8e0c0;">아직 추가 인건비가 없어요. + 버튼을 눌러 추가하세요!</div>';
  }
  return items.map((t, i) => {
    const annual = (t.salary || 0) * (t.months || 12) * (t.count || 1);
    const isCustom = t.type === 'custom';
    
    // 첫 칸: 직접 작성이면 input, 아니면 select
    const firstColumn = isCustom
      ? `<input type="text" class="custom-type-input" data-extra-idx="${i}" data-field="customName" value="${t.customName || ''}" placeholder="✏️ 직책명을 입력하세요" />`
      : `<select data-extra-idx="${i}" data-field="type">
          <option value="cookAssist" ${t.type==='cookAssist'?'selected':''}>조리보조교사</option>
          <option value="aid" ${t.type==='aid'?'selected':''}>보조교사</option>
          <option value="extended" ${t.type==='extended'?'selected':''}>연장교사</option>
          <option value="substitute" ${t.type==='substitute'?'selected':''}>대체교사</option>
          <option value="driver" ${t.type==='driver'?'selected':''}>운전기사</option>
          <option value="office" ${t.type==='office'?'selected':''}>사무원</option>
          <option value="custom" ${t.type==='custom'?'selected':''}>✏️ 직접 작성</option>
        </select>`;
    
    return `
      <div class="teacher-row" style="grid-template-columns: 2fr 1.3fr 0.8fr 0.8fr 1.3fr 0.7fr; border-color: #c8e0c0;">
        ${firstColumn}
        <input type="number" data-extra-idx="${i}" data-field="salary" value="${t.salary || 0}" min="0" placeholder="월급" />
        <input type="number" data-extra-idx="${i}" data-field="count" value="${t.count || 1}" min="1" placeholder="인원" />
        <input type="number" data-extra-idx="${i}" data-field="months" value="${t.months || 12}" min="1" max="12" placeholder="개월" />
        <div class="annual-display" data-extra-annual-idx="${i}" style="color: #2c6b2f; text-align: right; font-weight: 600; padding: 8px;">${fmt(annual)}원</div>
        <button class="btn-danger" data-extra-remove="${i}">삭제</button>
      </div>
    `;
  }).join('');
}

// =============================================================
// 수수료/항목 행 렌더링
// =============================================================
function renderFeeRows(key) {
  const items = state.data[key] || [];
  return items.map((item, i) => {
    const total = (item.unit || item.fee || 0) * (item.count || 0) * (item.months || 0);
    return `
      <tr>
        <td><input type="text" data-list="${key}" data-idx="${i}" data-field="name" value="${item.name || ''}" placeholder="항목명" /></td>
        <td><input type="number" data-list="${key}" data-idx="${i}" data-field="${item.fee !== undefined ? 'fee' : 'unit'}" value="${item.unit || item.fee || 0}" min="0" /></td>
        <td><input type="number" data-list="${key}" data-idx="${i}" data-field="count" value="${item.count || 0}" min="0" /></td>
        <td><input type="number" data-list="${key}" data-idx="${i}" data-field="months" value="${item.months || 0}" min="0" max="12" /></td>
        <td class="total-cell">${fmt(total)}</td>
        <td><button class="btn-danger" data-list-remove="${key}" data-idx="${i}">삭제</button></td>
      </tr>
    `;
  }).join('');
}

// =============================================================
// 렌더 & 이벤트 바인딩
// =============================================================
function render() {
  $('#main').innerHTML = steps[state.currentStep]();
  
  // 진행률
  const pct = (state.currentStep / (state.totalSteps - 1)) * 100;
  $('#progressFill').style.width = pct + '%';
  // 진행 텍스트: 시작 화면(index 0)은 "시작", 나머지는 "N / 24" 표시 (배지와 일치)
  if (state.currentStep === 0) {
    $('#progressText').textContent = '시작하기';
  } else {
    $('#progressText').textContent = `${state.currentStep} / ${state.totalSteps - 1}`;
  }
  
  // 네비게이션
  $('#btnPrev').style.visibility = state.currentStep === 0 ? 'hidden' : 'visible';
  $('#btnNext').textContent = state.currentStep === state.totalSteps - 1 ? '완료' : '다음 →';
  $('#btnNext').style.visibility = state.currentStep === state.totalSteps - 1 ? 'hidden' : 'visible';
  
  bindEvents();
}

function bindEvents() {
  // 정원 입력
  const capInput = $('#capacityInput');
  if (capInput) capInput.addEventListener('input', e => {
    state.data.capacity = num(e.target.value);
  });
  
  // 연령별 정원
  $$('[data-age]').forEach(input => {
    input.addEventListener('input', e => {
      state.data.ages[e.target.dataset.age] = num(e.target.value);
      updateCapacityCounter();
    });
  });
  
  // 보육료
  $$('[data-fee]').forEach(input => {
    input.addEventListener('input', e => {
      const key = e.target.dataset.fee;
      if (key === 'disabled') {
        state.data.disabledFee = num(e.target.value);
      } else {
        state.data.childcareFees[key] = num(e.target.value);
      }
      const totalFee = calc.govChildcareFee() + calc.disabledChildcareFee();
      const totalEl = $('#feeTotal');
      if (totalEl) totalEl.innerHTML = fmt(totalFee) + '<span class="unit">원</span>';
      const detailTotal = $('#feeDetailTotal');
      if (detailTotal) detailTotal.textContent = fmt(totalFee) + '원';
      // 상세 테이블의 각 행도 업데이트
      const detailBody = $('#feeDetailBody');
      if (detailBody) {
        const ages = state.data.ages;
        const fees = state.data.childcareFees;
        const activeAges = [0,1,2,3,4,5].filter(i => (ages['age'+i] || 0) > 0);
        const hasDisabled = (ages.disabled || 0) > 0;
        const detailRows = activeAges.map(i => {
          const count = ages['age'+i] || 0;
          const fee = fees['age'+i] || 0;
          const total = fee * count * 12;
          return `<tr><td>만 ${i}세</td><td>${fmt(fee)}원</td><td>${count}명</td><td>12개월</td><td class="total-cell">${fmt(total)}원</td></tr>`;
        }).join('');
        const disabledRow = hasDisabled ? `<tr><td>장애아</td><td>${fmt(state.data.disabledFee || 0)}원</td><td>${ages.disabled}명</td><td>12개월</td><td class="total-cell">${fmt((state.data.disabledFee || 0) * ages.disabled * 12)}원</td></tr>` : '';
        detailBody.innerHTML = detailRows + disabledRow + `<tr class="subtotal-row"><td colspan="4">총 합계</td><td class="total-cell" id="feeDetailTotal">${fmt(totalFee)}원</td></tr>`;
      }
    });
  });
  
  // 원장
  const dg = $('#directorGrade');
  if (dg) dg.addEventListener('input', e => state.data.director.grade = num(e.target.value));
  const ds = $('#directorSalary');
  if (ds) ds.addEventListener('input', e => {
    state.data.director.salary = num(e.target.value);
    const annualEl = $('#directorAnnual');
    if (annualEl) annualEl.textContent = fmt(state.data.director.salary * 12) + '원';
  });
  
  // 교사 행
  $$('[data-teacher-idx]').forEach(input => {
    input.addEventListener('input', e => {
      const i = parseInt(e.target.dataset.teacherIdx);
      const f = e.target.dataset.field;
      let val = e.target.value;
      
      // 텍스트 필드 (type, customName)는 문자열, supportRatePct는 % 변환, 나머지는 숫자
      if (f === 'type' || f === 'customName') {
        // 문자열 그대로
      } else if (f === 'supportRatePct') {
        const pct = parseFloat(val);
        state.data.teachers[i].supportRate = isNaN(pct) ? 0 : pct / 100;
        return;
      } else {
        val = num(val);
      }
      state.data.teachers[i][f] = val;
      
      // 직급 변경 시 처리
      if (f === 'type') {
        const t = state.data.teachers[i];
        const rateMap = {
          infant: 0.8, preschool: 0.3, disabled: 0.8,
          aid: 1.0, extended: 1.0, night: 0.8, cook: 1.0, custom: 0.8
        };
        t.supportRate = rateMap[val] !== undefined ? rateMap[val] : 1.0;
        // custom 선택 시 customName 빈값으로 초기화
        if (val === 'custom' && t.customName === undefined) {
          t.customName = '';
        }
        render(); // 화면 다시 그리기 (input/select 토글)
        return;
      }
      
      // customName은 데이터만 저장 (재렌더 안함 - 포커스 유지)
      if (f === 'customName') {
        return;
      }
      
      // 연봉 실시간 업데이트
      if (f === 'salary' || f === 'count') {
        const t = state.data.teachers[i];
        const annual = (t.salary || 0) * 12 * (t.count || 1);
        const annualEl = document.querySelector(`[data-annual-idx="${i}"]`);
        if (annualEl) {
          annualEl.innerHTML = `↳ 연 <b>${fmt(annual)}원</b> (월급 × 12개월 × ${t.count || 1}명)`;
        }
      }
    });
  });
  
  // 교사 삭제
  $$('[data-teacher-remove]').forEach(btn => {
    btn.addEventListener('click', e => {
      const i = parseInt(e.target.dataset.teacherRemove);
      state.data.teachers.splice(i, 1);
      render();
    });
  });
  
  // 교사 추가
  const addT = $('#btnAddTeacher');
  if (addT) addT.addEventListener('click', () => {
    state.data.teachers.push({ type: 'infant', grade: 1, salary: 2099100, count: 1, supportRate: 0.8 });
    render();
  });
  
  // 추가 인건비 (조리보조교사 등)
  const addExtra = $('#btnAddExtraPersonnel');
  if (addExtra) addExtra.addEventListener('click', () => {
    if (!state.data.extraPersonnel) state.data.extraPersonnel = [];
    state.data.extraPersonnel.push({ type: 'cookAssist', salary: 1800000, count: 1, months: 12 });
    render();
  });
  
  // 추가 인건비 입력 이벤트
  $$('[data-extra-idx]').forEach(input => {
    input.addEventListener('input', e => {
      const i = parseInt(e.target.dataset.extraIdx);
      const f = e.target.dataset.field;
      let val = e.target.value;
      
      if (f === 'type' || f === 'customName') {
        state.data.extraPersonnel[i][f] = val;
        if (f === 'type' && val === 'custom' && !state.data.extraPersonnel[i].customName) {
          state.data.extraPersonnel[i].customName = '';
        }
        // type 변경 시 화면 다시 그리기 (input/select 토글)
        if (f === 'type') {
          render();
          return;
        }
        return; // customName은 데이터만 저장
      } else {
        state.data.extraPersonnel[i][f] = parseInt(val) || 0;
      }
      
      // 연 합계 즉시 업데이트
      const t = state.data.extraPersonnel[i];
      const annual = (t.salary || 0) * (t.months || 12) * (t.count || 1);
      const display = document.querySelector(`[data-extra-annual-idx="${i}"]`);
      if (display) display.textContent = fmt(annual) + '원';
      
      // 소계, 4대보험 산정기준, 인건비 합계 업데이트
      const extraT = calc.extraPersonnelTotal();
      const salaryOnly = calc.teacherFullTotal();
      const allowanceT = calc.allAllowanceTotal();
      const otherT = calc.otherPersonnelTotal();
      const insBaseTotal = salaryOnly + allowanceT + extraT;
      const grandTotal = salaryOnly + allowanceT + otherT + extraT;
      
      const extraSub = $('#extraPersonnelSubtotal');
      const extraFormula = $('#extraFormulaSum');
      const insBase = $('#insuranceBaseFormula');
      const grand = $('#personnelGrandTotal');
      if (extraSub) extraSub.textContent = fmt(extraT) + '원';
      if (extraFormula) extraFormula.textContent = fmt(extraT) + '원';
      if (insBase) insBase.textContent = fmt(insBaseTotal) + '원';
      if (grand) grand.innerHTML = fmt(grandTotal) + '<span class="unit">원</span>';
    });
  });
  
  // 추가 인건비 삭제
  $$('[data-extra-remove]').forEach(btn => {
    btn.addEventListener('click', e => {
      const i = parseInt(e.target.dataset.extraRemove);
      state.data.extraPersonnel.splice(i, 1);
      render();
    });
  });
  
  // 야간연장
  $$('input[name="night"]').forEach(r => {
    r.addEventListener('change', e => {
      state.data.hasNightCare = e.target.value === 'yes';
      const detail = $('#nightDetail');
      if (detail) detail.style.display = state.data.hasNightCare ? 'block' : 'none';
    });
  });
  const nc = $('#nightCount');
  if (nc) nc.addEventListener('input', e => {
    state.data.nightCareCount = num(e.target.value);
    // 실시간 계산식 업데이트
    const count = state.data.nightCareCount;
    const total = calc.nightCareIncome();
    const monthly = total / 12;
    const formula = $('#nightCareFormula');
    const grandTotal = $('#nightCareGrandTotal');
    if (formula) {
      formula.innerHTML = `
        <span class="formula-label">🧮 야간연장 보육료 산출:</span><br>
        <span class="formula-expr" style="display: block; margin-top: 8px;">
          <b>[월 보육료]</b> <b>2시간</b> × <b>4,000원</b> × <b>${count}명</b> × <b>20일</b> = <b class="formula-result">${fmt(monthly)}원</b><br>
          <b>[연 보육료]</b> <b>${fmt(monthly)}원</b> × <b>12개월</b> = <b class="formula-result">${fmt(total)}원</b>
        </span>
      `;
    }
    if (grandTotal) grandTotal.innerHTML = fmt(total) + '<span class="unit">원</span>';
  });
  
  // 연장반 보육료
  function updateExtendedCareDisplay() {
    const e = state.data.extendedCare;
    const infantTotal = calc.extendedCareInfant();
    const preschoolTotal = calc.extendedCarePreschool();
    const mo = e.months || 12;
    
    // 전체 합계
    const grandEl = $('#extendedCareGrandTotal');
    if (grandEl) grandEl.innerHTML = fmt(infantTotal + preschoolTotal) + '<span class="unit">원</span>';
    
    // 영아반 공식 전체 업데이트
    const infantFormula = $('#extendedInfantFormula');
    if (infantFormula) {
      infantFormula.innerHTML = `
        <span class="formula-label">영아반 연장보육료 산출:</span><br>
        <span class="formula-expr">
          <b>${fmt(e.infantUnit || 0)}원</b> × <b>${e.infantCount || 0}명</b> × <b>20시간</b> × <b>${mo}개월</b>
          = <b class="formula-result">${fmt(infantTotal)}원</b>
        </span>
      `;
    }
    
    // 유아반 공식 전체 업데이트
    const preschoolFormula = $('#extendedPreschoolFormula');
    if (preschoolFormula) {
      preschoolFormula.innerHTML = `
        <span class="formula-label">유아반 연장보육료 산출:</span><br>
        <span class="formula-expr">
          <b>${fmt(e.preschoolUnit || 0)}원</b> × <b>${e.preschoolCount || 0}명</b> × <b>20시간</b> × <b>${mo}개월</b>
          = <b class="formula-result">${fmt(preschoolTotal)}원</b>
        </span>
      `;
    }
    
    // 개월 sync
    const m1 = $('#extendedMonths1');
    const m2 = $('#extendedMonths2');
    if (m1) m1.value = mo;
    if (m2) m2.value = mo;
  }
  const eIU = $('#extendedInfantUnit');
  if (eIU) eIU.addEventListener('input', e => {
    state.data.extendedCare.infantUnit = num(e.target.value);
    updateExtendedCareDisplay();
  });
  const eIC = $('#extendedInfantCount');
  if (eIC) eIC.addEventListener('input', e => {
    state.data.extendedCare.infantCount = num(e.target.value);
    updateExtendedCareDisplay();
  });
  const ePU = $('#extendedPreschoolUnit');
  if (ePU) ePU.addEventListener('input', e => {
    state.data.extendedCare.preschoolUnit = num(e.target.value);
    updateExtendedCareDisplay();
  });
  const ePC = $('#extendedPreschoolCount');
  if (ePC) ePC.addEventListener('input', e => {
    state.data.extendedCare.preschoolCount = num(e.target.value);
    updateExtendedCareDisplay();
  });
  const eMo = $('#extendedMonths');
  if (eMo) eMo.addEventListener('input', e => {
    state.data.extendedCare.months = num(e.target.value);
    updateExtendedCareDisplay();
  });
  
  // 수익자 부담/운영비/활동비/지출 등의 리스트 항목 추가
  $$('[data-add]').forEach(btn => {
    btn.addEventListener('click', e => {
      const key = e.target.dataset.add;
      state.data[key].push({ name: '', unit: 0, count: 0, months: 12 });
      render();
    });
  });
  
  // 리스트 항목 삭제
  $$('[data-list-remove]').forEach(btn => {
    btn.addEventListener('click', e => {
      const key = e.target.dataset.listRemove;
      const i = parseInt(e.target.dataset.idx);
      state.data[key].splice(i, 1);
      render();
    });
  });
  
  // 리스트 항목 수정
  $$('[data-list]').forEach(input => {
    input.addEventListener('input', e => {
      const key = e.target.dataset.list;
      const i = parseInt(e.target.dataset.idx);
      const f = e.target.dataset.field;
      let val = e.target.value;
      if (f !== 'name') val = num(val);
      state.data[key][i][f] = val;
      // 합계 실시간 업데이트
      const row = e.target.closest('tr');
      if (row) {
        const item = state.data[key][i];
        const total = (item.unit || item.fee || 0) * (item.count || 0) * (item.months || 0);
        const totalCell = row.querySelector('.total-cell');
        if (totalCell) totalCell.textContent = fmt(total);
      }
      // 합계 상단 표시 업데이트
      updateLiveSums();
      // STEP 15 세출 인건비 - 수당 소계 & 산정기준 실시간 업데이트
      if (key === 'directorAllowances' || key === 'teacherAllowances' || key === 'otherPersonnel') {
        const dSub = $('#directorAllowSubtotal');
        const tSub = $('#teacherAllowSubtotal');
        const allSub = $('#allowanceGrandSubtotal');
        const allFormulaSum = $('#allowanceFormulaSum');
        const otherSub = $('#otherPersonnelSubtotal');
        const extraFormula = $('#extraFormulaSum');
        const insBase = $('#insuranceBaseFormula');
        const grand = $('#personnelGrandTotal');
        const salaryOnly = calc.teacherFullTotal();
        const allowanceT = calc.allAllowanceTotal();
        const otherT = calc.otherPersonnelTotal();
        const extraT = calc.extraPersonnelTotal();
        const insBaseTotal = salaryOnly + allowanceT + extraT; // 4대보험 산정기준 (추가 포함, 기타 제외)
        const grandTotal = salaryOnly + allowanceT + otherT + extraT; // 인건비 총합 (모두 포함)
        if (dSub) dSub.textContent = fmt(calc.directorAllowanceTotal()) + '원';
        if (tSub) tSub.textContent = fmt(calc.teacherAllowanceTotal()) + '원';
        if (allSub) allSub.textContent = fmt(allowanceT) + '원';
        if (allFormulaSum) allFormulaSum.textContent = fmt(allowanceT) + '원';
        if (otherSub) otherSub.textContent = fmt(otherT) + '원';
        if (extraFormula) extraFormula.textContent = fmt(extraT) + '원';
        if (insBase) insBase.textContent = fmt(insBaseTotal) + '원';
        if (grand) grand.innerHTML = fmt(grandTotal) + '<span class="unit">원</span>';
      }
    });
  });
  
  // 지원율
  $$('[data-rate]').forEach(input => {
    input.addEventListener('input', e => {
      state.data.supportRates[e.target.dataset.rate] = num(e.target.value) / 100;
      // 교사들의 supportRate도 업데이트
      state.data.teachers.forEach(t => {
        if (t.type === 'infant') t.supportRate = state.data.supportRates.infant;
        else if (t.type === 'preschool') t.supportRate = state.data.supportRates.preschool;
        else if (t.type === 'disabled') t.supportRate = state.data.supportRates.disabled;
        else if (t.type === 'cook') t.supportRate = state.data.supportRates.cook;
        else if (t.type === 'night') t.supportRate = state.data.supportRates.disabled;
      });
    });
  });
  
  // 산재보험 요율
  const ir = $('#industrialRate');
  if (ir) ir.addEventListener('input', e => {
    state.data.industrialRate = num(e.target.value) / 100;
    // STEP 10 상세표 실시간 업데이트
    const base = calc.teacherFullTotal();
    const ins = CONSTANTS.INSURANCE;
    const health = base * ins.healthInsurance;
    const industrial = base * state.data.industrialRate;
    const insTotal = base * ins.nationalPension + health + health * ins.longTermCare 
                   + base * ins.employment + industrial;
    const retirement = base * ins.retirement;
    
    const rateCell = $('#industrialRateCell');
    const amountCell = $('#industrialAmountCell');
    const subtotalCell = $('#insuranceSubtotal');
    const grandTotalCell = $('#insuranceGrandTotal');
    const cardTotal = $('#insuranceCardTotal');
    
    if (rateCell) rateCell.textContent = (state.data.industrialRate*100).toFixed(2) + '%';
    if (amountCell) amountCell.textContent = fmt(industrial) + '원';
    if (subtotalCell) subtotalCell.textContent = fmt(insTotal) + '원';
    if (grandTotalCell) grandTotalCell.textContent = fmt(insTotal + retirement) + '원';
    if (cardTotal) cardTotal.textContent = fmt(insTotal);
  });
  
  // 이자수입
  const ii = $('#interestInput');
  if (ii) ii.addEventListener('input', e => state.data.interestIncome = num(e.target.value));
  
  // 예비비
  const ri = $('#reserveInput');
  if (ri) ri.addEventListener('input', e => state.data.reserveFund = num(e.target.value));
  
  // 자동 예비비
  const ar = $('#autoReserve');
  if (ar) ar.addEventListener('click', () => {
    const diff = calc.totalIncome() - calc.totalExpense();
    if (diff > 0) {
      state.data.reserveFund = Math.round(diff);
      render();
    }
  });
  
  // 엑셀 다운로드
  const bd = $('#btnDownload');
  if (bd) bd.addEventListener('click', downloadExcel);
  
  // 초기화
  const br = $('#btnReset');
  if (br) br.addEventListener('click', () => {
    if (confirm('처음부터 다시 시작하시겠습니까? 모든 데이터가 삭제됩니다.')) {
      location.reload();
    }
  });
}

function updateLiveSums() {
  const parentTot = $('#parentFeeTotal');
  if (parentTot) parentTot.innerHTML = fmt(calc.parentFeeIncome()) + '<span class="unit">원</span>';
  const localTot = $('#localTotal');
  if (localTot) localTot.innerHTML = fmt(calc.localSupportTotal()) + '<span class="unit">원</span>';
  // 세출 단계에서 예산 트래커 업데이트
  updateBudgetTracker();
}

function updateBudgetTracker() {
  const tracker = $('#budgetTracker');
  if (!tracker) return;
  const income = calc.totalIncome();
  const expense = calc.totalExpense();
  const remaining = income - expense;
  const expEl = $('#trackerExpense');
  const bar = $('#trackerBar');
  const statusEl = $('#trackerStatus');
  if (expEl) expEl.textContent = fmt(expense) + '원';
  if (bar) bar.style.width = (income > 0 ? Math.min(100, (expense/income)*100) : 0) + '%';
  // 상태 클래스 업데이트
  tracker.classList.remove('tracker-ok','tracker-perfect','tracker-over','tracker-empty');
  let statusClass, statusIcon, statusText;
  if (income === 0) {
    statusClass = 'tracker-empty';
    statusIcon = '📝';
    statusText = '세입을 먼저 입력해주세요';
  } else if (remaining === 0) {
    statusClass = 'tracker-perfect';
    statusIcon = '🎯';
    statusText = `딱 맞아요! 세입 = 세출 👏`;
  } else if (remaining < 0) {
    statusClass = 'tracker-over';
    statusIcon = '⚠️';
    statusText = `예산 초과: <b>${fmt(Math.abs(remaining))}원</b>`;
  } else if (remaining < income * 0.1) {
    statusClass = 'tracker-ok';
    statusIcon = '⚡';
    statusText = `남은 예산: <b>${fmt(remaining)}원</b> (얼마 안 남았어요!)`;
  } else {
    statusClass = 'tracker-ok';
    statusIcon = '💰';
    statusText = `남은 예산: <b>${fmt(remaining)}원</b>`;
  }
  tracker.classList.add(statusClass);
  if (statusEl) {
    statusEl.innerHTML = `<span class="tracker-status-icon">${statusIcon}</span><span class="tracker-status-text">${statusText}</span>`;
  }
}

function updateCapacityCounter() {
  const counter = $('#capacityCounter');
  if (!counter) return;
  const cap = state.data.capacity || 0;
  const assigned = calc.totalCapacity();
  const remaining = cap - assigned;
  const bar = $('#capBar');
  const assignedEl = $('#capAssigned');
  const statusEl = $('#capStatus');
  if (assignedEl) assignedEl.textContent = assigned;
  if (bar) bar.style.width = (cap > 0 ? Math.min(100, (assigned/cap)*100) : 0) + '%';
  // 상태 업데이트
  counter.classList.remove('counter-ok','counter-perfect','counter-over','counter-empty');
  let statusClass, statusIcon, statusText;
  if (cap === 0) {
    statusClass = 'counter-empty';
    statusIcon = '📝';
    statusText = '전체 정원을 먼저 입력해주세요 (STEP 1)';
  } else if (remaining === 0 && assigned > 0) {
    statusClass = 'counter-perfect';
    statusIcon = '🎉';
    statusText = `정원과 <b>딱 맞아요!</b> 👏`;
  } else if (remaining < 0) {
    statusClass = 'counter-over';
    statusIcon = '⚠️';
    statusText = `정원 초과 <b>${Math.abs(remaining)}명!</b>`;
  } else {
    statusClass = 'counter-ok';
    statusIcon = '😊';
    statusText = `남은 인원: <b>${remaining}명</b>`;
  }
  counter.classList.add(statusClass);
  if (statusEl) {
    statusEl.innerHTML = `<span class="counter-status-icon">${statusIcon}</span><span class="counter-status-text">${statusText}</span>`;
  }
}

// =============================================================
// 네비게이션
// =============================================================
$('#btnPrev').addEventListener('click', () => {
  if (state.currentStep > 0) {
    state.currentStep--;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

$('#btnNext').addEventListener('click', () => {
  if (state.currentStep < state.totalSteps - 1) {
    // 세입 완료(STEP 14, index 14) → 세출(STEP 15, index 15) 진입 시 샘플 자동 채우기
    if (state.currentStep === 14) {
      initializeExpenseSamples();
    }
    state.currentStep++;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

// =============================================================
// 엑셀 다운로드
// =============================================================
function downloadExcel() {
  const wb = XLSX.utils.book_new();
  const income = calc.totalIncome();
  const expense = calc.totalExpense();
  
  // 1. 총괄표
  const summaryData = [
    ['', '', '세입 세출 예산 총괄표', '', '', '', '', ''],
    [],
    ['', '세입', '', '', '', '세출', '', ''],
    ['', '과목', '예산액', '비중', '', '과목', '예산액', '비중'],
    ['', '보육료', calc.govChildcareFee() + calc.disabledChildcareFee() + calc.extendedCareIncome() + calc.nightCareIncome(), '', '', '인건비', calc.personnelTotalNew(), ''],
    ['', '수익자 부담수입', calc.parentFeeIncome(), '', '', '운영비', calc.managementTotal() + calc.promoTotal(), ''],
    ['', '보조금 및 지원금', calc.personnelSupportIncome() + calc.localSupportTotal(), '', '', '보육활동비', calc.childcareActivityTotal(), ''],
    ['', '잡수입', state.data.interestIncome, '', '', '수익자 부담 경비', calc.parentFeeExpense(), ''],
    ['', '', '', '', '', '재산 조성비', calc.propertyTotal(), ''],
    ['', '', '', '', '', '예비비', state.data.reserveFund || 0, ''],
    ['', '세입 총액', income, 1, '', '세출 총액', expense, 1],
  ];
  
  // 비중 계산
  if (income > 0) {
    summaryData[4][3] = (calc.govChildcareFee() + calc.disabledChildcareFee() + calc.extendedCareIncome() + calc.nightCareIncome()) / income;
    summaryData[5][3] = calc.parentFeeIncome() / income;
    summaryData[6][3] = (calc.personnelSupportIncome() + calc.localSupportTotal()) / income;
    summaryData[7][3] = state.data.interestIncome / income;
  }
  if (expense > 0) {
    summaryData[4][7] = calc.personnelTotalNew() / expense;
    summaryData[5][7] = (calc.managementTotal() + calc.promoTotal()) / expense;
    summaryData[6][7] = calc.childcareActivityTotal() / expense;
    summaryData[7][7] = calc.parentFeeExpense() / expense;
    summaryData[8][7] = calc.propertyTotal() / expense;
    summaryData[9][7] = (state.data.reserveFund || 0) / expense;
  }
  
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
  ws1['!cols'] = [{wch:3},{wch:24},{wch:18},{wch:12},{wch:3},{wch:24},{wch:18},{wch:12}];
  
  // === 총괄표 수식 주입 ===
  // 행 5~8: 세입 4개 항목 (C5:C8), 세출 6개 항목 (G5:G10)
  // 행 11: 총액 (C11=SUM(C5:C8), G11=SUM(G5:G10))
  // 엑셀 1-indexed: summaryData 인덱스 10 → 엑셀 행 11
  ws1['C11'] = { t: 'n', v: income, f: 'SUM(C5:C8)' };
  ws1['G11'] = { t: 'n', v: expense, f: 'SUM(G5:G10)' };
  
  // 비중: C5/C$11, G5/G$11 ... (세입/세출 각 항목 / 총액)
  ['D5','D6','D7','D8'].forEach((cell, idx) => {
    const cRow = idx + 5;
    ws1[cell] = { t: 'n', v: (summaryData[cRow-1]?.[3] || 0), f: `IFERROR(C${cRow}/C$11,0)`, z: '0.00%' };
  });
  ['H5','H6','H7','H8','H9','H10'].forEach((cell, idx) => {
    const cRow = idx + 5;
    ws1[cell] = { t: 'n', v: (summaryData[cRow-1]?.[7] || 0), f: `IFERROR(G${cRow}/G$11,0)`, z: '0.00%' };
  });
  // 총액 비중은 100%
  ws1['D11'] = { t: 'n', v: 1, z: '0.00%' };
  ws1['H11'] = { t: 'n', v: 1, z: '0.00%' };
  
  XLSX.utils.book_append_sheet(wb, ws1, '세입세출 총괄표');
  
  // 2. 세입 상세
  const incomeRows = [
    ['', `${CONSTANTS.YEAR}년 세입 예산서`, '', '', '', '', '', '', '', '', ''],
    [],
    ['', '(가칭) 00 어린이집', '', '', '', '', '', '', '', '(단위: 원)'],
    ['', '계정과목', '', '', '예산액', '산출기초', '', '', '', '', ''],
    ['', '관', '항', '목', '', '내용', '단가', '인원', '개월', '시간/비율', '합계'],
    ['', '01 보육료', '', '', calc.govChildcareFee() + calc.disabledChildcareFee() + calc.extendedCareIncome() + calc.nightCareIncome(), '', '', '', '', '', ''],
    ['', '', '11 보육료', '', '', '', '', '', '', '', ''],
    ['', '', '', '111 정부지원보육료', calc.govChildcareFee() + calc.disabledChildcareFee(), '', '', '', '', '', ''],
  ];
  
  // 연령별 보육료
  ['age0','age1','age2','age3','age4','age5'].forEach((k, i) => {
    const count = state.data.ages[k];
    if (count > 0) {
      const fee = state.data.childcareFees[k];
      incomeRows.push(['', '', '', '', '', `만 ${i}세`, fee, count, 12, '', fee * count * 12]);
    }
  });
  if (state.data.ages.disabled > 0) {
    incomeRows.push(['', '', '', '', '', '장애아', state.data.disabledFee, state.data.ages.disabled, 12, '', state.data.disabledFee * state.data.ages.disabled * 12]);
  }
  
  // 연장반 보육료
  if (calc.extendedCareIncome() > 0) {
    incomeRows.push(['', '', '', '112 연장반 보육료', calc.extendedCareIncome(), '', '', '', '', '', '']);
    const e = state.data.extendedCare;
    const mo = e.months || 12;
    if ((e.infantCount || 0) > 0) {
      incomeRows.push(['', '', '', '', '', '영아 연장반', e.infantUnit || 0, e.infantCount, mo, '월 20시간', calc.extendedCareInfant()]);
    }
    if ((e.preschoolCount || 0) > 0) {
      incomeRows.push(['', '', '', '', '', '유아 연장반', e.preschoolUnit || 0, e.preschoolCount, mo, '월 20시간', calc.extendedCarePreschool()]);
    }
  }
  
  // 야간연장 보육료
  if (calc.nightCareIncome() > 0) {
    incomeRows.push(['', '', '', '113 야간연장 보육료', calc.nightCareIncome(), '', '', '', '', '', '']);
    // 월 보육료 = 평균이용시간(2시간) × 단가(4,000원) × 인원 × 20일
    // 연 = 월 × 12개월
    // 엑셀 컬럼: G=단가, H=인원, I=개월, J=시간/비율
    // 수식용으로: 단가=4,000원, 인원=N명, 개월=12, J=월80원(2시간×20일×단가를 표현) 대신 아래처럼 풀어씀
    // 명확성을 위해 "월 80,000원" (2시간×4,000원×20일=월1인당 단가로 표현) × 인원 × 12개월
    const monthlyPerPerson = 2 * 4000 * 20; // 월 1인당 단가 80,000원
    incomeRows.push(['', '', '', '', '', '야간연장 (19시~24시)', monthlyPerPerson, state.data.nightCareCount || 0, 12, '월 2시간 평균', calc.nightCareIncome()]);
  }
  
  // 수익자 부담
  incomeRows.push(['', '02 수익자부담수입', '', '', calc.parentFeeIncome(), '', '', '', '', '', '']);
  incomeRows.push(['', '', '21 선택적 보육활동비', '', '', '', '', '', '', '', '']);
  incomeRows.push(['', '', '', '211 특별활동비', '', '', '', '', '', '', '']);
  state.data.specialActivities.forEach(a => {
    const unitVal = a.unit || a.fee || 0;
    incomeRows.push(['', '', '', '', '', a.name, unitVal, a.count || 0, a.months || 0, '', unitVal * (a.count || 0) * (a.months || 0)]);
  });
  incomeRows.push(['', '', '22 기타필요경비', '', '', '', '', '', '', '', '']);
  incomeRows.push(['', '', '', '221 기타필요경비', '', '', '', '', '', '', '']);
  state.data.otherParentFees.forEach(a => {
    const unitVal = a.unit || a.fee || 0;
    incomeRows.push(['', '', '', '', '', a.name, unitVal, a.count || 0, a.months || 0, '', unitVal * (a.count || 0) * (a.months || 0)]);
  });
  
  // 보조금
  incomeRows.push(['', '03 보조금 및 지원금', '', '', calc.personnelSupportIncome() + calc.localSupportTotal(), '', '', '', '', '', '']);
  incomeRows.push(['', '', '31 인건비 보조금', '', calc.personnelSupportIncome(), '', '', '', '', '', '']);
  incomeRows.push(['', '', '', '311 인건비 보조금', '', '', '', '', '', '', '']);
  
  // 원장
  const dTotal = state.data.director.salary * 12 * state.data.supportRates.director;
  incomeRows.push(['', '', '', '', '', `원장 ${state.data.director.grade}호봉`, state.data.director.salary, 1, state.data.supportRates.director, 12, dTotal]);
  
  // 교사
  state.data.teachers.forEach(t => {
    const total = t.salary * 12 * (t.count || 1) * (t.supportRate || 1);
    const typeMap = {
      infant: '영아반 교사', preschool: '유아반 교사', disabled: '장애교사',
      aid: '보조교사', extended: '연장교사', night: '야간연장교사', cook: '조리원'
    };
    const label = `${getTeacherLabel(t)} ${t.grade || ''}호봉`;
    incomeRows.push(['', '', '', '', '', label, t.salary, t.count || 1, t.supportRate || 1, 12, total]);
  });
  
  // 4대보험 + 퇴직
  const fullBase = calc.teacherFullTotal();
  incomeRows.push(['', '', '', '', '', '국민연금(사업주)', fullBase, '', CONSTANTS.INSURANCE.nationalPension, '', fullBase * CONSTANTS.INSURANCE.nationalPension]);
  const health = fullBase * CONSTANTS.INSURANCE.healthInsurance;
  incomeRows.push(['', '', '', '', '', '건강보험(사업주)', fullBase, '', CONSTANTS.INSURANCE.healthInsurance, '', health]);
  incomeRows.push(['', '', '', '', '', '장기요양보험', health, '', CONSTANTS.INSURANCE.longTermCare, '', health * CONSTANTS.INSURANCE.longTermCare]);
  incomeRows.push(['', '', '', '', '', '고용보험(사업주)', fullBase, '', CONSTANTS.INSURANCE.employment, '', fullBase * CONSTANTS.INSURANCE.employment]);
  incomeRows.push(['', '', '', '', '', '산재보험', fullBase, '', state.data.industrialRate, '', fullBase * state.data.industrialRate]);
  incomeRows.push(['', '', '', '', '', '퇴직적립금', fullBase, '', CONSTANTS.INSURANCE.retirement, '', fullBase * CONSTANTS.INSURANCE.retirement]);
  
  // 시/군/구 지원
  if (state.data.localSupport.length > 0) {
    incomeRows.push(['', '', '32 운영보조금', '', calc.localSupportTotal(), '', '', '', '', '', '']);
    incomeRows.push(['', '', '', '325 기타지원금', calc.localSupportTotal(), '', '', '', '', '', '']);
    state.data.localSupport.forEach(a => {
      incomeRows.push(['', '', '', '', '', a.name, a.unit || 0, a.count || 0, a.months || 0, '', (a.unit || 0) * (a.count || 0) * (a.months || 0)]);
    });
  }
  
  // 잡수입
  if (state.data.interestIncome > 0) {
    incomeRows.push(['', '08 잡수입', '', '', state.data.interestIncome, '', '', '', '', '', '']);
    incomeRows.push(['', '', '81 잡수입', '811 이자수입', state.data.interestIncome, '이자수입', state.data.interestIncome, 1, 1, 1, state.data.interestIncome]);
  }
  
  incomeRows.push([]);
  incomeRows.push(['', '합계', '', '', income, '', '', '', '', '', income]);
  
  const ws2 = XLSX.utils.aoa_to_sheet(incomeRows);
  ws2['!cols'] = [{wch:3},{wch:20},{wch:20},{wch:24},{wch:16},{wch:28},{wch:14},{wch:10},{wch:10},{wch:10},{wch:16}];
  
  // === 세입 시트 수식 주입 ===
  // 컬럼: A=빈칸, B=관, C=항, D=목, E=예산액, F=내용, G=단가, H=인원, I=개월, J=시간/비율, K=합계
  for (let r = 4; r < incomeRows.length; r++) {
    const row = incomeRows[r];
    if (!row || row.length < 11) continue;
    const hasName = row[5] !== '' && row[5] !== undefined;
    const hasUnit = typeof row[6] === 'number' && row[6] !== 0;
    const hasQty = typeof row[7] === 'number' && row[7] !== 0;
    const hasMonth = typeof row[8] === 'number' && row[8] !== 0;
    if (hasName && hasUnit && hasQty && hasMonth) {
      const rowNum = r + 1; // 엑셀 1-indexed
      const cellRef = `K${rowNum}`;
      // 시간/비율(J)이 숫자면 포함
      const hasRatio = typeof row[9] === 'number' && row[9] !== 0;
      const formula = hasRatio 
        ? `G${rowNum}*H${rowNum}*I${rowNum}*J${rowNum}` 
        : `G${rowNum}*H${rowNum}*I${rowNum}`;
      if (!ws2[cellRef]) ws2[cellRef] = { t: 'n', v: row[10] };
      ws2[cellRef].f = formula;
    }
  }
  
  // 마지막 합계 행: E와 K에 SUM 수식 (산출기초 행들의 K열 합산)
  const incLastRowNum = incomeRows.length; // 1-indexed 마지막 행
  // 산출기초 행들의 K값을 모두 더함 (5행부터 마지막 전까지)
  ws2[`E${incLastRowNum}`] = { t: 'n', v: income, f: `SUM(K5:K${incLastRowNum - 1})` };
  ws2[`K${incLastRowNum}`] = { t: 'n', v: income, f: `SUM(K5:K${incLastRowNum - 1})` };
  
  XLSX.utils.book_append_sheet(wb, ws2, '세입');
  
  // 3. 세출 상세
  const expRows = [
    ['', `${CONSTANTS.YEAR}년 세출 예산서`, '', '', '', '', '', '', '', ''],
    [],
    ['', '(가칭) 00 어린이집', '', '', '', '', '', '', '', '(단위: 원)'],
    ['', '계정과목', '', '', '예산액', '산출기초', '', '', '', ''],
    ['', '관', '항', '목', '', '내용', '단가', '인원', '개월', '합계'],
    ['', '100 인건비', '', '', calc.personnelTotalNew(), '', '', '', '', ''],
    ['', '', '110 원장인건비', '111 원장급여', state.data.director.salary * 12, `원장 ${state.data.director.grade}호봉`, state.data.director.salary, 1, 12, state.data.director.salary * 12],
  ];
  
  // 원장 수당
  if (state.data.directorAllowances.length > 0) {
    expRows.push(['', '', '', '112 원장수당', calc.directorAllowanceTotal(), '', '', '', '', '']);
    state.data.directorAllowances.forEach(a => {
      expRows.push(['', '', '', '', '', a.name, a.unit || 0, a.count || 0, a.months || 0, (a.unit || 0) * (a.count || 0) * (a.months || 0)]);
    });
  }
  
  // 보육교직원
  const teacherExpTotal = state.data.teachers.reduce((s,t) => s + t.salary * 12 * (t.count || 1), 0);
  expRows.push(['', '', '120 보육교직원 인건비', '121 보육교직원 급여', teacherExpTotal, '', '', '', '', '']);
  state.data.teachers.forEach(t => {
    const typeMap = {
      infant: '영아반 교사', preschool: '유아반 교사', disabled: '장애교사',
      aid: '보조교사', extended: '연장교사', night: '야간연장교사', cook: '조리원'
    };
    const label = `${getTeacherLabel(t)} ${t.grade || ''}호봉`;
    expRows.push(['', '', '', '', '', label, t.salary, t.count || 1, 12, t.salary * 12 * (t.count || 1)]);
  });
  
  // 교직원 수당
  if (state.data.teacherAllowances.length > 0) {
    expRows.push(['', '', '', '122 보육교직원 수당', calc.teacherAllowanceTotal(), '', '', '', '', '']);
    state.data.teacherAllowances.forEach(a => {
      expRows.push(['', '', '', '', '', a.name, a.unit || 0, a.count || 0, a.months || 0, (a.unit || 0) * (a.count || 0) * (a.months || 0)]);
    });
  }
  
  // 130 추가 인건비 (조리보조교사 등 정규 교직원 - 4대보험 포함, 세입 미반영)
  if (state.data.extraPersonnel && state.data.extraPersonnel.length > 0) {
    expRows.push(['', '', '130 추가 인건비', '131 추가 인건비', calc.extraPersonnelTotal(), '', '', '', '', '']);
    state.data.extraPersonnel.forEach(t => {
      const label = t.type === 'custom' ? (t.customName || '직접 작성') : ({
        cookAssist: '조리보조교사', aid: '보조교사', extended: '연장교사',
        substitute: '대체교사', driver: '운전기사', office: '사무원'
      }[t.type] || '교직원');
      const annual = (t.salary || 0) * (t.months || 12) * (t.count || 1);
      expRows.push(['', '', '', '', '', label, t.salary || 0, t.count || 1, t.months || 12, annual]);
    });
  }
  
  // 기관부담금
  const insBase = calc.insuranceBase();
  expRows.push(['', '', '140 기관부담금', '141 법정부담금', calc.insuranceTotalNew(), '', '', '', '', '']);
  expRows.push(['', '', '', '', '', '국민연금(사업주)', insBase, CONSTANTS.INSURANCE.nationalPension, '', insBase * CONSTANTS.INSURANCE.nationalPension]);
  const healthNew = insBase * CONSTANTS.INSURANCE.healthInsurance;
  expRows.push(['', '', '', '', '', '건강보험(사업주)', insBase, CONSTANTS.INSURANCE.healthInsurance, '', healthNew]);
  expRows.push(['', '', '', '', '', '장기요양보험', healthNew, CONSTANTS.INSURANCE.longTermCare, '', healthNew * CONSTANTS.INSURANCE.longTermCare]);
  expRows.push(['', '', '', '', '', '고용보험(사업주)', insBase, CONSTANTS.INSURANCE.employment, '', insBase * CONSTANTS.INSURANCE.employment]);
  expRows.push(['', '', '', '', '', '산재보험', insBase, state.data.industrialRate, '', insBase * state.data.industrialRate]);
  expRows.push(['', '', '', '142 퇴직금 및 퇴직적립금', calc.retirementTotalNew(), '퇴직적립금', insBase, CONSTANTS.INSURANCE.retirement, '', calc.retirementTotalNew()]);
  
  // 150 기타 인건비 (4대보험 미포함 - 대체교사, 대체조리사 등)
  if (state.data.otherPersonnel && state.data.otherPersonnel.length > 0) {
    expRows.push(['', '', '150 기타 인건비', '151 기타 인건비', calc.otherPersonnelTotal(), '', '', '', '', '']);
    state.data.otherPersonnel.forEach(a => {
      expRows.push(['', '', '', '', '', a.name, a.unit || 0, a.count || 0, a.months || 0, (a.unit || 0) * (a.count || 0) * (a.months || 0)]);
    });
  }
  
  // 헬퍼 함수: 세분화된 리스트 섹션 출력
  function pushSection(관, 항, 목Map) {
    // 관 헤더
    const 관Total = Object.values(목Map).reduce((s, key) => s + calc.sumList(key), 0);
    if (관Total === 0) return;
    expRows.push(['', 관, '', '', 관Total, '', '', '', '', '']);
    Object.entries(목Map).forEach(([목명, key]) => {
      const 목Total = calc.sumList(key);
      if (목Total === 0 && (state.data[key] || []).length === 0) return;
      expRows.push(['', '', 항, 목명, 목Total, '', '', '', '', '']);
      (state.data[key] || []).forEach(a => {
        expRows.push(['', '', '', '', '', a.name, a.unit || 0, a.count || 0, a.months || 0, (a.unit || 0) * (a.count || 0) * (a.months || 0)]);
      });
    });
  }
  
  // 관리운영비 (200) - 항 하나에 목 여러 개
  if (calc.managementTotal() > 0) {
    expRows.push(['', '200 운영비', '', '', calc.managementTotal() + calc.promoTotal(), '', '', '', '', '']);
    expRows.push(['', '', '210 관리운영비', '', calc.managementTotal(), '', '', '', '', '']);
    const 관리목 = {
      '211 수용비 및 수수료': 'receivingCosts',
      '212 공공요금 및 제세공과금': 'utilityCosts',
      '213 연료비': 'fuelCosts',
      '214 여비': 'travelCosts',
      '215 차량비': 'vehicleCosts',
      '216 복리후생비': 'welfareCosts',
    };
    Object.entries(관리목).forEach(([목명, key]) => {
      const 목Total = calc.sumList(key);
      if (목Total === 0 && (state.data[key] || []).length === 0) return;
      expRows.push(['', '', '', 목명, 목Total, '', '', '', '', '']);
      (state.data[key] || []).forEach(a => {
        expRows.push(['', '', '', '', '', a.name, a.unit || 0, a.count || 0, a.months || 0, (a.unit || 0) * (a.count || 0) * (a.months || 0)]);
      });
    });
    
    // 업무추진비 (220)
    if (calc.promoTotal() > 0) {
      expRows.push(['', '', '220 업무추진비', '', calc.promoTotal(), '', '', '', '', '']);
      const 추진목 = {
        '221 업무추진비': 'businessPromoCosts',
        '222 직책급': 'positionAllowanceCosts',
        '223 회의비': 'meetingCosts',
      };
      Object.entries(추진목).forEach(([목명, key]) => {
        const 목Total = calc.sumList(key);
        if (목Total === 0 && (state.data[key] || []).length === 0) return;
        expRows.push(['', '', '', 목명, 목Total, '', '', '', '', '']);
        (state.data[key] || []).forEach(a => {
          expRows.push(['', '', '', '', '', a.name, a.unit || 0, a.count || 0, a.months || 0, (a.unit || 0) * (a.count || 0) * (a.months || 0)]);
        });
      });
    }
  }
  
  // 보육활동비 (300)
  if (calc.childcareActivityTotal() > 0) {
    expRows.push(['', '300 보육활동비', '', '', calc.childcareActivityTotal(), '', '', '', '', '']);
    expRows.push(['', '', '310 기본보육활동비', '', calc.childcareActivityTotal(), '', '', '', '', '']);
    const 활동목 = {
      '311 교직원 연수 연구비': 'trainingCosts',
      '312 교재교구 구입비': 'materialCosts',
      '313 행사비': 'eventCosts',
      '315 급간식비': 'mealCosts',
    };
    Object.entries(활동목).forEach(([목명, key]) => {
      const 목Total = calc.sumList(key);
      if (목Total === 0 && (state.data[key] || []).length === 0) return;
      expRows.push(['', '', '', 목명, 목Total, '', '', '', '', '']);
      (state.data[key] || []).forEach(a => {
        expRows.push(['', '', '', '', '', a.name, a.unit || 0, a.count || 0, a.months || 0, (a.unit || 0) * (a.count || 0) * (a.months || 0)]);
      });
    });
  }
  
  // 수익자부담 지출 (400)
  if (calc.parentFeeExpense() > 0) {
    expRows.push(['', '400 수익자부담금', '', '', calc.parentFeeExpense(), '', '', '', '', '']);
    expRows.push(['', '', '410 수익자부담', '411 기타필요경비', calc.parentFeeExpense(), '', '', '', '', '']);
    state.data.parentFeeExpenses.forEach(a => {
      expRows.push(['', '', '', '', '', a.name, a.unit || 0, a.count || 0, a.months || 0, (a.unit || 0) * (a.count || 0) * (a.months || 0)]);
    });
  }
  
  // 재산조성비 (700)
  if (calc.propertyTotal() > 0) {
    expRows.push(['', '700 재산조성비', '', '', calc.propertyTotal(), '', '', '', '', '']);
    const 재산목 = {
      '711 시설비': 'facilityCosts',
      '712 시설비유지비': 'facilityMaintCosts',
      '721 자산취득비': 'assetAcquireCosts',
    };
    Object.entries(재산목).forEach(([목명, key]) => {
      const 목Total = calc.sumList(key);
      if (목Total === 0 && (state.data[key] || []).length === 0) return;
      expRows.push(['', '', '', 목명, 목Total, '', '', '', '', '']);
      (state.data[key] || []).forEach(a => {
        expRows.push(['', '', '', '', '', a.name, a.unit || 0, a.count || 0, a.months || 0, (a.unit || 0) * (a.count || 0) * (a.months || 0)]);
      });
    });
  }
  
  // 예비비
  if (state.data.reserveFund > 0) {
    expRows.push(['', '1000 예비비', '', '', state.data.reserveFund, '예비비', state.data.reserveFund, 1, 1, state.data.reserveFund]);
  }
  
  expRows.push([]);
  expRows.push(['', '합계', '', '', expense, '', '', '', '', expense]);
  
  const ws3 = XLSX.utils.aoa_to_sheet(expRows);
  ws3['!cols'] = [{wch:3},{wch:20},{wch:20},{wch:24},{wch:16},{wch:28},{wch:14},{wch:10},{wch:10},{wch:16}];
  
  // === 세출 시트 수식 주입 ===
  // 컬럼: A=빈칸, B=관, C=항, D=목, E=예산액, F=내용, G=단가, H=인원, I=개월, J=합계
  for (let r = 4; r < expRows.length; r++) {
    const row = expRows[r];
    if (!row || row.length < 10) continue;
    const hasName = row[5] !== '' && row[5] !== undefined;
    const hasUnit = typeof row[6] === 'number' && row[6] !== 0;
    const hasQty = typeof row[7] === 'number' && row[7] !== 0;
    const hasMonth = typeof row[8] === 'number' && row[8] !== 0;
    if (hasName && hasUnit && hasQty && hasMonth) {
      const rowNum = r + 1; // 엑셀 1-indexed
      const cellRef = `J${rowNum}`;
      const formula = `G${rowNum}*H${rowNum}*I${rowNum}`;
      if (!ws3[cellRef]) ws3[cellRef] = { t: 'n', v: row[9] };
      ws3[cellRef].f = formula;
    }
  }
  
  // 마지막 합계 행: E와 J에 SUM 수식
  const expLastRowNum = expRows.length; // 1-indexed 마지막 행
  ws3[`E${expLastRowNum}`] = { t: 'n', v: expense, f: `SUM(J5:J${expLastRowNum - 2})` };
  ws3[`J${expLastRowNum}`] = { t: 'n', v: expense, f: `SUM(J5:J${expLastRowNum - 2})` };
  
  XLSX.utils.book_append_sheet(wb, ws3, '세출');
  
  // 4. 기본정보 요약
  const infoRows = [
    ['항목', '내용'],
    ['기준연도', CONSTANTS.YEAR + '년'],
    ['전체 정원', calc.totalCapacity() + '명'],
    ['영아반 정원', calc.infantCount() + '명'],
    ['유아반 정원', calc.preschoolCount() + '명'],
    ['장애아', (state.data.ages.disabled || 0) + '명'],
    [],
    ['4대보험 요율 (2026년 기준)'],
    ['국민연금(사업주)', (CONSTANTS.INSURANCE.nationalPension * 100).toFixed(2) + '%'],
    ['건강보험(사업주)', (CONSTANTS.INSURANCE.healthInsurance * 100).toFixed(3) + '%'],
    ['장기요양보험', (CONSTANTS.INSURANCE.longTermCare * 100).toFixed(2) + '% (건강보험료 대비)'],
    ['고용보험(사업주)', (CONSTANTS.INSURANCE.employment * 100).toFixed(2) + '%'],
    ['산재보험', (state.data.industrialRate * 100).toFixed(2) + '%'],
    ['퇴직적립금', '1/12 (8.33%)'],
    [],
    ['인건비 지원율'],
    ['원장', (state.data.supportRates.director * 100).toFixed(0) + '%'],
    ['영아반 교사', (state.data.supportRates.infant * 100).toFixed(0) + '%'],
    ['유아반 교사', (state.data.supportRates.preschool * 100).toFixed(0) + '%'],
    ['장애교사', (state.data.supportRates.disabled * 100).toFixed(0) + '%'],
    ['조리원', (state.data.supportRates.cook * 100).toFixed(0) + '%'],
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(infoRows);
  ws4['!cols'] = [{wch:24},{wch:40}];
  XLSX.utils.book_append_sheet(wb, ws4, '기본정보');
  
  // 다운로드
  const today = new Date();
  const dateStr = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;
  const fileName = `${CONSTANTS.YEAR}년_국공립어린이집_예산서_${dateStr}.xlsx`;
  XLSX.writeFile(wb, fileName);
  
  // 다운로드 성공 피드백
  const btn = document.getElementById('btnDownload');
  if (btn) {
    const originalText = btn.innerHTML;
    btn.innerHTML = '✅ 다운로드 완료!';
    btn.style.background = 'linear-gradient(135deg, #4CAF50, #2E7D32)';
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.style.background = '';
    }, 2500);
  }
}

// =============================================================
// 초기 실행
// =============================================================
render();
