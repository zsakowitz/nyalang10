import { Reason, type Span } from "@/parse/span"
import { blue, quote } from "@/shared/ansi"
import { kv, never, type TCoercable, type TFinal, type Value } from "../def"
import { printTFinal } from "../def-debug"
import { R } from "../enum"
import { issue } from "../error"
import type { Env } from "../exec/env"
import { castNever, execTx, txForUnitIn, type Tx } from "../exec/tx"
import type { Coercions } from "./coerce"
import { hash } from "./hash"

// throws if no unification is found
function tryUnify(
  cx: Coercions,
  span: Span,
  a: TFinal,
  b: TFinal,
): [TFinal, Tx, Tx] | false {
  if (a.k == R.Never) {
    return [b, castNever(b), true]
  }

  if (b.k == R.Never) {
    return [a, true, castNever(a)]
  }

  if (a.k <= R.Extern && b.k <= R.Extern) {
    return cx.unify(a as TCoercable, b as TCoercable)
  }

  if (a.k <= R.Extern || b.k <= R.Extern) {
    return false
  }

  if (a.k == R.UnitIn && b.k == R.UnitIn) {
    const result = tryUnify(cx, span, a.v, b.v)
    if (!result) return false

    return [
      kv(R.UnitIn, result[0]),
      txForUnitIn(result[1]),
      txForUnitIn(result[2]),
    ]
  }

  if (hash(a) == hash(b)) {
    return [a, true, true]
  }

  return false
}

export function unify(
  message: string,
  cx: Coercions,
  span: Span,
  a: TFinal,
  b: TFinal,
): [TFinal, Tx, Tx] {
  const result = tryUnify(cx, span, a, b)
  if (result) {
    return result
  }

  // TODO: add "help: maybe use a union type?"
  if (a.k <= R.Extern && b.k <= R.Extern) {
    issue(
      `${message}\nnote: ${quote(printTFinal(a), blue)} and ${quote(printTFinal(b), blue)} cannot be coerced into the same type.\nhelp: Try defining a coercion from one type to the other.`,
      span,
    )
  } else {
    issue(
      `${message}\nnote: ${quote(printTFinal(a), blue)} and ${quote(printTFinal(b), blue)} are not the same type.`,
      span,
    )
  }
}

export function unifyValues(
  env: Env,
  message: string,
  vals: Value[],
): { k: TFinal; v: Value[] } {
  if (vals.length == 0) {
    return { k: never, v: [] }
  }

  if (vals.length == 1) {
    return { k: vals[0]!.k, v: [vals[0]!] }
  }

  let ret: Value[] = [vals[0]!]
  let ty: TFinal = vals[0]!.k
  let span = vals[0]!.s.for(Reason.TyIncompat)

  for (let i = 1; i < vals.length; i++) {
    const cur = vals[i]!
    span = span.join(cur.s)
    const [tyNext, txPrev, txCur] = unify(message, env.cx, span, ty, cur.k)
    ty = tyNext
    ret = ret.map((x) => execTx(env, txPrev, x))
    ret.push(execTx(env, txCur, cur))
  }

  return { k: ty, v: ret }
}
