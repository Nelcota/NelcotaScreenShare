import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/server/db/schema";

/**
 * The admin panel CSV exports: header, BOM, separator, auditing
 * of the export and rejection without a session or permission.
 */
const requestHeaders = { current: new Headers() };
vi.mock("@/server/request-context.server", () => ({
  requestMemo: (load: () => unknown) => load,
  requestHeaders: () => requestHeaders.current,
}));

process.env.ADMIN_AUTH_SECRET = "segredo-admin-de-teste-0123456789abcdef0123456789";
const { adminSession } = await import("./support/admin-session");
const routes = {
  salas: await import("@/features/admin/rooms/server/csv-export.server"),
  usuarios: await import("@/features/admin/participants/server/csv-export.server"),
  compartilhamentos: await import("@/features/admin/shares/server/csv-export.server"),
  auditoria: await import("@/features/admin/audit/server/csv-export.server"),
  "lista-pro": await import("@/features/admin/waitlist/server/csv-export.server"),
};

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

type Session = Awaited<ReturnType<typeof adminSession>>;
let owner: Session;
let viewer: Session;
let roomCode: string;
beforeAll(async () => {
  owner = await adminSession(db, "owner");
  viewer = await adminSession(db, "viewer");
  roomCode = `sala-csv-${Date.now().toString(36)}`;
  const [room] = await db
    .insert(schema.rooms)
    .values({
      code: roomCode,
      status: "finished",
      startedAt: new Date(Date.now() - 120_000),
      finishedAt: new Date(),
    })
    .returning();
  const [participation] = await db
    .insert(schema.roomParticipations)
    .values({
      roomId: room!.id,
      livekitIdentity: "pessoa-csv",
      livekitSid: `PA_${crypto.randomUUID()}`,
      displayName: "Pessoa Csv",
      joinedAt: new Date(Date.now() - 60_000),
    })
    .returning();
  await db.insert(schema.shareSessions).values({
    roomId: room!.id,
    participationId: participation!.id,
    trackSid: `TR_${crypto.randomUUID()}`,
    startedAt: new Date(Date.now() - 30_000),
  });
});

const EXPECTED = {
  salas: {
    header: "id;codigo;status;inicio;fim;duracao_segundos;pico;compartilhamentos",
    action: "room.export",
    filename: /^attachment; filename="salas-\d{4}-\d{2}-\d{2}\.csv"$/,
  },
  usuarios: {
    header: "id;nome;email;status;email_verificado;cadastro;ultimo_acesso;participacoes",
    action: "user.export",
    filename: /^attachment; filename="participantes-/,
  },
  compartilhamentos: {
    header: "id;sala;pessoa;inicio;fim;duracao_segundos;com_audio",
    action: "share_session.export",
    filename: /^attachment; filename="compartilhamentos-/,
  },
  auditoria: {
    header: "quando;acao;descricao;autor;email_autor;recurso;id_recurso;ip;request_id;mudancas",
    action: "audit.export",
    filename: /^attachment; filename="auditoria-/,
  },
  "lista-pro": {
    header: "email;entrou_em",
    action: "pro_interest.export",
    filename: /^attachment; filename="lista-de-espera-pro-/,
  },
} as const;

/** CSV text without losing the BOM (`Response.text()` strips it when decoding). */
async function csvText(response: Response): Promise<string> {
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(await response.arrayBuffer());
}

async function call(name: keyof typeof routes, query = "") {
  return routes[name].exportCsv(
    new Request(`http://localhost:3000/api/admin/exportar/${name}${query}`),
  );
}

describe("CSV export", () => {
  for (const name of Object.keys(routes) as (keyof typeof routes)[]) {
    it(`${name}: CSV with BOM and ";", and the export is recorded in the audit log`, async () => {
      requestHeaders.current = owner.headers;
      const response = await call(name);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
      expect(response.headers.get("content-disposition")).toMatch(EXPECTED[name].filename);
      const text = await csvText(response);
      expect(text.startsWith("\uFEFF")).toBe(true);
      const [header] = text.slice(1).split("\r\n");
      expect(header).toBe(EXPECTED[name].header);

      const audits = await db
        .select()
        .from(schema.auditLogs)
        .where(
          and(
            eq(schema.auditLogs.action, EXPECTED[name].action),
            eq(schema.auditLogs.actorAdminId, owner.id),
          ),
        );
      expect(audits).toHaveLength(1);
    });
  }

  it("salas: lists the seeded room", async () => {
    requestHeaders.current = owner.headers;
    const text = await csvText(await call("salas"));
    expect(text).toContain(roomCode);
  });

  it("the page filter applies to the export (search by code)", async () => {
    requestHeaders.current = owner.headers;
    const text = await csvText(await call("salas", `?q=${roomCode}`));
    const lines = text.slice(1).split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(2);
  });

  it("no session: 401; no export permission: 403", async () => {
    requestHeaders.current = new Headers();
    expect((await call("salas")).status).toBe(401);
    requestHeaders.current = viewer.headers;
    const forbidden = await Promise.all(
      (Object.keys(routes) as (keyof typeof routes)[]).map(
        async (name) => (await call(name)).status,
      ),
    );
    // The viewer sees the tables but cannot export any of them.
    expect(forbidden.every((status) => status === 403)).toBe(true);
  });
});
