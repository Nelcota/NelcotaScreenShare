import { expect, test } from "@playwright/test";
import { newParticipant, joinRoom, expectNoHorizontalScroll } from "./support/session";
import { accountHeaders, joinControlled, signalStatus } from "./support/host-controls";
import { pilotAccount, pilotTeam, workspaceSql } from "./support/workspaces";
import { z } from "zod";

test.skip(
  process.env.E2E_HOST_CONTROLS !== "true",
  "Requires the private signaling admission gate",
);

test("permanent rooms: favorite, rename, two calls, history and archive reuse one link", async ({
  browser,
}) => {
  const person = await newParticipant(browser, "Criador Permanente");
  await pilotAccount(person);
  try {
    const forged = await person.context.request.post(
      "/api/operations/admin-beta-provisionBetaAction",
      {
        headers: await accountHeaders(person),
        data: {
          input: {
            subject: "account",
            id: crypto.randomUUID(),
            active: true,
            roomLimit: 50,
            expiresAt: null,
            reason: "Forged self provisioning",
          },
        },
      },
    );
    expect(z.object({ serverError: z.string() }).parse(await forged.json()).serverError).toContain(
      "Sua sessão expirou",
    );
    await person.page.goto("/salas");
    await person.page.getByRole("button", { name: "Nova sala", exact: true }).click();
    // Only spaces: the message shows under the field and the dialog stays open.
    await person.page.getByLabel("Nome da sala", { exact: true }).fill("   ");
    await person.page.getByRole("button", { name: "Criar sala", exact: true }).click();
    await expect(person.page.getByText("Use pelo menos 2 caracteres.")).toBeVisible();
    await expect(person.page.getByRole("dialog", { name: "Nova sala permanente" })).toBeVisible();
    await person.page.getByLabel("Nome da sala", { exact: true }).fill("Encontro semanal");
    await person.page.getByRole("button", { name: "Criar sala", exact: true }).click();
    const card = person.page.getByRole("article").filter({ hasText: "Encontro semanal" });
    const href = await card.getByRole("link", { name: "Abrir sala" }).getAttribute("href");
    if (!href) throw new Error("Room link missing");
    const code = href.split("/").at(-1) ?? "";
    await card.getByRole("button", { name: "Favoritar Encontro semanal" }).click();
    await expect(card.getByRole("button", { name: "Desfavoritar Encontro semanal" })).toBeVisible();
    await card.getByRole("button", { name: "Editar", exact: true }).click();
    await person.page.getByLabel("Nome da sala", { exact: true }).fill("Ritual do time");
    await person.page.getByRole("button", { name: "Salvar sala", exact: true }).click();
    const renamed = person.page.getByRole("article").filter({ hasText: "Ritual do time" });
    await expect(renamed.getByRole("link", { name: "Abrir sala" })).toHaveAttribute("href", href);
    await joinRoom(person.page, code);
    await person.page.getByRole("button", { name: "Controles do anfitrião" }).click();
    await person.page
      .getByRole("button", { name: "Encerrar chamada para todos", exact: true })
      .click();
    await person.page.getByRole("button", { name: "Encerrar chamada", exact: true }).click();
    await expect(
      person.page.getByRole("heading", { name: "A chamada foi encerrada" }),
    ).toBeVisible();
    await joinRoom(person.page, code);
    await person.page.getByRole("button", { name: "Controles do anfitrião" }).click();
    await person.page
      .getByRole("button", { name: "Encerrar chamada para todos", exact: true })
      .click();
    await person.page.getByRole("button", { name: "Encerrar chamada", exact: true }).click();
    await expect(
      person.page.getByRole("heading", { name: "A chamada foi encerrada" }),
    ).toBeVisible();
    await person.page.goto("/salas");
    await renamed.getByRole("link", { name: "Histórico" }).click();
    await expect(person.page.getByRole("table").locator("tbody tr")).toHaveCount(2);
    await person.page.goto("/salas");
    await person.page.setViewportSize({ width: 390, height: 760 });
    await expectNoHorizontalScroll(person.page);
    await person.page.screenshot({
      path: test.info().outputPath("permanent-rooms-mobile.png"),
      animations: "disabled",
    });
    await renamed.getByRole("button", { name: "Arquivar", exact: true }).click();
    const archived = person.page.waitForResponse(
      (response) =>
        response.url().includes("rooms-roomWorkspaceAction") &&
        response.request().method() === "POST",
    );
    await person.page.getByRole("button", { name: "Arquivar sala", exact: true }).click();
    await archived;
    await expect(person.page.getByRole("button", { name: "Nova sala", exact: true })).toBeEnabled();
    await expect(renamed).toHaveCount(0);
    await person.page.getByRole("radio", { name: "Arquivadas", exact: true }).click();
    await renamed.getByRole("button", { name: "Desfavoritar Ritual do time" }).click();
    await expect(renamed.getByRole("button", { name: "Favoritar Ritual do time" })).toBeDisabled();
    await person.page.goto(href);
    await expect(person.page.getByRole("heading", { name: "Sala indisponível" })).toBeVisible();
  } finally {
    await person.context.close();
  }
});

test("team invitations, tenant isolation, removal and stale Pro pages enforce current permissions", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const owner = await newParticipant(browser, "Dono Workspace");
  const recipient = await newParticipant(browser, "Membro Workspace");
  const otherOwner = await newParticipant(browser, "Outro Workspace");
  await pilotAccount(owner);
  await pilotAccount(recipient);
  await pilotAccount(otherOwner);
  try {
    await otherOwner.page.goto("/times");
    await otherOwner.page.getByLabel("Nome do time").fill("Outro time");
    await otherOwner.page.getByRole("button", { name: "Criar time", exact: true }).click();
    await expect(otherOwner.page).toHaveURL(/\/times\/[\w-]{36}$/);
    const otherTeamUrl = otherOwner.page.url();
    await owner.page.goto("/times");
    await owner.page.getByLabel("Nome do time").fill("   ");
    await owner.page.getByRole("button", { name: "Criar time", exact: true }).click();
    await expect(owner.page.getByText("Use pelo menos 2 caracteres.")).toBeVisible();
    await owner.page.getByLabel("Nome do time").fill("Time de produto");
    await owner.page.getByRole("button", { name: "Criar time", exact: true }).click();
    await expect(owner.page).toHaveURL(/\/times\/[\w-]{36}$/);
    const teamId = owner.page.url().split("/").at(-1) ?? "";
    await pilotTeam(teamId);
    await owner.page.reload();
    await owner.page.getByLabel("E-mail da pessoa").fill(recipient.email);
    await owner.page.getByRole("button", { name: "Gerar convite", exact: true }).click();
    const link = owner.page.getByLabel("Link do convite");
    await expect(link).toBeVisible();
    const invitation = await link.inputValue();
    await recipient.page.goto(invitation);
    await recipient.page.getByRole("button", { name: "Aceitar convite" }).click();
    await expect(
      recipient.page.getByRole("heading", { name: "Time de produto", exact: true }),
    ).toBeVisible();
    await expect(
      recipient.page.getByRole("button", { name: "Nova sala", exact: true }),
    ).toBeHidden();
    await recipient.page.goto(otherTeamUrl);
    await expect(
      recipient.page.getByRole("heading", { name: "Outro time", exact: true }),
    ).toBeHidden();
    expect(
      (
        await recipient.context.request.get(otherTeamUrl, {
          headers: await accountHeaders(recipient),
        })
      ).status(),
    ).toBe(404);
    await owner.page.getByRole("button", { name: "Nova sala", exact: true }).click();
    await owner.page.getByLabel("Nome da sala", { exact: true }).fill("Reunião produto");
    await owner.page.getByRole("button", { name: "Criar sala", exact: true }).click();
    const card = owner.page.getByRole("article").filter({ hasText: "Reunião produto" });
    const href = await card.getByRole("link", { name: "Abrir sala" }).getAttribute("href");
    if (!href) throw new Error("Team room missing");
    const code = href.split("/").at(-1) ?? "";
    await joinControlled(owner, code);
    const credentials = await joinControlled(recipient, code);
    // A second tab exercises workspace removal while the owner's call stays connected.
    const manage = await owner.context.newPage();
    await manage.goto(`/times/${teamId}`);
    await manage
      .getByRole("listitem")
      .filter({ hasText: "Membro Workspace" })
      .getByRole("button", { name: "Remover", exact: true })
      .click();
    const removed = manage.waitForResponse(
      (response) =>
        response.url().includes("team-teamWorkspaceAction") &&
        response.request().method() === "POST",
    );
    await manage.getByRole("button", { name: "Confirmar remoção" }).click();
    await removed;
    await expect(manage.getByRole("dialog")).toBeHidden();
    await expect(manage.getByRole("listitem").filter({ hasText: "Membro Workspace" })).toHaveCount(
      0,
    );
    expect(await signalStatus(credentials.serverUrl, credentials.token)).toBe(403);
    const listResponse = await recipient.context.request.get(`/times/${teamId}`, {
      headers: await accountHeaders(recipient),
    });
    expect(listResponse.status()).toBe(404);
    await workspaceSql("update pro_entitlements set active = false where team_id = $1", [teamId]);
    const denied = await owner.context.request.post("/api/operations/rooms-roomWorkspaceAction", {
      headers: await accountHeaders(owner),
      data: {
        input: {
          kind: "create",
          teamId,
          name: "Stale creation",
          allowGuests: false,
          memberCanHost: false,
        },
      },
    });
    expect(z.object({ serverError: z.string() }).parse(await denied.json()).serverError).toContain(
      "Pro beta ativo",
    );
    await manage.reload();
    await expect(manage.getByRole("button", { name: "Nova sala", exact: true })).toBeDisabled();
    await manage.screenshot({
      path: test.info().outputPath("team-workspace-desktop.png"),
      animations: "disabled",
    });
    await manage.close();
  } finally {
    await Promise.all([
      owner.context.close(),
      recipient.context.close(),
      otherOwner.context.close(),
    ]);
  }
});
