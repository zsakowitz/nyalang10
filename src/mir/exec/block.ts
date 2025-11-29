import { ex, st, type Stmt } from "@/lir/def"
import type { Span } from "@/parse/span"
import { T } from "@/shared/enum"
import { Id } from "@/shared/id"
import { kv, val, type TFinal, type Value } from "../def"
import { R } from "../enum"

export class Block {
  private v: Stmt[] = []

  store(v: Value): Value {
    const id = new Id("__")
    this.v.push(st(T.Let, { mut: false, name: id, val: v.v }))
    return val(v.k, ex(T.Local, id), v.s)
  }

  push(val: Value) {
    this.v.push(st(T.Expr, val.v))
  }

  return(v: Value) {
    this.v.push(st(T.Expr, v.v))
    return val(v.k, ex(T.Block, this.v), v.s)
  }

  returnUnitIn(v: TFinal, span: Span) {
    return this.return(val(kv(R.UnitIn, v), ex(T.Block, []), span))
  }
}
