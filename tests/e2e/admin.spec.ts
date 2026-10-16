import { createHash, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { totpFromUri } from "../integration/support/totp";
import { sql } from "./support/database";
import { newVisitor } from "./support/session";

const PASSWORD = "senha-forte-do-dono-e2e";

/** Owner invitation written straight to the database (as create-owner does). */
async function ownerInvitation(email: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await sql(
    `insert into admin_invitations (email, role, token_hash, expires_at)
     values ($1, 'owner', $2, now() + interval '30 minutes')`,
    [email, createHash("sha256").update(token).digest("hex")],
  );
  return token;
}

test("admin panel: invitation, sign-in with required 2FA, room filter and CSV export", async ({
  browser,
}) => {
  const email = `dono.${Date.now()}@exemplo.dev`;
  const token = await ownerInvitation(email);
  const roomCode = `painel-${Date.now().toString(36)}`;
  const otherCode = `outra-${Date.now().toString(36)}`;
  await sql("insert into rooms (code) values ($1)", [roomCode]);
  await sql("insert into rooms (code) values ($1)", [otherCode]);
  const { page, context } = await newVisitor(browser);

  await page.goto(`/admin/convite/${token}`);
  await page.getByLabel("Seu nome").fill("Dona do Painel");
  await page.getByLabel("Senha (pelo menos 12 caracteres)").fill(PASSWORD);
  await page.getByLabel("Repita a senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Criar acesso" }).click();
  await expect(page).toHaveURL(/\/admin\/entrar/);

  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();

  // Owner without 2FA: the panel goes straight to enabling it.
  await expect(page).toHaveURL(/\/admin\/conta\/seguranca/);
  await page.getByLabel("Confirme sua senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Ativar verificação" }).click();
  const secret = (await page.locator("code").first().textContent())?.trim() ?? "";
  await page
    .getByLabel("Código do app")
    .fill(totpFromUri(`otpauth://totp/Nelcota?secret=${secret}`));
  await page.getByRole("button", { name: "Confirmar e ativar" }).click();
  await page.getByRole("button", { name: "Guardei os códigos" }).click();

  await page.goto("/admin/salas");
  await expect(page.getByRole("cell", { name: roomCode })).toBeVisible();
  await page.getByRole("searchbox").first().fill(roomCode);
  await expect(page).toHaveURL(new RegExp(`q=${roomCode}`));

  // Same mounted table, a browser-history navigation with a different nonempty search value.
  await page.evaluate((code) => {
    const url = new URL(window.location.href);
    url.searchParams.set("q", code);
    const current = window.history.state as { idx?: number };
    const state = { ...current, idx: (current.idx ?? 0) + 1, key: "filter-history" };
    window.history.pushState(state, "", url);
    window.dispatchEvent(new PopStateEvent("popstate", { state }));
  }, otherCode);
  await expect(page.getByRole("searchbox").first()).toHaveValue(otherCode);
  await expect(page.getByRole("cell", { name: otherCode })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("searchbox").first()).toHaveValue(roomCode);
  await expect(page.getByRole("cell", { name: roomCode })).toBeVisible();

  // Search uses a GET loader and discards stale responses while typing.
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Ir para…, código da sala ou nome de alguém").fill(roomCode);
  await expect(page.getByRole("option", { name: new RegExp(roomCode) })).toBeVisible();
  const blocked = Promise.withResolvers<void>();
  const searchPattern = /\/api\/operations\/admin-search-searchPanelAction/;
  await page.route(searchPattern, async (route) => {
    await blocked.promise;
    await route.continue();
  });
  const arriving = page.waitForRequest(searchPattern);
  await page.getByPlaceholder("Ir para…, código da sala ou nome de alguém").fill(otherCode);
  try {
    await arriving;
    await expect(page.getByRole("option", { name: new RegExp(roomCode) })).toBeHidden();
  } finally {
    blocked.resolve();
  }
  await expect(page.getByRole("option", { name: new RegExp(otherCode) })).toBeVisible();
  await page.unroute(searchPattern);
  await page.keyboard.press("Escape");

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: /Exportar CSV/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.csv$/);

  // Room detail: summary, people and screen shares.
  await page.getByRole("link", { name: roomCode }).click();
  await expect(page.getByRole("heading", { name: roomCode })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Resumo" })).toBeVisible();
  await expect(page.getByText("Ninguém entrou nesta sala.")).toBeVisible();
  await expect(page.getByText("Ninguém compartilhou a tela.")).toBeVisible();

  // A note typed on one room does not follow to the next room opened from the palette.
  const note = page.getByRole("textbox", { name: "Nota interna" });
  await note.fill("Nota só desta sala");
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Ir para…, código da sala ou nome de alguém").fill(otherCode);
  await page.getByRole("option", { name: new RegExp(otherCode) }).click();
  await expect(page.getByRole("heading", { name: otherCode })).toBeVisible();
  await expect(note).toHaveValue("");
  await page.goBack();
  await expect(page.getByRole("heading", { name: roomCode })).toBeVisible();

  const audit = await sql(
    `select count(*)::int as n from audit_logs as audit
     join admin_users as actor on actor.id = audit.actor_admin_id
     where audit.action = 'room.export' and actor.email = $1`,
    [email],
  );
  expect(audit.rows[0]).toEqual({ n: 1 });

  // Participant detail: account, sessions, participations and history.
  const participantEmail = `pessoa.${Date.now()}@exemplo.dev`;
  await sql(`insert into users (name, email, email_verified) values ('Pessoa Painel', $1, true)`, [
    participantEmail,
  ]);
  // One open session, to end it from the panel below.
  await sql(
    `insert into user_sessions (user_id, token, expires_at)
     select id, $2, now() + interval '1 day' from users where email = $1`,
    [participantEmail, `sessao-${Date.now()}`],
  );
  await page.goto("/admin/usuarios");
  // Filtering waits for hydration and isolates this attempt's participant from previous retries.
  await page.getByRole("searchbox", { name: "Nome ou e-mail" }).fill(participantEmail);
  await expect(page).toHaveURL((url) => url.searchParams.get("q") === participantEmail);
  await expect(page.getByText("1 resultado", { exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: `Pessoa Painel ${participantEmail}` })).toBeVisible();
  await page.getByRole("link", { name: "Pessoa Painel" }).click();
  await expect(page.getByRole("heading", { name: "Pessoa Painel" })).toBeVisible();
  await expect(page.getByText("Ainda não entrou em nenhuma sala.")).toBeVisible();
  await expect(page.getByText("Nenhuma ação do painel nesta conta.")).toBeVisible();

  // Ending sessions asks first, like blocking and deleting; cancelling keeps them.
  await page.getByRole("button", { name: "Encerrar sessões" }).click();
  const confirm = page.getByRole("dialog");
  await expect(confirm.getByText("Encerrar as sessões desta conta?")).toBeVisible();
  await confirm.getByRole("button", { name: "Cancelar" }).click();
  const open = await sql(
    `select count(*)::int as n from user_sessions join users on users.id = user_sessions.user_id
     where users.email = $1`,
    [participantEmail],
  );
  expect(open.rows[0]).toEqual({ n: 1 });
  await page.getByRole("button", { name: "Encerrar sessões" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Encerrar" }).click();
  await expect(page.getByText("1 sessão encerrada.")).toBeVisible();

  // A mutation revalidates the page and the root without reloading the document.
  await page.goto("/admin/configuracoes");
  const saturation = page.getByRole("slider", { name: "Tema escuro" });
  await saturation.focus();
  await page.keyboard.press("ArrowLeft");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Salvo. Vale para as próximas páginas.")).toBeVisible();
  await expect(page.locator("html")).toHaveCSS("--mascot-saturation-dark", "0.95");
  await page.reload();
  await expect(saturation).toHaveAttribute("aria-valuenow", "0.95");
  await page.getByRole("button", { name: "Restaurar original" }).click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.locator("html")).toHaveCSS("--mascot-saturation-dark", "1");
  await page.goto("/admin/pro");
  await page.getByRole("textbox", { name: "Buscar contas e times" }).fill(participantEmail);
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  // Design-system controls only: no browser select, date picker or checkbox on the page
  // (Radix keeps hidden native ones for forms, marked aria-hidden).
  await expect(
    page
      .locator("main")
      .locator('select, input[type="date"], input[type="checkbox"]')
      .and(page.locator(':not([aria-hidden="true"])')),
  ).toHaveCount(0);
  // Messages come from the page, not the browser's validation bubble.
  await page.getByRole("button", { name: "Salvar ativação", exact: true }).click();
  await expect(page.getByText("Escolha a conta ou o time.")).toBeVisible();
  await page.getByRole("combobox", { name: "Conta ou time" }).click();
  await page.getByRole("option", { name: `Pessoa Painel · ${participantEmail}` }).click();
  await page.getByLabel("Limite de salas permanentes").fill("4");
  await page.getByRole("button", { name: "Salvar ativação", exact: true }).click();
  await expect(page.getByText("Escreva o motivo da alteração.")).toBeVisible();
  await page.getByLabel("Motivo da alteração").fill("Selected participant pilot");
  await page.getByRole("button", { name: "Salvar ativação", exact: true }).click();
  await expect(page.getByText("Ativação salva e registrada na auditoria.")).toBeVisible();
  // The save revalidates the page; the form keeps what was typed (it is not remounted).
  await expect(page.getByLabel("Motivo da alteração")).toHaveValue("Selected participant pilot");
  const provisioning = await sql(
    "select p.active, p.room_limit from pro_entitlements p join users u on u.id = p.user_id where u.email = $1",
    [participantEmail],
  );
  expect(provisioning.rows[0]).toEqual({ active: true, room_limit: 4 });
  const provisionAudit = await sql(
    "select count(*)::int as n from audit_logs a join admin_users u on u.id = a.actor_admin_id where a.action = 'pro.provision' and u.email = $1",
    [email],
  );
  expect(provisionAudit.rows[0]).toEqual({ n: 1 });

  await context.close();
});
