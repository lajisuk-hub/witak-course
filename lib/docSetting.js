// 지자체마다 다른 문서 설정(글꼴·글자크기·줄간격·여백)을 다루는 곳.
//
// 한글(.hwpx) 안에서 이 값들이 있는 자리
//   글꼴      Contents/header.xml 의 <hh:font id=".." face="..">
//   글자크기  Contents/header.xml 의 <hh:charPr height="900">   (1/100 pt)
//   줄간격    Contents/header.xml 의 <hh:lineSpacing value="133">(%)
//   여백      Contents/section0.xml 의 <hp:margin left=".." ..>  (HWPUNIT)

export const MM = 283.465; // 1mm 가 HWPUNIT 으로 몇인지

export const FONTS = [
  '휴먼명조',
  '함초롬바탕',
  '한컴바탕',
  'HY신명조',
  '맑은 고딕',
  '함초롬돋움',
  '굴림',
  '돋움',
  '바탕',
];

// 아무 지정이 없을 때 (원장님 샘플 그대로 쓰기)
export const DEFAULT_SETTING = {
  font: '',        // 비우면 샘플 글꼴 그대로
  size: 0,         // pt. 0 이면 그대로
  lineSpacing: 0,  // %. 0 이면 그대로
  margin: 0,       // mm. 0 이면 그대로 (상하좌우 같은 값)
};

export function isEmptySetting(s) {
  if (!s) return true;
  return !s.font && !s.size && !s.lineSpacing && !s.margin;
}

export function describeSetting(s) {
  if (isEmptySetting(s)) return '샘플 문서 그대로';
  const p = [];
  if (s.font) p.push(s.font);
  if (s.size) p.push(`${s.size}pt`);
  if (s.lineSpacing) p.push(`줄간격 ${s.lineSpacing}%`);
  if (s.margin) p.push(`여백 ${s.margin}mm`);
  return p.join(' · ');
}

/**
 * header.xml 에 글꼴·글자크기·줄간격을 반영한다.
 * @param {string} header   Contents/header.xml 내용
 * @param {object} setting  { font, size, lineSpacing }
 * @param {object} bodyStyle { para, char } 샘플에서 찾아낸 본문 모양
 */
export function applyToHeader(header, setting, bodyStyle) {
  let out = header;

  // ── 글꼴 ──
  // 본문이 쓰는 글꼴 번호를 찾아, 그 글꼴 이름만 바꾼다.
  // (문서 전체가 같은 글꼴을 쓰므로 이것만으로 전체가 바뀐다)
  if (setting.font) {
    const charPr = out.match(new RegExp(`<hh:charPr id="${bodyStyle.char}"[\\s\\S]*?</hh:charPr>`));
    const fontId = charPr && charPr[0].match(/<hh:fontRef[^>]*hangul="(\d+)"/);
    if (fontId) {
      const id = fontId[1];
      // 모든 언어 묶음에서 그 번호의 글꼴 이름을 바꾼다
      out = out.replace(
        new RegExp(`(<hh:font id="${id}" face=")[^"]*(")`, 'g'),
        `$1${setting.font}$2`
      );
    }
  }

  // ── 본문 글자 크기 ──
  // 본문과 같은 크기를 쓰는 글자모양만 바꾼다(제목은 건드리지 않는다).
  if (setting.size) {
    const charPr = out.match(new RegExp(`<hh:charPr id="${bodyStyle.char}"[^>]*height="(\\d+)"`));
    const nowHeight = charPr ? charPr[1] : null;
    const want = Math.round(setting.size * 100);
    if (nowHeight && String(want) !== nowHeight) {
      out = out.replace(
        new RegExp(`(<hh:charPr id="\\d+" )height="${nowHeight}"`, 'g'),
        `$1height="${want}"`
      );
    }
  }

  // ── 줄간격 ──
  if (setting.lineSpacing) {
    out = out.replace(
      new RegExp(`(<hh:paraPr id="${bodyStyle.para}"[\\s\\S]*?<hh:lineSpacing type="PERCENT" value=")\\d+(")`),
      `$1${Math.round(setting.lineSpacing)}$2`
    );
  }

  return out;
}

/** section0.xml 의 용지 여백을 바꾼다 */
export function applyToSection(section, setting) {
  if (!setting.margin) return section;
  const v = Math.round(setting.margin * MM);
  return section.replace(
    /(<hp:margin[^>]*?)left="\d+" right="\d+" top="\d+" bottom="\d+"/,
    `$1left="${v}" right="${v}" top="${v}" bottom="${v}"`
  );
}
