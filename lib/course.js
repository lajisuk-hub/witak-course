// 과정 차시 목록. 화면 순서와 준비 상태를 여기서 한 곳에서 관리한다.
// href 가 null 이면 아직 만들지 않은 차시(준비 중)로 보여준다.

export const COURSE = [
  {
    no: 0,
    title: '우리 지자체 목차 만들기',
    desc: '공고문을 올리면 제출서류 목차를 뽑아 내 문서 뼈대를 만듭니다.',
    href: '/toc',
  },
  {
    no: 1,
    title: '자기소개서 작성하기',
    desc: 'A4 한 장. 원장으로서 자격이 충분하다는 것이 드러나게 씁니다.',
    href: '/step1',
  },
  {
    no: 2,
    title: '40인 기준 회계서류 (세입·세출)',
    desc: '반별 구성을 확정한 뒤 예산을 짭니다.',
    href: '/step2',
  },
  {
    no: 3,
    title: '연간–월간–하루일지 계획',
    desc: '샘플을 받아 참고해서 직접 작성합니다.',
    href: '/step3',
  },
  {
    no: 4,
    title: '특색프로그램 계획',
    desc: '우리 원만의 특색 프로그램을 연령별로 만듭니다.',
    href: '/step4',
  },
  {
    no: 5,
    title: '취약보육 계획',
    desc: '우리 원이 하는 영역을 골라 맞춤 문서를 만듭니다.',
    href: '/step5',
  },
  {
    no: 6,
    title: '학부모 참여수업 계획',
    desc: '아빠·조부모 등 참여 프로그램을 골라 넣습니다.',
    href: '/step6',
  },
  {
    no: 7,
    title: '전체문서 나열하고 내용 보충',
    desc: '빠진 곳을 채우고 사진을 넣습니다.',
    href: null,
  },
  {
    no: 8,
    title: '목차 및 표지 만들고 수정보완',
    desc: '문서를 다 만든 뒤 목차와 표지를 정리합니다.',
    href: null,
  },
  {
    no: 9,
    title: '면접 코칭용 PDF 만들기',
    desc: '완성한 서류를 면접 준비용으로 정리합니다.',
    href: null,
  },
  {
    no: 10,
    title: '심사 발표자료(PPT) 만들기',
    desc: '발표용 자료를 만듭니다.',
    href: null,
  },
];

// 진행자 연락 안내 (모든 안내 문구 끝에 붙는다)
export const CONTACT_LINE =
  '어려움이 있을 경우 반드시 라지숙 소장에게 연락하세요!';
export const CONTACT_SUB = '문의사항이 있을 경우 클릭 후 카톡 상담하세요';

// 라지숙 소장 카카오톡 오픈채팅 (여기만 바꾸면 모든 화면에 반영됩니다)
export const KAKAO_URL = 'https://open.kakao.com/o/s0rTIOEi';
