// 9차시 · 심사 발표자료 (원장님이 정한 목차 그대로)
//
// 발표 시간은 모두 합쳐 4분 30초(270초)다.
// 표지에서 인사 15초 + 아래 10꼭지 255초 = 270초.

export const PRESENT_SECTIONS = [
  {
    no: 1,
    title: '원장 소개',
    seconds: 30,
    guide:
      '지원자가 어떤 사람인지 — 이름, 총 경력 연수, 지금까지 걸어온 길. 서류의 자기소개서·이력 부분에서 뽑는다.',
  },
  {
    no: 2,
    title: '원장의 전문성',
    sub: '신규위탁 원장으로서의 강점',
    seconds: 30,
    guide:
      '원장으로서 준비돼 있다는 근거 — 자격증, 학력, 연수, 잘하는 분야. 서류의 자기소개서·이력·연수 내용에서 뽑는다.',
  },
  {
    no: 3,
    title: '그간의 노력',
    sub: '업무 능력',
    seconds: 25,
    guide:
      '지금까지 실제로 해 온 일과 성과 — 운영 경험, 평가인증, 프로그램 운영, 수상, 지역사회 활동 등.',
  },
  {
    no: 4,
    title: '위탁 어린이집 운영철학',
    seconds: 25,
    guide: '보육철학·비전·운영목표. 서류의 운영계획 앞부분에서 뽑는다.',
  },
  {
    no: 5,
    title: '특색프로그램',
    seconds: 30,
    guide: '우리 원만의 특색 프로그램 이름과 연령별 내용. 서류의 특색프로그램 계획에서 뽑는다.',
  },
  {
    no: 6,
    title: '취약보육',
    seconds: 25,
    guide: '영아·장애·다문화·시간연장 등 우리 원이 하는 취약보육 운영 방안.',
  },
  {
    no: 7,
    title: '교사의 전문성 향상',
    seconds: 25,
    guide: '교직원 연수·장학·처우·조직문화 등 교사를 키우는 계획.',
  },
  {
    no: 8,
    title: '예산의 적절성',
    seconds: 20,
    guide:
      '세입·세출 예산의 짜임새 — 정원, 인건비 비중, 운영비 배분 등. 서류의 예산서에서 숫자를 뽑는다.',
  },
  {
    no: 9,
    title: '중점 운영계획',
    seconds: 30,
    guide: '위탁을 맡으면 가장 먼저, 집중해서 할 일 3~4가지.',
  },
  {
    no: 10,
    title: '마무리',
    seconds: 15,
    guide: '다짐과 감사 인사. 심사위원께 드리는 마지막 한마디.',
  },
];

export const COVER_SECONDS = 15;
export const TOTAL_SECONDS =
  COVER_SECONDS + PRESENT_SECTIONS.reduce((s, x) => s + x.seconds, 0); // 270초 = 4분 30초

/** 1·2부로 나눠 부른다 (한 번에 다 만들면 60초 제한에 걸린다) */
export const PART1 = PRESENT_SECTIONS.filter((s) => s.no <= 5);
export const PART2 = PRESENT_SECTIONS.filter((s) => s.no > 5);

// 발표 속도 — 또박또박 읽으면 1초에 4.8글자(빈칸 뺀 글자 수) 정도 나간다.
export const CHARS_PER_SEC = 4.8;

/** 대본 글자 수로 걸리는 시간을 어림한다 (빈칸은 세지 않는다) */
export function estimateSeconds(text) {
  const n = String(text || '').replace(/\s/g, '').length;
  return Math.round(n / CHARS_PER_SEC);
}

/**
 * AI에게 시킬 대본 길이 (빈칸을 포함해서 세는 글자 수).
 * 한국어는 빈칸이 20%쯤 되므로 위 속도보다 넉넉히 잡는다.
 */
export function scriptCharRange(seconds) {
  return [Math.round(seconds * 4.55), Math.round(seconds * 5.3)];
}

/**
 * 글자 수만 시키면 AI가 자꾸 짧게 쓴다.
 * 문장 수를 함께 정해 주면 길이가 잘 맞는다 (발표 문장 하나가 7~8초쯤).
 */
export function scriptSentences(seconds) {
  return Math.max(2, Math.round(seconds / 7.5));
}

/** 초를 "1분 30초"처럼 읽기 쉽게 */
export function timeLabel(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (!m) return `${s}초`;
  return s ? `${m}분 ${s}초` : `${m}분`;
}

/** 표지에서 할 인사말 (AI를 부르지 않고 그대로 쓴다) */
export function coverScript(center, applicant) {
  const c = (center || '○○어린이집').trim();
  const a = (applicant || '○○○').trim();
  return `안녕하십니까. ${c} 위탁 지원자 ${a}입니다. 귀한 자리에 서게 해 주셔서 감사합니다. 지금부터 저희가 준비한 운영계획을 말씀드리겠습니다.`;
}
