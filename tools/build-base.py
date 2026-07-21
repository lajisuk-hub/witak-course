# public/base.hwpx (한글 통합서류의 빈 틀) 을 만드는 스크립트
#
# 하는 일
#   1) 원본 hwpx 에서 서식 정의(header.xml)와 뼈대만 남긴다
#   2) 글꼴 "휴먼명조" 를 추가한다 (공고문·위탁서류에서 가장 많이 쓰는 글꼴)
#   3) 본문 12pt 를 비롯한 글자모양·문단모양을 새로 넣는다
#
# 쓰는 법:  python tools/build-base.py [원본.hwpx]
#
# 주의(과거 교훈)
#   - mimetype 은 압축하지 않고 맨 앞에 넣어야 한글이 연다
#   - linesegarray 는 넣지 않는다 (한글이 다시 계산한다)

import os
import re
import sys
import zipfile

SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.expanduser('~'), 'OneDrive', '바탕 화면', '5월 국공립신규위탁', '특색-영아반.hwpx'
)
DST = os.path.join(os.path.dirname(__file__), '..', 'public', 'base.hwpx')

FONT_ID = 3
FONT_NAME = '휴먼명조'
TYPE_INFO = ('<hh:typeInfo familyType="FCAT_MYUNGJO" weight="6" proportion="4" contrast="0"'
             ' strokeVariation="1" armStyle="1" letterform="1" midline="1" xHeight="1"/>')

# 새로 넣을 글자모양 (id, 크기(1/100pt), 굵게, 글자색)
NEW_CHAR_PRS = [
    (15, 1200, False, '#000000'),   # 본문 12pt
    (16, 2200, True, '#1A3A5C'),    # 문서 제목
    (17, 1500, True, '#1A3A5C'),    # 꼭지 제목
    (18, 1000, False, '#6E6E6E'),   # 작성 요령(작은 회색 글씨)
    (19, 1300, False, '#000000'),   # 표지 부제
    (20, 1400, True, '#1A3A5C'),    # 목차 제목
]

# 새로 넣을 문단모양 (id, 정렬, 위 간격, 아래 간격, 왼쪽 들여쓰기)
NEW_PARA_PRS = [
    (25, 'CENTER', 0, 600, 0),      # 가운데 (표지)
    (26, 'LEFT', 900, 400, 0),      # 꼭지 제목
    (27, 'LEFT', 0, 300, 400),      # 작성 요령
    (28, 'JUSTIFY', 0, 250, 0),     # 본문
]


def char_pr(cid, height, bold, color):
    b = '<hh:bold/>' if bold else ''
    return (
        f'<hh:charPr id="{cid}" height="{height}" textColor="{color}" shadeColor="none"'
        ' useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="2">'
        f'<hh:fontRef hangul="{FONT_ID}" latin="{FONT_ID}" hanja="{FONT_ID}" japanese="{FONT_ID}"'
        f' other="{FONT_ID}" symbol="{FONT_ID}" user="{FONT_ID}"/>'
        '<hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>'
        '<hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>'
        '<hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/>'
        '<hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/>'
        f'{b}'
        '<hh:underline type="NONE" shape="SOLID" color="#000000"/>'
        '<hh:strikeout shape="NONE" color="#000000"/>'
        '<hh:outline type="NONE"/>'
        '<hh:shadow type="NONE" color="#C0C0C0" offsetX="10" offsetY="10"/>'
        '</hh:charPr>'
    )


def margin(prev, nxt, left):
    return (
        '<hh:margin>'
        '<hc:intent value="0" unit="HWPUNIT"/>'
        f'<hc:left value="{left}" unit="HWPUNIT"/>'
        '<hc:right value="0" unit="HWPUNIT"/>'
        f'<hc:prev value="{prev}" unit="HWPUNIT"/>'
        f'<hc:next value="{nxt}" unit="HWPUNIT"/>'
        '</hh:margin>'
        '<hh:lineSpacing type="PERCENT" value="170" unit="HWPUNIT"/>'
    )


def para_pr(pid, align, prev, nxt, left):
    m = margin(prev, nxt, left)
    return (
        f'<hh:paraPr id="{pid}" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1"'
        ' suppressLineNumbers="0" checked="0" textDir="LTR">'
        f'<hh:align horizontal="{align}" vertical="BASELINE"/>'
        '<hh:heading type="NONE" idRef="0" level="0"/>'
        '<hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="KEEP_WORD" widowOrphan="0"'
        ' keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>'
        '<hh:autoSpacing eAsianEng="0" eAsianNum="0"/>'
        '<hp:switch>'
        '<hp:case hp:required-namespace="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar">'
        f'{m}</hp:case>'
        f'<hp:default>{m}</hp:default>'
        '</hp:switch>'
        '<hh:border borderFillIDRef="2" offsetLeft="0" offsetRight="0" offsetTop="0"'
        ' offsetBottom="0" connect="0" ignoreMargin="0"/>'
        '</hh:paraPr>'
    )


def main():
    src = zipfile.ZipFile(SRC)
    header = src.read('Contents/header.xml').decode('utf-8')

    # ① 글꼴 추가 — 언어별 fontface 마다 휴먼명조를 하나씩 넣는다
    def add_font(m):
        cnt = int(m.group(2))
        return m.group(0).replace(f'fontCnt="{cnt}"', f'fontCnt="{cnt + 1}"')

    parts = re.split(r'(</hh:fontface>)', header)
    rebuilt = []
    for p in parts:
        if p == '</hh:fontface>':
            rebuilt.append(
                f'<hh:font id="{FONT_ID}" face="{FONT_NAME}" type="TTF" isEmbedded="0">'
                f'{TYPE_INFO}</hh:font>' + p
            )
        else:
            rebuilt.append(p)
    header = ''.join(rebuilt)
    header = re.sub(r'(<hh:fontface lang="[A-Z]+" fontCnt=")(\d+)(")',
                    lambda m: m.group(1) + str(int(m.group(2)) + 1) + m.group(3), header)

    # ② 글자모양 추가
    m = re.search(r'<hh:charProperties itemCnt="(\d+)">', header)
    old = int(m.group(1))
    header = header.replace(m.group(0), f'<hh:charProperties itemCnt="{old + len(NEW_CHAR_PRS)}">')
    header = header.replace(
        '</hh:charProperties>',
        ''.join(char_pr(*c) for c in NEW_CHAR_PRS) + '</hh:charProperties>')

    # ③ 문단모양 추가
    m = re.search(r'<hh:paraProperties itemCnt="(\d+)">', header)
    old = int(m.group(1))
    header = header.replace(m.group(0), f'<hh:paraProperties itemCnt="{old + len(NEW_PARA_PRS)}">')
    header = header.replace(
        '</hh:paraProperties>',
        ''.join(para_pr(*p) for p in NEW_PARA_PRS) + '</hh:paraProperties>')

    # ④ 본문은 자리표시자만 남긴 뼈대로
    sec = src.read('Contents/section0.xml').decode('utf-8')
    head = sec[:sec.index('<hp:p ')]
    first_p = sec[sec.index('<hp:p '):sec.index('</hp:p>') + 7]
    secpr = first_p[first_p.index('<hp:secPr'):first_p.index('</hp:secPr>') + 11]
    skeleton = (
        head
        + '<hp:p id="1" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
        + '<hp:run charPrIDRef="15">' + secpr + '</hp:run></hp:p>'
        + '<!--BODY-->'
        + '</hs:sec>'
    )

    # ⑤ 다시 압축
    out = zipfile.ZipFile(DST, 'w')
    out.writestr(zipfile.ZipInfo('mimetype'), src.read('mimetype'), zipfile.ZIP_STORED)
    for name in ['version.xml', 'Contents/content.hpf', 'settings.xml',
                 'META-INF/container.xml', 'META-INF/container.rdf', 'META-INF/manifest.xml']:
        out.writestr(name, src.read(name), zipfile.ZIP_DEFLATED)
    out.writestr('Contents/header.xml', header.encode('utf-8'), zipfile.ZIP_DEFLATED)
    out.writestr('Contents/section0.xml', skeleton.encode('utf-8'), zipfile.ZIP_DEFLATED)
    out.close()

    # 검사
    from xml.dom import minidom
    minidom.parseString(header.encode('utf-8'))
    minidom.parseString(skeleton.replace('<!--BODY-->', '').encode('utf-8'))
    z = zipfile.ZipFile(DST)
    assert z.namelist()[0] == 'mimetype'
    assert z.infolist()[0].compress_type == zipfile.ZIP_STORED
    assert z.testzip() is None
    print('OK ->', os.path.abspath(DST), os.path.getsize(DST), 'bytes')


if __name__ == '__main__':
    main()
