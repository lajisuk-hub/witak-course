// 7차시 · 완성 서류 점검
// 수강생이 정리한 전체 서류(PDF 글자)를 받아 네 갈래로 살펴본다.
//   part = 'structure' → 목차 맞춤 + 번호 순서
//   part = 'content'   → 인터뷰 반영 + 위탁 서류로서의 매력
// 한 번에 다 보면 60초 제한에 걸리므로 두 부분을 나눠 동시에 부른다.
//
// AI에게 JSON을 시키면 따옴표 때문에 깨진다 → ### 구분자 형식으로 받아 lib/reviewPlan.js에서 파싱.
import Anthropic from '@anthropic-ai/sdk';
import { parseReview } from '@/lib/reviewPlan';

export const maxDuration = 60;
const MODEL = 'claude-sonnet-5';
// 완성 서류는 70쪽·8만 자가 보통이다. 앞부분만 보면 뒤쪽을 못 찾는다 (9차시 2026-09-23 교훈).
const SRC_LIMIT = 150000;

function header({ center, applicant, city }) {
  return `당신은 국공립어린이집 신규위탁 심사위원 경험이 많은 전문가입니다.
아래 [위탁 서류]는 지원자가 지자체에 제출하려고 정리한 서류 전문입니다.
글자는 PDF에서 뽑은 것이라 표·그림은 글자만 남아 있고, [쪽 N] 표시는 그 줄부터 N쪽이라는 뜻입니다.

어린이집 이름: ${center || '(서류에서 찾으세요)'}
지원자 이름: ${applicant || '(서류에서 찾으세요)'}
지원 지역: ${city || '(서류에서 찾으세요)'}`;
}

const RULES = `지켜야 할 것
- 서류에 실제로 있는 것만 근거로 말하세요. 없는 내용을 지어내면 안 됩니다.
- 큰따옴표를 쓰지 마세요. 강조는 홑따옴표로 하세요.
- 설명은 한 줄(60자 안팎)로, 어린이집 원장님이 바로 알아듣게 쉬운 말로 쓰세요. 전문용어·영어 약자는 피하세요.
- 쪽 번호는 [쪽 N] 표시를 보고 적으세요. 모르면 - 로 적으세요.
- 아래 형식 그대로만 출력하세요. 형식 밖의 말은 절대 쓰지 마세요.`;

function structurePrompt({ source, toc, meta }) {
  const tocList = toc.length
    ? toc.map((n, i) => `${i + 1}. ${n}`).join('\n')
    : '(0차시에서 뽑은 목차가 없습니다. 서류 앞부분에 있는 서류 자체의 목차 쪽을 기준으로 삼으세요.)';

  return `${header(meta)}

=== 우리 지자체가 요구한 목차 (이 순서대로 정리돼야 합니다) ===
${tocList}
=== 목차 끝 ===

=== 위탁 서류 ===
${source}
=== 서류 끝 ===

할 일
A. 목차 대조 — 위 목차 항목 하나하나에 대해 서류에 그 내용이 있는지, 몇 쪽에 있는지, 목차 순서대로 나오는지 살피세요.
   상태는 다음 중 하나: 있음(그 자리에 잘 있음) / 순서다름(있는데 순서가 어긋남) / 부족(있긴 한데 내용이 한두 줄뿐이거나 제목만 있음) / 없음(서류에서 찾을 수 없음).
   목차 항목마다 ###항목 블록을 하나씩, 목차 순서대로 모두 쓰세요. 하나도 빠뜨리면 안 됩니다.
   목차에는 없는데 서류에 들어 있는 큰 꼭지가 있으면 이름 앞에 [목차에 없음] 을 붙여 ###항목 블록을 추가하세요(상태: 순서다름).
B. 번호 순서 — 서류의 장·절 번호(Ⅰ Ⅱ, 1. 2., 가. 나., 1) 2), ① ②)가 건너뛰거나 겹치거나 단계가 뒤섞인 곳, 같은 제목이 두 번 나오는 곳, 쪽 순서가 목차와 어긋나는 곳을 찾으세요.
   문제 하나마다 ###항목 블록(영역: 번호, 상태: 문제)을 쓰세요. 문제가 없으면 이름 '문제 없음', 상태 '있음'으로 한 블록만 쓰세요.
   표 안의 번호(월별 계획표의 1~12, 예산 항목 번호)는 살피지 않습니다. 본문 제목 번호만 봅니다.
C. 총평 — 목차·번호 각각 등급(좋음/보통/보완필요)과 두 문장 요약.
D. 우선 — 지금 바로 고쳐야 할 것을 중요한 순서로 최대 3개. 어디(쪽·항목)를 어떻게 고칠지 한 줄로.

${RULES}

###항목
영역: 목차
이름: (목차 항목 이름 그대로)
상태: 있음
쪽: 12
설명: (한 줄)
###항목
영역: 번호
이름: (쪽 N, 문제가 있는 제목 문구)
상태: 문제
쪽: N
설명: (무엇이 어긋났고 어떻게 고칠지)
###총평
영역: 목차
등급: 좋음
요약: (두 문장)
###총평
영역: 번호
등급: 보통
요약: (두 문장)
###우선
내용: (한 줄)
###우선
내용: (한 줄)`;
}

function contentPrompt({ source, interview, meta }) {
  const iv = interview
    ? interview
    : '(앱에 적어 둔 인터뷰 내용이 없습니다. 인터뷰 영역은 이름 (인터뷰 없음), 상태 안됨, 설명 1차시 자기소개서 인터뷰를 먼저 적어 주세요 로 한 블록만 쓰세요.)';

  return `${header(meta)}

=== 지원자가 이 앱의 인터뷰에서 직접 적은 내용 ===
${iv}
=== 인터뷰 끝 ===

=== 위탁 서류 ===
${source}
=== 서류 끝 ===

할 일
A. 인터뷰 반영 — 위 인터뷰 항목 하나하나가 서류 어디에 어떻게 살아 있는지 살피세요.
   상태는 다음 중 하나: 반영됨(서류에 그 내용이 분명히 있음) / 일부반영(비슷한 말은 있으나 인터뷰의 핵심이 빠짐) / 안됨(서류에서 찾을 수 없음).
   설명에는 반영됐으면 어느 쪽 어느 부분인지, 안 됐으면 어느 꼭지에 어떤 문장으로 넣으면 좋을지 적으세요.
   인터뷰 항목마다 ###항목 블록을 하나씩 모두 쓰세요.
B. 위탁 서류로서의 매력 — 심사위원 눈으로 읽었을 때의 설득력을 5점 만점으로 매기고,
   강점(잘 살린 부분) 3개와 보완(고치면 점수가 오를 부분) 3~5개를 쓰세요.
   보완은 '어디를 어떻게'가 분명해야 합니다. 예) 특색프로그램에 기대 효과(아이의 변화)를 두 줄 보태세요.
   특히 살필 것: 지원 지역·어린이집에 맞춘 내용인지(다른 원 이름·지역명이 남아 있지 않은지), 숫자(정원·경력·예산)가 앞뒤로 같은지, 앞부분의 철학·슬로건이 뒤 계획까지 이어지는지, 심사위원이 첫 장에서 지원자의 강점을 바로 알 수 있는지.
C. 총평 — 인터뷰·매력 각각 등급(좋음/보통/보완필요)과 두 문장 요약. 매력에는 점수도 적으세요.
D. 우선 — 지금 바로 고쳐야 할 것을 중요한 순서로 최대 3개. 어디(쪽·항목)를 어떻게 고칠지 한 줄로.

${RULES}

###항목
영역: 인터뷰
이름: (인터뷰 항목 이름 그대로)
상태: 반영됨
쪽: 3
설명: (한 줄)
###항목
영역: 매력
이름: 강점
상태: 좋음
쪽: 5
설명: (한 줄)
###항목
영역: 매력
이름: 보완
상태: 보완
쪽: 20
설명: (어디를 어떻게)
###총평
영역: 인터뷰
등급: 보통
요약: (두 문장)
###총평
영역: 매력
등급: 좋음
점수: 4
요약: (두 문장)
###우선
내용: (한 줄)`;
}

export async function POST(req) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { error: 'AI 열쇠(ANTHROPIC_API_KEY)가 설정되지 않았습니다. 라지숙 소장에게 문의해 주세요.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const full = String(body.sourceText || '').trim();
    if (full.length < 30) {
      return Response.json(
        { error: '서류 내용이 없습니다. 정리한 서류를 PDF로 저장해 올려 주세요.' },
        { status: 400 }
      );
    }
    const source = full.slice(0, SRC_LIMIT);
    const truncated = full.length > SRC_LIMIT;

    const meta = { center: body.center, applicant: body.applicant, city: body.city };
    const toc = (Array.isArray(body.toc) ? body.toc : [])
      .map((t) => (typeof t === 'string' ? t : t && t.name) || '')
      .map((s) => s.trim())
      .filter(Boolean);

    const prompt =
      body.part === 'content'
        ? contentPrompt({ source, interview: String(body.interview || '').trim(), meta })
        : structurePrompt({ source, toc, meta });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 6000,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    });
    const text = msg.content.map((c) => (c.type === 'text' ? c.text : '')).join('');

    const result = parseReview(text);
    if (!result.items.length && !Object.keys(result.summaries).length) {
      return Response.json(
        { error: '점검 결과를 만들지 못했습니다. 잠시 뒤 다시 눌러 주세요.' },
        { status: 502 }
      );
    }
    return Response.json({ ...result, truncated });
  } catch (err) {
    return Response.json({ error: err.message || '알 수 없는 오류' }, { status: 500 });
  }
}
