import { can, type PermissionRequest } from "@/features/auth/server/permissions.server";
import type { AdminRole } from "@/features/auth/domain/roles";

/**
 * Admin panel navigation. The server filters by role and sends the client only
 * what the person can open.
 */
export type NavIcon =
  | "home"
  | "live"
  | "usage"
  | "rooms"
  | "users"
  | "shares"
  | "entries"
  | "waitlist"
  | "reports"
  | "audit"
  | "status"
  | "mail"
  | "errors"
  | "settings"
  | "security"
  | "sessions"
  | "team";

interface NavItemDefinition {
  href: string;
  label: string;
  icon: NavIcon;
  permission?: PermissionRequest;
  /** Extra words for the command palette search. */
  keywords?: string[];
}

const NAV: { label: string; items: NavItemDefinition[] }[] = [
  {
    label: "Visão geral",
    items: [
      { href: "/admin", label: "Início", icon: "home", permission: { dashboard: ["read"] } },
      {
        href: "/admin/uso",
        label: "Uso diário",
        icon: "usage",
        permission: { dashboard: ["read"] },
        keywords: ["uso", "minutos", "navegador", "dia", "estatística"],
      },
    ],
  },
  {
    label: "Uso",
    items: [
      {
        href: "/admin/ao-vivo",
        label: "Ao vivo",
        icon: "live",
        permission: { live: ["read"] },
        keywords: ["chamada", "agora", "online", "fantasma"],
      },
      {
        href: "/admin/salas",
        label: "Salas",
        icon: "rooms",
        permission: { room: ["read"] },
        keywords: ["sala", "código", "convite"],
      },
      {
        href: "/admin/usuarios",
        label: "Participantes",
        icon: "users",
        permission: { participant: ["read"] },
        keywords: ["usuário", "conta", "pessoa", "bloquear"],
      },
      {
        href: "/admin/compartilhamentos",
        label: "Compartilhamentos",
        icon: "shares",
        permission: { shareSession: ["read"] },
        keywords: ["tela", "share"],
      },
      {
        href: "/admin/entradas",
        label: "Entradas negadas",
        icon: "entries",
        permission: { room: ["read"] },
        keywords: ["negada", "recusada", "senha", "sala cheia", "token"],
      },
      {
        href: "/admin/lista-pro",
        label: "Lista de espera do Pro",
        icon: "waitlist",
        permission: { participant: ["read"] },
        keywords: ["pro", "espera", "lançamento", "e-mail"],
      },
    ],
  },
  {
    label: "Governança",
    items: [
      {
        href: "/admin/denuncias",
        label: "Denúncias",
        icon: "reports",
        permission: { report: ["read"] },
        keywords: ["denúncia", "moderação", "mensagem", "abuso"],
      },
      {
        href: "/admin/auditoria",
        label: "Auditoria",
        icon: "audit",
        permission: { audit: ["read"] },
        keywords: ["log", "histórico", "quem fez"],
      },
    ],
  },
  {
    label: "Sistema",
    items: [
      {
        href: "/admin/status",
        label: "Status",
        icon: "status",
        permission: { system: ["status"] },
        keywords: ["saúde", "banco", "livekit", "e-mail", "versão", "deploy", "erro"],
      },
      {
        href: "/admin/emails",
        label: "E-mails",
        icon: "mail",
        permission: { mail: ["read"] },
        keywords: ["e-mail", "envio", "resend", "smtp", "teste", "confirmação"],
      },
      {
        href: "/admin/erros",
        label: "Erros",
        icon: "errors",
        permission: { audit: ["read"] },
        keywords: ["erro", "falha", "sentry", "exceção"],
      },
      {
        href: "/admin/pro",
        label: "Pro beta",
        icon: "settings",
        permission: { beta: ["read"] },
        keywords: ["piloto", "ativação", "time"],
      },
      {
        href: "/admin/equipe",
        label: "Equipe",
        icon: "team",
        permission: { user: ["ban"], adminInvitation: ["create"] },
        keywords: ["admin", "convite", "acesso", "desativar", "leitor"],
      },
      {
        href: "/admin/configuracoes",
        label: "Configurações",
        icon: "settings",
        permission: { settings: ["read"] },
        keywords: ["mascote", "saturação"],
      },
    ],
  },
  {
    label: "Minha conta",
    items: [
      {
        href: "/admin/conta/seguranca",
        label: "Segurança",
        icon: "security",
        keywords: ["2fa", "senha"],
      },
      { href: "/admin/conta/sessoes", label: "Sessões ativas", icon: "sessions" },
    ],
  },
];

interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  keywords: string[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export function navFor(role: AdminRole): NavGroup[] {
  return NAV.map((group) => ({
    label: group.label,
    items: group.items
      .filter((item) => !item.permission || can(role, item.permission))
      .map(({ href, label, icon, keywords }) => ({ href, label, icon, keywords: keywords ?? [] })),
  })).filter((group) => group.items.length > 0);
}
