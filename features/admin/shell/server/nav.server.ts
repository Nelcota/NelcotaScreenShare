import { can, type PermissionRequest } from "@/features/auth/server/permissions.server";
import type { AdminRole } from "@/features/auth/domain/roles";

/**
 * Admin panel navigation. The server filters by role and sends the client only
 * what the person can open.
 */
export type NavIcon =
  | "home"
  | "rooms"
  | "users"
  | "shares"
  | "audit"
  | "settings"
  | "security"
  | "sessions";

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
    items: [{ href: "/admin", label: "Início", icon: "home", permission: { dashboard: ["read"] } }],
  },
  {
    label: "Uso",
    items: [
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
    ],
  },
  {
    label: "Governança",
    items: [
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
        href: "/admin/pro",
        label: "Pro beta",
        icon: "settings",
        permission: { beta: ["read"] },
        keywords: ["piloto", "ativação", "time"],
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
