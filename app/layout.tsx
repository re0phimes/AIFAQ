import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIFAQ",
  description: "AI/ML 常见问题知识库",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400&family=Noto+Sans+SC:wght@400;500;700&family=Rubik:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <main className="mx-auto max-w-2xl px-4 py-6 md:max-w-4xl md:px-8 md:py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
