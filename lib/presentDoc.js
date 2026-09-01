'use client';

// 9차시 · 발표자료 파일 만들기 (브라우저에서 바로 만든다)
//   · PPT(.pptx) — 파워포인트에서 열어 고칠 수 있다. 대본은 각 장의 '슬라이드 노트'에 들어간다.
//   · 대본(.txt) — 따로 인쇄해서 연습하실 수 있게 글자만 모아 준다.

import { PRESENT_SECTIONS, coverScript, timeLabel, TOTAL_SECONDS } from './presentPlan';

// 파워포인트 만드는 도구는 우리 서버에 두고 쓴다 (바깥 CDN이 막히거나 바뀌어도 안전하다)
const PPTX_SRC = '/pptxgen.bundle.js';

const NAVY = '1A3A5C';
const NAVY_SOFT = '2C5580';
const GOLD = 'C89B4A';
const CREAM = 'FAF7F0';
const TEXT = '2B2B2B';
const FONT = '맑은 고딕';

/** 파워포인트 만드는 도구를 미리 받아 둔다 (단추를 누른 뒤 받으면 저장이 막힐 수 있다) */
export function preloadPptx() {
  if (typeof window === 'undefined' || window.PptxGenJS) return;
  if (document.querySelector(`script[data-src="${PPTX_SRC}"]`)) return;
  const s = document.createElement('script');
  s.src = PPTX_SRC;
  s.dataset.src = PPTX_SRC;
  document.head.appendChild(s);
}

async function loadPptx() {
  if (window.PptxGenJS) return window.PptxGenJS;
  await new Promise((resolve, reject) => {
    const found = document.querySelector(`script[data-src="${PPTX_SRC}"]`);
    if (found) {
      found.addEventListener('load', resolve);
      found.addEventListener('error', () => reject(new Error('발표자료 도구를 불러오지 못했습니다')));
      if (window.PptxGenJS) resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = PPTX_SRC;
    s.dataset.src = PPTX_SRC;
    s.onload = resolve;
    s.onerror = () => reject(new Error('발표자료 도구를 불러오지 못했습니다'));
    document.head.appendChild(s);
  });
  return window.PptxGenJS;
}

function two(n) {
  return String(n).padStart(2, '0');
}

/**
 * 슬라이드 내용으로 .pptx 파일(blob)을 만든다.
 * @param {object} o
 * @param {string} o.center    어린이집 이름
 * @param {string} o.applicant 지원자 이름
 * @param {string} o.city      지원 지역
 * @param {Array}  o.slides    [{no,title,sub,bullets,script,seconds}]
 */
export async function buildPptxBlob({ center, applicant, city, slides }) {
  const PptxGenJS = await loadPptx();
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9'; // 10 × 5.63 인치
  pptx.author = applicant || '';
  pptx.title = `${center || ''} 위탁사업계획 발표자료`;

  const centerName = (center || '○○어린이집').trim();
  const who = (applicant || '○○○').trim();

  // ── 표지 ──
  const cover = pptx.addSlide();
  cover.background = { color: NAVY };
  cover.addShape(pptx.ShapeType.rect, { x: 0, y: 2.05, w: 10, h: 0.03, fill: { color: GOLD } });
  cover.addText(city ? `${city} 국공립어린이집 신규위탁` : '국공립어린이집 신규위탁', {
    x: 0.6,
    y: 1.45,
    w: 8.8,
    h: 0.5,
    fontSize: 16,
    color: 'F0D9A8',
    align: 'center',
    fontFace: FONT,
  });
  cover.addText(centerName, {
    x: 0.6,
    y: 2.25,
    w: 8.8,
    h: 0.9,
    fontSize: 40,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    fontFace: FONT,
  });
  cover.addText('위탁사업계획 발표', {
    x: 0.6,
    y: 3.15,
    w: 8.8,
    h: 0.5,
    fontSize: 20,
    color: 'FFFFFF',
    align: 'center',
    fontFace: FONT,
  });
  cover.addText(`위탁 지원자   ${who}`, {
    x: 0.6,
    y: 4.15,
    w: 8.8,
    h: 0.4,
    fontSize: 16,
    color: 'F0D9A8',
    align: 'center',
    fontFace: FONT,
  });
  cover.addNotes(coverScript(center, applicant));

  // ── 발표 순서 ──
  const agenda = pptx.addSlide();
  agenda.background = { color: CREAM };
  agenda.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 0.95, fill: { color: NAVY } });
  agenda.addText('발표 순서', {
    x: 0.6,
    y: 0.15,
    w: 8.8,
    h: 0.6,
    fontSize: 24,
    bold: true,
    color: 'FFFFFF',
    fontFace: FONT,
  });
  PRESENT_SECTIONS.forEach((s, i) => {
    const col = i < 5 ? 0 : 1;
    const row = i % 5;
    agenda.addText(
      [
        { text: two(s.no), options: { color: GOLD, bold: true, fontSize: 16 } },
        { text: `  ${s.title}`, options: { color: NAVY, fontSize: 16 } },
      ],
      {
        x: 0.7 + col * 4.6,
        y: 1.35 + row * 0.72,
        w: 4.3,
        h: 0.55,
        valign: 'middle',
        fontFace: FONT,
      }
    );
  });

  // ── 내용 슬라이드 10장 ──
  slides.forEach((s) => {
    const sl = pptx.addSlide();
    sl.background = { color: 'FFFFFF' };
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 10, h: 1.05, fill: { color: NAVY } });
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 1.05, w: 10, h: 0.05, fill: { color: GOLD } });
    sl.addText(
      [
        { text: two(s.no), options: { color: GOLD, bold: true, fontSize: 18 } },
        { text: `   ${s.title}`, options: { color: 'FFFFFF', bold: true, fontSize: 24 } },
      ],
      { x: 0.6, y: 0.18, w: 8.8, h: 0.7, valign: 'middle', fontFace: FONT }
    );

    let top = 1.45;
    if (s.sub) {
      sl.addText(s.sub, {
        x: 0.7,
        y: top,
        w: 8.6,
        h: 0.45,
        fontSize: 16,
        bold: true,
        color: NAVY_SOFT,
        fontFace: FONT,
      });
      top += 0.6;
    }

    sl.addText(
      (s.bullets || []).map((t) => ({
        text: t,
        options: { bullet: { code: '25CF' }, breakLine: true },
      })),
      {
        x: 0.8,
        y: top,
        w: 8.4,
        h: 5.3 - top,
        fontSize: 18,
        color: TEXT,
        fontFace: FONT,
        lineSpacingMultiple: 1.5,
        valign: 'top',
      }
    );

    sl.addText(`${centerName}  ·  위탁 지원자 ${who}`, {
      x: 0.6,
      y: 5.15,
      w: 6,
      h: 0.3,
      fontSize: 10,
      color: '9A968E',
      fontFace: FONT,
    });
    sl.addText(two(s.no), {
      x: 8.9,
      y: 5.15,
      w: 0.5,
      h: 0.3,
      fontSize: 10,
      color: '9A968E',
      align: 'right',
      fontFace: FONT,
    });

    sl.addNotes(`[${timeLabel(s.seconds)}] ${s.script || ''}`);
  });

  const out = await pptx.write({ outputType: 'blob' });
  return out instanceof Blob ? out : new Blob([out]);
}

/** 대본만 모아 글자 파일로 (인쇄해서 연습하시라고) */
export function buildScriptText({ center, applicant, slides }) {
  const lines = [];
  lines.push(`${(center || '○○어린이집').trim()} 위탁사업계획 발표 대본`);
  lines.push(`위탁 지원자 ${(applicant || '○○○').trim()}`);
  lines.push(`전체 발표 시간 ${timeLabel(TOTAL_SECONDS)}`);
  lines.push('');
  lines.push('──────────────────────────────');
  lines.push(`[표지] 인사 · ${timeLabel(15)}`);
  lines.push(coverScript(center, applicant));
  lines.push('');
  slides.forEach((s) => {
    lines.push('──────────────────────────────');
    lines.push(`[${two(s.no)}] ${s.title} · ${timeLabel(s.seconds)}`);
    lines.push(s.script || '');
    lines.push('');
  });
  return lines.join('\r\n');
}
