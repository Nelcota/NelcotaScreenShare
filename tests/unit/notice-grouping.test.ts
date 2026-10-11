import { describe, expect, test } from "vitest";
import {
  addToNoticeGroup,
  NOTICE_GROUP_WINDOW_MS,
  noticeGroupMessage,
  type NoticeGroup,
  type NoticePerson,
} from "@/features/room/domain/notice-grouping";

const ana = { identity: "ana", name: "Ana" };
const beto = { identity: "beto", name: "Beto" };
const carla = { identity: "carla", name: "Carla" };
const davi = { identity: "davi", name: "Davi" };

function joinAll(first: NoticePerson, ...others: readonly NoticePerson[]): NoticeGroup {
  return others.reduce(
    (group, person, index) => addToNoticeGroup(group, "joined", person, (index + 1) * 100),
    addToNoticeGroup(undefined, "joined", first, 0),
  );
}

describe("noticeGroupMessage", () => {
  test("names one, two or three people and counts the rest", () => {
    expect(noticeGroupMessage(joinAll(ana))).toBe("Ana entrou na sala");
    expect(noticeGroupMessage(joinAll(ana, beto))).toBe("Ana e Beto entraram na sala");
    expect(noticeGroupMessage(joinAll(ana, beto, carla))).toBe(
      "Ana, Beto e Carla entraram na sala",
    );
    expect(noticeGroupMessage(joinAll(ana, beto, carla, davi))).toBe(
      "Ana, Beto e mais 2 entraram na sala",
    );
  });

  test("uses the leaving wording", () => {
    const one = addToNoticeGroup(undefined, "left", ana, 0);
    expect(noticeGroupMessage(one)).toBe("Ana saiu da sala");
    expect(noticeGroupMessage(addToNoticeGroup(one, "left", beto, 10))).toBe(
      "Ana e Beto saíram da sala",
    );
  });

  test("falls back to someone for an empty group", () => {
    expect(noticeGroupMessage({ kind: "joined", people: [], lastAt: 0 })).toBe(
      "Alguém entrou na sala",
    );
  });
});

describe("addToNoticeGroup", () => {
  test("starts a new group after the window", () => {
    const first = addToNoticeGroup(undefined, "joined", ana, 0);
    const late = addToNoticeGroup(first, "joined", beto, NOTICE_GROUP_WINDOW_MS + 1);
    expect(late.people).toEqual([beto]);
  });

  test("the window counts from the latest notice", () => {
    const first = addToNoticeGroup(undefined, "joined", ana, 0);
    const second = addToNoticeGroup(first, "joined", beto, NOTICE_GROUP_WINDOW_MS);
    const third = addToNoticeGroup(second, "joined", carla, NOTICE_GROUP_WINDOW_MS * 2);
    expect(third.people).toEqual([ana, beto, carla]);
  });

  test("does not mix kinds or repeat a person", () => {
    const joined = addToNoticeGroup(undefined, "joined", ana, 0);
    expect(addToNoticeGroup(joined, "left", beto, 10).people).toEqual([beto]);
    expect(addToNoticeGroup(joined, "joined", ana, 10).people).toEqual([ana]);
  });

  test("never changes the previous group", () => {
    const first = addToNoticeGroup(undefined, "joined", ana, 0);
    addToNoticeGroup(first, "joined", beto, 10);
    expect(first.people).toEqual([ana]);
  });
});
