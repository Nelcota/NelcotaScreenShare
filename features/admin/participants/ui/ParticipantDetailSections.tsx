import { Link } from "react-router";
import type { SocialCounts } from "@/features/admin/participants/server/social-counts.server";
import { Facts, Section } from "@/components/Section";
import { LEAVE_REASON_LABELS } from "@/features/admin/rooms/domain/labels";
import type { getParticipantDetail } from "@/features/admin/participants/server/queries.server";
import { formatDateTime, formatNumber, formatSpan } from "@/lib/format";
import { describeUserAgent } from "@/lib/user-agent";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ParticipantDetail = NonNullable<Awaited<ReturnType<typeof getParticipantDetail>>>;

/** Account data: sign-up, access, 2FA, blocking and anonymization. */
export function ParticipantAccount({
  account,
  social,
}: {
  account: ParticipantDetail["account"];
  social: SocialCounts;
}) {
  return (
    <Section title="Conta">
      <Facts
        items={[
          ["Cadastro", formatDateTime(account.createdAt)],
          ["Último acesso", account.lastSeenAt ? formatDateTime(account.lastSeenAt) : "Nunca"],
          ["E-mail confirmado", account.emailVerified ? "Sim" : "Não"],
          ["Verificação em 2 etapas", account.twoFactorEnabled ? "Ativa" : "Desligada"],
          ["Participações", formatNumber(account.participations)],
          ["Amigos", formatNumber(social.friends)],
          [
            "Bloqueios",
            `Fez ${formatNumber(social.blocksMade)} · Recebeu ${formatNumber(social.blocksReceived)}`,
          ],
          ...(account.blockedAt
            ? ([
                ["Bloqueada em", formatDateTime(account.blockedAt)],
                ["Motivo", account.blockReason ?? "—"],
              ] satisfies [string, string][])
            : []),
          ...(account.anonymizedAt
            ? ([["Anonimizada em", formatDateTime(account.anonymizedAt)]] satisfies [
                string,
                string,
              ][])
            : []),
        ]}
      />
    </Section>
  );
}

/** Where the account is signed in right now. */
export function ParticipantSessions({ sessions }: { sessions: ParticipantDetail["sessions"] }) {
  return (
    <Section
      title="Sessões ativas"
      description={sessions.length === 0 ? "Nenhuma sessão aberta." : undefined}
    >
      {sessions.length > 0 ? (
        <ul className="flex flex-col divide-y divide-line text-sm">
          {sessions.map((session) => (
            <li key={session.id} className="flex flex-col py-2">
              <span className="font-medium">{describeUserAgent(session.userAgent)}</span>
              <span className="text-ink-muted">
                {session.ipAddress ?? "IP desconhecido"} · entrou em{" "}
                {formatDateTime(session.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

function timelineNote(count: number): string | undefined {
  if (count === 0) return "Ainda não entrou em nenhuma sala.";
  // The query stops at 100 participations.
  if (count === 100) return "As 100 mais recentes.";
  return undefined;
}

/** Rooms the person joined (the 100 most recent). */
export function ParticipantTimeline({ timeline }: { timeline: ParticipantDetail["timeline"] }) {
  return (
    <Section title="Participações" description={timelineNote(timeline.length)}>
      {timeline.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sala</TableHead>
                <TableHead>Entrou</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Saída</TableHead>
                <TableHead>Compartilhou</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timeline.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-normal">
                    <Link
                      viewTransition
                      to={`/admin/salas/${item.roomId}`}
                      className="font-sans text-xs tabular-nums hover:underline"
                    >
                      {item.roomCode}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDateTime(item.joinedAt)}</TableCell>
                  <TableCell>{formatSpan(item.joinedAt, item.leftAt)}</TableCell>
                  <TableCell className="whitespace-normal text-ink-muted">
                    {item.leaveReason ? (LEAVE_REASON_LABELS[item.leaveReason] ?? "—") : "Na sala"}
                  </TableCell>
                  <TableCell className="whitespace-normal tabular-nums">
                    {item.shares === 0 ? "—" : `${item.shares}×`}
                  </TableCell>
                  <TableCell className="font-sans text-xs whitespace-normal tabular-nums">
                    {item.ip ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </Section>
  );
}
