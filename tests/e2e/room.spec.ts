import { fakeScreenCapture } from "./support/screen-capture";
import { expect, test } from "@playwright/test";
import {
  joinRoom,
  newParticipant,
  newRoomCode,
  newVisitor,
  PASSWORD,
  setJoinMicrophone,
} from "./support/session";
import { createdRoom } from "./support/database";
import { E2E_ACCESS_PASSWORD, E2E_URL } from "./support/env";

test.describe("room access", () => {
  test("without an account opens as a guest; signing in comes back to the room", async ({
    browser,
  }) => {
    await createdRoom("abc-defg-hij");
    const { page, context } = await newVisitor(browser);
    await page.goto("/sala/ABC-DEFG-HIJ");
    await expect(page).toHaveURL(/\/sala\/abc-defg-hij$/);
    await expect(page.getByLabel("Seu nome na sala")).toBeFocused();
    await page.getByRole("link", { name: "Já tenho conta" }).click();
    await expect(page).toHaveURL(/\/entrar\?voltar=%2Fsala%2Fabc-defg-hij/);
    await context.close();
  });

  test("a code nobody created shows that the room does not exist", async ({ browser }) => {
    const { page, context } = await newVisitor(browser);
    const response = await page.goto("/sala/bzk-i123-askjndjkaw");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Esta sala não existe" })).toBeVisible();
    await expect(page.getByText("Confira o link.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Entrar na sala/ })).toHaveCount(0);
    await context.close();
  });

  test("an account creates a room from the home page and owns its pre-join", async ({
    browser,
  }) => {
    const { page, context } = await newParticipant(browser, "Rui Criador");
    await page.goto("/");
    await page.getByRole("button", { name: "Criar sala", exact: true }).first().click();
    await expect(page).toHaveURL(/\/sala\/[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}$/);
    await expect(
      page.getByRole("button", { name: /Entrar na sala|Entrar só ouvindo/ }),
    ).toBeVisible();
    await context.close();
  });

  test("a visitor's Criar sala goes through sign-up and lands in the new room", async ({
    browser,
  }) => {
    const { page, context } = await newVisitor(browser);
    await page.goto("/");
    await page.getByRole("button", { name: "Criar sala", exact: true }).first().click();
    await expect(page).toHaveURL(/\/cadastro\?voltar=%2F%3Fcriar%3Dsala$/);
    await page.getByLabel("Seu nome").fill("Lia Nova");
    await page.getByLabel("E-mail").fill(`lia.${Date.now()}@exemplo.dev`);
    await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
    // Enter in the password field, as people usually submit it.
    await page.getByLabel("Senha", { exact: true }).press("Enter");
    await expect(page).toHaveURL(/\/sala\/[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}$/);
    await expect(
      page.getByRole("button", { name: /Entrar na sala|Entrar só ouvindo/ }),
    ).toBeVisible();
    // The room replaced the return address: going back does not create another room.
    await page.goBack();
    await expect(page).not.toHaveURL(/criar=sala/);
    await context.close();
  });

  test("right after signing up, Criar sala opens a new room without reloading", async ({
    browser,
  }) => {
    const { page, context } = await newVisitor(browser);
    await page.goto("/cadastro");
    await page.getByLabel("Seu nome").fill("Rafa Nova");
    await page.getByLabel("E-mail").fill(`rafa.${Date.now()}@exemplo.dev`);
    await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Senha", { exact: true }).press("Enter");
    await expect(page).toHaveURL(`${E2E_URL}/inicio`);
    await expect(page.getByRole("button", { name: "Rafa Nova" }).first()).toBeVisible();

    const creating = page.waitForRequest(/\/api\/operations\/room-createRoomAction/);
    await page.getByRole("button", { name: "Criar sala", exact: true }).first().click();
    await creating;
    await expect(page).toHaveURL(/\/sala\/[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}$/);
    await expect(
      page.getByRole("button", { name: /Entrar na sala|Entrar só ouvindo/ }),
    ).toBeVisible();
    await context.close();
  });

  test("an invalid code returns to the home page with a notice", async ({ browser }) => {
    const { page, context } = await newVisitor(browser);
    await page.goto("/sala/!!");
    await expect(page).toHaveURL(/\/\?erro=codigo/);
    await context.close();
  });
});

test.describe("pre-join", () => {
  test("without JavaScript, the room password cannot be submitted into the URL", async ({
    browser,
  }) => {
    const person = await newParticipant(browser, "Sem JavaScript");
    const context = await browser.newContext({
      baseURL: E2E_URL,
      storageState: await person.context.storageState(),
      javaScriptEnabled: false,
    });
    const page = await context.newPage();
    const path = `/sala/${await newRoomCode()}`;
    await page.goto(path);
    await expect(page.getByRole("button", { name: /Entrar na sala/ })).toBeDisabled();
    await expect(page.locator("form")).toHaveAttribute("method", "post");
    await page.getByLabel("Senha da sala").fill(E2E_ACCESS_PASSWORD);
    await page.getByLabel("Senha da sala").press("Enter");
    await expect(page).toHaveURL(`${E2E_URL}${path}`);
    await context.close();
    await person.context.close();
  });

  test("a wrong password shows the error on the field", async ({ browser }) => {
    const ana = await newParticipant(browser, "Ana Teste");
    const response = await ana.page.goto(`/sala/${await newRoomCode()}`);
    expect(await response?.text()).not.toContain(E2E_ACCESS_PASSWORD);
    await expect(ana.page.getByText(/Captando áudio|Microfone testado/)).toBeVisible();
    await ana.page.getByLabel("Senha da sala").fill("errada");
    await ana.page.getByRole("button", { name: /Entrar na sala|Entrar só ouvindo/ }).click();
    await expect(
      ana.page.getByText("Senha incorreta. Confira com quem enviou o convite."),
    ).toBeVisible();
    await ana.context.close();
  });

  test("with the microphone off, joins listen-only", async ({ browser }) => {
    const bia = await newParticipant(browser, "Bia Teste");
    await bia.page.goto(`/sala/${await newRoomCode()}`);
    await setJoinMicrophone(bia.page, false);
    await expect(bia.page.getByRole("button", { name: /Entrar só ouvindo/ })).toBeVisible();
    await bia.context.close();
  });
});

test.describe("in the room", () => {
  test("entering an occupied room is silent and subsequent activity is announced once", async ({
    browser,
  }) => {
    const sender = await newParticipant(browser, "Avisos Remetente");
    const reader = await newParticipant(browser, "Avisos Leitor");
    try {
      const code = await newRoomCode();
      await fakeScreenCapture(sender.page);
      await joinRoom(sender.page, code, { micOn: false });
      await sender.page.getByRole("button", { name: "Compartilhar tela", exact: true }).click();
      await sender.page.getByRole("button", { name: /^Tela inteira/ }).click();
      await expect(sender.page.getByLabel("Prévia da sua tela")).toBeVisible();
      await joinRoom(reader.page, code, { micOn: false });
      await reader.page
        .getByRole("button", { name: "Assistir à tela de Avisos Remetente" })
        .click();
      await expect(
        reader.page.getByRole("region", { name: "Tela compartilhada por Avisos Remetente" }),
      ).toBeVisible();
      await expect(
        reader.page.getByText("Avisos Remetente entrou na sala", { exact: true }),
      ).toBeHidden();
      await expect(
        reader.page.getByText("Avisos Remetente começou a mostrar a tela", { exact: true }),
      ).toBeHidden();
      await expect(
        sender.page.getByText("Avisos Leitor entrou na sala", { exact: true }),
      ).toHaveCount(1);

      const dock = sender.page.getByRole("navigation", {
        name: "Controles da chamada",
        exact: true,
      });
      await dock.getByRole("button", { name: /^Parar de compartilhar/ }).click();
      await expect(
        reader.page.getByText("Avisos Remetente parou de mostrar a tela", { exact: true }),
      ).toHaveCount(1);
      await dock.getByRole("button", { name: "Compartilhar tela", exact: true }).click();
      await sender.page.getByRole("button", { name: /^Tela inteira/ }).click();
      await expect(
        reader.page.getByText("Avisos Remetente começou a mostrar a tela", { exact: true }),
      ).toHaveCount(1);
      await dock.getByRole("button", { name: "Sair da sala", exact: true }).click();
      await sender.page
        .getByRole("alertdialog")
        .getByRole("button", { name: "Sair", exact: true })
        .click();
      await expect(
        reader.page.getByText("Avisos Remetente saiu da sala", { exact: true }),
      ).toHaveCount(1);
    } finally {
      await sender.context.close();
      await reader.context.close();
    }
  });

  test("deafening shows sem som on your tile and to the others", async ({ browser }) => {
    const deaf = await newParticipant(browser, "Som Fora");
    const other = await newParticipant(browser, "Som Outro");
    try {
      const code = await newRoomCode();
      await joinRoom(deaf.page, code, { micOn: false });
      await joinRoom(other.page, code, { micOn: false });
      await deaf.page.getByRole("button", { name: "Parar de ouvir a sala", exact: true }).click();
      await expect(
        deaf.page.getByRole("button", { name: "Voltar a ouvir a sala", exact: true }),
      ).toContainText("Sem som");
      await expect(deaf.page.getByText("sem som", { exact: true })).toHaveCount(1);
      await expect(other.page.getByText("sem som", { exact: true })).toHaveCount(1);
      await deaf.page.getByRole("button", { name: "Voltar a ouvir a sala", exact: true }).click();
      await expect(other.page.getByText("sem som", { exact: true })).toHaveCount(0);
      await expect(deaf.page.getByText("sem som", { exact: true })).toHaveCount(0);
    } finally {
      await deaf.context.close();
      await other.context.close();
    }
  });

  test("deafen silences existing and new audio and restores the microphone", async ({
    browser,
  }) => {
    const listener = await newParticipant(browser, "Audio Leitor");
    const speaker = await newParticipant(browser, "Audio Falante");
    const newcomer = await newParticipant(browser, "Audio Novo");
    const code = await newRoomCode();
    await fakeScreenCapture(speaker.page, { withSound: true, safeAudio: true });
    await joinRoom(listener.page, code);
    await joinRoom(speaker.page, code);
    const audioVolumes = () =>
      listener.page
        .locator("audio")
        .evaluateAll((elements) => elements.map((element) => (element as HTMLAudioElement).volume));
    await expect.poll(async () => (await audioVolumes()).length).toBeGreaterThan(0);
    await listener.page.keyboard.press("d");
    await expect(
      listener.page.getByRole("button", { name: "Parar de ouvir a sala", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(listener.page.getByRole("button", { name: /Desligar microfone/ })).toBeVisible();
    await listener.page.getByRole("button", { name: "Parar de ouvir a sala", exact: true }).click();
    await expect.poll(audioVolumes).toEqual([0]);
    await expect(listener.page.getByRole("button", { name: /Ligar microfone/ })).toBeVisible();
    await joinRoom(newcomer.page, code);
    await speaker.page.getByRole("button", { name: /Compartilhar tela/ }).click();
    await speaker.page.getByRole("button", { name: /^Tela inteira/ }).click();
    // Nobody receives a screen, or its sound, before choosing to watch it.
    await expect(listener.page.getByText("Audio Falante está compartilhando a tela")).toBeVisible();
    await expect.poll(async () => (await audioVolumes()).length).toBe(2);
    await listener.page.getByRole("button", { name: "Assistir à tela de Audio Falante" }).click();
    await expect.poll(async () => (await audioVolumes()).length).toBe(3);
    await expect.poll(audioVolumes).toEqual([0, 0, 0]);
    await listener.page.getByRole("button", { name: "Voltar a ouvir a sala" }).click();
    await expect.poll(audioVolumes).toEqual([1, 1, 1]);
    await expect(listener.page.getByRole("button", { name: /Desligar microfone/ })).toBeVisible();
    await listener.page.setViewportSize({ width: 320, height: 740 });
    const dock = listener.page.getByRole("navigation", { name: "Controles da chamada" });
    await expect
      .poll(async () => {
        const bounds = await dock.boundingBox();
        return bounds !== null && bounds.x >= 0 && bounds.x + bounds.width <= 320;
      })
      .toBe(true);
    await listener.context.close();
    await speaker.context.close();
    await newcomer.context.close();
  });

  test("opening and reopening a long chat positions the latest messages in view", async ({
    browser,
  }) => {
    const sender = await newParticipant(browser, "Historico Remetente");
    const reader = await newParticipant(browser, "Historico Leitor");
    const code = await newRoomCode();
    await joinRoom(sender.page, code, { micOn: false });
    await joinRoom(reader.page, code, { micOn: false });
    await sender.page.getByRole("button", { name: /^Chat/ }).click();
    const composer = sender.page.getByPlaceholder("Escreva para a sala");
    for (let index = 0; index < 3; index += 1) {
      await composer.fill(`${index}: ${"Linha do histórico\n".repeat(20)}`);
      await sender.page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
      await expect(composer).toHaveValue("");
    }
    await composer.fill("Mensagem mais recente");
    await sender.page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
    await expect(reader.page.getByRole("button", { name: "Chat (4 novas)" })).toBeVisible();
    await reader.page.getByRole("button", { name: /^Chat/ }).click();
    const list = reader.page.getByRole("complementary", { name: "Chat da sala" }).getByRole("list");
    await expect
      .poll(() => list.evaluate((element) => element.scrollHeight > element.clientHeight))
      .toBe(true);
    const distanceFromEnd = () =>
      list.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight);
    await expect.poll(distanceFromEnd).toBeLessThan(48);
    await list.evaluate((element) => element.scrollTo({ top: 0 }));
    await reader.page.getByRole("button", { name: "Fechar chat", exact: true }).click();
    await reader.page.getByRole("button", { name: "Chat", exact: true }).click();
    await expect.poll(distanceFromEnd).toBeLessThan(48);
    await sender.context.close();
    await reader.context.close();
  });

  test("controls: microphone and picker on mobile, share and stop the screen", async ({
    browser,
  }) => {
    const { page, context } = await newParticipant(browser, "Aline Teste");
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await fakeScreenCapture(page);
    await joinRoom(page, await newRoomCode(), { micOn: false });
    await expect(page.getByText("Você é a primeira pessoa aqui")).toBeVisible();

    const dock = page.getByRole("navigation", { name: "Controles da chamada", exact: true });
    const microphone = dock.getByRole("button", { name: "Ligar microfone", exact: true });
    await microphone.focus();
    await expect(microphone).toBeFocused();
    expect(
      await microphone.evaluate((element) => {
        const pair = element.parentElement;
        if (!pair) throw new Error("Missing microphone pair");
        return getComputedStyle(pair).overflow;
      }),
    ).toBe("visible");
    await dock.getByRole("button", { name: "Ligar microfone", exact: true }).click();
    await expect(
      dock.getByRole("button", { name: "Desligar microfone", exact: true }),
    ).toBeEnabled();
    await dock.screenshot({ path: test.info().outputPath("dock-desktop-dark.png") });

    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 812 });
      const bounds = await dock.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      await expect(
        dock.getByRole("button", { name: "Opções do microfone", exact: true }),
      ).toBeVisible();
    }
    await dock.getByRole("button", { name: "Opções do microfone", exact: true }).click();
    const microphones = page.getByRole("dialog", { name: "Microfone", exact: true });
    await expect(microphones).toBeVisible();
    await microphones.getByRole("list").getByRole("button").last().click();
    await expect(microphones).toBeHidden();
    await dock.getByRole("button", { name: "Desligar microfone", exact: true }).click();
    await expect(dock.getByRole("button", { name: "Ligar microfone", exact: true })).toBeEnabled();
    await dock.screenshot({ path: test.info().outputPath("dock-mobile-dark.png") });

    await dock.getByRole("button", { name: "Compartilhar tela", exact: true }).click();
    await page.getByRole("button", { name: /^Tela inteira/ }).click();
    await expect(page.getByLabel("Prévia da sua tela")).toBeVisible();
    const stopSharing = dock.getByRole("button", { name: /^Parar de compartilhar/ });
    await expect(stopSharing).toBeEnabled();
    await dock.screenshot({ path: test.info().outputPath("dock-sharing-dark.png") });
    await stopSharing.click();
    await expect(
      dock.getByRole("button", { name: "Compartilhar tela", exact: true }),
    ).toBeEnabled();
    await expect(page.getByLabel("Prévia da sua tela")).toBeHidden();

    await dock.getByRole("button", { name: "Chat", exact: true }).click();
    await expect(dock.getByRole("button", { name: "Chat", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByPlaceholder("Escreva para a sala")).toBeVisible();
    await page.getByRole("button", { name: "Fechar chat", exact: true }).click();
    await page.getByRole("button", { name: "Mais opções", exact: true }).click();
    await page.getByRole("button", { name: "Ativar modo claro", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await dock.screenshot({ path: test.info().outputPath("dock-mobile-light.png") });
    await context.close();
  });

  test("computer audio that would echo the room is left out of the share", async ({ browser }) => {
    const participant = await newParticipant(browser, "Bia Teste");
    await fakeScreenCapture(participant.page, { withSound: true });
    await joinRoom(participant.page, await newRoomCode(), { micOn: false });

    await participant.page.getByRole("button", { name: "Compartilhar tela", exact: true }).click();
    await participant.page.getByRole("button", { name: /^Tela inteira/ }).click();
    await expect(participant.page.getByLabel("Prévia da sua tela")).toBeVisible();
    await expect(participant.page.getByText(/O som do computador ficou de fora/)).toBeVisible();

    await participant.context.close();
  });

  test("a tab in a Nelcota call never shares its sound", async ({ browser }) => {
    const sharer = await newParticipant(browser, "Tab Chamada");
    await fakeScreenCapture(sharer.page, { withSound: true, safeAudio: true, callTab: "start" });
    await joinRoom(sharer.page, await newRoomCode(), { micOn: false });

    await sharer.page.getByRole("button", { name: "Compartilhar tela", exact: true }).click();
    await sharer.page.getByRole("button", { name: /^Aba do navegador/ }).click();
    await expect(sharer.page.getByLabel("Prévia da sua tela")).toBeVisible();
    await expect(sharer.page.getByText(/O som da aba ficou de fora/)).toBeVisible();

    await sharer.context.close();
  });

  test("a shared tab that joins a call stops sending its sound", async ({ browser }) => {
    const listener = await newParticipant(browser, "Tab Ouvinte");
    const sharer = await newParticipant(browser, "Tab Troca");
    await fakeScreenCapture(sharer.page, { withSound: true, safeAudio: true, callTab: "later" });
    const code = await newRoomCode();
    await joinRoom(listener.page, code, { micOn: false });
    await joinRoom(sharer.page, code, { micOn: false });
    const heardTracks = () => listener.page.locator("audio").count();

    await sharer.page.getByRole("button", { name: "Compartilhar tela" }).click();
    await sharer.page.getByRole("button", { name: /^Aba do navegador/ }).click();
    await listener.page.getByRole("button", { name: "Assistir à tela de Tab Troca" }).click();
    await expect.poll(heardTracks).toBe(1);
    await sharer.page.evaluate(() =>
      (window as unknown as { joinCapturedTabToCall: () => void }).joinCapturedTabToCall(),
    );
    await expect(sharer.page.getByText(/O som da aba ficou de fora/)).toBeVisible();
    await expect.poll(heardTracks).toBe(0);
    await expect(sharer.page.getByLabel("Prévia da sua tela")).toBeVisible();

    await listener.context.close();
    await sharer.context.close();
  });

  test("a viewer turns down only the shared screen's sound", async ({ browser }) => {
    const viewer = await newParticipant(browser, "Volume Ouvinte");
    const presenter = await newParticipant(browser, "Volume Tela");
    await fakeScreenCapture(presenter.page, { withSound: true, safeAudio: true });
    const code = await newRoomCode();
    await joinRoom(viewer.page, code, { micOn: false });
    await joinRoom(presenter.page, code);
    const volumes = () =>
      viewer.page
        .locator("audio")
        .evaluateAll((elements) =>
          elements.map((element) => (element as HTMLAudioElement).volume).toSorted((a, b) => a - b),
        );

    await presenter.page.getByRole("button", { name: "Compartilhar tela" }).click();
    await presenter.page.getByRole("button", { name: /^Tela inteira/ }).click();
    await viewer.page.getByRole("button", { name: "Assistir à tela de Volume Tela" }).click();
    await expect.poll(async () => (await volumes()).length).toBe(2);
    await expect(viewer.page.getByText("Tela sem som")).toHaveCount(0);
    await viewer.page.getByRole("button", { name: "Volume da tela: 100%" }).click();
    await viewer.page.getByRole("slider", { name: "Volume da tela de Volume Tela" }).focus();
    for (let step = 0; step < 10; step += 1) await viewer.page.keyboard.press("ArrowLeft");
    await expect.poll(volumes).toEqual([0.5, 1]);
    await viewer.page.getByRole("button", { name: "Silenciar a tela" }).click();
    await expect.poll(volumes).toEqual([0, 1]);
    await viewer.page.getByRole("button", { name: "Voltar o som da tela" }).click();
    await expect.poll(volumes).toEqual([0.5, 1]);

    await viewer.context.close();
    await presenter.context.close();
  });

  test("alone: welcome; leave and join again", async ({ browser }) => {
    const caio = await newParticipant(browser, "Caio Teste");
    const code = await newRoomCode();
    await joinRoom(caio.page, code);
    await expect(caio.page.getByText("Você é a primeira pessoa aqui")).toBeVisible();

    await caio.page.getByRole("button", { name: "Sair da sala" }).click();
    await caio.page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Sair", exact: true })
      .click();
    await expect(caio.page.getByText("Você saiu da chamada")).toBeVisible();
    await caio.page.getByRole("button", { name: "Voltar à chamada" }).click();
    await expect(caio.page.getByLabel("Senha da sala")).toBeVisible();
    await caio.context.close();
  });

  test("two people: join notice, chat, reaction, hand and shared screen", async ({ browser }) => {
    const code = await newRoomCode();
    const dani = await newParticipant(browser, "Dani Souza");
    const edu = await newParticipant(browser, "Edu Lima");
    await fakeScreenCapture(dani.page);

    await joinRoom(dani.page, code);
    await dani.page.getByRole("button", { name: "Compartilhar tela", exact: true }).click();
    await dani.page.getByRole("button", { name: /^Tela inteira/ }).click();
    await expect(dani.page.getByLabel("Prévia da sua tela")).toBeVisible();

    await joinRoom(edu.page, code);
    await expect(dani.page.getByText("Edu Lima entrou na sala")).toBeVisible();
    await expect(
      edu.page.getByRole("region", { name: "Tela compartilhada por Dani Souza" }),
    ).toHaveCount(0);
    await expect(edu.page.getByRole("button", { name: "Mostrar FPS e ping" })).toHaveCount(0);
    await edu.page.getByRole("button", { name: "Assistir à tela de Dani Souza" }).click();
    await expect(
      edu.page.getByRole("region", { name: "Tela compartilhada por Dani Souza" }),
    ).toBeVisible();

    // Shared screen in a floating window, and back. The window needs the first frames.
    await expect
      .poll(() =>
        edu.page.getByLabel("Tela de Dani Souza").evaluate((v: HTMLVideoElement) => v.readyState),
      )
      .toBeGreaterThan(0);
    await expect(edu.page.getByText("Tela sem som")).toBeAttached();
    await expect(edu.page.getByLabel("Estatísticas da tela")).toHaveCount(0);
    await edu.page.getByRole("button", { name: "Mostrar FPS e ping" }).click();
    const metrics = edu.page.getByLabel("Estatísticas da tela");
    await expect(metrics).toContainText(/Recebendo: [1-9]\d* FPS/);
    await expect(metrics).toContainText(/Seu ping ao servidor: (\d+|—) ms/);
    // Measured in Dani's browser and sent to the viewers.
    await expect(metrics).toContainText(/Ping de quem apresenta: \d+ ms/);
    await edu.page.getByRole("button", { name: "Ocultar FPS e ping" }).click();
    await expect(metrics).toHaveCount(0);
    await edu.page.getByRole("button", { name: "Abrir em janela" }).click();
    await expect(edu.page.getByRole("button", { name: "Fechar a janela" })).toBeVisible();
    await edu.page.keyboard.press("j");
    await expect(edu.page.getByRole("button", { name: "Abrir em janela" })).toBeVisible();

    // Stop watching from the screen's own controls (the dock has the same button, tested in
    // stop-watching-dock): back to the call only, until "Assistir" again.
    await edu.page
      .getByRole("region", { name: "Tela compartilhada por Dani Souza" })
      .getByRole("button", { name: "Parar de assistir" })
      .click();
    await expect(
      edu.page.getByRole("region", { name: "Tela compartilhada por Dani Souza" }),
    ).toHaveCount(0);
    await expect(edu.page.getByRole("button", { name: "Mostrar FPS e ping" })).toHaveCount(0);
    await edu.page.getByRole("button", { name: "Assistir à tela de Dani Souza" }).click();
    await expect(
      edu.page.getByRole("region", { name: "Tela compartilhada por Dani Souza" }),
    ).toBeVisible();

    // Chat with the panel closed: notice and unread counter.
    await edu.page.getByRole("button", { name: /^Chat/ }).click();
    await edu.page.getByPlaceholder("Escreva para a sala").fill("Oi, Dani!");
    await edu.page.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(dani.page.getByRole("button", { name: "Chat (1 nova)" })).toBeVisible();

    // Reaction.
    await edu.page.getByRole("button", { name: "Reações" }).click();
    await edu.page.getByRole("button", { name: "Reagir com 🎉" }).click();
    await expect(dani.page.getByText("🎉")).toBeVisible();

    // Raised hand (recorded by the server at /api/sala/mao).
    await edu.page.keyboard.press("Escape");
    await edu.page.keyboard.press("h");
    await expect(dani.page.getByText("✋ Edu Lima levantou a mão")).toBeVisible();
    await expect(
      dani.page.getByText("Edu Lima está com a mão levantada", { exact: true }),
    ).toBeVisible();
    await expect(
      edu.page.getByText("Edu Lima está com a mão levantada", { exact: true }),
    ).toBeVisible();
    await dani.page.setViewportSize({ width: 320, height: 740 });
    const badge = dani.page
      .getByText("Edu Lima está com a mão levantada", { exact: true })
      .locator("..");
    await expect(badge).toBeVisible();
    const badgeBounds = await badge.boundingBox();
    expect(badgeBounds).not.toBeNull();
    expect(badgeBounds!.width).toBeLessThanOrEqual(24);
    await expect(
      dani.page.getByText("Edu Lima está com a mão levantada", { exact: true }),
    ).toHaveClass("sr-only");
    await edu.page.keyboard.press("h");
    await expect(
      dani.page.getByText("Edu Lima está com a mão levantada", { exact: true }),
    ).toBeHidden();

    await dani.context.close();
    await edu.context.close();
  });

  test("a guest joins through the link once someone with an account is inside", async ({
    browser,
  }) => {
    const code = await newRoomCode();
    const gil = await newParticipant(browser, "Gil Anfitriao");
    const { page: iris, context } = await newVisitor(browser);
    const join = iris.getByRole("button", { name: /Entrar na sala|Entrar só ouvindo/ });

    await iris.goto(`/sala/${code}`);
    await iris.getByLabel("Seu nome na sala").fill("Iris Convidada");
    await iris.getByLabel("Senha da sala").fill(E2E_ACCESS_PASSWORD);
    await join.click();
    await expect(
      iris.getByText("Quando quem te convidou entrar, toque em Entrar na sala."),
    ).toBeVisible();

    await joinRoom(gil.page, code);
    await join.click();
    await expect(iris.getByRole("button", { name: /Sair/ })).toBeVisible();
    await expect(gil.page.getByText("Iris Convidada (sem conta) entrou na sala")).toBeVisible();

    // The guest's hand goes through the server too (signed guest cookie).
    await iris.keyboard.press("h");
    await expect(gil.page.getByText("✋ Iris Convidada (sem conta) levantou a mão")).toBeVisible();

    await iris.getByRole("button", { name: "Sair da sala" }).click();
    await iris.getByRole("alertdialog").getByRole("button", { name: "Sair", exact: true }).click();
    await expect(iris.getByRole("link", { name: "Criar conta grátis" })).toBeVisible();
    // Alone again after the guest left: not "the first person here" anymore.
    await expect(gil.page.getByText("Todo mundo saiu da sala")).toBeVisible();
    await expect(gil.page.getByText("Você é a primeira pessoa aqui")).toBeHidden();
    await context.close();
    await gil.context.close();
  });

  test("a connection failure offers to try again (B-01)", async ({ browser }) => {
    const fia = await newParticipant(browser, "Fia Teste");
    await fia.page.route("**/api/token", async (route) => {
      const response = await route.fetch();
      const body = (await response.json()) as { token: string };
      await route.fulfill({ response, json: { ...body, serverUrl: "ws://127.0.0.1:9" } });
    });
    await fia.page.goto(`/sala/${await newRoomCode()}`);
    await fia.page.getByLabel("Senha da sala").fill(E2E_ACCESS_PASSWORD);
    await fia.page.getByRole("button", { name: /Entrar na sala|Entrar só ouvindo/ }).click();
    await expect(fia.page.getByText("Não deu para conectar")).toBeVisible({ timeout: 30_000 });
    await expect(fia.page.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
    await fia.context.close();
  });
});
