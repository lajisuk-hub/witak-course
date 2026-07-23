// 6차시 · 학부모 참여수업
// 우리 원 특색과 연계된 부모·가족 참여 프로그램을 AI가 작성한다.
// 입력: { theme, items: [{ target, freq }] }
// 출력: { programs: [{ name, detail }] }  (items 순서대로)
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;
const MODEL = 'claude-sonnet-5';

// 긴 글 + 여러 개라 JSON 대신 구분자로 받는다 (AI JSON 깨짐 교훈)
function parseBlocks(raw) {
  const s = String(raw || '').replace(/\r\n/g, '\n');
  const parts = s.split(/===\s*\d+\s*===/).map((x) => x.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    const nameM = p.match(/이름\s*[:：]\s*(.+)/);
    const detailM = p.match(/내용\s*[:：]\s*([\s\S]+)/);
    if (nameM && detailM) {
      out.push({
        name: nameM[1].trim().replace(/["“”]/g, ''),
        detail: detailM[1].trim().replace(/["“”]/g, '').replace(/\s*\n\s*/g, ' '),
      });
    }
  }
  return out;
}

export async function POST(req) {
  try {
    const { theme = '', items = [] } = await req.json();

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: 'AI 열쇠(ANTHROPIC_API_KEY)가 설정되지 않았습니다.' }, { status: 500 });
    }
    if (!theme.trim()) {
      return Response.json({ error: '먼저 우리 원 특색을 골라 주세요.' }, { status: 400 });
    }
    const list = Array.isArray(items) ? items.filter((it) => it && it.target) : [];
    if (list.length < 1) {
      return Response.json({ error: '참여 프로그램을 최소 1가지 이상 추가해 주세요.' }, { status: 400 });
    }

    const lines = list
      .map((it, i) => `${i + 1}) 대상: ${it.target} / 횟수: ${it.freq || '연 2회'}`)
      .join('\n');

    const prompt = `너는 국공립어린이집 위탁 심사를 오래 지도해 온 컨설턴트다.
우리 어린이집의 특색(대표 보육 프로그램)은 「${theme}」이다.

아래 각 항목마다, 이 특색과 **연계된** 부모·가족 참여 프로그램을 하나씩 만들어라.
${lines}

작성 규칙:
1. 각 프로그램은 우리 원 특색 「${theme}」과 자연스럽게 연결되어야 한다. (특색을 가정·부모 참여로 확장하는 방식)
2. 대상(아빠/조부모/부모/온 가족)의 성격을 살린다. 예: 아빠=아버지 양육 참여·부자유대, 조부모=세대공감·전통, 온 가족=가족 유대.
3. 내용에는 **무엇을 어떻게 하는지 + 정해진 횟수 + 특색과의 연계 + 기대효과**가 드러나야 한다.
4. 이름은 12자 안팎의 프로그램명. 내용은 2~3문장, 평서문(~한다) 체. 심사위원이 읽는 공적 문서다.
5. 실제로 운영 가능한 현실적인 활동으로 쓴다. 없는 예산·시설을 전제하지 마라.
6. 큰따옴표(")는 절대 쓰지 마라.

출력 형식(구분선을 그대로 쓰고 다른 설명은 붙이지 마라):
===1===
이름: (프로그램명)
내용: (2~3문장)
===2===
이름: ...
내용: ...
(항목 수만큼 이어서)`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    });

    const raw = msg.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
    const programs = parseBlocks(raw);

    if (!programs.length) {
      console.error('참여프로그램 파싱 실패:', msg.stop_reason, raw.slice(0, 400));
      const why =
        msg.stop_reason === 'max_tokens'
          ? '글이 너무 길어져 끊겼습니다. 다시 눌러 주세요.'
          : '작성하지 못했습니다. 잠시 뒤 다시 눌러 주세요.';
      return Response.json({ error: why }, { status: 500 });
    }

    // items 수에 맞춰 반환 (부족하면 있는 만큼)
    return Response.json({ programs: programs.slice(0, list.length) });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message || '알 수 없는 오류' }, { status: 500 });
  }
}
