import { Link, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { TIME_ZONE } from "@/lib/format";

export function RoomHistory({
  account,
  room,
  history,
}: {
  account: { name: string; image: string | null };
  room: { name: string | null; code: string; teamId: string | null };
  history: {
    items: {
      id: string;
      startedAt: Date | null;
      createdAt: Date;
      closedAt: Date | null;
      status: string;
      participants: number;
      shares: number;
    }[];
    next: string | null;
  };
}) {
  const [search] = useSearchParams();
  return (
    <WorkspaceShell
      account={account}
      title={room.name ?? "Histórico da sala"}
      description="Cada chamada tem um registro separado com data, duração e totais de participação e compartilhamento."
    >
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link to={room.teamId ? `/times/${room.teamId}` : "/salas"}>Voltar às salas</Link>
        </Button>
        <Button asChild>
          <Link to={`/sala/${room.code}`}>Abrir sala</Link>
        </Button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-120 text-left text-sm">
          <caption className="sr-only">Histórico de chamadas</caption>
          <thead className="bg-surface-2">
            <tr>
              {["Data", "Duração", "Pessoas", "Telas"].map((label) => (
                <th key={label} scope="col" className="p-4">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.items.map((item) => (
              <tr key={item.id} className="border-t border-line">
                <td className="p-4">
                  {new Date(item.startedAt ?? item.createdAt).toLocaleString("pt-BR", {
                    timeZone: TIME_ZONE,
                  })}
                </td>
                <td className="p-4">{duration(item)}</td>
                <td className="p-4">{item.participants}</td>
                <td className="p-4">{item.shares}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!history.items.length ? (
          <p className="p-8 text-center text-ink-muted">Nenhuma chamada registrada.</p>
        ) : null}
      </div>
      <div className="flex gap-2">
        {search.has("antes") ? (
          <Button asChild variant="outline">
            <Link to="?">Mais recentes</Link>
          </Button>
        ) : null}
        {history.next ? (
          <Button asChild variant="outline">
            <Link to={`?antes=${encodeURIComponent(history.next)}`}>Mais antigas</Link>
          </Button>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}
function duration(item: { startedAt: Date | null; closedAt: Date | null; status: string }) {
  if (!item.startedAt) return "Não iniciada";
  if (!item.closedAt) return "Em andamento";
  const seconds = Math.max(
    0,
    Math.round((new Date(item.closedAt).getTime() - new Date(item.startedAt).getTime()) / 1000),
  );
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}
