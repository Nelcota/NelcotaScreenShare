import { expect, test, type Page } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode, newVisitor } from "./support/session";
import { E2E_ACCESS_PASSWORD, E2E_URL } from "./support/env";

/**
 * Fake shared screen: an animated canvas instead of the browser's picker. `withSound`
 * adds computer audio that, like a real capture without `restrictOwnAudio`, would carry
 * the room's playback.
 */
async function fakeScreenCapture(page: Page, { withSound = false } = {}) {
  await page.addInitScript((sound) => {
    navigator.mediaDevices.getDisplayMedia = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const context = canvas.getContext("2d");
      let frame = 0;
      setInterval(() => {
        frame += 1;
        if (!context) return;
        context.fillStyle = frame % 2 ? "#3a7" : "#173";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }, 100);
      const stream = canvas.captureStream(15);
      if (sound) {
        const audio = new AudioContext();
        const destination = audio.createMediaStreamDestination();
        audio.createOscillator().connect(destination);
        stream.addTrack(destination.stream.getAudioTracks()[0]!);
      }
      return Promise.resolve(stream);
    };
  }, withSound);
}

test.describe("room access", () => {
  test("without an account opens as a guest; signing in comes back to the room", async ({
    browser,
  }) => {
    const { page, context } = await newVisitor(browser);
    await page.goto("/sala/ABC-DEFG-HIJ");
    await expect(page).toHaveURL(/\/sala\/abc-defg-hij$/);
    await expect(page.getByLabel("Seu nome na sala")).toBeFocused();
    await page.getByRole("link", { name: "Já tenho conta" }).click();
    await expect(page).toHaveURL(/\/entrar\?voltar=%2Fsala%2Fabc-defg-hij/);
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
    const path = `/sala/${newRoomCode()}`;
    await page.goto(path);
    await expect(page.getByRole("button", { name: /Entrar na sala/ })).toBeDisabled();
    await expect(page.locator("form")).toHaveAttribute("method", "post");
    await page.getByLabel("Senha da sala (quem te convidou sabe)").fill(E2E_ACCESS_PASSWORD);
    await page.getByLabel("Senha da sala (quem te convidou sabe)").press("Enter");
    await expect(page).toHaveURL(`${E2E_URL}${path}`);
    await context.close();
    await person.context.close();
  });

  test("a wrong password shows the error on the field", async ({ browser }) => {
    const ana = await newParticipant(browser, "Ana Teste");
    const response = await ana.page.goto(`/sala/${newRoomCode()}`);
    expect(await response?.text()).not.toContain(E2E_ACCESS_PASSWORD);
    await expect(ana.page.getByText(/Captando áudio|Microfone testado/)).toBeVisible();
    await ana.page.getByLabel("Senha da sala (quem te convidou sabe)").fill("errada");
    await ana.page.getByRole("button", { name: /Entrar na sala|Entrar só ouvindo/ }).click();
    await expect(ana.page.getByText("Essa senha não confere")).toBeVisible();
    await ana.context.close();
  });

  test("with the microphone off, joins listen-only", async ({ browser }) => {
    const bia = await newParticipant(browser, "Bia Teste");
    await bia.page.goto(`/sala/${newRoomCode()}`);
    await bia.page.getByRole("switch").first().click();
    await expect(bia.page.getByRole("button", { name: /Entrar só ouvindo/ })).toBeVisible();
    await bia.context.close();
  });
});

test.describe("in the room", () => {
  test("opening and reopening a long chat positions the latest messages in view", async ({
    browser,
  }) => {
    const sender = await newParticipant(browser, "Historico Remetente");
    const reader = await newParticipant(browser, "Historico Leitor");
    const code = newRoomCode();
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
    await joinRoom(page, newRoomCode(), { micOn: false });
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
        dock.getByRole("button", { name: "Escolher microfone", exact: true }),
      ).toBeVisible();
    }
    await dock.getByRole("button", { name: "Escolher microfone", exact: true }).click();
    const microphones = page.getByRole("dialog", { name: "Microfones", exact: true });
    await expect(microphones).toBeVisible();
    await microphones.getByRole("button").last().click();
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
    await joinRoom(participant.page, newRoomCode(), { micOn: false });

    await participant.page.getByRole("button", { name: "Compartilhar minha tela" }).click();
    await participant.page.getByRole("button", { name: /^Tela inteira/ }).click();
    await expect(participant.page.getByLabel("Prévia da sua tela")).toBeVisible();
    await expect(participant.page.getByText(/O som do computador ficou de fora/)).toBeVisible();

    await participant.context.close();
  });

  test("alone: welcome; leave and join again", async ({ browser }) => {
    const caio = await newParticipant(browser, "Caio Teste");
    const code = newRoomCode();
    await joinRoom(caio.page, code);
    await expect(caio.page.getByText("Você é a primeira pessoa aqui")).toBeVisible();

    await caio.page.getByRole("button", { name: "Sair da sala" }).click();
    await caio.page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Sair", exact: true })
      .click();
    await expect(caio.page.getByText("Você saiu da sala")).toBeVisible();
    await caio.page.getByRole("button", { name: "Voltar para a sala" }).click();
    await expect(caio.page.getByLabel("Senha da sala (quem te convidou sabe)")).toBeVisible();
    await caio.context.close();
  });

  test("two people: join notice, chat, reaction, hand and shared screen", async ({ browser }) => {
    const code = newRoomCode();
    const dani = await newParticipant(browser, "Dani Souza");
    const edu = await newParticipant(browser, "Edu Lima");
    await fakeScreenCapture(dani.page);

    await joinRoom(dani.page, code);
    await dani.page.getByRole("button", { name: "Compartilhar minha tela" }).click();
    await dani.page.getByRole("button", { name: /^Tela inteira/ }).click();
    await expect(dani.page.getByLabel("Prévia da sua tela")).toBeVisible();

    await joinRoom(edu.page, code);
    await expect(dani.page.getByText("Edu Lima entrou na sala")).toBeVisible();
    await expect(
      edu.page.getByRole("region", { name: "Tela compartilhada por Dani Souza" }),
    ).toBeVisible();

    // Shared screen in a floating window, and back. The window needs the first frames.
    await expect
      .poll(() =>
        edu.page.getByLabel("Tela de Dani Souza").evaluate((v: HTMLVideoElement) => v.readyState),
      )
      .toBeGreaterThan(0);
    await edu.page.getByRole("button", { name: "Abrir em janela" }).click();
    await expect(edu.page.getByRole("button", { name: "Fechar a janela" })).toBeVisible();
    await edu.page.keyboard.press("j");
    await expect(edu.page.getByRole("button", { name: "Abrir em janela" })).toBeVisible();

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
      dani.page.getByLabel("Edu Lima está com a mão levantada", { exact: true }),
    ).toBeVisible();
    await expect(
      edu.page.getByLabel("Edu Lima está com a mão levantada", { exact: true }),
    ).toBeVisible();
    await edu.page.keyboard.press("h");
    await expect(
      dani.page.getByLabel("Edu Lima está com a mão levantada", { exact: true }),
    ).toBeHidden();

    await dani.context.close();
    await edu.context.close();
  });

  test("a guest joins through the link once someone with an account is inside", async ({
    browser,
  }) => {
    const code = newRoomCode();
    const gil = await newParticipant(browser, "Gil Anfitriao");
    const { page: iris, context } = await newVisitor(browser);
    const join = iris.getByRole("button", { name: /Entrar na sala|Entrar só ouvindo/ });

    await iris.goto(`/sala/${code}`);
    await iris.getByLabel("Seu nome na sala").fill("Iris Convidada");
    await iris.getByLabel("Senha da sala (quem te convidou sabe)").fill(E2E_ACCESS_PASSWORD);
    await join.click();
    await expect(iris.getByText(/A sala ainda não começou/)).toBeVisible();

    await joinRoom(gil.page, code);
    await join.click();
    await expect(iris.getByRole("button", { name: /Sair/ })).toBeVisible();
    await expect(gil.page.getByText("Iris Convidada (convidado) entrou na sala")).toBeVisible();

    // The guest's hand goes through the server too (signed guest cookie).
    await iris.keyboard.press("h");
    await expect(gil.page.getByText("✋ Iris Convidada (convidado) levantou a mão")).toBeVisible();

    await iris.getByRole("button", { name: "Sair da sala" }).click();
    await iris.getByRole("alertdialog").getByRole("button", { name: "Sair", exact: true }).click();
    await expect(iris.getByRole("link", { name: "Criar conta grátis" })).toBeVisible();
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
    await fia.page.goto(`/sala/${newRoomCode()}`);
    await fia.page.getByLabel("Senha da sala (quem te convidou sabe)").fill(E2E_ACCESS_PASSWORD);
    await fia.page.getByRole("button", { name: /Entrar na sala|Entrar só ouvindo/ }).click();
    await expect(fia.page.getByText("Não deu para conectar")).toBeVisible({ timeout: 30_000 });
    await expect(fia.page.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
    await fia.context.close();
  });
});
