'use client';

import { CONTACT_LINE, CONTACT_SUB, KAKAO_URL } from '@/lib/course';

// 화면 아래 진행자 연락 안내. 누르면 라지숙 소장 카카오톡으로 이어진다.
export default function ContactBar() {
  const inner = (
    <>
      <p>{CONTACT_LINE}</p>
      <span className="kakao">
        <b>💬</b> {CONTACT_SUB}
      </span>
    </>
  );

  if (!KAKAO_URL) {
    // 아직 카톡 주소를 넣지 않았을 때
    return <div className="card contact noprint">{inner}</div>;
  }

  return (
    <a className="card contact link noprint" href={KAKAO_URL} target="_blank" rel="noreferrer">
      {inner}
    </a>
  );
}
