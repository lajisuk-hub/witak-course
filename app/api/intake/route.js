// 시작 인터뷰 답변을 읽고, 이 수강생의 강점·약점과 한 달 공부 일정을 만들어 준다.
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

const MODEL = 'claude-sonnet-5';

function extractJson(text) {
  if (!text) return null;
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  s = s.slice(start, end + 1);
  try {
    return JSON.parse(s);
  } catch {
    try {
      return JSON.parse(s.replace(/,\s*([}\]])/g, '$1'));
    } catch {
      return null;
    }
  }
}

export async function POST(req) {
  try {
    const { profile = {}, answers = {} } = await req.json();

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { error: 'AI 열쇠(ANTHROPIC_API_KEY)가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const prompt = `너는 국공립어린이집 신규위탁 심사를 오래 지도해 온 컨설턴트다.
아래는 이번 과정에 참여한 원장 지원자가 쓴 시작 인터뷰 답변이다.

[지원자]
- 이름: ${profile.name || '(미기재)'}
- 현재 지역: ${profile.region || '(미기재)'}
- 지원하고 싶은 지역: ${profile.targetRegion || '(미기재)'}

[답변]
1) 전체 경력
${answers.career || '(미기재)'}

2) 국공립 원장이 되고자 하는 이유
${answers.reason || '(미기재)'}

3) 이번 지원에서 가장 걱정되는 부분
${answers.worry || '(미기재)'}

4) 가장 도움받고 싶은 부분
${answers.help || '(미기재)'}

할 일:
1. 이 사람의 **강점**을 3가지 뽑는다. 답변에 실제로 나온 근거를 들어 구체적으로 쓴다.
2. 이 사람의 **보완이 필요한 점**을 3가지 뽑는다. 기죽이지 말고, 심사에서 불리해질 수 있는 지점을 솔직하되 따뜻하게 쓴다.
3. 이 과정에서 **특히 확실하게 공부하면 좋을 것** 3가지를 뽑는다. 위 약점과 이어지게 쓴다.
4. **한 달(4주) 공부 일정**을 만든다. 주마다 무엇을 할지 이 과정의 차시와 맞물리게 쓴다.
   과정 차시: 0 목차만들기 / 1 자기소개서 / 2 회계(세입세출) / 3 연간-월간-하루일지 /
   4 특색프로그램 / 5 취약보육 / 6 학부모참여수업 / 7 전체보충 / 8 목차·표지 / 9 면접 / 10 발표

말투: 원장님을 존중하는 따뜻한 존댓말. 어려운 전문용어는 쓰지 않는다.
큰따옴표(")는 값 안에 절대 쓰지 마라.

반드시 아래 형식의 JSON만 출력하라. 설명 문장은 쓰지 마라.
{"summary":"두 문장 정도의 총평",
 "strengths":["강점1","강점2","강점3"],
 "weaknesses":["보완점1","보완점2","보완점3"],
 "focus":["확실히 공부할 것1","2","3"],
 "plan":[{"week":"1주차","title":"주제","todo":"이번 주에 할 일"}]}`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    });

    const raw = msg.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
    const data = extractJson(raw);

    if (!data || !Array.isArray(data.strengths)) {
      console.error('시작 인터뷰 파싱 실패:', raw.slice(0, 500));
      return Response.json(
        { error: '분석 결과를 읽지 못했습니다. 잠시 뒤 다시 눌러 주세요.' },
        { status: 500 }
      );
    }

    const arr = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);

    return Response.json({
      summary: String(data.summary || '').trim(),
      strengths: arr(data.strengths),
      weaknesses: arr(data.weaknesses),
      focus: arr(data.focus),
      plan: (Array.isArray(data.plan) ? data.plan : [])
        .filter((p) => p && (p.week || p.title))
        .map((p) => ({
          week: String(p.week || '').trim(),
          title: String(p.title || '').trim(),
          todo: String(p.todo || '').trim(),
        })),
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message || '알 수 없는 오류' }, { status: 500 });
  }
}
