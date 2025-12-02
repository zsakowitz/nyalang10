import { ex, st, type Stmt } from "@/lir/def"
import type { Span } from "@/parse/span"
import { T } from "@/shared/enum"
import { Id } from "@/shared/id"
import { kvs, val, type TFinal, type Value } from "../def"
import { R } from "../enum"

export class Block {
  private v: Stmt[] = []

  store(v: Value): Value {
    const id = new Id("__")
    this.v.push(st(T.Let, { mut: false, name: id, val: v.v }, v.s))
    return val(v.k, ex(T.Local, id, v.s), v.s)
  }

  push(v: Value) {
    this.v.push(st(T.Expr, v.v, v.s))
  }

  return(v: Value) {
    this.v.push(st(T.Expr, v.v, v.s))
    return val(v.k, ex(T.Block, this.v, v.s), v.s)
  }

  returnUnitIn(v: TFinal, span: Span) {
    return this.return(val(kvs(R.UnitIn, v, v.s), ex(T.Block, [], span), span))
  }
}
