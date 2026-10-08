'use client';

// 0차시 목차 — 원장님이 올린 **디자인 목차 서식(forms/toc.hwpx)** 을 그대로 쓰되,
// 정리된 지자체 목차 항목을 **순서 그대로, 개수만큼** 챕터(Ⅰ, Ⅱ, …)로 채우고 지역을 넣는다.
// 챕터 모양(Chepter 글자·장식선·번호·쪽번호 00)은 서식의 첫 챕터를, 하위 항목은 서식의 "1. … 00" 줄을 복제해 쓴다.

import { fileName } from './forms';

const JSZIP_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function loadJSZip() {
  if (window.JSZip) return window.JSZip;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = JSZIP_SRC;
    s.onload = resolve;
    s.onerror = () => reject(new Error('압축 도구를 불러오지 못했습니다'));
    document.head.appendChild(s);
  });
  return window.JSZip;
}

const ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ', 'Ⅺ', 'Ⅻ'];
const numeral = (i) => ROMAN[i] || String(i + 1);
const textOf = (p) => (p.match(/<hp:t>([^<]*)<\/hp:t>/g) || []).map((t) => t.slice(6, -7)).join('');

// 하위 항목 "1. 이름      00" 의 00 위치를 맞춘다. 서식의 줄들을 재 보면 한글 1자 = 빈칸 3개,
// 한 줄 = 빈칸 76개 폭이다(여유 2칸 둠). 이름이 너무 길면 줄이 넘쳐 글자가 벌어지므로 00을 뺀다.
function withPage00(label) {
  const w = [...label].reduce((n, ch) => n + (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(ch) ? 3 : 1), 0);
  if (w > 68) return label;
  return label + ' '.repeat(Math.max(2, 74 - w)) + '00';
}

// 줄 높이(쪽 그림 기준 대략 px) — 서식 상자 안에 다 들어가는지 가늠하는 데 쓴다.
const H_CHAPTER = 44.5; // Chepter 줄 + 번호·제목 줄
const H_LINE = 30.5; // 쪽번호 줄, 하위 항목 한 줄
const H_BOX = 720; // 목차 상자 안 쓸 수 있는 높이 (서식 원래 모양 = 677)

// 서식의 목차 칸(Chepter 줄이 들어 있는 표 칸)을 찾아,
// 지자체 항목 수만큼 [Chepter 줄 + 번호·제목 줄 + (하위 항목 줄들 또는 쪽번호 줄)] 묶음을 새로 만든다.
// 첫 챕터의 모양(장식선·글자모양)과 서식의 하위 항목 줄 모양을 그대로 복제하므로 디자인은 유지된다.
// chapters: [{ name, subs: ['하위1', ...] }]
export function rebuildChapters(section, chapters, city) {
  let s = section;
  const list = (chapters || [])
    .map((c) => (typeof c === 'string' ? { name: c, subs: [] } : c))
    .map((c) => ({
      name: String(c.name || '').trim(),
      subs: (c.subs || []).map((x) => String(x || '').trim()).filter(Boolean),
    }))
    .filter((c) => c.name);
  const first = s.indexOf('<hp:t>Chepter');
  if (first >= 0 && list.length) {
    const subStart = s.lastIndexOf('<hp:subList', first);
    const bodyStart = s.indexOf('>', subStart) + 1;
    const bodyEnd = s.indexOf('</hp:subList>', first);
    const body = s.slice(bodyStart, bodyEnd);
    const paras = body.match(/<hp:p [\s\S]*?<\/hp:p>/g) || [];
    const chapIdx = paras.map((p, i) => (p.includes('<hp:t>Chepter') ? i : -1)).filter((i) => i >= 0);
    if (chapIdx.length && paras.join('') === body) {
      const chepterP = paras[chapIdx[0]];
      const titleP = paras[chapIdx[0] + 1];
      // 쪽번호 줄: 글자가 빈칸과 00 뿐인 줄 (없으면 빈 줄)
      const pageP =
        paras.find((p) => /^\s*0+\s*$/.test(textOf(p))) || paras[chapIdx[0] + 2] || '';
      // 하위 항목 줄: "1. 기본방향     00" 모양의 줄 (없으면 쪽번호 줄 모양을 빌림)
      const subP = paras.find((p) => /^\d+\.\s+\S.*\s{2,}0+\s*$/.test(textOf(p))) || pageP;

      // 하위 항목이 없는 챕터의 쪽번호 줄은, 상자를 넘칠 것 같으면 뺀다.
      const nSubs = list.reduce((n, c) => n + c.subs.length, 0);
      const nNoSub = list.filter((c) => !c.subs.length).length;
      const keepPage = list.length * H_CHAPTER + nSubs * H_LINE + nNoSub * H_LINE <= H_BOX;

      let uid = 0;
      const out = list.map((c, i) => {
        // 장식선 id가 겹치지 않게 새 번호
        const line = chepterP
          .replace(/(<hp:line id=")(\d+)"/, (m, a, id) => `${a}${Number(id) + 1000 + ++uid}"`)
          .replace(/(instid=")(\d+)"/, (m, a, id) => `${a}${Number(id) + 1000 + uid}"`);
        let k = 0;
        const title = titleP.replace(/<hp:t>[^<]*<\/hp:t>/g, () =>
          k++ === 0 ? `<hp:t>${numeral(i)}. </hp:t>` : k === 2 ? `<hp:t>${esc(c.name)}</hp:t>` : '<hp:t></hp:t>'
        );
        if (c.subs.length && subP) {
          const subs = c.subs.map((nm, j) => {
            const label = `${j + 1}. ${nm}`;
            let once = true;
            return subP.replace(/<hp:t>[^<]*<\/hp:t>/g, () => {
              if (!once) return '<hp:t></hp:t>';
              once = false;
              return `<hp:t>${esc(withPage00(label))}</hp:t>`;
            });
          });
          return line + title + subs.join('');
        }
        return line + title + (keepPage ? pageP : '');
      });
      s = s.slice(0, bodyStart) + out.join('') + s.slice(bodyEnd);
    }
  }

  // 지역: 00시군구 → 도시명
  if (city && city.trim()) {
    s = s.split('00시군구').join(esc(city.trim()));
  }

  // 글자를 바꿨으니 줄 정보는 모두 빼서 한글이 다시 계산하게 한다(남겨 두면 "손상" 오류).
  return s.replace(/<hp:linesegarray>[\s\S]*?<\/hp:linesegarray>/g, '');
}

/**
 * @param {object} o
 * @param {Array<{name:string,matchId:string|null,subs?:string[]}>} o.items  /toc 에서 정리한 목차 항목
 * @param {string} o.city
 * @param {string} o.phone
 * @param {string} o.student
 * @param {Function} [o.onProgress]
 */
export async function buildTocDesignDoc({ items, city, phone, student, onProgress }) {
  const JSZip = await loadJSZip();

  if (onProgress) onProgress('목차 서식을 불러오는 중입니다...');
  const ticket = await fetch(`/api/sample?kind=toc&phone=${encodeURIComponent(phone)}`);
  const info = await ticket.json();
  if (!ticket.ok) {
    throw new Error(info.error || '목차 서식을 열지 못했습니다. 라지숙 소장에게 문의해 주세요.');
  }
  const res = await fetch(info.url);
  if (!res.ok) throw new Error('목차 서식을 받지 못했습니다');
  const zip = await JSZip.loadAsync(await res.arrayBuffer());

  if (onProgress) onProgress('디자인에 우리 지자체 목차를 반영하는 중입니다...');
  const section = await zip.file('Contents/section0.xml').async('string');

  // 정리된 순서 그대로 한 항목씩 챕터로 (하위 항목은 그 아래 "1. 2. …" 줄로)
  const newSection = rebuildChapters(
    section,
    (items || []).map((it) => ({ name: it && it.name, subs: (it && it.subs) || [] })),
    city
  );

  if (onProgress) onProgress('한글 파일로 묶는 중입니다...');
  const out = new JSZip();
  out.file('mimetype', await zip.file('mimetype').async('uint8array'), { compression: 'STORE' });
  const names = Object.keys(zip.files).filter(
    (n) => n !== 'mimetype' && n !== 'Contents/section0.xml' && !zip.files[n].dir
  );
  for (const n of names) {
    out.file(n, await zip.file(n).async('uint8array'), { compression: 'DEFLATE' });
  }
  out.file('Contents/section0.xml', newSection, { compression: 'DEFLATE' });

  // 한글은 포장에 엄격하다 — JSZip이 자동으로 넣는 폴더 항목(Contents/ 등)을 빼 원본 hwpx 구조와 맞춘다.
  Object.keys(out.files).forEach((n) => {
    if (out.files[n].dir) delete out.files[n];
  });
  const blob = await out.generateAsync({ type: 'blob', mimeType: 'application/hwp+zip' });
  return { blob, name: fileName({ city, student, docName: '목차' }) };
}
