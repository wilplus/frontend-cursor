import { describe, expect, it } from "vitest";
import { validateAudioUpload, MAX_UPLOAD_BYTES } from "./audioUploadValidation";

function fileOf(name: string, type: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("validateAudioUpload", () => {

  it("rejects a file over the proxy size limit", () => {
    expect(
      validateAudioUpload(fileOf("take.mp3", "audio/mpeg", MAX_UPLOAD_BYTES + 1))
    ).toMatch(/large/i);
  });
});
