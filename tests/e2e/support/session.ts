import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createdRoom } from "./database";
import { E2E_ACCESS_PASSWORD, E2E_URL } from "./env";

export const PASSWORD = "senha-do-participante-e2e";

let sequence = 0;

/**
 * Each test person comes from their own "IP" (X-Forwarded-For, read by the
 * server middleware as in production behind Traefik): sign-up is rate-limited per IP.
 */
export async function newVisitor(
  browser: Browser,
): Promise<{ context: BrowserContext; page: Page }> {
  sequence += 1;
  const ip = `10.77.${Math.floor(sequence / 250)}.${(sequence % 250) + 1}`;
  const context = await browser.newContext({
    baseURL: E2E_URL,
    locale: "pt-BR",
    permissions: ["microphone"],
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  return { context, page: await context.newPage() };
}

export interface Participant {
  context: BrowserContext;
  page: Page;
  name: string;
  email: string;
}

/** New account, already signed in (sign-up via the API; e-mail confirmation is off in E2E). */
export async function newParticipant(browser: Browser, name: string): Promise<Participant> {
  const { context, page } = await newVisitor(browser);
  const email = `${name.toLowerCase().replaceAll(/\s+/g, ".")}.${Date.now()}.${sequence}@exemplo.dev`;
  const response = await context.request.post("/api/auth/sign-up/email", {
    data: { name, email, password: PASSWORD },
    headers: { origin: E2E_URL },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return { context, page, name, email };
}

/** The page fits the viewport width (no sideways scrolling on small screens). */
export async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}

let roomSequence = 0;

/** A new room for each test, already created. */
export async function newRoomCode(): Promise<string> {
  roomSequence += 1;
  // The sequence keeps codes made in the same millisecond apart.
  return createdRoom(`e2e-${Date.now().toString(36).slice(-6)}${roomSequence.toString(36)}-sala`);
}

/** Opens the room, goes through pre-join (room password) and waits for the room to load. */
export async function joinRoom(page: Page, code: string, { micOn = true } = {}) {
  await page.goto(`/sala/${code}`);
  await expect(page.getByLabel("Senha da sala")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Entrar na sala|Entrar só ouvindo/ }),
  ).toBeEnabled();
  await setJoinMicrophone(page, micOn);
  await page.getByLabel("Senha da sala").fill(E2E_ACCESS_PASSWORD);
  await page.getByRole("button", { name: /Entrar na sala|Entrar só ouvindo/ }).click();
  await expect(page.getByRole("button", { name: /Sair/ })).toBeVisible();
}

/**
 * Sets "Entrar com microfone ligado" on the pre-join. The screen remembers the last choice
 * in this browser, so the switch is read before it is clicked.
 */
export async function setJoinMicrophone(page: Page, on: boolean) {
  const microphone = page.getByRole("switch").first();
  const checked = (await microphone.getAttribute("aria-checked")) === "true";
  if (checked !== on) await microphone.click();
}
