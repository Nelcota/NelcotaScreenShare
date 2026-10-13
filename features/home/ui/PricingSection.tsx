import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { CreateRoomButton } from "./CreateRoomButton";
import { ProWaitlistForm } from "./ProWaitlistForm";
import { SectionIntro } from "./SectionIntro";

function Plan({
  name,
  price,
  unit,
  summary,
  badge,
  features,
  children,
}: {
  name: string;
  price: string;
  unit: string;
  summary: string;
  badge?: string;
  features: string[];
  children: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-8 rounded-3xl border border-line p-6 transition-colors duration-(--motion-feedback) hover:border-line-strong sm:p-10 md:row-span-3 md:grid md:grid-rows-subgrid">
      <div className="flex flex-col gap-4">
        <h3 className="flex items-center gap-2.5 text-xl font-semibold tracking-[-0.02em]">
          {name}
          {badge ? (
            <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-medium text-brand-soft">
              {badge}
            </span>
          ) : null}
        </h3>
        <p className="flex items-baseline gap-2">
          <span className="text-[clamp(3rem,7vw,4.5rem)] leading-none font-semibold tracking-[-0.05em] tabular-nums">
            {price}
          </span>
          <span className="text-base text-ink-muted">{unit}</span>
        </p>
        <p className="max-w-sm text-base text-pretty text-ink-muted">{summary}</p>
      </div>
      <div>{children}</div>
      <ul className="flex flex-col divide-y divide-line border-t border-line text-sm">
        {features.map((feature) => (
          <li key={feature} className="flex gap-3 py-3">
            <Check className="mt-0.5 size-4 shrink-0 text-brand-soft" aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>
    </li>
  );
}

/**
 * Free today, Pro announced. The free plan lists only what the product does now; the Pro
 * has no checkout yet, so it collects e-mails for the launch. Each card
 * puts its action right under the price, before the list; side by side, the cards share
 * rows (subgrid), so both lists start at the same height.
 */
export function PricingSection({ maxParticipants }: { maxParticipants: number }) {
  return (
    <section id="precos" aria-labelledby="pricing-title" className="w-full max-w-5xl scroll-mt-28">
      <SectionIntro id="pricing-title" title="Preços." subtitle="Comece grátis." align="center" />

      <ul data-fx className="mt-12 grid gap-4 sm:mt-16 md:grid-cols-2 md:gap-y-8">
        <Plan
          name="Grátis"
          price="R$ 0"
          unit="para sempre"
          summary="Para mostrar a tela ao time."
          features={[
            `Salas de até ${maxParticipants} pessoas`,
            "Convidados entram só com o link",
            "Som do computador, ponteiro, chat e reações",
          ]}
        >
          <CreateRoomButton className="w-full" />
        </Plan>
        <Plan
          name="Pro"
          price="R$ 19"
          unit="por pessoa/mês"
          badge="Em breve"
          summary="Para times que usam o Nelcota todos os dias."
          features={[
            "Salas maiores",
            "Sem limite de tempo nas salas",
            "Salas fixas do time, com link permanente",
            "Painel do time: histórico, membros e convites",
          ]}
        >
          <ProWaitlistForm />
        </Plan>
      </ul>
    </section>
  );
}
