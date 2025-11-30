import { Reason, type Span } from "@/parse/span"
import { blue, quote } from "@/shared/ansi"
import { T } from "@/shared/enum"
import type { Value } from "../def"
import { R } from "../enum"
import { issue } from "../error"

export function asConstInt(span: Span, value: Value): number | null {
  if (value.k.k != R.Int) {
    issue(
      `Array length must be an ${quote("int", blue)}.`,
      span.for(Reason.ExpectedInt),
    )
  }
  if (value.v.k == T.Int) {
    const v = value.v.v
    if (BigInt.asUintN(32, v) != v) {
      issue(`Array lengths must be between 0 and 2^32-1.`, span)
    }
    return Number(v)
  }
  if (value.v.k == T.Block && value.v.v.length != 0) {
    const last = value.v.v[value.v.v.length - 1]!
    if (last.k != T.Expr || last.v.k != T.Int) {
      return null
    }
    const v = last.v.v
    if (BigInt.asUintN(32, v) != v) {
      issue(`Array lengths must be between 0 and 2^32-1.`, span)
    }
    return Number(v)
  }
  return null
}
