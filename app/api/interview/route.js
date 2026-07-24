// 8차시 · 면접 코칭
// 원본 앱(lajisuk-hub/wmentor-interview-prep)의 3개 라우트를 하나로 합쳐 옮겨 왔다.
//   mode = 'recommend' → 7개 영역을 순서대로, 쉬움/복합 번갈아 질문 1개
//   mode = 'custom'    → 수강생이 적은 키워드로 질문 1개
//   mode = 'answer'    → 추천 답안 + 내 답변 피드백
//
// AI 응답은 JSON 대신 구분자로 받는다 (JSON이 따옴표 때문에 깨지는 교훈).
import Anthropic from '@anthropic-ai/sdk';
import { planForRecommend } from '@/lib/interviewAreas';

export const maxDuration = 60;
const MODEL = 'claude-sonnet-5';

function sourceBlock(sourceText, limit) {
  const s = String(sourceText || '');
  return s.length >= 30
    ? `\n=== 위탁심사 자료 ===\n${s.slice(0, limit)}\n=== 자료 끝 ===`
    : '\n(올린 위탁심사 자료가 없습니다. 일반적인 국공립 어린이집 면접 기준으로 작성하세요.)';
}

function askedBlock(asked) {
  const list = Array.isArray(asked) ? asked : [];
  if (!list.length) return '';
  return (
    '\n\n=== 이미 물어본 질문 (겹치지 마세요) ===\n' +
    list.map((q, i) => `${i + 1}. ${q}`).join('\n')
  );
}

async function ask(prompt, maxTokens) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: 'disabled' },
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
  });
  return {
    text: msg.content.map((c) => (c.type === 'text' ? c.text : '')).join('').trim(),
    stop: msg.stop_reason,
  };
}

// "질문:" 뒤 한 덩어리만 뽑는다 (앞뒤 군더더기 제거)
function pickQuestion(raw) {
  const s = String(raw || '').replace(/\r\n/g, '\n').trim();
  const m = s.match(/질문\s*[:：]\s*([\s\S]+)/);
  const body = (m ? m[1] : s).trim();
  return body.split('\n').map((x) => x.trim()).filter(Boolean)[0] || '';
}

export async function POST(req) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { error: 'AI 열쇠(ANTHROPIC_API_KEY)가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const mode = String(body.mode || '');
    const sourceText = body.sourceText || '';

    // ── 추천 질문 ──
    if (mode === 'recommend') {
      const { area, level } = planForRecommend(Number(body.recommendCount) || 1);
      const levelGuide =
        level === 'easy'
          ? '이번 질문은 [쉬운 질문]이다. 한 가지만 묻는 단순하고 직관적인 질문으로 만들어라. 여러 요소를 한 문장에 엮지 마라. 예: 우리 어린이집에 지원하신 동기는 무엇인가요?'
          : '이번 질문은 [복합 질문]이다. 자료의 구체적 내용에 근거해 계획의 배경·실제 운영 방식·기대 효과를 함께 묻는 심층 질문으로 만들어라.';

      const prompt = `너는 국공립 어린이집 신규위탁 심사위원이다.
아래 위탁심사 자료를 꼼꼼히 읽고, 실제 면접에서 나올 법한 질문을 하나만 만들어라.
질문은 반드시 아래 [질문 영역]에 해당해야 하고, 자료 내용에 근거해야 한다.
${levelGuide}
큰따옴표(")는 쓰지 마라.
${sourceBlock(sourceText, 12000)}

=== 질문 영역 ===
${area.key} : ${area.guide}${askedBlock(body.askedQuestions)}

출력 형식(다른 설명 없이 이 한 줄만):
질문: (질문 내용)`;

      const { text } = await ask(prompt, 800);
      const question = pickQuestion(text);
      if (!question) {
        return Response.json({ error: '질문을 만들지 못했습니다. 다시 눌러 주세요.' }, { status: 500 });
      }
      return Response.json({ category: area.key, level, question, source: 'recommend' });
    }

    // ── 직접 질문 ──
    if (mode === 'custom') {
      const keyword = String(body.keyword || '').trim();
      if (keyword.length < 2) {
        return Response.json({ error: '연습하고 싶은 키워드나 질문을 적어 주세요.' }, { status: 400 });
      }

      const prompt = `너는 국공립 어린이집 신규위탁 심사위원이다.
응시자가 적은 아래 [키워드/질문]의 주제 안에서만 면접 질문을 하나 만들어라.
적지 않은 다른 주제로 확장하지 마라.
이미 완성된 질문 문장을 적었다면 그 의도를 살려 면접 질문으로 다듬어라.
자료가 있으면 그 어린이집의 맥락을 반영하라. 큰따옴표(")는 쓰지 마라.
${sourceBlock(sourceText, 10000)}

=== 응시자가 적은 키워드/질문 ===
${keyword}${askedBlock(body.askedQuestions)}

출력 형식(다른 설명 없이 이 한 줄만):
질문: (질문 내용)`;

      const { text } = await ask(prompt, 800);
      const question = pickQuestion(text);
      if (!question) {
        return Response.json({ error: '질문을 만들지 못했습니다. 다시 눌러 주세요.' }, { status: 500 });
      }
      return Response.json({
        category: `직접 질문: ${keyword}`,
        level: 'deep',
        question,
        source: 'custom',
      });
    }

    // ── 추천 답안 + 피드백 ──
    if (mode === 'answer') {
      const question = String(body.question || '');
      const myAnswer = String(body.myAnswer || '').trim();

      const prompt = `너는 국공립 어린이집 신규위탁 면접을 오래 지도해 온 컨설턴트다.
응시자의 답변을 평가하고, 위탁심사 자료에 근거한 모범 답안을 제시하라.
보건복지부 보육 정책과 표준보육과정·누리과정의 관점을 반영하라.
큰따옴표(")는 쓰지 마라.
${sourceBlock(sourceText, 8000)}

=== 심사위원 질문 ===
${question}

=== 응시자 답변 ===
${myAnswer || '(답변 없음)'}

출력 형식(구분선을 그대로 쓰고 다른 설명은 붙이지 마라):
===추천답안===
(면접에서 그대로 말할 수 있는 자연스러운 구어체 3~5문장)
===피드백===
(잘한 점 1가지 + 보완할 점 1~2가지)`;

      const { text, stop } = await ask(prompt, 2000);
      const s = text.replace(/\r\n/g, '\n');
      const rm = s.match(/===\s*추천답안\s*===\s*([\s\S]*?)(?====\s*피드백\s*===|$)/);
      const fm = s.match(/===\s*피드백\s*===\s*([\s\S]*)$/);
      const recommended = (rm ? rm[1] : '').trim();
      const feedback = (fm ? fm[1] : '').trim();

      if (!recommended) {
        console.error('면접 답안 파싱 실패:', stop, s.slice(0, 300));
        return Response.json(
          {
            error:
              stop === 'max_tokens'
                ? '글이 너무 길어져 끊겼습니다. 다시 눌러 주세요.'
                : '답안을 만들지 못했습니다. 잠시 뒤 다시 눌러 주세요.',
          },
          { status: 500 }
        );
      }
      return Response.json({ recommended, feedback: feedback || '(피드백 없음)' });
    }

    return Response.json({ error: '알 수 없는 요청입니다.' }, { status: 400 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message || '오류가 발생했습니다.' }, { status: 500 });
  }
}
