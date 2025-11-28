import { blue, bold, dim, red, reset } from "@/shared/ansi"

export interface Pos {
  idx: number
  row: number // first row is 0
  col: number // first col is 0
}

export class Span {
  constructor(
    readonly path: string,
    readonly text: string,
    readonly start: Pos,
    readonly end: Pos,
    readonly kind?: Reason,
    readonly also?: Span[],
  ) {}

  private shrink() {
    while (
      this.start.idx < this.end.idx
      && /\s/.test(this.text[this.start.idx] ?? "")
    ) {
      this.start.idx++
      if (this.text[this.start.idx] == "\n") {
        this.start.row++
        this.start.col = 0
      } else {
        this.start.col++
      }
    }

    while (
      this.start.idx < this.end.idx
      && /\s/.test(this.text[this.end.idx + 1] ?? "")
    ) {
      this.end.idx--
      if (this.text[this.end.idx + 1] == "\n") {
        this.end.row--
        this.end.col = (this.text.split("\n")[this.end.row] ?? "").length
      } else {
        this.end.col--
      }
    }
  }

  for(kind: Reason) {
    return new Span(this.path, this.text, this.start, this.end, kind, this.also)
  }

  with(span: Span) {
    return new Span(this.path, this.text, this.start, this.end, this.kind, [
      ...(this.also ?? []),
      span,
    ])
  }

  flat(): Span[] {
    const all = this.also?.flatMap((x) => x.flat()) ?? []
    all.unshift(this)
    return all
  }

  private highlightSelf(): string {
    const color = COLORS[this.kind ?? "null"]

    let r0 = Math.max(this.start.row, 0)
    let r1 = this.end.row + 1
    let lines = this.text.split("\n").slice(r0, r1)
    while (lines.length && !lines[0]!.trim()) {
      lines.shift()
      r0++
    }
    while (lines.length && !lines.at(-1)!.trim()) {
      lines.pop()
      r1--
    }

    const head =
      reset
      + dim
      + `in `
      + reset
      + `${this.path}:${this.start.row + 1}:${this.start.col + 1}`
      + red

    if (lines.length == 0) {
      return head
    }

    const c0 = Math.min(...lines.map((x) => /^\s*/.exec(x)![0].length))
    lines = lines.map((x) => x.slice(c0))

    return (
      head
      + lines
        .map((x, i) => {
          x = x.trim()
          const r = i + r0
          const start =
            r == this.start.row ? Math.max(0, this.start.col - c0)
            : r > this.start.row ? 0
            : x.length
          const end =
            r == this.end.row ? Math.max(0, this.end.col - c0)
            : r < this.end.row ? x.length
            : 0
          return (
            reset
            + dim
            + ("\n" + (r + 1 + "").padStart(4) + " | ")
            + x.slice(0, start)
            + (reset + color + bold + x.slice(start, end))
            + (reset + dim + x.slice(end))
            + (r == this.end.row ?
              "\n     | "
              + " ".repeat(start)
              + (color + "^".repeat(end - start))
              + (" " + reset + color + REASONS[this.kind ?? "null"])
            : "")
          )
        })
        .join("")
    )
  }

  highlight(): string {
    return this.flat()
      .map((x) => x.highlightSelf())
      .join("\n\n")
  }
}

export enum Reason {
  TyExpected,
  TyActual,
  TraceStart,
  Trace,
  ExpectedInt,
}

export interface WithSpan<T> {
  data: T
  span: Span
}

export function at<T>(data: T, span: Span): WithSpan<T> {
  return { data, span }
}

export const VSPAN = new Span(
  "<virtual>",
  "",
  { idx: 0, row: 0, col: 0 },
  { idx: 0, row: 0, col: 0 },
)

export function vspan<T>(data: T): WithSpan<T> {
  return at(data, VSPAN)
}

const COLORS = {
  [Reason.TyActual]: red,
  [Reason.TyExpected]: blue,
  [Reason.Trace]: "",
  [Reason.TraceStart]: red,
  [Reason.ExpectedInt]: red,
  null: "",
}

const REASONS = {
  [Reason.TyActual]: "actual expression",
  [Reason.TyExpected]: "expected type",
  [Reason.Trace]: "call stack",
  [Reason.TraceStart]: "erroneous call",
  [Reason.ExpectedInt]: "not an 'int'",
  null: "",
}
