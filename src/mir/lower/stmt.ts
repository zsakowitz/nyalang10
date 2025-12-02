import { ex, st, type Stmt as LirStmt } from "@/lir/def"
import type { Span } from "@/parse/span"
import { T } from "@/shared/enum"
import {
  kvs,
  val,
  vals,
  type Stmt,
  type TFinal,
  type Value,
  type ValueStmt,
} from "../def"
import { R } from "../enum"
import { forkLocals, type Env } from "./env"
import { expr } from "./exec-expr"

export function stmt(env: Env, { data: { k, v }, span }: Stmt): ValueStmt {
  switch (k) {
    case R.Expr:
      const { k, v: vr, s } = expr(env, v)
      return vals(k, st(T.Expr, vr, s), s)
    case R.Let: {
      const value = expr(env, v.value)

      const localId = v.name.data.fresh()
      env.vr.set(v.name.data.index, {
        mut: v.mut,
        ty: value.k,
        value: localId,
        def: v.name.span,
      })

      return vals(
        kvs(R.Void, null, span),
        st(T.Let, { mut: v.mut, name: localId, val: value.v }, span),
        span,
      )
    }
  }
}

export function block(env: Env, span: Span, els: Stmt[]): Value {
  const subenv = forkLocals(env)
  const block: LirStmt[] = []
  let rk: TFinal = kvs(R.Void, null, span)
  let rs = span
  els.forEach((el) => {
    const { k, v, s } = stmt(subenv, el)
    rk = k
    rs = s
    block.push(v)
  })
  return val(rk, ex(T.Block, block, rs), rs)
}
