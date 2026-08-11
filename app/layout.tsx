import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Early Recognition Trainer — VR",
  description: "A post-operative patient deteriorates in real time. Notice, reason, and act — in the browser or in VR.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
