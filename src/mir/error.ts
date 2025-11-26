import type { Span } from "@/parse"
import { ErrorKind, NLError } from "@/shared/error"

export function assert(x: unknown, span: Span): asserts x {
  if (!x) {
    ice(`Assertion failed.`, span)
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
