import type { MetaFunction } from "react-router";
import { BackLink } from "@/components/shell/BackLink";
import { ParticipantHeader } from "@/components/shell/ParticipantHeader";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { RELEASES } from "@/features/home/domain/changelog";
import { ReleaseNotes } from "@/features/home/ui/ReleaseNotes";
import { INDEXABLE, originFromMatches, pageMeta } from "@/lib/seo";

export const handle = INDEXABLE;

export const meta: MetaFunction = ({ matches }) =>
  pageMeta({
    title: "Novidades · Nelcota",
    description: "O que mudou no Nelcota: recursos novos, correções e melhorias.",
    path: "/novidades",
    origin: originFromMatches(matches),
  });

export default function ChangelogPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <ParticipantHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
        <BackLink className="mb-8" />
        <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] leading-[1] font-semibold tracking-[-0.045em] text-balance">
          Novidades.
          <span className="block text-ink-subtle">O que mudou por aqui.</span>
        </h1>
        <p className="mt-6 text-base leading-relaxed text-pretty text-ink-muted sm:text-lg">
          Recursos novos, correções e melhorias.
        </p>
        <div className="mt-10 flex flex-col gap-14">
          {RELEASES.map((release) => (
            <ReleaseNotes key={release.date} release={release} headingLevel="h2" />
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
