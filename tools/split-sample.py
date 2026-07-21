# 원장님의 문서 샘플(hwpx)을 "꼭지 조각"으로 잘라 두는 스크립트
#
# 왜 필요한가
#   지자체마다 목차 순서가 다르다. 샘플을 꼭지 단위로 잘라 두면
#   각 지자체 목차 순서대로 다시 붙이기만 하면 된다.
#   조각을 원본 XML 그대로 쓰기 때문에 표·그림·글자모양이 100% 보존된다.
#
# 쓰는 법:  python tools/split-sample.py "샘플.hwpx"
# 결과   :  sample/  폴더에 조각들과 blocks.json 이 생긴다

import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

HP = '{http://www.hancom.co.kr/hwpml/2011/paragraph}'

SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.expanduser('~'), 'OneDrive', '바탕 화면', '5월 국공립 신규위탁 샘플.hwpx')
OUT = os.path.join(os.path.dirname(__file__), '..', 'sample')

# 꼭지 제목으로 볼 문단
HEADING = [
    re.compile(r'^【\s*서식\s*\d+\s*】'),
    re.compile(r'^\d+\.\s*\S'),
    re.compile(r'^[가-힣]\.\s*\S'),
]


def text_of(el):
    return re.sub(r'\s+', ' ', ''.join(t.text or '' for t in el.iter(HP + 't'))).strip()


# 간지(장 표지)처럼 표 하나로 된 쪽도 조각의 시작으로 본다
DIVIDER = re.compile(r'^(Contents|[ⅠⅡⅢⅣⅤⅥⅦⅧ]\s*[.．]?\s*\S|표지서식)')


def is_heading(el, txt):
    if not txt:
        return False
    has_tbl = el.find('.//' + HP + 'tbl') is not None
    if has_tbl:
        # 표가 든 문단은 간지/장표지일 때만 조각의 시작으로 본다
        return bool(DIVIDER.match(txt)) and len(txt) < 2000
    if len(txt) > 45:
        return False
    # "1. ~한다." 처럼 문장으로 끝나는 것은 목록 항목이지 제목이 아니다
    if re.search(r'(다|요|음|임)\.$', txt):
        return False
    return any(p.match(txt) for p in HEADING)


def main():
    z = zipfile.ZipFile(SRC)
    raw = z.read('Contents/section0.xml').decode('utf-8')
    root = ET.fromstring(raw.encode('utf-8'))

    # 원본 XML 에서 문단별 조각을 그대로 떼어내기 위해 위치를 찾는다
    starts = [m.start() for m in re.finditer(r'<hp:p [^>]*?>', raw)]
    # 최상위 문단만 골라야 하므로 깊이를 세며 훑는다
    depth = 0
    top = []  # (start, end) 최상위 hp:p 범위
    for m in re.finditer(r'<hp:p [^>]*?>|</hp:p>|<hp:p [^>]*?/>', raw):
        tag = m.group(0)
        if tag.endswith('/>'):
            if depth == 0:
                top.append((m.start(), m.end()))
            continue
        if tag.startswith('</'):
            depth -= 1
            if depth == 0:
                top[-1] = (top[-1][0], m.end())
        else:
            if depth == 0:
                top.append((m.start(), m.end()))
            depth += 1

    kids = list(root)
    if len(kids) != len(top):
        print('경고: 문단 개수가 맞지 않습니다 (%d vs %d)' % (len(kids), len(top)))

    blocks = []
    cur = None
    for i, el in enumerate(kids):
        txt = text_of(el)
        if cur is None or is_heading(el, txt):
            cur = {'no': len(blocks), 'title': txt[:70], 'from': i, 'to': i, 'ranges': [top[i]]}
            blocks.append(cur)
        else:
            cur['to'] = i
            cur['ranges'].append(top[i])

    os.makedirs(OUT, exist_ok=True)
    index = []
    for b in blocks:
        s = b['ranges'][0][0]
        e = b['ranges'][-1][1]
        index.append({
            'no': b['no'],
            'title': b['title'],
            'paras': b['to'] - b['from'] + 1,
            'start': s,   # section0.xml 안에서의 시작 위치
            'end': e,     # 끝 위치 (조각을 파일로 두지 않고 원본에서 잘라 쓴다)
        })

    # ── 목차를 새로 찍을 때 쓸 글자·문단모양 번호를 뽑아 둔다 ──
    def style_of(b):
        xml = raw[b['start']:b['end']]
        pm = re.search(r'<hp:p [^>]*paraPrIDRef="(\d+)"', xml)
        cm = re.search(r'charPrIDRef="(\d+)"', xml)
        return {'para': int(pm.group(1)) if pm else 0, 'char': int(cm.group(1)) if cm else 0}

    styles = {}
    for b in index:
        t = b['title']
        if re.match(r'^\d+\.\s', t) and 'heading1' not in styles:
            styles['heading1'] = style_of(b)
        if re.match(r'^[가-힣]\.\s', t) and 'heading2' not in styles:
            styles['heading2'] = style_of(b)

    # ── 조각을 꼭지(sampleSections.js 의 id)에 배정한다 ──
    # 문서에 나오는 순서대로, 아래 표시가 나오면 그때부터 그 꼭지가 시작된다.
    MARKERS = [
        (r'^표지서식', 'cover'),
        (r'^【\s*서식\s*4\s*】', 'org-status'),
        (r'^【\s*서식\s*5\s*】', 'applicant'),
        (r'^【\s*서식\s*6\s*】', 'plan-basic'),
        (r'^2\.\s*조직 및 인력관리', 'plan-hr'),
        (r'^3\.\s*위탁기간', 'plan-curriculum'),
        (r'^마\.\s*보육지침', 'plan-law'),
        (r'^바\.\s*취약보육', 'plan-vulnerable'),
        (r'^4\.\s*어린이집 운영 및 관리', 'manage-overall'),
        (r'^나\.\s*열린어린이집', 'manage-open'),
        (r'^다\.\s*특별활동', 'manage-special'),
        (r'^라\.\s*시설에서 사고', 'manage-safety'),
        (r'^5\.\s*어린이집 시설 유지', 'facility'),
        (r'^6\.\s*예산 편성', 'budget'),
        (r'^【\s*서식\s*7\s*】', 'expert-career'),
        (r'^2\.\s*원장의 재정운영', 'expert-ability'),
        (r'^3\.\s*운영체 대표', 'expert-will'),
        (r'^【\s*서식\s*8\s*】', 'self-fund'),
        (r'^【\s*서식\s*9\s*】', 'record-business'),
        (r'^2\.\s*운영체의 복지 및 보육 관련 지역사회', 'record-community'),
        (r'^【\s*서식\s*10\s*】', 'trust-legal'),
    ]
    # 간지(장 사이 표지)와 목차는 넣지 않는다.
    # 단 "Ⅰ.위탁운영체 현황" 처럼 점·붙임표가 붙은 것은 제목 상자이므로 넣는다.
    SKIP = re.compile(r'^(Contents|[ⅠⅡⅢⅣⅤⅥⅦⅧ](?![.．\-]))')

    mapping = {}
    cur = None
    for b in index:
        t = b['title']
        for pat, sid in MARKERS:
            if re.match(pat, t):
                cur = sid
                break
        if b['no'] == 0 or cur is None:
            continue  # 표지쪽·앞머리는 따로 쓴다
        if SKIP.match(t):
            continue
        mapping.setdefault(cur, []).append(b['no'])

    # ── 결과를 한 파일로 (앱이 읽는다) ──
    head = raw[:raw.index('<hp:p ')]
    data = {
        'blocks': index,
        'mapping': mapping,
        'styles': styles,
        'coverBlock': 0,          # 표지 조각
        'skeletonHead': head,     # 문단 없는 hs:sec 머리 부분
    }
    with open(os.path.join(OUT, 'sample-map.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)

    # 원본 hwpx 를 앱이 받아갈 수 있게 public 으로 복사
    pub = os.path.join(os.path.dirname(__file__), '..', 'public', 'sample.hwpx')
    with open(SRC, 'rb') as a, open(pub, 'wb') as b2:
        b2.write(a.read())

    print('\n꼭지 배정:')
    for k, v in mapping.items():
        print('  %-18s 조각 %s' % (k, v))
    print('\nsample-map.json / public/sample.hwpx 생성 완료')

    print('조각 %d개' % len(blocks))


if __name__ == '__main__':
    main()
