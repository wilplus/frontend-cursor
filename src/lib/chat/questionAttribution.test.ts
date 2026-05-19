import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  describeQuestionSource,
  logQuestionAttribution,
  type NextQuestionAttribution,
} from "./questionAttribution";

describe("questionAttribution", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    infoSpy.mockRestore();
    warnSpy.mockRestore();
  });

  describe("describeQuestionSource()", () => {
    it("directives_queue + directive → 'admin · directive #N (tag)'", () => {
      expect(
        describeQuestionSource({
          source: "directives_queue",
          directive: { position: 2, intent_tag: "probe" },
        })
      ).toBe("admin · directive #2 (probe)");
    });

    it("directives_queue with empty intent_tag → drops the parens", () => {
      expect(
        describeQuestionSource({
          source: "directives_queue",
          directive: { position: 1, intent_tag: "  " },
        })
      ).toBe("admin · directive #1");
    });

    it("directives_queue without directive object → 'admin · directive'", () => {
      expect(
        describeQuestionSource({ source: "directives_queue" })
      ).toBe("admin · directive");
    });

    it("admin_override → 'admin · override'", () => {
      expect(
        describeQuestionSource({ source: "admin_override" })
      ).toBe("admin · override");
    });

    it("llm_generated → null (no attribution to show)", () => {
      expect(
        describeQuestionSource({ source: "llm_generated" })
      ).toBeNull();
    });

    it("unknown source → warns LOUD and returns the literal", () => {
      const result = describeQuestionSource({
        source: "experimental_path_2099" as unknown as NextQuestionAttribution["source"],
      });
      expect(result).toBe("unknown source: experimental_path_2099");
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringMatching(/unknown source/i)
      );
    });
  });

  describe("logQuestionAttribution()", () => {
    it("emits console.info for directives_queue with structured prefix", () => {
      logQuestionAttribution(
        {
          source: "directives_queue",
          directive: { position: 3, intent_tag: "challenge" },
        },
        7
      );
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[next-question attribution\] turn=7/),
        { position: 3, intent_tag: "challenge" }
      );
    });

    it("emits console.info for admin_override with no directive object", () => {
      logQuestionAttribution({ source: "admin_override" }, 4);
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringMatching(/turn=4.*admin · override/i),
        null
      );
    });

    it("is a no-op for llm_generated (no info or warn fires)", () => {
      logQuestionAttribution({ source: "llm_generated" }, 5);
      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
