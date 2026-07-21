import './globals.css';

export const metadata = {
  title: '국공립 신규위탁 과정 진행',
  description: '우리 지자체 공고문에 맞춰 위탁 제출서류 목차를 자동으로 만들어 줍니다.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
