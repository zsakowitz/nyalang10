import { ice } from "../error"

const WS = /\s/

export class State {
  constructor(
    readonly text: string,
    public index = 0,
  ) {}

  skipSpaces() {
    while (this.index < this.text.length && WS.test(this.text[this.index]!)) {
      this.index++
    }
  }

  matchText(text: string) {
    this.skipSpaces()
    if (this.text.startsWith(text, this.index)) {
      this.index += text.length
      return true
    }
    return false
  }

  // assumes `regex` has the `y` flag set
  matchRegex(regex: RegExp) {
    this.skipSpaces()
    regex.lastIndex = this.index
    const match = regex.exec(this.text)
    if (match) {
      this.index += match[0]!.length
      return match
    }
    return null
  }

  debug(): string {
    return (
      this.text.slice(0, this.index) + ">>>>>>" + this.text.slice(this.index)
    )
  }
}

type Result<T> = { ok: true; value: T } | { ok: false }

export class Parser<T> {
  constructor(readonly go: (state: State) => Result<T>) {}

  map<U>(f: (x: T) => U): Parser<U> {
    return new Parser((state) => {
      const result = this.go(state)
      if (!result.ok) return result
      return { ok: true, value: f(result.value) }
    })
  }

  skipThen<U>(rhs: ParserLike<U>): Parser<U> {
    return seq([this, rhs]).map((x) => x[1])
  }

  thenSkip(rhs: ParserLike<unknown>): Parser<T> {
    return seq([this as Parser<T>, rhs]).map((x) => x[0])
  }

  then<U>(rhs: ParserLike<U>): Parser<[T, U]> {
    return seq([this as Parser<T>, rhs])
  }

  alt(rhs: ParserLike<T>): Parser<T> {
    return any([this as Parser<T>, rhs])
  }

  key<K extends keyof T>(key: K): Parser<T[K]> {
    return this.map((x) => x[key])
  }

  keys<const U extends readonly (keyof T)[]>(
    keys: U,
  ): Parser<{ -readonly [K in keyof U]: T[U[K]] }> {
    return this.map((x) => keys.map((key) => x[key])) as any
  }

  opt(): Parser<T | null> {
    return any([this as Parser<T | null>, always(null)])
  }

  sepByRaw(
    sep: ParserLike<unknown>,
  ): Parser<{ items: T[]; trailing: boolean }> {
    return new Parser<{ items: T[]; trailing: boolean }>((state) => {
      const items: T[] = []
      let trailing = false

      while (true) {
        state.skipSpaces()
        const start1 = state.index
        const result1 = this.go(state)
        if (result1.ok) {
          if (state.index == start1) {
            ice(`Infinite loop detected while parsing ` + state.debug())
          }
          items.push(result1.value)
          trailing = false
        } else {
          if (state.index == start1) {
            return { ok: true, value: { items, trailing } }
          }
          return { ok: false }
        }

        state.skipSpaces()
        const start2 = state.index
        const result2 = sep.go(state)
        if (result2.ok) {
          trailing = true
        } else if (start2 == state.index) {
          return { ok: true, value: { items, trailing: false } }
        } else {
          return { ok: false }
        }
      }
    })
  }

  sepBy(sep: ParserLike<unknown>): Parser<T[]> {
    return this.sepByRaw(sep).key("items")
  }
}

export interface ParserLike<T> {
  go(s: State): Result<T>
}

declare global {
  interface String extends ParserLike<string> {}
  interface RegExp extends ParserLike<RegExpExecArray> {}
}

String.prototype.go = function (state: State) {
  if (state.matchText(this as string)) {
    return { ok: true, value: this as string }
  } else {
    return { ok: false }
  }
}

RegExp.prototype.go = function (state: State) {
  const result = state.matchRegex(this)
  if (result) {
    return { ok: true, value: result }
  } else {
    return { ok: false }
  }
}

export function from<T>(x: ParserLike<T>): Parser<T> {
  return new Parser((state) => x.go(state))
}

export function always<T>(value: T): Parser<T> {
  return new Parser(() => ({ ok: true, value }))
}

export function lazy<T>(x: () => ParserLike<T>): Parser<T> {
  let parser: Parser<T> | null
  return new Parser((state) => {
    parser ??= from(x())
    return parser.go(state)
  })
}

export function seq<const T extends readonly ParserLike<unknown>[]>(
  p: T,
): Parser<{
  -readonly [K in keyof T]: T[K] extends ParserLike<infer U> ? U : never
}> {
  return new Parser((state) => {
    const value: any[] = []

    for (let i = 0; i < p.length; i++) {
      const result = p[i]!.go(state)
      if (result.ok) {
        value.push(result.value)
      } else {
        return { ok: false }
      }
    }

    return { ok: true, value: value as any }
  })
}

export function any<T>(p: readonly ParserLike<T>[]): Parser<T> {
  return new Parser((state) => {
    state.skipSpaces()
    const start = state.index

    for (let i = 0; i < p.length; i++) {
      const result = p[i]!.go(state)
      // if a parser partially matches, consider the match to fail
      // this avoids unnecessary backtracking at the cost of forcing parser authors to factor out common prefixes
      if (result.ok || state.index != start) {
        return result
      }
    }

    return { ok: false }
  })
}
