import { Check } from "lucide-react";
import { HomeStart } from "./HomeStart";

const FACTS = ["Grátis", "Sem instalar nada", "Sem cartão"];

/**
 * Closing call to action: the same bar as the top of the page, mascots included, so whoever
 * reads to the end creates the room right here.
 */
export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="mt-12 w-full sm:mt-20">
      <div className="page-column flex min-h-[70svh] flex-col items-center justify-center gap-6 py-24 text-center">
        <h2
          id="cta-title"
          className="text-[clamp(2.75rem,7vw,6rem)] leading-[0.95] font-semibold tracking-[-0.05em] text-balance"
        >
          Mostre sua tela.
          <span className="block text-brand-soft">Agora.</span>
        </h2>
        <p className="max-w-lg text-lg leading-relaxed text-pretty text-ink-muted sm:text-xl">
          Crie a sala, mande o link e, em menos de um minuto, todo mundo está vendo a mesma tela.
        </p>
        <div className="mt-4 w-full max-w-2xl">
          <HomeStart invalidCode={false} focusShortcut={false} />
        </div>
        <ul
          aria-label="Condições"
          className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-ink-muted"
        >
          {FACTS.map((fact) => (
            <li key={fact} className="inline-flex items-center gap-1.5">
              <Check className="size-4 text-brand-soft" aria-hidden="true" />
              {fact}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
