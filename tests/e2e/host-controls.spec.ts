import { expect, test } from "@playwright/test";
import {
  joinRoom,
  newParticipant,
  newRoomCode,
  newVisitor,
  expectNoHorizontalScroll,
} from "./support/session";
import { E2E_ACCESS_PASSWORD, E2E_URL } from "./support/env";
import { fakeScreenCapture } from "./support/screen-capture";
import {
  accountHeaders,
  joinControlled,
  refreshedCredentials,
  signalStatus,
} from "./support/host-controls";
import { tokenErrorSchema, tokenResponseSchema } from "@/features/room/domain/token-contract";

test.skip(
  process.env.E2E_HOST_CONTROLS !== "true",
  "Requires the private signaling admission gate",
);

test("host lock rejects prefetched admission and guests; sharing restriction preserves voice", async ({
  browser,
}) => {
  const host = await newParticipant(browser, "Anfitriao Sala");
  const member = await newParticipant(browser, "Pessoa Tela");
  const waiting = await newParticipant(browser, "Pessoa Esperando");
  const guest = await newVisitor(browser);
  try {
    const code = await newRoomCode();
    await fakeScreenCapture(member.page, { withSound: true, safeAudio: true });
    const credentials = await joinControlled(host, code);
    const csp = (await host.context.request.get("/")).headers()["content-security-policy"];
    expect(csp).toContain(E2E_URL.replace(/^http/, "ws"));
    expect(csp).not.toContain(":7880");
    await expect(host.page.getByRole("button", { name: "Controles do anfitrião" })).toBeVisible();
    await joinRoom(member.page, code);
    await expect(member.page.getByRole("button", { name: "Controles do anfitrião" })).toBeHidden();
    const reserved = await waiting.context.request.post("/api/token", {
      headers: await accountHeaders(waiting),
      data: { room: code, password: E2E_ACCESS_PASSWORD },
    });
    expect(reserved.ok()).toBe(true);
    const prefetched = tokenResponseSchema.parse(await reserved.json());
    const forged = await member.context.request.post("/api/operations/room-hostCommandAction", {
      headers: await accountHeaders(member),
      data: { input: { kind: "close", room: code, sessionId: credentials.sessionId } },
    });
    expect(await forged.text()).toContain("Só o anfitrião");
    await host.page.getByRole("button", { name: "Controles do anfitrião" }).click();
    await host.page.getByRole("switch", { name: "Bloquear novas entradas" }).click();
    await expect(host.page.getByRole("switch", { name: "Bloquear novas entradas" })).toBeChecked();
    expect(await signalStatus(prefetched.serverUrl, prefetched.token)).toBe(403);
    const refused = await guest.context.request.post("/api/token", {
      headers: { origin: E2E_URL },
      data: { room: code, password: E2E_ACCESS_PASSWORD, guestName: "Convidado" },
    });
    expect(tokenErrorSchema.parse(await refused.json()).error).toBe("room_locked");
    await member.page.getByRole("button", { name: "Compartilhar tela", exact: true }).click();
    await member.page.getByRole("button", { name: /^Tela inteira/ }).click();
    await expect(member.page.getByLabel("Prévia da sua tela")).toBeVisible();
    await host.page.getByLabel("Quem pode compartilhar tela").selectOption("host");
    await expect(member.page.getByLabel("Prévia da sua tela")).toBeHidden();
    await expect(
      member.page.getByRole("button", { name: "Compartilhamento restrito pelo anfitrião" }),
    ).toBeVisible();
    await expect(member.page.getByRole("button", { name: /Desligar microfone/ })).toBeVisible();
    await expect(
      host.page.getByText("Pessoa Tela parou de mostrar a tela", { exact: true }),
    ).toBeHidden();
    await host.page.screenshot({
      path: test.info().outputPath("host-controls-desktop.png"),
      animations: "disabled",
    });
    await host.page.setViewportSize({ width: 390, height: 640 });
    await expectNoHorizontalScroll(host.page);
    await host.page.screenshot({
      path: test.info().outputPath("host-controls-mobile.png"),
      animations: "disabled",
    });
    await host.page.getByLabel("Quem pode compartilhar tela").selectOption("selected");
    const allowed = host.page.getByRole("checkbox", { name: "Pessoa Tela" });
    await allowed.click();
    await expect(allowed).toBeChecked();
    await expect(
      member.page.getByRole("button", { name: "Compartilhar tela", exact: true }),
    ).toBeVisible();
  } finally {
    await Promise.all([
      host.context.close(),
      member.context.close(),
      waiting.context.close(),
      guest.context.close(),
    ]);
  }
});

test("transfer removes old host authority; exclusion and closure reject original/refreshed JWTs", async ({
  browser,
}) => {
  const host = await newParticipant(browser, "Primeiro Host");
  const next = await newParticipant(browser, "Proximo Host");
  const member = await newParticipant(browser, "Pessoa Removida");
  try {
    const code = await newRoomCode();
    const hostCredentials = await joinControlled(host, code);
    await joinRoom(next.page, code);
    const refreshes = refreshedCredentials(member);
    const memberCredentials = await joinControlled(member, code);
    const refreshCount = refreshes.length;
    const hand = await member.context.request.post("/api/sala/mao", {
      headers: await accountHeaders(member),
      data: { room: code, raised: true },
    });
    expect(hand.status()).toBe(204);
    await expect.poll(() => refreshes.length).toBeGreaterThan(refreshCount);
    await host.page.getByRole("button", { name: /3 pessoas/ }).click();
    await host.page.getByRole("button", { name: "Moderar Proximo Host" }).click();
    await host.page.getByRole("button", { name: "Transferir anfitrião" }).click();
    await host.page.getByRole("button", { name: "Transferir função" }).click();
    await expect(next.page.getByRole("button", { name: "Controles do anfitrião" })).toBeVisible();
    await expect(host.page.getByRole("button", { name: "Controles do anfitrião" })).toBeHidden();
    await next.page.getByRole("button", { name: /3 pessoas/ }).click();
    await next.page.getByRole("button", { name: "Moderar Pessoa Removida" }).click();
    await next.page.getByRole("button", { name: "Remover da chamada" }).click();
    await next.page.getByRole("button", { name: "Remover pessoa" }).click();
    await expect(
      member.page.getByRole("button", { name: "Sair da sala", exact: true }),
    ).toBeHidden();
    for (const token of [memberCredentials.token, ...refreshes])
      expect(await signalStatus(memberCredentials.serverUrl, token)).toBe(403);
    await next.page.keyboard.press("Escape");
    await next.page.getByRole("button", { name: "Controles do anfitrião" }).click();
    await next.page.getByRole("button", { name: "Encerrar sala para todos" }).click();
    await next.page.getByRole("button", { name: "Encerrar sala", exact: true }).click();
    await expect(host.page.getByRole("button", { name: "Sair da sala", exact: true })).toBeHidden();
    expect(await signalStatus(hostCredentials.serverUrl, hostCredentials.token)).toBe(403);
    const reopen = await host.context.request.post("/api/token", {
      headers: await accountHeaders(host),
      data: { room: code, password: E2E_ACCESS_PASSWORD },
    });
    expect(tokenErrorSchema.parse(await reopen.json()).error).toBe("room_closed");
  } finally {
    await Promise.all([host.context.close(), next.context.close(), member.context.close()]);
  }
});

test("admitted participant reconnects under lock and host authority survives navigation", async ({
  browser,
}) => {
  const host = await newParticipant(browser, "Host Reconexao");
  const member = await newParticipant(browser, "Pessoa Reconexao");
  try {
    let interrupt: (() => Promise<void>) | undefined;
    await member.page.routeWebSocket(/\/rtc(?:\/v1)?\?/, (socket) => {
      socket.connectToServer();
      interrupt = () => socket.close({ code: 1012, reason: "Test reconnection" });
    });
    const code = await newRoomCode();
    await joinRoom(host.page, code);
    await joinRoom(member.page, code);
    await host.page.getByRole("button", { name: "Controles do anfitrião" }).click();
    await host.page.getByRole("switch", { name: "Bloquear novas entradas" }).click();
    await expect(host.page.getByRole("switch", { name: "Bloquear novas entradas" })).toBeChecked();
    await host.page.getByLabel("Quem pode compartilhar tela").selectOption("host");
    await expect(
      member.page.getByRole("button", { name: "Compartilhamento restrito pelo anfitrião" }),
    ).toBeVisible();
    if (!interrupt) throw new Error("Missing signaling connection");
    await interrupt();
    await expect(member.page.getByText("Conexão restabelecida.", { exact: true })).toBeVisible();
    await expect(
      member.page.getByRole("button", { name: "Compartilhamento restrito pelo anfitrião" }),
    ).toBeVisible();
    await expect(member.page.locator('audio[data-source="voice"]')).toHaveCount(1);
    await host.page.keyboard.press("Escape");
    await host.page.getByRole("button", { name: "Mais opções", exact: true }).click();
    await host.page.getByRole("link", { name: /Foto, e-mail e senha na sua conta/ }).click();
    await expect(
      host.page.getByRole("complementary", { name: "Chamada em andamento" }),
    ).toBeVisible();
    await host.page.getByRole("link", { name: "Voltar à sala", exact: true }).click();
    await host.page.getByRole("button", { name: "Controles do anfitrião" }).click();
    await expect(host.page.getByRole("switch", { name: "Bloquear novas entradas" })).toBeChecked();
    await expect(host.page.getByLabel("Quem pode compartilhar tela")).toHaveValue("host");
  } finally {
    await Promise.all([host.context.close(), member.context.close()]);
  }
});
