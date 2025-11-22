export const enum ErrorLevel {
  Internal,
  Standard,
  UB,
}

export class NLError extends Error {
  constructor(
    readonly level: ErrorLevel,
    readonly message: string,
  ) {
    super(message)
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
