import { highlight, type Span } from "@/parse/span"
import { blue, red } from "./ansi"

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
    readonly span: Span[] = [],
  ) {
    super(
      PREFIXES[kind]
        + header
        + span
          .map((x, i) => "\n\n" + highlight(x, [blue, red][i % 2]!))
          .join(""),
    )
  }

  push(span: Span) {
    this.span.push(span)
  }
}
