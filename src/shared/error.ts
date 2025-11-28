import type { Span } from "@/parse/span"
import { bold, dim, red, reset } from "./ansi"

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
          .map(
            (x) =>
              "\n"
              + reset
              + dim
              + x.text.slice(0, x.start.idx)
              + reset
              + red
              + bold
              + x.text.slice(x.start.idx, x.end.idx)
              + reset
              + dim
              + x.text.slice(x.end.idx)
              + red,
          )
          .join(""),
    )
  }

  push(span: Span) {
    this.span.push(span)
  }
}
