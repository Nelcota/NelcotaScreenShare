import { expect, test, type Page } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

/** A saved preference (or a change from another tab), also usable on pre-join. */
async function setSavedMode(page: Page, enabled: boolean) {
  await page.evaluate((value) => {
    localStorage.setItem("nelcota-streamer-mode", value ? "1" : "0");
    window.dispatchEvent(new Event("storage"));
  }, enabled);
}

async function historyIndex(page: Page): Promise<number> {
  return page.evaluate(() => {
    const state: unknown = history.state;
    if (!state || typeof state !== "object" || !("idx" in state) || typeof state.idx !== "number") {
      throw new Error("The router's history entry has no index");
    }
    return state.idx;
  });
}

async function expectHiddenRoom(page: Page, code: string) {
  await expect(page).toHaveURL(/\/sala$/);
  await setSavedMode(page, false);
  await expect(page).toHaveURL(new RegExp(`/sala/${code}$`));
  await expect(page.getByText(code, { exact: true })).toBeVisible();
  await setSavedMode(page, true);
  await expect(page).toHaveURL(/\/sala$/);
}

test("streamer mode hides every invitation and can reveal them again", async ({ browser }) => {
  const { page, context } = await newParticipant(browser, "Streamer Teste");
  const code = await newRoomCode();
  await joinRoom(page, code, { micOn: false });
  await expect(page.getByLabel("Link da sala", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mais opções", exact: true }).click();
  await page.getByRole("switch", { name: "Modo streamer" }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Código oculto. Copiar link para convidar" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/sala$/);
  await expect(page.getByLabel("Link da sala", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("QR code para entrar na sala pelo celular")).toHaveCount(0);
  expect(await page.locator("body").innerText()).not.toContain(code);
  await page.getByRole("button", { name: "Sair da sala", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page.getByText("Você saiu da chamada", { exact: true })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain(code);
  await expect(page.getByRole("button", { name: "Copiar link", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Voltar à chamada", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copiar convite", exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/\/sala$/);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Entrar na sala|Entrar só ouvindo/ }),
  ).toBeEnabled();
  await expect(page).toHaveURL(/\/sala$/);
  await expect(page.getByRole("button", { name: "Copiar convite", exact: true })).toHaveCount(0);
  expect(await page.locator("body").innerText()).not.toContain(code);
  await joinRoom(page, code, { micOn: false });
  await expect(page.getByLabel("Link da sala", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Mais opções", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Modo streamer" })).toBeChecked();
  await page.getByRole("switch", { name: "Modo streamer" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Link da sala", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: `Sala ${code}. Copiar link para convidar` }),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/sala/${code}$`));
  await context.close();
});

test("the hidden room address alone leads nowhere", async ({ browser }) => {
  const { page, context } = await newParticipant(browser, "Streamer Visita");
  await page.goto("/sala");
  await expect(page).toHaveURL(/\/$/);
  await context.close();
});

test("back, forward and reload preserve each hidden room without adding history entries", async ({
  browser,
}) => {
  const { page, context } = await newParticipant(browser, "Streamer Historico");
  const first = await newRoomCode();
  const second = await newRoomCode();
  try {
    await context.addInitScript(() => localStorage.setItem("nelcota-streamer-mode", "1"));
    await page.goto("/");
    const startIndex = await historyIndex(page);
    await page.getByLabel("Link ou código da sala", { exact: true }).first().fill(first);
    await page.getByLabel("Link ou código da sala", { exact: true }).first().press("Enter");
    await expectHiddenRoom(page, first);
    expect(await historyIndex(page)).toBe(startIndex + 1);
    // Signed in, the way back leads to the app's start.
    await page.getByRole("link", { name: "Voltar ao início", exact: true }).click();
    await expect(page).toHaveURL(/\/inicio$/);
    await page.getByLabel("Link ou código da sala", { exact: true }).first().fill(second);
    await page.getByLabel("Link ou código da sala", { exact: true }).first().press("Enter");
    await expectHiddenRoom(page, second);
    await page.getByRole("link", { name: "Voltar ao início", exact: true }).click();
    await expect(page).toHaveURL(/\/inicio$/);
    await page.goBack();
    await expectHiddenRoom(page, second);
    await page.goBack();
    await expect(page).toHaveURL(/\/inicio$/);
    await page.goBack();
    await expectHiddenRoom(page, first);
    await page.reload();
    await expectHiddenRoom(page, first);
    expect(await historyIndex(page)).toBe(startIndex + 1);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await page.goForward();
    await expectHiddenRoom(page, first);
    await page.goForward();
    await expect(page).toHaveURL(/\/inicio$/);
    await page.goForward();
    await expectHiddenRoom(page, second);
  } finally {
    await context.close();
  }
});

test("a hidden room and its invite survive reload when session storage is blocked", async ({
  browser,
}) => {
  const { page, context } = await newParticipant(browser, "Streamer Storage");
  const code = await newRoomCode();
  const invite = "a".repeat(43);
  try {
    await context.addInitScript(() => {
      localStorage.setItem("nelcota-streamer-mode", "1");
      Object.defineProperty(window, "sessionStorage", {
        get() {
          throw new Error("Storage blocked");
        },
      });
    });
    await page.goto(`/sala/${code}?convite=${invite}`);
    await expect(page).toHaveURL(/\/sala$/);
    const index = await historyIndex(page);
    await page.reload();
    await expect(page).toHaveURL(/\/sala$/);
    await expect(page.getByText("Com convite, sem senha")).toBeVisible();
    expect(await historyIndex(page)).toBe(index);
    await setSavedMode(page, false);
    await expect(page).toHaveURL(new RegExp(`/sala/${code}\\?convite=${invite}$`));
    await expect(page.getByText(code, { exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("a masked call stays connected across profile navigation and browser history", async ({
  browser,
}) => {
  const { page, context } = await newParticipant(browser, "Streamer Chamada");
  const code = await newRoomCode();
  try {
    await joinRoom(page, code);
    await page.getByRole("button", { name: "Mais opções", exact: true }).click();
    await page.getByRole("switch", { name: "Modo streamer" }).click();
    await expect(page).toHaveURL(/\/sala$/);
    await page.getByRole("dialog").getByRole("link", { name: "Configurações" }).click();
    await expect(page.getByRole("complementary", { name: "Chamada em andamento" })).toBeVisible();
    await page.getByRole("link", { name: "Voltar à chamada", exact: true }).click();
    await expect(page).toHaveURL(/\/sala$/);
    await expect(page.getByRole("button", { name: /Desligar microfone/ })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("complementary", { name: "Chamada em andamento" })).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/\/sala$/);
    await expect(page.getByRole("button", { name: /Desligar microfone/ })).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event("nelcota:mutation")));
    await expect(page).toHaveURL(/\/sala$/);
    await expect(page.getByLabel("Senha da sala")).toHaveCount(0);
  } finally {
    await context.close();
  }
});
