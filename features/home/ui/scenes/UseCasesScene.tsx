import type { ReactNode } from "react";
import { BugArt, PairingArt, ReviewArt } from "./UseCaseArt";

const CASES: { title: string; text: string; uses: string; art: ReactNode }[] = [
  {
    title: "Mostrar um bug.",
    text: "Reproduza o erro ao vivo, com o som do computador, e o time vê o mesmo que você.",
    uses: "Som do computador · Tela, janela ou aba",
    art: <BugArt />,
  },
  {
    title: "Revisar uma tela.",
    text: "Design e produto apontam o que querem mudar na tela de quem apresenta, com o nome de cada um no ponteiro.",
    uses: "Ponteiro compartilhado · Reações e mão levantada",
    art: <ReviewArt />,
  },
  {
    title: "Parear num problema.",
    text: "Uma pessoa conduz e a outra acompanha numa janela flutuante por cima do editor.",
    uses: "Janela flutuante · Atalhos de teclado",
    art: <PairingArt />,
  },
];

/**
 * The three moments the product is built for, one row each, the picture alternating sides.
 * No pinned motion here: the scenes around it already move, and this part is for reading.
 */
export function UseCasesScene() {
  return (
    <section id="para-times" aria-labelledby="use-cases-title" className="w-full">
      <div className="flex flex-col gap-12 py-28 sm:gap-16 sm:py-40">
        <h2
          id="use-cases-title"
          className="page-column text-[clamp(2.25rem,6vw,5rem)] leading-[1] font-semibold tracking-[-0.045em]"
        >
          No dia a dia
          <br />
          <span className="text-ink-subtle">do time.</span>
        </h2>
        <ol data-cases-track className="page-column flex flex-col gap-20 md:gap-24">
          {CASES.map(({ title, text, uses, art }, index) => (
            <li
              key={title}
              className="flex flex-col gap-6 md:flex-row md:items-center md:gap-12 md:even:flex-row-reverse"
            >
              <div className="md:w-1/2">{art}</div>
              <div className="flex flex-col gap-3 md:w-1/2">
                <span className="text-sm font-medium text-ink-subtle tabular-nums">
                  0{index + 1}
                </span>
                <h3 className="text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.05] font-semibold tracking-[-0.04em]">
                  {title}
                </h3>
                <p className="text-base leading-relaxed text-pretty text-ink-muted">{text}</p>
                <p className="text-sm font-medium text-brand-soft">{uses}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
