// 문서 종류.
//
// 원장님이 관리자 화면에서 **문서마다 따로** 한글 샘플을 올려 주시면,
// 수강생 화면에서는 그 샘플의 **글꼴·글자크기·줄간격·여백**을 그대로 물려받아
// 그 문서 하나만 만들어 드린다. (예전처럼 12MB 전체 문서를 조립하지 않는다)
//
// 보관 자리: Supabase 보관소 witak 버킷의 forms/<key>.hwpx

export const FORMS = [
  {
    key: 'toc',
    name: '목차',
    step: 0,
    desc: '수강생의 지자체 목차로 바꿔서 만들어 드립니다.',
  },
  {
    key: 'intro',
    name: '자기소개서',
    step: 1,
    desc: '1차시에서 쓴 자기소개서가 이 서식으로 만들어집니다.',
  },
  {
    key: 'budget',
    name: '예산서',
    step: 2,
    desc: '2차시 세입·세출 예산서 서식입니다.',
  },
  {
    key: 'program',
    name: '연간–월간–하루일지',
    step: 3,
    desc: '3차시 보육사업계획 서식입니다.',
  },
  {
    key: 'special',
    name: '특색프로그램',
    step: 4,
    desc: '4차시 특색·특별활동 서식입니다.',
  },
  {
    key: 'vulnerable',
    name: '취약보육',
    step: 5,
    desc: '5차시 취약보육 계획 서식입니다.',
  },
  {
    key: 'parent',
    name: '학부모 참여수업',
    step: 6,
    desc: '6차시 열린어린이집·학부모 참여 서식입니다.',
  },
  {
    key: 'final',
    name: '전체 문서 (마지막 제공)',
    step: null,
    desc: '과정을 마친 수강생이 각 문서를 모아 정리할 때 쓰는 전체 서식입니다.',
  },
];

export function formByKey(key) {
  return FORMS.find((f) => f.key === key) || null;
}

/** 지역_이름_문서이름.hwpx 로 이름을 통일한다 */
export function fileName({ city, student, docName }) {
  const clean = (v) => String(v || '').replace(/[^\w가-힣]/g, '');
  const parts = [clean(city), clean(student), clean(docName)].filter(Boolean);
  return `${parts.join('_')}.hwpx`;
}
