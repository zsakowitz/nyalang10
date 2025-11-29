import type { Span } from "@/parse/span"
import { ErrorKind, NLError } from "@/shared/error"

export function assert(x: unknown, span: Span): asserts x {
  if (!x) {
    ice(`Critical assertion failed.`, span)
  }
}

export function ice(x: string, span: Span): never {
  throw new NLError(ErrorKind.Internal, x, span)
}

export function issue(x: string, span: Span): never {
  throw new NLError(ErrorKind.Standard, x, span)
}

export function ub(x: string, span: Span): never {
  throw new NLError(ErrorKind.UB, x, span)
}

export function unreachable(span: Span): never {
  assert(false, span)
}
