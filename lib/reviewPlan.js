// 7차시 · 완성 서류 점검
// 수강생이 정리해 PDF로 저장한 전체 서류를 올리면 네 갈래로 살펴본다.
//   목차  — 0차시에서 뽑은 우리 지자체 목차 순서대로 정리됐는지
//   번호  — 장·절 번호(Ⅰ, 1., 가., 1))가 빠지거나 겹치지 않는지
//   인터뷰 — 1차시 자기소개서 인터뷰·시작 질문에 적은 내용이 서류에 살아 있는지
//   매력  — 심사위원이 읽었을 때 위탁 서류로서 설득력이 있는지
//
// AI 응답은 JSON 대신 ### 구분자로 받아 여기서 파싱한다 (따옴표 때문에 JSON이 깨지는 교훈).

export const AREAS = [
  { key: '목차', title: '목차에 맞게 정리됐나', desc: '우리 지자체 목차 순서와 항목' },
  { key: '번호', title: '번호 순서가 맞나', desc: '장·절 번호와 쪽 순서' },
  { key: '인터뷰', title: '인터뷰 내용이 반영됐나', desc: '1차시에 적으신 철학·경력·계획' },
  { key: '매력', title: '위탁 서류로서 매력적인가', desc: '심사위원 눈으로 본 설득력' },
];

/** 1차시 자기소개서 인터뷰 칸 이름 (introForm의 key → 사람이 읽는 이름) */
export const INTRO_LABELS = {
  years: '경력 연수',
  reason: '지원의 핵심 이유',
  philosophy: '보육철학',
  career: '주요 경력',
  expertise: '자신 있는 전문 영역',
  achievement: '자랑스러운 성과',
  slogan: '운영 슬로건',
  pillars: '운영의 3가지 축',
  firstYear: '첫 해에 정착시킬 것',
};

/** 시작 화면 질문 (answers의 key → 이름) */
export const START_LABELS = {
  career: '전체 경력',
  reason: '국공립 원장이 되려는 이유',
};

export const GRADES = {
  좋음: { color: '#2e7d5b', bg: '#eaf5ef', label: '좋음' },
  보통: { color: '#a07a2c', bg: '#fbf4e3', label: '보통' },
  보완필요: { color: '#b5651d', bg: '#fdf0e4', label: '보완 필요' },
};

export const STATUS = {
  있음: { color: '#2e7d5b', bg: '#eaf5ef' },
  반영됨: { color: '#2e7d5b', bg: '#eaf5ef' },
  좋음: { color: '#2e7d5b', bg: '#eaf5ef' },
  순서다름: { color: '#a07a2c', bg: '#fbf4e3' },
  일부반영: { color: '#a07a2c', bg: '#fbf4e3' },
  부족: { color: '#a07a2c', bg: '#fbf4e3' },
  없음: { color: '#b5651d', bg: '#fdf0e4' },
  안됨: { color: '#b5651d', bg: '#fdf0e4' },
  문제: { color: '#b5651d', bg: '#fdf0e4' },
  보완: { color: '#b5651d', bg: '#fdf0e4' },
};

/**
 * 수강생이 앱에 적어 둔 것들을 AI에게 보여 줄 글로 만든다.
 * (1차시 인터뷰 + 시작 질문 + 5차시 취약보육 선택 + 6차시 참여수업 주제)
 */
export function interviewText(d, vulnAreas) {
  const lines = [];
  const form = d.introForm || {};
  for (const [k, label] of Object.entries(INTRO_LABELS)) {
    const v = String(form[k] || '').trim();
    if (v) lines.push(`- ${label}: ${v}`);
  }
  const ans = d.answers || {};
  for (const [k, label] of Object.entries(START_LABELS)) {
    const v = String(ans[k] || '').trim();
    if (v && !form[k]) lines.push(`- ${label}: ${v}`);
  }
  if (Array.isArray(vulnAreas) && vulnAreas.length) {
    lines.push(`- 5차시에서 고른 취약보육 영역: ${vulnAreas.join(', ')}`);
  }
  const p = d.parentStep || {};
  const theme = p.customTheme || p.theme;
  if (theme) lines.push(`- 6차시 학부모 참여수업 주제: ${theme}`);
  return lines.join('\n');
}

/** "###항목 / ###총평 / ###우선" 구분자 형식 → 결과 객체 */
export function parseReview(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n');
  const blocks = text
    .split(/^###/m)
    .map((b) => b.trim())
    .filter(Boolean);

  const items = [];
  const summaries = {};
  const priorities = [];

  for (const b of blocks) {
    const nl = b.indexOf('\n');
    const kind = (nl === -1 ? b : b.slice(0, nl)).trim();
    const body = nl === -1 ? '' : b.slice(nl + 1);
    const grab = (label) => {
      const m = body.match(new RegExp(`^${label}\\s*[:：]\\s*(.+)$`, 'm'));
      return m ? m[1].trim() : '';
    };

    if (kind.startsWith('항목')) {
      const area = grab('영역').replace(/\s.*$/, '');
      if (!area) continue;
      items.push({
        area,
        name: grab('이름'),
        status: grab('상태').replace(/\s+/g, ''),
        page: grab('쪽').replace(/[^\d~,\-]/g, ''),
        note: grab('설명'),
      });
    } else if (kind.startsWith('총평')) {
      const area = grab('영역').replace(/\s.*$/, '');
      if (!area) continue;
      const g = grab('등급').replace(/\s+/g, '');
      summaries[area] = {
        grade: GRADES[g] ? g : g.includes('보완') ? '보완필요' : g.includes('좋') ? '좋음' : '보통',
        score: Number((grab('점수').match(/\d+(\.\d+)?/) || [])[0]) || 0,
        text: grab('요약'),
      };
    } else if (kind.startsWith('우선')) {
      const t = grab('내용');
      if (t) priorities.push(t);
    }
  }
  return { items, summaries, priorities };
}

/** 1·2부 결과를 하나로 합친다 */
export function mergeReview(a, b) {
  return {
    items: [...(a?.items || []), ...(b?.items || [])],
    summaries: { ...(a?.summaries || {}), ...(b?.summaries || {}) },
    priorities: [...(a?.priorities || []), ...(b?.priorities || [])],
  };
}
