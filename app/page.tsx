import Link from "next/link";
import { redirect } from "next/navigation";
import { FileSearch, ListChecks, ShieldCheck, Video } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { getAuth } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: ListChecks, title: "Personalized, structured plans", body: "Questions generated from the job requirements and the candidate's resume, inside your template's time and follow-up limits." },
  { icon: Video, title: "Realtime voice interviewer", body: "A professional AI interviewer asks one question at a time and follows up on specific information gaps." },
  { icon: FileSearch, title: "Evidence you can watch", body: "Every assessment links to timestamped transcript moments. Click to jump the recording straight there." },
  { icon: ShieldCheck, title: "Recruiters decide", body: "No automatic hire/reject. Consent, private storage, tenant isolation and a full audit trail built in." },
];

export default async function Home() {
  if (await getAuth()) redirect("/dashboard");
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex gap-2">
          <Link href="/login" className={buttonVariants({ variant: "ghost" })}>Sign in</Link>
          <Link href="/signup" className={buttonVariants()}>Get started</Link>
        </div>
      </header>
      <section className="mx-auto max-w-4xl px-6 pt-16 pb-20 text-center sm:pt-24">
        <p className="mx-auto mb-5 w-fit rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">AI video interviews for recruiting teams</p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">Interview every candidate. Review only the evidence.</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground text-balance">
          Intervue AI runs consistent, personalized first-round video interviews, records and transcribes them, and produces evidence-backed reports your team can verify in seconds.
        </p>
        <div className="mt-10 flex justify-center gap-3">
          <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "h-11 px-6")}>Create a workspace</Link>
          <Link href="/login" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-11 px-6")}>Sign in</Link>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-xl border bg-card p-6">
            <Icon className="size-5 text-primary" />
            <h3 className="mt-4 font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
