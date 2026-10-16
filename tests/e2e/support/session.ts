import { randomInt } from "node:crypto";
import {
  expect,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import { createdRoom } from "./database";
import { E2E_ACCESS_PASSWORD, E2E_URL } from "./env";

export const PASSWORD = "senha-do-participante-e2e";

/** Picks an option in a design-system select (a combobox with a list, not a native select). */
export async function chooseOption(scope: Page | Locator, label: string, option: string) {
  await scope.getByRole("combobox", { name: label }).click();
  // The list opens in a portal, outside a popover or dialog the select may sit in.
  const page = "page" in scope ? scope.page() : scope;
  await page.getByRole("option", { name: option, exact: true }).click();
}

let sequence = 0;

/**
 * Where this worker's addresses start. Playwright starts a new worker after a failed test,
 * and the sign-up limit is kept in the database: counting from zero again would reuse the
 * addresses of earlier tests (or of the run before) and hit "Too many requests".
 */
const FIRST_ADDRESS = randomInt(0, 2 ** 23);

/** 10.x.y.z from a number, skipping .0 and .255 in the last part. */
function visitorAddress(index: number): string {
  const spread = index % 2 ** 24;
  const last = (spread % 254) + 1;
  const rest = Math.floor(spread / 254);
  return `10.${Math.floor(rest / 256) % 256}.${rest % 256}.${last}`;
}

/**
 * Each test person comes from their own "IP" (X-Forwarded-For, read by the
 * server middleware as in production behind Traefik): sign-up is rate-limited per IP.
 */
export async function newVisitor(
  browser: Browser,
): Promise<{ context: BrowserContext; page: Page }> {
  sequence += 1;
  const ip = visitorAddress(FIRST_ADDRESS + sequence);
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
