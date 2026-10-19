/*
STORY    As a speaker uploading a recording instead of recording live, I want a
         too-large or video file refused before upload with a plain reason, so
         that I do not wait for a failure (record step of the loop).
OUTCOME
  O1  A file over the upload limit is refused with a "too large" reason.
  O2  A video file (by MIME type, or by extension when the type is missing)
      is refused with an "audio only" reason.
  O3  A normal audio file within the limit is accepted (no reason returned).
PROVES   O1 -> "refuses a file over the upload limit"
         O2 -> "refuses a video file, by type or by extension"
         O3 -> "accepts a normal audio file within the limit"
WHY      Bug 1: video files reached the BFF and died as a raw 413.
*/
import { describe, expect, it } from "vitest";
import { validateAudioUpload, MAX_UPLOAD_BYTES } from "./audioUploadValidation";

function fileOf(name: string, type: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("validateAudioUpload", () => {
  it("refuses a file over the upload limit", () => {
    expect(
      validateAudioUpload(fileOf("take.mp3", "audio/mpeg", MAX_UPLOAD_BYTES + 1))
    ).toMatch(/large/i);
  });

  it("refuses a video file, by type or by extension", () => {
    expect(validateAudioUpload(fileOf("talk.mp4", "video/mp4", 1024))).toMatch(/audio files only/i);
    expect(validateAudioUpload(fileOf("talk.MOV", "", 1024))).toMatch(/audio files only/i);
  });

  it("accepts a normal audio file within the limit", () => {
    expect(validateAudioUpload(fileOf("take.m4a", "audio/mp4", 1024))).toBeNull();
    expect(validateAudioUpload(fileOf("take.mp3", "audio/mpeg", MAX_UPLOAD_BYTES))).toBeNull();
  });
});
