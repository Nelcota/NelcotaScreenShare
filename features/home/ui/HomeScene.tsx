import { Check } from "lucide-react";
import { useRef } from "react";
import { useHeroRecede } from "@/features/home/hooks/use-hero-recede";
import { AppHeader } from "@/components/shell/AppHeader";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { HomeEntrance } from "./HomeEntrance";
import { HomeSections } from "./HomeSections";
import { HomeStart } from "./HomeStart";

const HERO_FACTS = ["Grátis", "Sem instalar", "Sem gravação"];

/** Home page: the hero with the entry bar and the mascots, then the sections that sell it. */
export function HomeScene({
  invalidCode,
  account,
  notice,
  maxParticipants,
}: {
  invalidCode: boolean;
  /** Signed-in participant (name and photo for the navbar), or null. */
  account: { name: string; image: string | null } | null;
  notice?: string | undefined;
  /** Room size configured on the server, quoted by the sections. */
  maxParticipants: number;
}) {
  const hero = useRef<HTMLDivElement>(null);
  useHeroRecede(hero);

  return (
    <HomeEntrance className="flex flex-col items-center pb-8">
      <AppHeader account={account} data-anim="nav" className="fixed inset-x-0 top-0 z-30" />

      {/* A full screen, with a scroll cue at its foot. As the story starts, the hero steps back
          (see useHeroRecede). */}
      <div
        ref={hero}
        className="relative flex min-h-svh w-full max-w-6xl flex-col items-center justify-center px-4 pt-28 pb-12 sm:px-8"
      >
        {notice ? (
          <output className="mb-8 block w-full rounded-2xl bg-surface-2 px-4 py-3 text-center text-sm">
            {notice}
          </output>
        ) : null}
        <h1
          data-anim="title"
          className="text-center text-[clamp(3rem,8vw,6.5rem)] leading-[0.95] font-semibold tracking-[-0.05em] text-balance"
        >
          <span className="block">Mostre a tela.</span>
          <span className="block text-brand-soft">Com som e ponteiro.</span>
        </h1>
        <p
          data-anim="subtitle"
          className="mt-6 max-w-xl text-center text-lg leading-relaxed text-pretty text-ink-muted sm:text-xl"
        >
          Para times de tecnologia mostrarem um bug, revisarem uma tela ou parearem num problema.
          Direto do navegador, e quem recebe o link entra sem criar conta.
        </p>

        <div data-anim="card" className="mt-10 w-full max-w-2xl will-change-transform sm:mt-12">
          <HomeStart invalidCode={invalidCode} />
        </div>
        <ul
          data-anim="subtitle"
          aria-label="Destaques"
          className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-ink-muted"
        >
          {HERO_FACTS.map((fact) => (
            <li key={fact} className="inline-flex items-center gap-1.5">
              <Check className="size-4 text-brand-soft" aria-hidden="true" />
              {fact}
            </li>
          ))}
        </ul>
        <span
          aria-hidden="true"
          data-anim="subtitle"
          className="absolute bottom-6 left-1/2 flex h-9 w-5.5 -translate-x-1/2 justify-center rounded-full border-[1.5px] border-ink-subtle/50 pt-1.5 max-sm:hidden [@media(max-height:44rem)]:hidden"
        >
          <span className="size-1 rounded-full bg-ink-muted motion-safe:animate-[scroll-cue_1.8s_cubic-bezier(0.65,0,0.35,1)_infinite]" />
        </span>
      </div>

      <HomeSections maxParticipants={maxParticipants} />

      <SiteFooter className="mt-8" />
    </HomeEntrance>
  );
}
