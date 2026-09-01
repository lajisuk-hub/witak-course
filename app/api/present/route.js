// 9차시 · 심사 발표자료 만들기
// 수강생이 올린 위탁 서류 전문에서 원장님이 정한 10꼭지를 뽑아
// 슬라이드 내용(제목·소제목·불릿)과 발표 대본을 만든다.
//
// · 한 번에 10꼭지를 다 만들면 60초 제한에 걸리므로 1부(1~5)·2부(6~10)로 나눠 부른다.
// · AI에게 JSON을 시키면 따옴표 때문에 깨진다 → 구분자 형식으로 받아 서버에서 파싱한다.
import Anthropic from '@anthropic-ai/sdk';
import { PART1, PART2, scriptCharRange, scriptSentences } from '@/lib/presentPlan';

export const maxDuration = 60;
const MODEL = 'claude-sonnet-5';
const SRC_LIMIT = 30000; // 서류가 아주 길면 앞부분만 본다

function sourceBlock(sourceText) {
  const s = String(sourceText || '').trim();
  if (s.length < 30) return null;
  return s.slice(0, SRC_LIMIT);
}

function buildPrompt({ sections, source, center, applicant, city }) {
  const list = sections
    .map((s) => {
      const [lo, hi] = scriptCharRange(s.seconds);
      return (
        `[${s.no}] ${s.title}${s.sub ? ` (${s.sub})` : ''}\n` +
        `  · 담을 내용: ${s.guide}\n` +
        `  · 발표 시간 ${s.seconds}초 → 대본은 ${scriptSentences(s.seconds)}문장, ` +
        `${lo}자 이상 ${hi}자 이하 (빈칸 포함)`
      );
    })
    .join('\n');

  return `당신은 국공립어린이집 신규위탁 심사 발표를 도와주는 전문가입니다.
아래 [위탁 서류]는 지원자가 실제로 제출할 서류 전문입니다.
이 서류에서 근거를 찾아 심사위원 앞에서 쓸 발표 슬라이드를 만들어 주세요.

어린이집 이름: ${center || '(서류에서 찾으세요)'}
지원자 이름: ${applicant || '(서류에서 찾으세요)'}
지원 지역: ${city || '(서류에서 찾으세요)'}

=== 위탁 서류 ===
${source}
=== 서류 끝 ===

만들 슬라이드
${list}

지켜야 할 것
1. 서류에 있는 사실(숫자, 프로그램 이름, 경력 연수, 예산 금액)을 그대로 살려 쓰세요. 서류에 없는 내용을 지어내면 안 됩니다.
2. 서류에서 근거를 못 찾은 꼭지는 불릿 자리에 (서류에서 찾지 못했습니다 - 직접 채워 주세요) 라고만 적으세요.
3. 큰따옴표를 쓰지 마세요. 강조가 필요하면 홑따옴표를 쓰세요.
4. 불릿은 슬라이드마다 3~5개, 한 줄에 25자를 넘기지 마세요. 문장이 아니라 핵심 어구로 적으세요.
5. 소제목은 그 슬라이드를 한 줄로 요약한 20자 이내의 문구입니다.
6. 대본은 발표자가 실제로 소리 내어 읽는 말(합니다·습니다 말투)입니다. 줄바꿈 없이 한 문단으로 쓰세요.
6-1. 대본 길이는 발표 시간과 직결됩니다. 꼭지마다 정해 준 문장 수와 글자 수를 반드시 지키세요. 짧게 쓰면 안 됩니다.
6-2. 한 문장은 25자에서 40자 사이로 짧고 또렷하게 쓰세요. 길게 늘이지 마세요. 길이가 모자라면 서류에 있는 구체적인 사실(숫자, 프로그램 이름, 성과, 운영 방법, 그렇게 하는 까닭)을 더 넣어 채우세요.
7. 대본에 슬라이드 번호나 안내문을 넣지 마세요. 바로 말할 내용만 쓰세요.

아래 형식 그대로만 출력하세요. 다른 말은 절대 쓰지 마세요.

###SLIDE
번호: 1
제목: 원장 소개
소제목: 한 줄 요약
불릿: 첫째 항목
불릿: 둘째 항목
불릿: 셋째 항목
대본: 실제로 읽을 말
###SLIDE
번호: 2
...`;
}

/** 구분자 형식 → 슬라이드 배열 */
function parseSlides(raw, sections) {
  const text = String(raw || '').replace(/\r\n/g, '\n');
  const blocks = text
    .split('###SLIDE')
    .map((b) => b.trim())
    .filter(Boolean);

  const out = [];
  for (const b of blocks) {
    const grab = (label) => {
      const m = b.match(new RegExp(`^${label}\\s*[:：]\\s*(.+)$`, 'm'));
      return m ? m[1].trim() : '';
    };
    const bullets = [];
    const re = /^불릿\s*[:：]\s*(.+)$/gm;
    let m;
    while ((m = re.exec(b))) bullets.push(m[1].trim().replace(/^[-·•]\s*/, ''));

    const no = parseInt(grab('번호'), 10);
    const plan = sections.find((s) => s.no === no);
    if (!plan) continue;

    out.push({
      no,
      title: grab('제목') || plan.title,
      sub: grab('소제목') || plan.sub || '',
      bullets: bullets.length ? bullets : ['(서류에서 찾지 못했습니다 - 직접 채워 주세요)'],
      script: grab('대본'),
      seconds: plan.seconds,
    });
  }
  return out.sort((a, b) => a.no - b.no);
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
    const source = sourceBlock(body.sourceText);
    if (!source) {
      return Response.json(
        { error: '위탁 서류 내용이 없습니다. 파일을 올리거나 내용을 붙여넣어 주세요.' },
        { status: 400 }
      );
    }

    const sections = Number(body.part) === 2 ? PART2 : PART1;
    const prompt = buildPrompt({
      sections,
      source,
      center: body.center,
      applicant: body.applicant,
      city: body.city,
    });

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 5000,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    });
    const text = msg.content.map((c) => (c.type === 'text' ? c.text : '')).join('');

    const slides = parseSlides(text, sections);
    if (!slides.length) {
      return Response.json(
        { error: '발표자료를 만들지 못했습니다. 잠시 뒤 다시 눌러 주세요.' },
        { status: 502 }
      );
    }
    return Response.json({ slides });
  } catch (err) {
    return Response.json({ error: err.message || '알 수 없는 오류' }, { status: 500 });
  }
}
