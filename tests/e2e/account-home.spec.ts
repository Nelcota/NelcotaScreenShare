import { expect, test } from "@playwright/test";
import { E2E_URL } from "./support/env";
import {
  expectNoHorizontalScroll,
  joinRoom,
  newRoomCode,
  newParticipant,
  newVisitor,
  PASSWORD,
} from "./support/session";

const PNG_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test("sign-up through the UI, account page and ending the other session", async ({ browser }) => {
  const { page, context } = await newVisitor(browser);
  const email = `gil.${Date.now()}@exemplo.dev`;

  await page.goto("/cadastro");
  // The theme is chosen right on the access screen; the photo comes later, in the account.
  // Click the visible label, as a person does: the radio itself is visually hidden
  // (sr-only) under the label's icon, which would intercept a click aimed at it.
  const lightTheme = page.getByRole("radio", { name: "Claro", exact: true });
  await page.locator("label").filter({ has: lightTheme }).click();
  await expect(lightTheme).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("main input[type=file]")).toHaveCount(0);
  await page.getByLabel("Seu nome").fill("Gil Teste");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(`${E2E_URL}/`);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  // A second session (another "device") to end from the account page.
  const other = await newVisitor(browser);
  const signIn = await other.context.request.post("/api/auth/sign-in/email", {
    data: { email, password: PASSWORD },
    headers: { origin: E2E_URL },
  });
  expect(signIn.ok()).toBe(true);

  await page.goto("/conta");
  await expect(page.getByRole("heading", { name: "Gil Teste", level: 1 })).toBeVisible();
  // The checklist's "Ativar" opens the two-step verification row.
  await page.getByRole("link", { name: "Ativar", exact: true }).click();
  await expect(page).toHaveURL(/\/conta#duas-etapas$/);
  await expect(page.getByLabel("Confirme sua senha", { exact: true })).toBeFocused();
  // An edit in progress stays intact when another setting is opened.
  await page.getByLabel("Nome na sala").fill("Gil Novo");
  await page.getByRole("button", { name: "Trocar senha", exact: true }).click();
  await expect(page.getByLabel("Senha atual", { exact: true })).toBeFocused();
  await expect(page.getByLabel("Nome na sala")).toHaveValue("Gil Novo");
  await expect(page.getByRole("button", { name: "Encerrar", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Encerrar todas as outras" }).click();
  await expect(page.getByRole("button", { name: "Encerrar", exact: true })).toHaveCount(0);

  const session = await other.context.request.get("/api/auth/get-session");
  expect(await session.json()).toBeNull();
  await other.context.close();
  await context.close();
});

test("profile photo: preview, persistence on the account and avatar on the home page", async ({
  browser,
}) => {
  const { page, context } = await newParticipant(browser, "Foto Teste");
  await page.goto("/conta");
  const fileInput = page.locator("main input[type=file]");
  // A file picked before hydration reaches no handler: pick it again until the page answers.
  await expect(async () => {
    await fileInput.setInputFiles({
      name: "quebrada.png",
      mimeType: "image/png",
      buffer: Buffer.from("imagem inválida"),
    });
    await expect(
      page.getByText("Não foi possível abrir a imagem. Escolha outra foto.", { exact: true }),
    ).toBeVisible({ timeout: 2000 });
  }).toPass();
  await fileInput.setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: PNG_PIXEL,
  });
  await expect(page.getByRole("button", { name: "Salvar foto", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Salvar foto", exact: true }).click();
  await expect(page.getByText("Foto de perfil atualizada.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("main [data-slot=avatar-image]")).toHaveAttribute(
    "src",
    /^data:image\/webp;base64,/,
  );
  await page.goto("/");
  await expect(page.locator('a[href="/conta"] [data-slot=avatar-image]')).toHaveAttribute(
    "src",
    /^data:image\/webp;base64,/,
  );
  await joinRoom(page, newRoomCode(), { micOn: false });
  const roomPhoto = page
    .getByRole("navigation", { name: "Sala", exact: true })
    .locator("[data-slot=avatar-image]");
  await expect(roomPhoto).toHaveAttribute("src", /^data:image\/webp;base64,/);
  await expect(roomPhoto).toBeVisible();
  await page.getByRole("button", { name: "Sair da sala", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Sair", exact: true }).click();
  await page.goto("/conta");
  await page.getByRole("button", { name: "Alterar foto de perfil", exact: true }).click();
  await page.getByRole("menuitem", { name: "Remover foto", exact: true }).click();
  await page.getByRole("button", { name: "Salvar foto", exact: true }).click();
  await expect(page.getByText("Foto de perfil removida.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("main [data-slot=avatar-image]")).toHaveCount(0);
  // Without a photo, the default icon.
  await expect(page.locator("main [data-slot=avatar-fallback] svg")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Excluir conta", exact: true }).click();
  await expect(page.getByLabel("Digite sua senha para confirmar")).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Excluir minha conta para sempre", exact: true }),
  ).toBeVisible();
  await expectNoHorizontalScroll(page);
  await context.close();
});

test("a failure sending links does not show as success", async ({ browser }) => {
  const { page, context } = await newVisitor(browser);
  for (const endpoint of ["request-password-reset", "send-verification-email"]) {
    await page.route(`**/api/auth/${endpoint}`, (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ code: "INTERNAL_SERVER_ERROR", message: "Falha no envio" }),
      }),
    );
  }
  await page.goto("/recuperar-senha");
  await page.getByLabel("E-mail", { exact: true }).fill("teste@exemplo.dev");
  await page.getByRole("button", { name: "Enviar link", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Não foi possível enviar o link." }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Confira seu e-mail", exact: true })).toHaveCount(
    0,
  );
  await page.goto("/verificar-email?email=teste%40exemplo.dev");
  await page.getByRole("button", { name: "Reenviar link", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Não foi possível enviar o link." }),
  ).toBeVisible();
  await expect(page.getByText("Link reenviado. Confira o e-mail.", { exact: true })).toHaveCount(0);
  await context.close();
});

test('home: "/" focuses the room field and a valid code opens the room', async ({ browser }) => {
  const { page, context } = await newVisitor(browser);
  await page.goto("/");
  // The top bar; the closing one repeats it lower on the page and leaves "/" to it.
  const input = page.getByPlaceholder("Link ou código da sala").first();
  // The SSR field is visible before hydration installs the global shortcut listener.
  await expect(async () => {
    await page.keyboard.press("/");
    await expect(input).toBeFocused({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });

  await input.fill("abc-defg-hij");
  await input.press("Enter");
  // No account: the room opens as a guest, asking for a name.
  await expect(page).toHaveURL(/\/sala\/abc-defg-hij$/);
  await expect(page.getByLabel("Seu nome na sala")).toBeVisible();
  await context.close();
});
