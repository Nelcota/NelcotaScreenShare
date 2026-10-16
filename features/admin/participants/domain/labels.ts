import type { BadgeTone } from "@/components/StatusBadge";
import { PARTICIPANT_STATUSES, type ParticipantStatus } from "./search-params";

export const STATUS_LABELS: Record<ParticipantStatus, { label: string; tone: BadgeTone }> = {
  ativo: { label: "Ativa", tone: "success" },
  nao_verificado: { label: "Não verificada", tone: "warning" },
  bloqueado: { label: "Bloqueada", tone: "danger" },
  excluido: { label: "Excluída", tone: "neutral" },
};

export const STATUS_OPTIONS = PARTICIPANT_STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS[value].label,
}));

export const SORT_OPTIONS = [
  { value: "cadastro", label: "Cadastro" },
  { value: "acesso", label: "Último acesso" },
  { value: "participacoes", label: "Participações" },
] as const;

/** What blocking does, shown before confirming one or many accounts. */
export const BLOCK_DESCRIPTION =
  "As sessões são encerradas e a pessoa não consegue entrar nem participar de salas até ser desbloqueada.";
