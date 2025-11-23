export const enum ErrorLevel {
  Internal,
  Standard,
  UB,
}

const PREFIXES = {
  [ErrorLevel.Internal]: "[ice] ",
  [ErrorLevel.Standard]: "",
  [ErrorLevel.UB]: "[ub] ",
}

export class NLError extends Error {
  constructor(
    readonly level: ErrorLevel,
    message: string,
  ) {
    super(PREFIXES[level] + message)
  }
}

export function ice(x: string): never {
  throw new NLError(ErrorLevel.Internal, x)
}

export function issue(x: string): never {
  throw new NLError(ErrorLevel.Standard, x)
}

export function ub(x: string): never {
  throw new NLError(ErrorLevel.UB, x)
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
    ub(`Index '${index}' must be in range [0,${length}).`)
  }
}
