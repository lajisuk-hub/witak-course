// 8차시 면접 코칭 — 추천 질문 7개 영역
// 원본: lajisuk-hub/wmentor-interview-prep 의 lib/areas.js (복사해 옴, 원본은 건드리지 않음)

export const QUESTION_AREAS = [
  {
    key: '원장 전문성',
    guide:
      '원장 본인의 전문성에 관한 질문. 지원 동기, 이전 경력과 그 경력이 원 운영에 어떻게 도움이 되는지, 원장으로서의 역량과 각오 등.',
  },
  {
    key: '원 운영',
    guide:
      '어린이집 전반의 운영에 관한 질문. 운영 방침, 조직 관리 체계, 시설·환경 관리, 운영의 투명성과 책임성 등.',
  },
  {
    key: '특색 프로그램',
    guide:
      '이 어린이집만의 차별화된 특색 프로그램에 관한 질문. 프로그램의 목적, 운영 방식, 기대 효과 등.',
  },
  {
    key: '취약보육',
    guide:
      '취약보육에 관한 질문. 장애아 통합보육, 다문화 가정 지원, 시간연장·야간·휴일 보육 등 취약 보육 대상에 대한 계획.',
  },
  {
    key: '예산서',
    guide:
      '예산서에 관한 질문. 세입·세출 예산 편성, 재정 운용 계획, 예산의 적정성과 우선순위 등.',
  },
  {
    key: '교사',
    guide:
      '보육교사·교직원에 관한 질문. 교사 채용 기준, 처우 개선, 역량 강화와 보수교육, 교사 복지 등.',
  },
  {
    key: '운영계획서 전반',
    guide:
      '운영계획서의 그 외 내용에 관한 질문. 안전 관리, 학부모 협력과 소통, 지역사회 연계, 비상 대응 등 위에서 다루지 않은 영역.',
  },
];

// 추천 질문을 받은 횟수로 영역·난이도를 정한다
// (홀수번째 = 쉬운 질문, 짝수번째 = 복합 질문)
export function planForRecommend(recommendCount) {
  const area = QUESTION_AREAS[(recommendCount - 1) % QUESTION_AREAS.length];
  const level = recommendCount % 2 === 1 ? 'easy' : 'deep';
  return { area, level };
}

// 하루에 받을 수 있는 질문 수 (질문 10개 ≈ 1,000원)
export const DAILY_LIMIT = 10;
