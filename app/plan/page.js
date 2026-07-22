'use client';

import { useMe } from '@/lib/auth';
import ContactBar from '@/app/ContactBar';
import CalendarBoard from '@/app/CalendarBoard';

export default function Plan() {
  const { me, ready } = useMe();

  if (!ready || !me) return null;

  return (
    <>
      <div className="head">
        <h1>한 달 과정 달력</h1>
        <p>날짜를 누르면 그날 할 일이 나옵니다. 다 하시면 체크해 주세요</p>
        <a href="/">← 차시 목록으로</a>
      </div>

      <div className="wrap">
        <CalendarBoard phone={me.phone} />
        <ContactBar />
      </div>
    </>
  );
}
