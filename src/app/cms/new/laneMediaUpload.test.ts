import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  contentTypeFor,
  oversizeMessage,
  unsupportedMessage,
} from "./laneMediaUpload";

const fileOf = (name: string, type: string, size: number): File =>
  ({ name, type, size }) as File;

const VIDEO_CAP = 500 * 1024 * 1024; // what the presign serves by default

describe("the 19-second clip", () => {
  it("accepts a phone clip that the old 4.3 MB guard refused", () => {
    // The reported bug: 19 seconds of iPhone video, tens of MB, rejected by a
    // limit belonging to the coach BFF — a path this upload never touches.
    const clip = fileOf("IMG_4831.mov", "video/quicktime", 38 * 1024 * 1024);
    expect(unsupportedMessage(contentTypeFor(clip), "video")).toBeNull();
    expect(oversizeMessage(clip.size, VIDEO_CAP)).toBeNull();
  });

  it("reads the type off the name when the picker set none", () => {
    expect(contentTypeFor(fileOf("IMG_4831.MOV", "", 1))).toBe("video/quicktime");
    expect(contentTypeFor(fileOf("clip.mp4", "", 1))).toBe("video/mp4");
    expect(contentTypeFor(fileOf("no-extension", "", 1))).toBe("");
  });
});

describe("what it still refuses, and what it says", () => {
  it("names both numbers when a file really is too big", () => {
    const said = oversizeMessage(620 * 1024 * 1024, VIDEO_CAP);
    expect(said).toContain("620 MB");
    expect(said).toContain("500 MB");
    // Never again a length complaint about a size problem.
    expect(said).not.toMatch(/minute|shorter|length/i);
  });

  it("checks nothing when the backend served no cap", () => {
    expect(oversizeMessage(9e9, null)).toBeNull();
  });

  it("refuses a format the backend would refuse anyway, in words", () => {
    expect(unsupportedMessage("video/x-msvideo", "video")).toContain("MP4, MOV or WebM");
    expect(unsupportedMessage("application/pdf", "image")).toContain("JPEG");
  });
});

describe("the limit that does not apply here", () => {
  const RECORD = readFileSync("src/app/cms/new/RecordStep.tsx", "utf8");
  const CLIENT_SRC = readFileSync("src/app/cms/new/page.client.tsx", "utf8");
  const API = readFileSync("src/services/api/journalAdmin.ts", "utf8");

  it("is gone from the lane", () => {
    expect(RECORD).not.toContain("MAX_UPLOAD_BYTES");
    expect(RECORD).not.toContain("Keep it under a minute");
  });

  it("is replaced by the cap the presign serves", () => {
    expect(API).toContain("max_bytes");
    expect(RECORD).toContain("presigned.data.maxBytes");
    expect(CLIENT_SRC).toContain("presigned.data.maxBytes");
  });

  it("sends the signed headers back verbatim", () => {
    expect(API).toContain("presign.headers ??");
  });
});
