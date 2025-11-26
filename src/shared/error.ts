import type { Span } from "@/parse/span"

export const enum ErrorKind {
  Internal,
  Standard,
  UB,
}

const PREFIXES = {
  [ErrorKind.Internal]: "[ice] ",
  [ErrorKind.Standard]: "",
  [ErrorKind.UB]: "[ub] ",
}

export class NLError extends Error {
  constructor(
    readonly kind: ErrorKind,
    message: string,
    readonly span?: Span,
  ) {
    super(PREFIXES[kind] + message)
  }
}
