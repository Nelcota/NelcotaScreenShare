import { expect, test } from "@playwright/test";
import { sql } from "./support/database";
import { newParticipant, type Participant } from "./support/session";

/** A group with both people, so files can go without first becoming friends. */
async function groupOf(...people: Participant[]): Promise<string> {
  const created = await sql(
    "insert into conversations (kind, name) values ('group', 'Projeto') returning id",
  );
  const rows: unknown[] = created.rows;
  const row = rows[0];
  const conversationId = typeof row === "object" && row !== null && "id" in row ? row.id : null;
  if (typeof conversationId !== "string") throw new Error("the group was not created");
  for (const person of people) {
    await sql(
      "insert into conversation_members (conversation_id, user_id) select $1, id from users where email = $2",
      [conversationId, person.email],
    );
  }
  return conversationId;
}

/** Picks a file in the message box and waits until the server has checked it. */
async function attach(
  person: Participant,
  file: { name: string; mimeType: string; buffer: Buffer },
) {
  await person.page.locator('form input[type="file"]').setInputFiles(file);
  await expect(person.page.getByRole("button", { name: `Tirar ${file.name}` })).toBeVisible();
  await expect(person.page.getByText("Enviando…")).toHaveCount(0, { timeout: 15_000 });
}

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

test("a photo and a file go in a conversation, open full screen and download", async ({
  browser,
}) => {
  const ana = await newParticipant(browser, "Ana Anexo");
  const bia = await newParticipant(browser, "Bia Anexo");
  const conversation = `/mensagens/${await groupOf(ana, bia)}`;
  await ana.page.goto(conversation);

  await attach(ana, { name: "praia.png", mimeType: "image/png", buffer: PNG });
  await ana.page.getByLabel("Mensagem em Projeto").fill("Olha a praia");
  await ana.page.keyboard.press("Enter");
  await expect(ana.page.getByRole("button", { name: "Abrir praia.png" })).toBeVisible();

  await attach(ana, {
    name: "orcamento.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% orçamento\n"),
  });
  await ana.page.getByLabel("Mensagem em Projeto").press("Enter");
  await expect(ana.page.getByRole("button", { name: "Baixar orcamento.pdf" })).toBeVisible();

  // The other member sees both: the photo opens full screen, zooms, and Esc closes it.
  await bia.page.goto(conversation);
  await expect(bia.page.getByText("Olha a praia")).toBeVisible();
  await bia.page.getByRole("button", { name: "Abrir praia.png" }).click();
  const viewer = bia.page.getByRole("dialog", { name: "praia.png" });
  await viewer.getByRole("button", { name: "Ampliar a foto" }).click();
  await expect(viewer.getByRole("button", { name: "Diminuir a foto" })).toBeVisible();
  await bia.page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);

  // The file downloads as an attachment, with its name.
  const download = bia.page.waitForEvent("download");
  await bia.page.getByRole("button", { name: "Baixar orcamento.pdf" }).click();
  expect((await download).suggestedFilename()).toBe("orcamento.pdf");

  await ana.context.close();
  await bia.context.close();
});

test("a program is refused, even renamed", async ({ browser }) => {
  const ana = await newParticipant(browser, "Ana Programa");
  const bia = await newParticipant(browser, "Bia Programa");
  await ana.page.goto(`/mensagens/${await groupOf(ana, bia)}`);
  const box = ana.page.locator('form input[type="file"]');

  await box.setInputFiles({
    name: "setup.exe",
    mimeType: "application/octet-stream",
    buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00]),
  });
  await expect(ana.page.getByText("Esse tipo de arquivo não pode ser enviado.")).toBeVisible();

  await box.setInputFiles({
    name: "foto.png",
    mimeType: "image/png",
    buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]),
  });
  await expect(
    ana.page.getByText("Esse tipo de arquivo não pode ser enviado.").last(),
  ).toBeVisible();
  await expect(ana.page.getByRole("button", { name: "Tirar foto.png" })).toHaveCount(0);

  await ana.context.close();
  await bia.context.close();
});
