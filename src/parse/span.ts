import { bold, dim, red, reset } from "@/shared/ansi"

export interface Pos {
  idx: number
  row: number // first row is 0
  col: number // first col is 0
}

export interface Span {
  path: string
  text: string
  start: Pos
  end: Pos
  kind?: SpanKind
}

export enum SpanKind {
  ExpectedType,
  ActualExpression,
}

export interface WithSpan<T> {
  data: T
  span: Span
}

export function at<T>(data: T, span: Span): WithSpan<T> {
  return { data, span }
}

export const VSPAN: Span = {
  path: "<virtual>",
  text: "",
  start: { idx: 0, row: 0, col: 0 },
  end: { idx: 0, row: 0, col: 0 },
}

export function vspan<T>(data: T): WithSpan<T> {
  return at(data, VSPAN)
}

export function highlight(span: Span, color: string): string {
  let r0 = Math.max(span.start.row - 1, 0)
  let r1 = span.end.row + 2
  let lines = span.text.split("\n").slice(r0, r1)
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
    + `${span.path}:${span.start.row + 1}:${span.start.col + 1}`
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
        const r = i + r0
        const start =
          r == span.start.row ? Math.max(0, span.start.col - c0)
          : r > span.start.row ? 0
          : x.length
        const end =
          r == span.end.row ? Math.max(0, span.end.col - c0)
          : r < span.end.row ? x.length
          : 0
        return (
          reset
          + dim
          + ("\n" + (r + "").padStart(2) + " | ")
          + x.slice(0, start)
          + (reset + color + bold + x.slice(start, end))
          + (reset + dim + x.slice(end))
        )
      })
      .join("")
  )
}
