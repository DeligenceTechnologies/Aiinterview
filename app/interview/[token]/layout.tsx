import type { Metadata } from "next";

export const metadata: Metadata = { title: "Your interview", robots: { index: false, follow: false } };

export default function CandidateLayout({ children }: LayoutProps<"/interview/[token]">) {
  return <div className="flex min-h-screen flex-col bg-background">{children}</div>;
}
