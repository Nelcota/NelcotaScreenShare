import { expect, test, type Page } from "@playwright/test";
import { E2E_ACCESS_PASSWORD } from "./support/env";
import { joinRoom, newParticipant, newRoomCode, setJoinMicrophone } from "./support/session";

/** Leaves the full-screen call for the home page; the call goes on minimized. */
async function goHomeDuringCall(page: Page) {
  await page.getByRole("button", { name: "Mais opções", exact: true }).click();
  await page.getByRole("link", { name: "Configurações" }).click();
  await expect(page.getByRole("complementary", { name: "Chamada em andamento" })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Principal", exact: true })
    .getByRole("link", { name: "Nelcota, início", exact: true })
    .click();
  await expect(page).toHaveURL(/\/inicio$/);
}

async function openRoomFromHome(page: Page, code: string) {
  const input = page.getByPlaceholder("Link ou código da sala").first();
  await input.fill(code);
  await input.press("Enter");
}

test("going to another room during a call asks first: Ficar keeps the call, confirming leaves it", async ({
  browser,
}) => {
  const { page, context } = await newParticipant(browser, "Troca Sala");
  try {
    const current = await newRoomCode();
    const next = await newRoomCode();
    await joinRoom(page, current, { micOn: false });
    await goHomeDuringCall(page);
    const minimized = page.getByRole("complementary", { name: "Chamada em andamento" });

    await openRoomFromHome(page, next);
    const dialog = page.getByRole("dialog", { name: "Trocar de sala?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(
      `Você vai sair da sala ${current} e entrar na sala ${next}.`,
    );
    await dialog.getByRole("button", { name: "Ficar", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/inicio$/);
    await expect(minimized).toBeVisible();

    // The same room never asks: the call comes back to full screen.
    await minimized.getByRole("link", { name: "Voltar à chamada", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/sala/${current}$`));
    await expect(page.getByRole("dialog", { name: "Trocar de sala?" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sair da sala", exact: true })).toBeVisible();

    await goHomeDuringCall(page);
    await openRoomFromHome(page, next);
    await dialog.getByRole("button", { name: "Trocar de sala", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/sala/${next}$`));
    await expect(
      page.getByRole("heading", { name: "Tudo certo para entrar?", exact: true }),
    ).toBeVisible();
    await expect(minimized).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "Trocar de sala?" })).toHaveCount(0);

    // With the old call gone, other rooms open without asking.
    await page.goto("/");
    await openRoomFromHome(page, await newRoomCode());
    await expect(
      page.getByRole("heading", { name: "Tudo certo para entrar?", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Trocar de sala?" })).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("joining in a second tab asks first and confirming ends the call in the first tab", async ({
  browser,
}) => {
  const first = await newParticipant(browser, "Duas Abas");
  try {
    const current = await newRoomCode();
    const next = await newRoomCode();
    await joinRoom(first.page, current, { micOn: false });
    const second = await first.context.newPage();
    await second.goto(`/sala/${next}`);
    await expect(
      second.getByRole("button", { name: /Entrar na sala|Entrar só ouvindo/ }),
    ).toBeEnabled();
    await setJoinMicrophone(second, false);
    await second.getByLabel("Senha da sala").fill(E2E_ACCESS_PASSWORD);
    const join = second.getByRole("button", { name: "Entrar só ouvindo", exact: true });

    await join.click();
    const dialog = second.getByRole("dialog", { name: "Entrar nesta aba?" });
    await expect(dialog).toContainText(
      `Você já está na sala ${current} em outra aba. Ao entrar aqui, você sai de lá.`,
    );
    await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(join).toBeVisible();
    await expect(
      first.page.getByRole("button", { name: "Sair da sala", exact: true }),
    ).toBeVisible();

    await join.click();
    await dialog.getByRole("button", { name: "Entrar aqui", exact: true }).click();
    await expect(second.getByRole("button", { name: "Sair da sala", exact: true })).toBeVisible();
    await expect(
      first.page.getByRole("heading", { name: "Você está na sala em outro lugar", exact: true }),
    ).toBeVisible();
    await expect(first.page.getByText("Você entrou numa sala em outra aba.")).toBeVisible();
  } finally {
    await first.context.close();
  }
});
