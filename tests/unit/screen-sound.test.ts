import assert from "node:assert/strict";
import { test } from "vitest";
import {
  OWN_SCREEN_SOUND_LABEL,
  ownScreenSound,
  screenSoundAudible,
} from "@/features/room/domain/screen-sound";

test("a screen shared without sound has nothing to turn on", () => {
  assert.equal(ownScreenSound(undefined), "absent");
});

test("the sharer's sound is on until they turn it off", () => {
  assert.equal(ownScreenSound({ isMuted: false }), "on");
  assert.equal(ownScreenSound({ isMuted: true }), "off");
});

test("the button names what a click does", () => {
  assert.equal(OWN_SCREEN_SOUND_LABEL.on, "Desligar o som da tela");
  assert.equal(OWN_SCREEN_SOUND_LABEL.off, "Ligar o som da tela");
  assert.equal(OWN_SCREEN_SOUND_LABEL.absent, "Esta tela vai sem som");
});

test("a viewer hears the screen only while its sharer keeps the sound on", () => {
  assert.equal(screenSoundAudible({ isMuted: false }), true);
  assert.equal(screenSoundAudible({ isMuted: true }), false);
  assert.equal(screenSoundAudible(undefined), false);
});
