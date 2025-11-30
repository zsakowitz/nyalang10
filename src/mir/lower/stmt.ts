import { ex, st, type Stmt as LirStmt } from "@/lir/def"
import type { Span } from "@/parse/span"
import { T } from "@/shared/enum"
import {
  val,
  vals,
  void_,
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
      return vals(k, st(T.Expr, vr), s)
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
        void_,
        st(T.Let, { mut: v.mut, name: localId, val: value.v }),
        span,
      )
    }
  }
}

export function block(env: Env, span: Span, els: Stmt[]): Value {
  const subenv = forkLocals(env)
  const block: LirStmt[] = []
  let rk: TFinal = void_
  let rs = span
  els.forEach((el) => {
    const { k, v, s } = stmt(subenv, el)
    rk = k
    rs = s
    block.push(v)
  })
  return val(rk, ex(T.Block, block), rs)
}
