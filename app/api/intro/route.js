// 1차시 · 자기소개서 초안 만들기
//
// 질문 구성·문단 구조·문체 3종·목표 분량은 원장님이 만드신
// "자기소개서 작성 도구 v0.6"을 그대로 따른다.
// 다른 점: 정해진 문장을 짜맞추지 않고 AI가 재료에 맞춰 직접 쓴다.
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

const MODEL = 'claude-sonnet-5';

const TONES = {
  standard: {
    name: '표준형',
    guide:
      '담백하고 정갈한 문어체. 본 지원자는~ 으로 시작하는 공적인 서술. 사실과 계획을 또렷하게 앞세운다.',
  },
  warm: {
    name: '진정성형',
    guide:
      '현장에서 겪은 마음이 묻어나는 따뜻한 문체. 아이들의 웃음, 부모의 신뢰 같은 표현을 쓰되, 감상 뒤에는 반드시 사실과 계획을 붙인다.',
  },
  formal: {
    name: '격식형',
    guide:
      '심사 서류에 어울리는 격식 있는 문체. 본인은~ 으로 서술하고, 이상의/정합한다 같은 공적 표현과 정책 용어를 적절히 쓴다.',
  },
};

// 보건복지부 보육교직원 8대 직무역량
const COMPETENCIES = [
  '영유아 발달 영역',
  '교수·학습 영역',
  '건강·안전 영역',
  '가족 및 지역사회 협력 영역',
  '운영·관리 영역',
  '평가 영역',
  '인성 및 소양 영역',
  '전문지식·기술 영역',
];

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
    const { form = {}, tone = 'standard', current = null, mode = 'write' } = await req.json();

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { error: 'AI 열쇠(ANTHROPIC_API_KEY)가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const t = TONES[tone] || TONES.standard;
    const centerName = form.centerName || '본 어린이집';

    const material = `[기본 정보]
- 성함: ${form.name || '(미기재)'}
- 지원하는 어린이집: ${form.centerName || '(미기재)'}
- 현재 경력 연수: ${form.years || '(미기재)'}

[지원동기 · 운영철학]
- 지원의 핵심 이유: ${form.reason || '(미기재)'}
- 본인의 보육철학: ${form.philosophy || '(미기재)'}

[보육경력 · 전문성]
- 주요 경력 요약: ${form.career || '(미기재)'}
- 가장 자신 있는 전문 영역: ${form.expertise || '(미기재)'}
- 가장 자랑스러운 성과: ${form.achievement || '(없음)'}

[운영 비전]
- 운영 슬로건: ${form.slogan || '(미기재)'}
- 운영의 3가지 축: ${form.pillars || '(미기재)'}
- 위탁 첫 해에 반드시 정착시킬 것: ${form.firstYear || '(미기재)'}`;

    const rules = `작성 규칙:
1. 읽는 사람은 국공립어린이집 신규위탁 심사위원이다. **원장으로서 자격이 충분하다**는 것이 드러나야 한다.
2. 위 재료는 키워드만 적혀 있을 수 있다. 키워드를 **자연스럽고 풍부한 완성 문장으로 풀어 쓴다.**
3. 세 문단으로 나눈다.
   para1 = 지원동기 및 보육철학
   para2 = 보육경력 및 전문성
   para3 = 운영 비전 및 실행 계획
   closing = 소제목 없는 맺음말 두세 문장. ${centerName}을 언급하며 마무리한다.
4. para1 과 para3 에는 **표준보육과정·누리과정이 지향하는 영유아 중심 보육**, 그리고
   **국공립어린이집의 공공성·책임성·전문성** 가치와 이어지는 문장을 자연스럽게 한 번씩 넣는다.
5. para2 에서는 지원자의 전문 영역이 **보건복지부 보육교직원 8대 직무역량** 중 어디에 해당하는지
   반드시 짚어 준다. 8대 역량은 다음과 같다: ${COMPETENCIES.join(' / ')}
   재료에 맞는 역량만 고르고, 억지로 여러 개를 붙이지 마라.
6. para3 의 운영 3가지 축은 재료에 적힌 순서대로 **줄바꿈으로 구분해** 쓴다.
7. 재료에 없는 경력·수상·자격·숫자를 지어내지 마라. 없는 것은 쓰지 않는다.
8. 세 문단과 맺음말을 합한 분량은 공백 제외 **850~950자**. 이 범위를 지켜라.
9. 문체: ${t.guide}
10. 모두 존댓말(~습니다/~하였습니다)로 쓴다. 이모지는 쓰지 마라.
11. 큰따옴표(")는 값 안에 절대 쓰지 마라. 강조가 필요하면 작은따옴표를 쓴다.

반드시 아래 형식의 JSON만 출력하라. 설명 문장은 쓰지 마라.
{"para1":"...","para2":"...","para3":"...","closing":"..."}`;

    const prompt =
      mode === 'polish' && current
        ? `너는 국공립어린이집 위탁 심사를 오래 지도해 온 컨설턴트다.
아래 자기소개서를 **${t.name} 문체로 다시 정리하라**. 없는 사실을 새로 지어내지 말고, 표현과 구성을 손봐라.

${material}

--- 지금 자기소개서 ---
1. 지원동기 및 보육철학
${current.para1 || ''}

2. 보육경력 및 전문성
${current.para2 || ''}

3. 운영 비전 및 실행 계획
${current.para3 || ''}

맺음말
${current.closing || ''}

${rules}`
        : `너는 국공립어린이집 위탁 심사를 오래 지도해 온 컨설턴트다.
아래 재료로 **자기소개서**를 써라.

${material}

${rules}`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    });

    const raw = msg.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
    const data = extractJson(raw);

    if (!data || !data.para1) {
      console.error('자기소개서 파싱 실패:', raw.slice(0, 500));
      return Response.json(
        { error: '글을 만들지 못했습니다. 잠시 뒤 다시 눌러 주세요.' },
        { status: 500 }
      );
    }

    const s = (v) => String(v == null ? '' : v).trim();

    return Response.json({
      tone,
      draft: {
        para1: s(data.para1),
        para2: s(data.para2),
        para3: s(data.para3),
        closing: s(data.closing),
      },
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message || '알 수 없는 오류' }, { status: 500 });
  }
}
