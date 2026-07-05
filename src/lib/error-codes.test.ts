import { describe, it, expect } from "vitest";

import { AppError, NotFoundError } from "./errors";
import { appErrorCode, APP_ERROR_CODES } from "./error-codes";

describe("appErrorCode (typed to Cascata's code set)", () => {
  it("returns the code when it is one of the app's codes", () => {
    expect(appErrorCode(new NotFoundError("Link inválido", "LINK_INVALID"))).toBe("LINK_INVALID");
    expect(appErrorCode(new AppError("Link expirado", 410, "LINK_EXPIRED"))).toBe("LINK_EXPIRED");
  });

  it("survives the serverFn boundary (plain object + marker)", () => {
    const wire = { appError: true, status: 404, code: "LINK_INVALID", message: "no" };
    expect(appErrorCode(wire)).toBe("LINK_INVALID");
  });

  it("returns undefined for unknown codes or non-domain errors", () => {
    expect(appErrorCode(new AppError("x", 500, "NOT_A_CASCATA_CODE"))).toBeUndefined();
    expect(appErrorCode(new Error("plain"))).toBeUndefined();
    expect(appErrorCode(null)).toBeUndefined();
  });

  it("lists every code the app raises", () => {
    expect(APP_ERROR_CODES).toContain("VALIDATION_ERROR");
    expect(APP_ERROR_CODES.length).toBe(7);
  });
});
