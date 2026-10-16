import { expect, test } from "@playwright/test";
import { newParticipant } from "./support/session";
import { pilotAccount } from "./support/workspaces";

test.skip(
  process.env.E2E_HOST_CONTROLS !== "true",
  "Requires the private signaling admission gate",
);

test("a permanent room opens at the address its owner chose, and a taken one is refused", async ({
  browser,
}) => {
  const person = await newParticipant(browser, "Escolhe Endereco");
  await pilotAccount(person);
  const address = `encontro-${Date.now().toString(36)}`;
  try {
    const { page } = person;
    await page.goto("/salas");
    await page.getByRole("button", { name: "Nova sala", exact: true }).click();
    await page.getByLabel("Nome da sala", { exact: true }).fill("Encontro fixo");
    await page.getByLabel("Endereço", { exact: true }).fill(address);
    await page.getByRole("button", { name: "Criar sala", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(`a[href="/sala/${address}"]`).first()).toBeVisible();

    // The same address again: refused under its field, and the dialog stays open.
    await page.getByRole("button", { name: "Nova sala", exact: true }).click();
    await page.getByLabel("Nome da sala", { exact: true }).fill("Outra sala");
    await page.getByLabel("Endereço", { exact: true }).fill(address);
    await page.getByRole("button", { name: "Criar sala", exact: true }).click();
    await expect(
      page.getByRole("dialog").getByText("Esse endereço já está em uso. Escolha outro."),
    ).toBeVisible();

    // A reserved word without permission, then an invalid address checked on the form.
    await page.getByLabel("Endereço", { exact: true }).fill(`nelcota-${Date.now().toString(36)}`);
    await page.getByRole("button", { name: "Criar sala", exact: true }).click();
    await expect(
      page.getByRole("dialog").getByText("Esse endereço não pode ser usado."),
    ).toBeVisible();
    await page.getByLabel("Endereço", { exact: true }).fill("-errado");
    await page.getByRole("button", { name: "Criar sala", exact: true }).click();
    await expect(page.getByRole("dialog").getByText(/Use de 3 a 32 letras/)).toBeVisible();
  } finally {
    await person.context.close();
  }
});
