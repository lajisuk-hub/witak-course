'use client';

// 앱을 열 때 **서버에 담아 둔 내용을 먼저 받아와** 이 브라우저와 맞춘다.
// 이게 있어야 휴대폰에서 쓰던 것을 컴퓨터에서 이어서 하실 수 있다.
import { useEffect, useState } from 'react';
import { pullRemote, pushNow } from '@/lib/store';

export default function Boot({ children }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    pullRemote().finally(() => {
      if (alive) setReady(true);
    });

    // 화면을 닫거나 다른 앱으로 넘어갈 때, 아직 못 올린 내용을 마저 올린다
    const flush = () => pushNow({ keepalive: true });
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);

    return () => {
      alive = false;
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);

  if (!ready) {
    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6b7280',
          fontSize: 15,
        }}
      >
        저장하신 내용을 불러오는 중입니다…
      </div>
    );
  }

  return children;
}
