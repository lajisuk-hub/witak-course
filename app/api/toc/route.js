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
    // 흔한 깨짐: 뒤에 붙은 쉼표
    try {
      return JSON.parse(s.replace(/,\s*([}\]])/g, '$1'));
    } catch {
      return null;
    }
  }
}

export async function POST(req) {
  try {
    const { kind, text, base64, sections } = await req.json();

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: 'AI 열쇠(ANTHROPIC_API_KEY)가 설정되지 않았습니다.' }, { status: 500 });
    }

    const list = (sections || [])
      .map((s) => `- id: ${s.id} / 이름: ${s.name} / 관련어: ${(s.keywords || []).join(', ')}`)
      .join('\n');

    const instruction = `너는 국공립어린이집 위탁 제출서류를 정리하는 도우미다.

아래는 어느 지방자치단체의 "위탁 운영체 모집 공고문"이다.
여기에서 **제출해야 하는 서류의 목차(항목 목록)**를 순서대로 뽑아라.

규칙:
1. 공고문에 적힌 순서와 이름을 그대로 살린다. 번호(①②, 1.2. 등)는 떼고 이름만 남긴다.
2. 큰 항목 아래 작은 항목이 있으면 작은 항목까지 각각 하나씩 넣는다.
3. 서류 목록이 아닌 문장(일정, 문의처, 심사방법 등)은 넣지 않는다.
4. 각 항목마다, 아래 "샘플 꼭지 목록"에서 가장 잘 맞는 것 하나의 id를 matchId 에 넣는다.
   확실히 맞는 것이 없으면 matchId 는 null 로 둔다. 억지로 맞추지 마라.
5. 큰따옴표(")는 값 안에 절대 쓰지 마라.

샘플 꼭지 목록:
${list}

반드시 아래 형식의 JSON만 출력하라. 설명 문장은 쓰지 마라.
{"cityName":"○○시","items":[{"name":"항목 이름","matchId":"샘플id 또는 null"}]}`;

    const content = [];
    if (kind === 'pdf' && base64) {
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      });
      content.push({ type: 'text', text: instruction });
    } else {
      content.push({
        type: 'text',
        text: `${instruction}\n\n--- 공고문 내용 ---\n${String(text || '').slice(0, 60000)}`,
      });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content }],
    });

    const raw = msg.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
    const data = extractJson(raw);

    if (!data || !Array.isArray(data.items) || !data.items.length) {
      if (msg.stop_reason === 'max_tokens') {
        return Response.json(
          { error: '공고문 내용이 너무 길어 중간에 끊겼습니다. 목차 부분만 붙여넣어 주세요.' },
          { status: 500 }
        );
      }
      console.error('목차 파싱 실패:', raw.slice(0, 500));
      return Response.json(
        { error: '공고문에서 목차를 찾지 못했습니다. 목차 부분만 복사해 붙여넣어 주세요.' },
        { status: 500 }
      );
    }

    return Response.json({
      cityName: data.cityName || '',
      items: data.items
        .filter((it) => it && it.name)
        .map((it) => ({
          name: String(it.name).trim(),
          matchId: it.matchId && it.matchId !== 'null' ? String(it.matchId) : null,
        })),
    });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message || '알 수 없는 오류' }, { status: 500 });
  }
}
