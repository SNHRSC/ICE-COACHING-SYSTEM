import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "ICE Coaching System", description: "Personal coaching workspace for Coach Ice and trainees" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
