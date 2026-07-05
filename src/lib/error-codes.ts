// Cascata's domain error codes — the app-specific layer on top of the shared,
// canonical errors.ts. The base AppError + a string-typed appErrorCode live in
// errors.ts; here we pin the *closed set* of codes this app raises and narrow
// appErrorCode to it, so UI code can switch on the code type-safely
// (see SHARE_ERROR_COPY in routes/share.$token.tsx).

import { appErrorCode as baseAppErrorCode } from "./errors";

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

/** The domain code from any thrown value, narrowed to Cascata's code set. */
export function appErrorCode(e: unknown): AppErrorCode | undefined {
  const code = baseAppErrorCode(e);
  return code && (APP_ERROR_CODES as readonly string[]).includes(code)
    ? (code as AppErrorCode)
    : undefined;
}
