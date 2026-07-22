'use client';

// 예산서 앱의 계산 결과를 **원장님 예산서 한글 서식의 표에 채워** 내려받는다.
//
// 서식은 관리자 화면에서 올린 forms/budget.hwpx 를 쓴다.
// 표 모양·글꼴은 서식 그대로 두고, 빈 칸에 글자만 넣는다.

import { fillBudgetTables } from './budgetTable';
import { toBudgetTables } from './budgetMap';
import { fileName } from './forms';

const JSZIP_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

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

/**
 * @param {object} o
 * @param {object} o.state    예산서 앱의 state
 * @param {object} o.calc     예산서 앱의 calc
 * @param {string} o.phone    로그인한 전화번호
 * @param {string} o.city     지역
 * @param {string} o.student  수강생 이름
 * @param {Function} [o.onProgress]
 */
export async function buildBudgetDoc({ state, calc, phone, city, student, onProgress }) {
  const JSZip = await loadJSZip();

  if (onProgress) onProgress('예산서 서식을 불러오는 중입니다...');
  const ticket = await fetch(`/api/sample?kind=budget&phone=${encodeURIComponent(phone)}`);
  const info = await ticket.json();
  if (!ticket.ok) {
    throw new Error(
      info.error ||
        '예산서 서식을 열지 못했습니다. 라지숙 소장이 아직 서식을 올리지 않았을 수 있습니다.'
    );
  }
  const res = await fetch(info.url);
  if (!res.ok) throw new Error('예산서 서식을 받지 못했습니다');
  const zip = await JSZip.loadAsync(await res.arrayBuffer());

  if (onProgress) onProgress('계산 결과를 표에 채우는 중입니다...');
  const raw = await zip.file('Contents/section0.xml').async('string');
  const { income, expense, totals } = toBudgetTables({ state, calc });
  const { xml, filled, missing } = fillBudgetTables(raw, income, expense);

  if (onProgress) onProgress('한글 파일로 묶는 중입니다...');
  const out = new JSZip();
  out.file('mimetype', await zip.file('mimetype').async('uint8array'), { compression: 'STORE' });
  const names = Object.keys(zip.files).filter(
    (n) => n !== 'mimetype' && n !== 'Contents/section0.xml' && !zip.files[n].dir
  );
  for (const n of names) {
    out.file(n, await zip.file(n).async('uint8array'), { compression: 'DEFLATE' });
  }
  out.file('Contents/section0.xml', xml, { compression: 'DEFLATE' });

  const blob = await out.generateAsync({ type: 'blob', mimeType: 'application/hwp+zip' });
  return {
    blob,
    name: fileName({ city, student, docName: '예산서' }),
    filled,
    missing,
    totals,
  };
}
