import { Reason, type Span } from "@/parse/span"

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
    readonly header: string,
    public span?: Span,
  ) {
    super(PREFIXES[kind] + header + (span ? "\n\n" + span.highlight() : ""))
  }

  with(span: Span, why: Reason) {
    if (this.span) {
      this.span = this.span.with(span.for(why))
    } else {
      this.span = span.for(why)
    }
  }
}
