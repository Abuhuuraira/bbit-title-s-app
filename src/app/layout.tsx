import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Farewell Nickname Voting",
  description: "Vote for the funniest and most creative nicknames for your classmates at the farewell!",
  keywords: ["farewell", "voting", "nicknames", "class"],
  openGraph: {
    title: "Farewell Nickname Voting",
    description: "Vote for the funniest and most creative nicknames for your classmates!",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
