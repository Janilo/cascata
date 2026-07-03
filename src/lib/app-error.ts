// Typed domain errors. One place defines the error codes the app can raise,
// so the client can react to *which* failure happened instead of matching on
// human-facing message strings ("Link expirado" vs "Link inválido").
//
// Boundary note (why appErrorCode instead of instanceof): server functions
// serialize thrown errors with seroval, which preserves own enumerable
// properties (`code`, `status`, `name`) but NOT the subclass prototype — on the
// client the error arrives as a plain `Error` with a `code` property. So:
//   server:  throw new AppError("LINK_EXPIRED", "Link expirado", 410)
//   client:  appErrorCode(e) === "LINK_EXPIRED"  // never `e instanceof AppError`

export const APP_ERROR_CODES = [
  "LINK_INVALID", // share token unknown (or lookup failed)
  "LINK_EXPIRED", // share token exists but expires_at is in the past
  "FORBIDDEN_PENDING_APPROVAL", // logged in, but account not approved yet
  "AUTH_ERROR", // sign-in with the identity provider failed
  "CONFIG_ERROR", // server env/config missing — operator problem, not user
  "DB_ERROR", // database read/write failed
  "VALIDATION_ERROR", // input is well-formed but violates a domain precondition
] as const;

export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export class AppError extends Error {
  readonly code: AppErrorCode;
  /** HTTP-ish status for boundaries that speak HTTP; informational elsewhere. */
  readonly status: number;

  constructor(code: AppErrorCode, message: string, status = 500) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

// Extracts the AppErrorCode from any thrown value, on either side of the
// serverFn boundary. Returns undefined for non-domain errors.
export function appErrorCode(e: unknown): AppErrorCode | undefined {
  if (e == null || typeof e !== "object") return undefined;
  const code = (e as { code?: unknown }).code;
  return typeof code === "string" && (APP_ERROR_CODES as readonly string[]).includes(code)
    ? (code as AppErrorCode)
    : undefined;
}
