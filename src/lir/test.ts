import { T } from "../enum"
import { NLError } from "../error"
import { Id } from "../id"
import { ex, lv, st, type Expr } from "./def"
import * as run from "./exec-interp"
import * as tck from "./exec-typeck"

const ID_A = new Id("a")

const I23 = ex(T.Block, [
  st(T.Let, { name: ID_A, mut: false, val: ex(T.Int, 23n) }),
  st(T.AssignOne, { target: lv(T.Local, ID_A), value: ex(T.Int, 45n) }),
  st(T.Expr, ex(T.Local, ID_A)),
])

function test(expr: Expr) {
  const tenv = tck.env()
  const renv = run.env()

  try {
    tck.expr(tenv, expr)
  } catch (e) {
    console.error(e instanceof NLError ? `[tck] ${e.message}` : e)
    return
  }

  try {
    const v = run.expr(renv, expr)
    console.log(v)
  } catch (e) {
    console.error(e instanceof NLError ? `[eval] ${e.message}` : e)
  }
}

test(I23)
