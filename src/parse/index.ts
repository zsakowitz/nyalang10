import { lIce as iceLir } from "@/lir/error"
import { ice, issue } from "@/mir/error"
import { blue, bold, red, reset } from "@/shared/ansi"
import { at, Span, type Pos, type WithSpan } from "./span"

const WS = /\s/
const LETTER0 = /^\w/
const LETTER1 = /\w$/

export class State {
  private index_ = 0
  private row = 0
  private col = 0

  constructor(
    readonly text: string,
    readonly path: string,
  ) {}

  get index() {
    return this.index_
  }

  private incIndex(amount: number) {
    for (let i = 0; i < amount; i++) {
      if (this.text[this.index] == "\n") {
        this.row++
        this.col = 0
      } else {
        this.col++
      }
      this.index_++
    }
  }

  clone() {
    const s = new State(this.text, this.path)
    this.copyOnto(s)
    return s
  }

  copyOnto(state: State) {
    state.col = this.col
    state.row = this.row
    state.index_ = this.index_
  }

  skipSpaces() {
    while (this.index < this.text.length && WS.test(this.text[this.index]!)) {
      this.incIndex(1)
    }
    return this
  }

  indexAfterSkippedSpaces() {
    let i = this.index
    while (i < this.text.length && WS.test(this.text[i]!)) {
      i++
    }
    return i
  }

  // matches a string literal, but not in-between word boundaries
  // e.g. in `State { text: "hello", index: 3 }`, "lo" does not match via `.matchText`
  matchText(text: string) {
    this.skipSpaces()

    const index = this.index
    if (!this.text.startsWith(text, index)) {
      return false
    }

    const len = text.length
    if (LETTER0.test(text) && LETTER1.test(this.text.slice(0, index))) {
      return false
    }
    if (LETTER1.test(text) && LETTER0.test(this.text.slice(index + len))) {
      return false
    }
    this.incIndex(len)

    return true
  }

  // assumes `regex` has the `y` flag set
  matchRegex(regex: RegExp) {
    this.skipSpaces()
    const start = (regex.lastIndex = this.index)
    const match = regex.test(this.text)
    if (match) {
      const end = regex.lastIndex
      this.incIndex(end - start)
      return this.text.slice(start, end)
    }
    return null
  }

  debug(): string {
    return (
      blue
      + bold
      + this.text.slice(0, this.index)
      + reset
      + red
      + this.text.slice(this.index)
      + reset
    )
  }

  pos(): Pos {
    return {
      idx: this.index,
      row: this.row,
      col: this.col,
    }
  }

  span(start = this.pos(), end = this.pos()): Span {
    return new Span(this.path, this.text, start, end)
  }
}

export type Result<T> = { ok: true; value: T } | { ok: false }

export class Parser<T> {
  constructor(readonly go: (state: State) => Result<T>) {}

  parse(text: string, path = "<unknown>"): T {
    const state = new State(text, path)
    const result = this.go(state)
    if (result.ok && (state.skipSpaces(), state.index == text.length)) {
      return result.value
    }

    issue("Failed to parse: " + state.debug(), state.span())
  }

  map<U>(f: (x: T) => U): Parser<U> {
    return new Parser((state) => {
      const result = this.go(state)
      if (!result.ok) return result
      return { ok: true, value: f(result.value) }
    })
  }

  as<U>(value: U): Parser<U> {
    return this.map(() => value)
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

  or(rhs: ParserLike<T>): Parser<T> {
    return any<T>([this, rhs])
  }

  alt<U>(rhs: ParserLike<U>): Parser<[0, T] | [1, U]> {
    return any<[0, T] | [1, U]>([
      this.map((x) => [0, x]),
      from(rhs).map((x) => [1, x]),
    ])
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
    sep: ParserLike<unknown> = ",",
  ): Parser<{ items: T[]; trailing: boolean }> {
    return new Parser<{ items: T[]; trailing: boolean }>((state) => {
      const items: T[] = []
      let trailing = false

      while (true) {
        const start1 = state.indexAfterSkippedSpaces()
        const result1 = this.go(state)
        if (result1.ok) {
          if (state.index <= start1) {
            ice(
              `Infinite loop detected while parsing ` + state.debug(),
              state.span(),
            )
          }
          items.push(result1.value)
          trailing = false
        } else {
          if (state.index <= start1) {
            return { ok: true, value: { items, trailing } }
          }
          return { ok: false }
        }

        const start2 = state.indexAfterSkippedSpaces()
        const result2 = sep.go(state)
        if (result2.ok) {
          trailing = true
        } else if (start2 <= state.index) {
          return { ok: true, value: { items, trailing: false } }
        } else {
          return { ok: false }
        }
      }
    })
  }

  sepBy(sep?: ParserLike<unknown>): Parser<T[]> {
    return this.sepByRaw(sep).key("items")
  }

  filter(f: (data: T) => boolean): Parser<T> {
    return new Parser((state) => {
      const result = this.go(state)
      if (!result.ok) return { ok: false }
      if (!f(result.value)) return { ok: false }
      return result
    })
  }

  sepBy1(sep?: ParserLike<unknown>): Parser<[T, ...T[]]> {
    return this.sepByRaw(sep)
      .key("items")
      .filter((x) => x.length > 0) as Parser<[T, ...T[]]>
  }

  many(): Parser<T[]> {
    return this.sepBy(always(null))
  }

  suffixedBy(f: Parser<(x: T) => T>[]): Parser<T> {
    return seq([this as Parser<T>, any(f).many()]).map(([init, rest]) =>
      rest.reduce((lhs, map) => map(lhs), init),
    )
  }

  suffixedBySpan<U>(
    this: Parser<WithSpan<U>>,
    f: Parser<(x: WithSpan<U>) => U>[],
  ): Parser<WithSpan<U>> {
    return seq([this as Parser<WithSpan<U>>, any(f).span().many()]).map(
      ([init, rest]) =>
        rest.reduce(
          (lhs, map) => at(map.data(lhs), lhs.span.join(map.span)),
          init,
        ),
    )
  }

  attached() {
    return NO_NL.skipThen(this)
  }

  span(): Parser<WithSpan<T>> {
    return new Parser<WithSpan<T>>((state) => {
      const start = state.clone().skipSpaces().pos()
      const result = this.go(state)
      if (!result.ok) return { ok: false }

      return {
        ok: true,
        value: {
          data: result.value,
          span: state.span(start),
        },
      }
    })
  }

  switch<U>(p: (x: T) => Parser<U>): Parser<[T, U]> {
    return new Parser<[T, U]>((state) => {
      const result1 = this.go(state)
      if (!result1.ok) return { ok: false }
      const result2 = p(result1.value).go(state)
      if (!result2.ok) return { ok: false }
      return { ok: true, value: [result1.value, result2.value] }
    })
  }
}

export interface ParserLike<T> {
  go(s: State): Result<T>
}

declare global {
  interface String extends ParserLike<string> {}
  interface RegExp extends ParserLike<string> {}
}

String.prototype.go = function (state: State) {
  if (state.matchText(this as string)) {
    return { ok: true, value: this as string }
  } else {
    return { ok: false }
  }
}

RegExp.prototype.go = function (state: State) {
  if (!this.sticky) {
    ice(
      `/${this.source}/${this.flags} may not be used as a parser, since it does not specify the 'y' flag.`,
      state.span(),
    )
  }

  const result = state.matchRegex(this)
  if (result != null) {
    return { ok: true, value: result }
  } else {
    return { ok: false }
  }
}

export function from<T>(x: ParserLike<T>): Parser<T> {
  if (x instanceof RegExp && !x.sticky) {
    iceLir(
      `/${x.source}/${x.flags} may not be used as a parser, since it does not specify the 'y' flag.`,
    )
  }
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
    const max = state.indexAfterSkippedSpaces()

    for (let i = 0; i < p.length; i++) {
      const mystate = state.clone()
      const result = p[i]!.go(mystate)
      // if a parser partially matches, consider the match to fail
      // this avoids unnecessary backtracking at the cost of forcing parser authors to factor out common prefixes
      if (result.ok || mystate.index > max) {
        mystate.copyOnto(state)
        return result
      }
    }

    return { ok: false }
  })
}

export function alt<const T extends ParserLike<unknown>[]>(
  p: T,
): Parser<
  {
    [K in keyof T]: {
      k: K extends `${infer U extends number}` ? U : never
      v: T[K] extends ParserLike<infer U> ? U : never
    }
  }[number]
> {
  return any(p.map((x, i) => from(x).map((v) => ({ k: i, v })))) as any
}

export function lazyAny<T>(p: () => readonly ParserLike<T>[]): Parser<T> {
  return lazy(() => any(p()))
}

export const NO_NL = new Parser<null>((state) => {
  if (
    /\n/.test(state.text.slice(state.index, state.indexAfterSkippedSpaces()))
  ) {
    return { ok: false }
  } else {
    return { ok: true, value: null }
  }
})
