import { describe, expect, it } from "vitest";
import { validateAudioUpload, MAX_UPLOAD_BYTES } from "./audioUploadValidation";

function fileOf(name: string, type: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("validateAudioUpload", () => {
  it("accepts a small audio file", () => {
    expect(validateAudioUpload(fileOf("take.mp3", "audio/mpeg", 1000))).toBeNull();
  });

  it("rejects video by MIME type", () => {
    expect(
      validateAudioUpload(fileOf("clip.mp4", "video/mp4", 1000))
    ).toMatch(/video/i);
  });

  it("rejects video by extension when the MIME type is missing", () => {
    expect(validateAudioUpload(fileOf("clip.mov", "", 1000))).toMatch(/video/i);
  });

  it("accepts an audio file with no MIME type (some pickers omit it)", () => {
    expect(validateAudioUpload(fileOf("take.m4a", "", 1000))).toBeNull();
  });

  it("rejects a file over the proxy size limit", () => {
    expect(
      validateAudioUpload(fileOf("take.mp3", "audio/mpeg", MAX_UPLOAD_BYTES + 1))
    ).toMatch(/large/i);
  });

  it("accepts a file exactly at the limit", () => {
    expect(
      validateAudioUpload(fileOf("take.mp3", "audio/mpeg", MAX_UPLOAD_BYTES))
    ).toBeNull();
  });
});
