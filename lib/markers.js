// 원장님 샘플 문서와 앱 사이의 "약속" — 자리 표시.
//
// 원장님이 샘플 한글문서에서 각 항목이 시작하는 곳에 한 줄로 [[자기소개서]] 처럼 적어 두시면,
// 앱이 그 줄부터 다음 표시 전까지를 그 항목으로 봅니다.
//   · 수강생이 그 차시를 마쳤으면  → 수강생이 쓴 글로 바뀝니다
//   · 아직 안 했으면             → 원장님 샘플 내용이 그대로 남습니다 (본보기)
//   · 표시한 줄 자체는 완성 문서에서 사라집니다

// 표시 이름 → 문서 항목 id (lib/sampleSections.js 의 id)
export const MARKERS = {
  표지: 'cover',
  자기소개서: 'applicant',
  예산서: 'budget',
  프로그램: 'plan-curriculum',
  특색프로그램: 'manage-special',
  취약보육: 'plan-vulnerable',
  학부모참여: 'manage-open',
};

// 화면 안내용 (원장님께 보여 드리는 표)
export const MARKER_GUIDE = [
  { mark: '[[표지]]', what: '표지 · 위탁신청서', step: 8 },
  { mark: '[[자기소개서]]', what: '자기소개서', step: 1 },
  { mark: '[[예산서]]', what: '세입 · 세출 예산', step: 2 },
  { mark: '[[프로그램]]', what: '연간–월간–하루일지', step: 3 },
  { mark: '[[특색프로그램]]', what: '특색 · 특별활동', step: 4 },
  { mark: '[[취약보육]]', what: '취약보육 계획', step: 5 },
  { mark: '[[학부모참여]]', what: '열린어린이집 · 학부모 참여', step: 6 },
];

/**
 * section0.xml 에서 "맨 바깥 문단"들의 위치를 찾는다.
 * 표 안에도 문단이 들어 있으므로, 깊이를 세어 바깥 것만 고른다.
 * @returns {{start:number, end:number}[]}
 */
export function topLevelParagraphs(xml) {
  const out = [];
  let depth = 0;
  let start = -1;
  const re = /<hp:p[\s>]|<\/hp:p>/g;
  let m;
  while ((m = re.exec(xml))) {
    if (m[0] === '</hp:p>') {
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

/** 문단 안의 글자만 이어 붙인다 */
export function paragraphText(chunk) {
  const parts = chunk.match(/<hp:t>([\s\S]*?)<\/hp:t>/g) || [];
  return parts
    .map((p) => p.replace(/<\/?hp:t>/g, ''))
    .join('')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * 샘플에서 [[표시]] 를 찾아 항목별 구간을 만든다.
 * @returns {null | Array<{id:string, name:string, start:number, end:number}>}
 *          표시가 하나도 없으면 null (예전 방식으로 넘어간다)
 */
export function findMarkedRanges(xml) {
  const paras = topLevelParagraphs(xml);
  const found = [];

  paras.forEach((p, i) => {
    const text = paragraphText(xml.slice(p.start, p.end));
    const m = text.match(/^\[\[\s*([^\]]+?)\s*\]\]$/);
    if (!m) return;
    const name = m[1].replace(/\s+/g, '');
    const id = MARKERS[name];
    if (!id) return; // 약속에 없는 이름은 무시
    found.push({ id, name, paraIndex: i, markStart: p.start, markEnd: p.end });
  });

  if (!found.length) return null;

  return found.map((f, k) => ({
    id: f.id,
    name: f.name,
    // 표시한 줄 다음부터가 내용이다 (표시 줄은 문서에 넣지 않는다)
    start: f.markEnd,
    end: k + 1 < found.length ? found[k + 1].markStart : xml.length,
  }));
}
