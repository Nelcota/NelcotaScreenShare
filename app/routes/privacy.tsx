import { Link, type MetaFunction } from "react-router";
import {
  ArrowRight,
  Ban,
  Clock,
  Download,
  Flag,
  Fingerprint,
  Hand,
  Handshake,
  Hourglass,
  Landmark,
  MessageSquare,
  ScrollText,
  ShieldCheck,
  Trash2,
  UserRound,
  UserRoundCheck,
  VideoOff,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { BackLink } from "@/components/shell/BackLink";
import { ParticipantHeader } from "@/components/shell/ParticipantHeader";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { PrivacyItem, PrivacyList, PrivacySection } from "@/features/privacy/ui/PrivacySection";
import { PrivacyToc } from "@/features/privacy/ui/PrivacyToc";
import { StoredDataSections } from "@/features/privacy/ui/StoredDataSections";
import { INDEXABLE, originFromMatches, pageMeta } from "@/lib/seo";

export const handle = INDEXABLE;

export const meta: MetaFunction = ({ matches }) =>
  pageMeta({
    title: "Aviso de privacidade · Nelcota",
    description: "Quais dados o Nelcota guarda, por quê e por quanto tempo.",
    path: "/privacidade",
    origin: originFromMatches(matches),
  });

const SECTIONS = [
  { id: "o-que-guardamos", label: "O que guardamos" },
  { id: "o-que-nao-guardamos", label: "O que não guardamos" },
  { id: "por-que", label: "Por quê" },
  { id: "por-quanto-tempo", label: "Prazos" },
  { id: "seus-direitos", label: "Direitos" },
];

const HIGHLIGHTS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: VideoOff,
    title: "Nada da chamada é gravado",
    text: "Áudio, vídeo, tela e o chat da sala passam ao vivo e somem quando a sala acaba.",
  },
  {
    icon: ShieldCheck,
    title: "Só o necessário",
    text: "Conta, segurança, mensagens e registros de acesso exigidos por lei.",
  },
  {
    icon: UserRoundCheck,
    title: "Você no controle",
    text: "Baixe seus dados ou exclua a conta.",
  },
];

function RightsLink({
  to,
  icon,
  title,
  detail,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <Link
      viewTransition
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-4 transition-colors hover:bg-surface-3 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-ink-muted">{detail}</span>
      </span>
      <ArrowRight className="icon-nudge size-4 text-ink-subtle" aria-hidden="true" />
    </Link>
  );
}

function Duration({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/12 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-brand-soft">
      <Clock className="size-3.5" aria-hidden="true" />
      {children}
    </span>
  );
}

function PurposeAndRetentionSections() {
  return (
    <>
      <p className="text-sm text-ink-muted">
        Convites de time expiram em 7 dias. Registros de convites expirados, aceitos ou revogados
        são removidos após 30 dias. Salas arquivadas conservam o histórico para quem mantém acesso.
        Ao excluir a conta, seus favoritos e vínculos são removidos; você pode transferir seus times
        ou confirmar a exclusão deles.
      </p>
      <PrivacySection id="por-que" index={3} title="Por quê">
        <PrivacyList>
          <PrivacyItem icon={Wrench} title="Para você usar o serviço">
            Criar e entrar em salas e falar com seus amigos.
          </PrivacyItem>
          <PrivacyItem icon={Landmark} title="Para cumprir a lei">
            Registros de acesso a aplicações são guardados por 6 meses (Marco Civil da Internet,
            art. 15).
          </PrivacyItem>
          <PrivacyItem icon={ShieldCheck} title="Para segurança">
            Evitar abuso, bloquear tentativas de invasão e investigar incidentes.
          </PrivacyItem>
        </PrivacyList>
      </PrivacySection>

      <PrivacySection id="por-quanto-tempo" index={4} title="Por quanto tempo">
        <PrivacyList>
          <PrivacyItem
            icon={UserRound}
            title="Conta"
            aside={<Duration>Enquanto existir</Duration>}
          />
          <PrivacyItem
            icon={Fingerprint}
            title="Registros de acesso (IP)"
            aside={<Duration>6 meses</Duration>}
          />
          <PrivacyItem
            icon={ScrollText}
            title="Registros de auditoria (IP)"
            aside={<Duration>5 anos</Duration>}
          />
          <PrivacyItem
            icon={MessageSquare}
            title="Mensagens"
            aside={<Duration>Até quem enviou apagar</Duration>}
          />
          <PrivacyItem
            icon={Flag}
            title="Cópia da mensagem denunciada"
            aside={<Duration>Até a denúncia ser avaliada</Duration>}
          />
          <PrivacyItem
            icon={Handshake}
            title="Amigos e bloqueios"
            aside={<Duration>Até você desfazer</Duration>}
          >
            Ou até excluir a conta.
          </PrivacyItem>
          <PrivacyItem icon={Hand} title="Pedidos de entrada" aside={<Duration>7 dias</Duration>} />
          <PrivacyItem icon={Ban} title="Remoções de chamada" aside={<Duration>7 dias</Duration>} />
          <PrivacyItem
            icon={Hourglass}
            title="Nome nas participações"
            aside={<Duration>12 meses</Duration>}
          >
            Depois disso, anonimizado.
          </PrivacyItem>
        </PrivacyList>
      </PrivacySection>
    </>
  );
}

function RightsSection() {
  return (
    <PrivacySection
      id="seus-direitos"
      index={5}
      title="Seus direitos"
      description="Em Minha conta você baixa todos os seus dados e exclui a conta."
    >
      <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <RightsLink
            to="/conta#privacidade"
            icon={<Download className="size-5 shrink-0 text-brand-soft" aria-hidden="true" />}
            title="Baixar meus dados"
            detail="Arquivo JSON completo"
          />
          <RightsLink
            to="/conta#excluir"
            icon={<Trash2 className="size-5 shrink-0 text-danger" aria-hidden="true" />}
            title="Excluir conta"
            detail="Não pode ser desfeito"
          />
        </div>
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          Outros pedidos sobre seus dados são respondidos em até 15 dias.
        </p>
      </div>
    </PrivacySection>
  );
}

/**
 * Technical summary of data processing (LGPD). The final legal text is the
 * responsibility of whoever operates the service (see docs/archive/admin-plan.md §7.2).
 */
export default function PrivacyPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <ParticipantHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
        <BackLink className="mb-8" />
        <header className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-sm font-medium text-ink-muted">
            <ShieldCheck className="size-4.5 text-brand-soft" aria-hidden="true" />
            LGPD · Marco Civil da Internet
          </span>
          <h1 className="mt-5 text-3xl font-semibold tracking-[-0.025em] text-balance sm:text-4xl">
            Aviso de privacidade
          </h1>
          <p className="mt-3 text-base leading-relaxed text-pretty text-ink-muted sm:text-lg">
            Este resumo explica quais dados o Nelcota guarda, por quê e por quanto tempo.
          </p>
        </header>

        <ul aria-label="Resumo" className="mt-8 grid gap-3 sm:grid-cols-3">
          {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-2xl border border-line bg-surface p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-brand/12 text-brand-soft">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <p className="mt-4 text-sm font-medium">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{text}</p>
            </li>
          ))}
        </ul>

        <div className="sticky top-3 z-10 mt-10">
          <PrivacyToc items={SECTIONS} />
        </div>

        <div className="mt-10">
          <div className="flex flex-col gap-14">
            <StoredDataSections />
            <PurposeAndRetentionSections />
            <RightsSection />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
