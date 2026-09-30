import type { ResumeProfile } from "@/lib/validation/ai-schemas";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

export function CandidateProfile({ profile }: { profile: ResumeProfile }) {
  return (
    <div className="space-y-5 text-sm">
      {(profile.headline || profile.years_experience != null) && (
        <p className="text-muted-foreground">{profile.headline}{profile.headline && profile.years_experience != null ? " · " : ""}{profile.years_experience != null ? `${profile.years_experience} years experience` : ""}</p>
      )}
      {profile.skills.length > 0 && (
        <Block title="Skills"><div className="flex flex-wrap gap-1.5">{profile.skills.map((s) => <span key={s} className="rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">{s}</span>)}</div></Block>
      )}
      {profile.roles.length > 0 && (
        <Block title="Experience">
          <ol className="space-y-3">
            {profile.roles.map((r, i) => (
              <li key={i} className="border-l-2 pl-3">
                <p className="font-medium">{r.title}{r.company && <span className="font-normal text-muted-foreground"> · {r.company}</span>}</p>
                {(r.start || r.end) && <p className="text-xs text-muted-foreground">{r.start ?? "?"} – {r.end ?? "?"}</p>}
                {r.highlights.length > 0 && <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">{r.highlights.slice(0, 4).map((h, j) => <li key={j}>{h}</li>)}</ul>}
              </li>
            ))}
          </ol>
        </Block>
      )}
      {profile.companies.length > 0 && profile.roles.length === 0 && <Block title="Companies"><p>{profile.companies.join(", ")}</p></Block>}
      {profile.projects.length > 0 && (
        <Block title="Projects">
          <ul className="space-y-2">{profile.projects.map((p, i) => <li key={i}><span className="font-medium">{p.name}</span> — <span className="text-muted-foreground">{p.description}</span></li>)}</ul>
        </Block>
      )}
      {profile.achievements.length > 0 && <Block title="Achievements"><ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">{profile.achievements.map((a, i) => <li key={i}>{a}</li>)}</ul></Block>}
      {profile.education.length > 0 && <Block title="Education"><ul className="space-y-0.5 text-muted-foreground">{profile.education.map((e, i) => <li key={i}>{e}</li>)}</ul></Block>}
      {profile.certifications.length > 0 && <Block title="Certifications"><ul className="space-y-0.5 text-muted-foreground">{profile.certifications.map((e, i) => <li key={i}>{e}</li>)}</ul></Block>}
      {profile.uncertainties.length > 0 && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <p className="font-medium">Needs verification</p>
          <ul className="mt-1 list-disc pl-4">{profile.uncertainties.map((u, i) => <li key={i}>{u}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
