import type { AuditRow } from "../server/queries.server";
/** pt-BR labels for the audit log actions (an unknown one is shown as is). */
const ACTION_LABELS: Record<string, string> = {
  "auth.sign_in": "Entrou no painel",
  "auth.sign_in_failed": "Login recusado",
  "auth.lockout": "Conta bloqueada por tentativas",
  "auth.two_factor_enabled": "Ativou o 2FA",
  "auth.two_factor_disabled": "Desativou o 2FA",
  "auth.password_changed": "Trocou a senha",
  "auth.password_reset": "Redefiniu a senha",
  "admin_invitation.accept": "Aceitou convite de admin",
  "admin_session.revoke": "Encerrou uma sessão",
  "admin_session.revoke_others": "Encerrou as outras sessões",
  "settings.update": "Alterou configurações",
  "audit.export": "Exportou o audit log",
  "user.self_delete": "Excluiu a própria conta",
  "user.block": "Bloqueou participante",
  "user.unblock": "Desbloqueou participante",
  "user.delete": "Excluiu participante",
  "user.restore": "Restaurou participante",
  "user.sessions_revoke": "Encerrou sessões do participante",
  "user.verification_resend": "Reenviou confirmação de e-mail",
  "user.anonymize": "Anonimizou participante (LGPD)",
  "user.export": "Exportou participantes",
  "room.update": "Alterou a nota da sala",
  "room.delete": "Excluiu sala",
  "room.restore": "Restaurou sala",
  "room.export": "Exportou salas",
  "room.host_claim": "Assumiu como anfitrião",
  "room.host_transfer": "Elegeu novo anfitrião por ausência",
  "room.transfer": "Transferiu a função de anfitrião",
  "room.lock": "Alterou o bloqueio de entradas",
  "room.sharing": "Alterou quem pode compartilhar tela",
  "room.remove": "Removeu pessoa da chamada",
  "room.close": "Encerrou a sala para todos",
  "share_session.export": "Exportou compartilhamentos",
  "room_invite.create": "Criou convite de sala",
  "room_invite.revoke": "Revogou convite de sala",
};

const RESOURCE_LABELS: Record<string, string> = {
  admin_user: "Admin",
  admin_session: "Sessão de admin",
  admin_invitation: "Convite de admin",
  app_settings: "Configuração",
  audit_logs: "Audit log",
  user: "Participante",
  room: "Sala",
  room_session: "Chamada",
  room_invite: "Convite de sala",
  share_session: "Compartilhamento",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function resourceLabel(resourceType: string): string {
  return RESOURCE_LABELS[resourceType] ?? resourceType;
}

/** Who did it: admin by name, a flagged participant, or the system itself. */
export function actorText(actor: AuditRow["actor"]): string {
  if (actor.kind === "admin") return actor.name;
  if (actor.kind === "user") return `${actor.name} (participante)`;
  return "Sistema";
}
