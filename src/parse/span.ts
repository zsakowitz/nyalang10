export interface Pos {
  row: number // first row is 1, to match code editors
  col: number // first col is 1, to match code editors
}

export interface Span {
  path: string
  text: string
  start: Pos
  end: Pos
}

export interface WithSpan<T> {
  data: T
  span: Span
}

export function at<T>(data: T, span: Span): WithSpan<T> {
  return { data, span }
}
