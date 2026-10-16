import { expect, test } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

test("a camera turned on shows in the person's card for everyone", async ({ browser }) => {
  const ana = await newParticipant(browser, "Ana Camera");
  const beto = await newParticipant(browser, "Beto Olha");
  await ana.context.grantPermissions(["microphone", "camera"]);
  const code = await newRoomCode();
  await joinRoom(ana.page, code, { micOn: false });
  await joinRoom(beto.page, code, { micOn: false });
  await expect(beto.page.locator("video")).toHaveCount(0);

  await ana.page.getByRole("button", { name: "Ligar câmera" }).click();
  await expect(ana.page.getByRole("button", { name: "Desligar câmera" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // A single camera: nothing to switch to.
  await expect(ana.page.getByRole("button", { name: "Trocar câmera" })).toHaveCount(0);
  // Your own preview is mirrored; the others see it the right way round.
  await expect(ana.page.locator("video")).toHaveClass(/-scale-x-100/);
  await expect(beto.page.locator("video")).toHaveCount(1);
  await expect(beto.page.locator("video")).not.toHaveClass(/-scale-x-100/);
  await expect
    .poll(() => beto.page.locator("video").evaluate((video: HTMLVideoElement) => video.readyState))
    .toBeGreaterThan(0);

  // Enlarged on the stage, closed, enlarged again; the camera going off closes it.
  const stage = beto.page.getByRole("region", { name: "Câmera de Ana Camera" });
  await beto.page.getByRole("button", { name: "Ampliar a câmera de Ana Camera" }).click();
  await expect(stage).toBeVisible();
  await beto.page.getByRole("button", { name: "Fechar a câmera ampliada" }).click();
  await expect(stage).toHaveCount(0);
  await beto.page.getByRole("button", { name: "Ampliar a câmera de Ana Camera" }).click();
  await expect(stage).toBeVisible();

  await ana.page.keyboard.press("v");
  await expect(ana.page.getByRole("button", { name: "Ligar câmera" })).toBeVisible();
  await expect(beto.page.locator("video")).toHaveCount(0);
  await expect(stage).toHaveCount(0);

  await ana.context.close();
  await beto.context.close();
});
