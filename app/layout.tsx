import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'PLAYBOARD — 농구 전술 보드',
  description: '농구 코트 위에 선수와 움직임을 겹쳐 그리는 간편한 전술 보드',
  openGraph: {
    title: 'PLAYBOARD — 농구 전술 보드',
    description: '농구 코트 위에 선수와 움직임을 겹쳐 그리는 간편한 전술 보드',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'PLAYBOARD 농구 전술 보드' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PLAYBOARD — 농구 전술 보드',
    description: '농구 코트 위에 선수와 움직임을 겹쳐 그리는 간편한 전술 보드',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
