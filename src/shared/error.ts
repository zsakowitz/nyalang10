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
  ) {
    super(PREFIXES[kind] + message)
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
