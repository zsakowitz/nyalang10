import type { T } from "@/shared/enum"
import { ErrorKind, NLError } from "@/shared/error"
import type { Type } from "./def"
import { printType } from "./def-debug"

export function assert(x: unknown): asserts x {
  if (!x) {
    ice(`Assertion failed.`)
  }
}

export function ice(x: string): never {
  throw new NLError(ErrorKind.Internal, x)
}

export function issue(x: string): never {
  throw new NLError(ErrorKind.Standard, x)
}

export function ub(x: string): never {
  throw new NLError(ErrorKind.UB, x)
}

export function assertIndex(length: number, index: number) {
  if (
    !(
      index === (index | 0)
      && length === (length | 0)
      && 0 <= index
      && index < length
    )
  ) {
    issue(`Index '${index}' must be in range [0,${length}).`)
  }
}

export function assertIndexUB(length: number, index: number) {
  if (
    !(
      index === (index | 0)
      && length === (length | 0)
      && 0 <= index
      && index < length
    )
  ) {
    ub(`Accessed out-of-bounds index '${index}'.`)
  }
}

export function assertTypeKind<N extends keyof typeof T, K extends Type["k"]>(
  src: Type,
  name: N,
  k: (typeof T)[N] & K,
): asserts src is Extract<Type, { k: K }> {
  if (src.k !== k) {
    issue(`Expected 'T.${name}'; found '${printType(src)}'.`)
  }
}
