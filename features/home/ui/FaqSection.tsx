import { ArrowRight, ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { SectionIntro } from "./SectionIntro";

function faqItems(maxParticipants: number): { question: string; answer: string }[] {
  return [
    {
      question: "Preciso instalar alguma coisa?",
      answer: "Não. A sala abre no navegador, no computador ou no celular.",
    },
    {
      question: "Quem eu convido precisa criar conta?",
      answer:
        "Não. Quem recebe o link entra só com o nome, como convidado. A conta é só para quem abre a sala.",
    },
    {
      question: "Quanto custa?",
      answer:
        "O plano Grátis não tem prazo nem pede cartão. O Pro vai custar R$ 19 por pessoa por mês. Deixe seu e-mail na seção de preços para saber quando abrir.",
    },
    {
      question: "O som do computador vai junto com a tela?",
      answer:
        "No Chrome e no Edge, sim. No Firefox e no Safari, a tela vai sem o som do computador.",
    },
    {
      question: "Funciona no celular?",
      answer:
        "Para assistir, falar e usar o chat, sim. Para compartilhar a tela, use o computador.",
    },
    {
      question: "Quantas pessoas cabem numa sala?",
      answer: `Até ${maxParticipants} pessoas.`,
    },
    {
      question: "As chamadas ficam gravadas?",
      answer: "Não. Áudio, vídeo, telas e chat passam ao vivo e não são guardados.",
    },
    {
      question: "O que vocês guardam sobre mim?",
      answer:
        "Só o necessário para a conta e para o histórico de acesso às salas. Na página da conta você baixa esses dados ou exclui a conta, como prevê a LGPD.",
    },
  ];
}

/** Nelcota's side of the conversation: its icon at the foot of each answer. */
function NelcotaSays({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-end gap-2.5">
      <img src="/icon.png" alt="" width={32} height={32} className="size-8 shrink-0 rounded-lg" />
      <span className="max-w-[85%] rounded-[1.4rem] rounded-bl-md border border-line bg-surface-2 px-4 py-2.5 text-base leading-relaxed text-pretty">
        {children}
      </span>
    </span>
  );
}

/** How many questions the chat shows before "Ver mais". */
const FIRST_QUESTIONS = 3;

/**
 * Last objections as a chat, like the one in the room: the visitor's questions on the
 * right, Nelcota's answers on the left. The first few show; a button opens the rest, and
 * the privacy notice stays as the last message. Under the bubbles it is a list of
 * questions and answers.
 */
export function FaqSection({ maxParticipants }: { maxParticipants: number }) {
  const listId = useId();
  const [expanded, setExpanded] = useState(false);
  const items = faqItems(maxParticipants);
  const shown = expanded ? items : items.slice(0, FIRST_QUESTIONS);
  const hidden = items.length - FIRST_QUESTIONS;

  return (
    <section aria-labelledby="faq-title" className="w-full max-w-5xl">
      <SectionIntro id="faq-title" title="Perguntas" subtitle="frequentes." align="center" />

      <div data-fx className="mx-auto mt-12 flex max-w-2xl flex-col gap-3 sm:mt-16">
        <dl id={listId} className="flex flex-col gap-3">
          {shown.map(({ question, answer }) => (
            <div key={question} className="flex flex-col gap-3">
              <dt className="max-w-[85%] self-end rounded-[1.4rem] rounded-br-md bg-brand px-4 py-2.5 text-base font-medium text-brand-ink">
                {question}
              </dt>
              <dd>
                <NelcotaSays>{answer}</NelcotaSays>
              </dd>
            </div>
          ))}
        </dl>

        {hidden > 0 ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setExpanded((open) => !open)}
            className="inline-flex items-center gap-1.5 self-center rounded-full border border-line px-4 py-2 text-sm font-medium text-ink-muted transition-colors duration-(--motion-feedback) hover:border-line-strong hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {expanded ? "Mostrar menos" : `Ver mais ${hidden} perguntas`}
            <ChevronDown
              className={cn(
                "size-4 transition-transform duration-(--motion-surface) motion-reduce:transition-none",
                expanded && "rotate-180",
              )}
              aria-hidden="true"
            />
          </button>
        ) : null}

        <dl className="pt-3">
          <dt className="sr-only">E sobre privacidade?</dt>
          <dd>
            <NelcotaSays>
              Os detalhes estão no{" "}
              <Link
                viewTransition
                to="/privacidade"
                className="inline-flex items-center gap-1 font-medium text-brand-soft underline-offset-4 hover:underline"
              >
                aviso de privacidade
                <ArrowRight className="icon-nudge size-4" aria-hidden="true" />
              </Link>
            </NelcotaSays>
          </dd>
        </dl>
      </div>
    </section>
  );
}
