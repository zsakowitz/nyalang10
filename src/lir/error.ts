import type { T } from "@/shared/enum"
import { ErrorKind, NLError } from "@/shared/error"
import type { Type } from "./def"
import { printType } from "./def-debug"

export function lAssert(x: unknown): asserts x {
  if (!x) {
    lIce(`Assertion failed.`)
  }
}

export function lIce(x: string): never {
  throw new NLError(ErrorKind.Internal, x)
}

export function lIssue(x: string): never {
  throw new NLError(ErrorKind.Standard, x)
}

export function lUB(x: string): never {
  throw new NLError(ErrorKind.UB, x)
}

export function lAssertIndex(length: number, index: number) {
  if (
    !(
      index === (index | 0)
      && length === (length | 0)
      && 0 <= index
      && index < length
    )
  ) {
    lIssue(`Index '${index}' must be in range [0,${length}).`)
  }
}

export function lAssertIndexUB(length: number, index: number) {
  if (
    !(
      index === (index | 0)
      && length === (length | 0)
      && 0 <= index
      && index < length
    )
  ) {
    lUB(`Accessed out-of-bounds index '${index}'.`)
  }
}

export function lAssertTypeKind<N extends keyof typeof T, K extends Type["k"]>(
  src: Type,
  name: N,
  k: (typeof T)[N] & K,
): asserts src is Extract<Type, { k: K }> {
  if (src.k !== k) {
    lIssue(`Expected 'T.${name}'; found '${printType(src)}'.`)
  }
}
