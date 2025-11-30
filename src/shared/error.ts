import { Reason, Span } from "@/parse/span"
import { blue, bold, reset } from "./ansi"

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

function message(kind: ErrorKind, header: string, span: Span | undefined) {
  return (
    PREFIXES[kind]
    + header
      .replaceAll("\nhelp: ", "\n  " + blue + bold + "help: " + reset)
      .replaceAll("\nnote: ", "\n  " + blue + bold + "note: " + reset)
    + (span ? "\n\n" + span.highlight() : "")
  )
}

export class NLError extends Error {
  constructor(
    readonly kind: ErrorKind,
    readonly header: string,
    public span?: Span,
  ) {
    super(message(kind, header, span))
  }

  with(span: Span, why: Reason) {
    if (this.span) {
      this.span = this.span.with(span.for(why))
    } else {
      this.span = span.for(why)
    }
    this.message = message(this.kind, this.header, this.span)
  }
}
