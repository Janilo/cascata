import { describe, it, expect } from "vitest";
import { AppError, appErrorCode } from "./app-error";

describe("AppError", () => {
  it("carries code, status and message", () => {
    const e = new AppError("LINK_EXPIRED", "Link expirado", 410);
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("AppError");
    expect(e.code).toBe("LINK_EXPIRED");
    expect(e.status).toBe(410);
    expect(e.message).toBe("Link expirado");
  });

  it("defaults status to 500", () => {
    expect(new AppError("DB_ERROR", "boom").status).toBe(500);
  });
});

describe("appErrorCode — both sides of the serverFn boundary", () => {
  it("reads the code from a live AppError (server side)", () => {
    expect(appErrorCode(new AppError("LINK_INVALID", "Link inválido", 404))).toBe("LINK_INVALID");
  });

  it("reads the code from the deserialized shape (client side)", () => {
    // seroval preserves own enumerable props but NOT the subclass prototype:
    // the client receives a plain Error carrying `code`. This is exactly why
    // callers must use appErrorCode, never `instanceof AppError`.
    const wire = Object.assign(new Error("Link expirado"), {
      name: "AppError",
      code: "LINK_EXPIRED",
      status: 410,
    });
    expect(wire).not.toBeInstanceOf(AppError);
    expect(appErrorCode(wire)).toBe("LINK_EXPIRED");
  });

  it("returns undefined for non-domain errors and junk", () => {
    expect(appErrorCode(new Error("plain"))).toBeUndefined();
    expect(appErrorCode(Object.assign(new Error("x"), { code: "NOT_A_CODE" }))).toBeUndefined();
    expect(appErrorCode(Object.assign(new Error("x"), { code: 42 }))).toBeUndefined();
    expect(appErrorCode("string")).toBeUndefined();
    expect(appErrorCode(null)).toBeUndefined();
    expect(appErrorCode(undefined)).toBeUndefined();
  });

  it("distinguishes expired from invalid — the share-page decision", () => {
    const expired = appErrorCode(new AppError("LINK_EXPIRED", "Link expirado", 410));
    const invalid = appErrorCode(new AppError("LINK_INVALID", "Link inválido", 404));
    expect(expired).not.toBe(invalid);
  });
});
