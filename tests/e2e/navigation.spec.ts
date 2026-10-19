import { expect, test } from "@playwright/test";
import {
  expectNoHorizontalScroll,
  joinRoom,
  newParticipant,
  newRoomCode,
  newVisitor,
} from "./support/session";

test("general and auth pages have a single navbar, including on mobile", async ({ browser }) => {
  const { page, context } = await newVisitor(browser);
  for (const path of [
    "/",
    "/entrar",
    "/cadastro",
    "/privacidade",
    "/novidades",
    "/pagina-inexistente",
  ]) {
    await page.goto(path);
    const navbar = page.getByRole("navigation", { name: "Principal", exact: true });
    await expect(navbar).toHaveCount(1);
    await expect(navbar.getByRole("link", { name: "Nelcota, início", exact: true })).toBeVisible();
    await expect(navbar.getByRole("button", { name: /Ativar modo/ })).toBeVisible();
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "Principal", exact: true }).getByRole("link", {
      name: "Entrar",
      exact: true,
    }),
  ).toBeVisible();
  await expectNoHorizontalScroll(page);
  await context.close();
});

test("pre-join keeps the return from the account page and the call uses only the room bar", async ({
  browser,
}) => {
  const { page, context } = await newParticipant(browser, "Navegacao Teste");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const code = await newRoomCode();
  await page.goto(`/sala/${code}`);
  const navbar = page.getByRole("navigation", { name: "Principal", exact: true });
  // Inside the app the bar has only "Novidades"; the account lives in the column's foot.
  await expect(navbar.getByRole("link", { name: "Novidades", exact: true })).toBeVisible();
  const account = page.getByRole("link", { name: "Configurações", exact: true });
  await expect(account).toHaveAttribute(
    "href",
    `/conta?voltar=${encodeURIComponent(`/sala/${code}`)}`,
  );
  await expect(
    page.getByRole("heading", { name: "Tudo certo para entrar?", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("prejoin-desktop.png"), fullPage: true });
  await account.click();
  await expect(page.getByRole("heading", { name: "Navegacao Teste", exact: true })).toBeVisible();
  await expect(navbar).toHaveCount(1);
  await page.setViewportSize({ width: 768, height: 1024 });
  await expectNoHorizontalScroll(page);
  await page.getByRole("link", { name: "Voltar para a sala", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/sala/${code}$`));
  await page.setViewportSize({ width: 375, height: 812 });
  // Phones have no column: the photo's menu keeps the account.
  const menu = navbar.getByRole("button", { name: "Navegacao Teste", exact: true });
  await expect(menu).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.screenshot({ path: test.info().outputPath("prejoin-mobile.png"), fullPage: true });
  await joinRoom(page, code, { micOn: false });
  await expect(navbar).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Sala", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: /Sair/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Você saiu da chamada", exact: true }),
  ).toBeVisible();
  await expect(navbar).toHaveCount(1);
  await expect(menu).toBeVisible();
  await context.close();
});

test("public pages are indexable with a preview card; private pages stay out", async ({
  browser,
}) => {
  const { page, context } = await newVisitor(browser);
  const robots = page.locator('meta[name="robots"]');
  for (const path of ["/", "/novidades", "/privacidade"]) {
    await page.goto(path);
    await expect(robots).toHaveCount(0);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /^https?:\/\/[^/]+\/og\.png$/,
    );
  }
  for (const path of ["/entrar", "/cadastro"]) {
    await page.goto(path);
    await expect(robots).toHaveAttribute("content", "noindex, nofollow");
  }
  const robotsTxt = await page.request.get("/robots.txt");
  expect(await robotsTxt.text()).toContain("Disallow: /");
  expect((await page.request.get("/sitemap.xml")).ok()).toBe(true);
  expect((await page.request.get("/og.png")).ok()).toBe(true);
  await context.close();
});
