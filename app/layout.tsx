import type { Metadata } from "next";
import "./globals.css";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "广西地球信息产业发展研究",
  description: "面向公众传播的广西地球信息产业研究门户，提供新闻摘要、词云与知识图谱。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
