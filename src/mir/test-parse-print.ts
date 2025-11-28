import { printExpr, printType } from "@/lir/def-debug"
import * as mir from "@/mir/exec"
import { expr, fn } from "@/parse/mir"
import { NLError } from "@/shared/error"
import { env } from "./env"

function test(x: string) {
  try {
    const menv = env()

    const items = fn.alt(expr).sepBy("").parse(x)
    let e
    for (const item of items) {
      if (item[0] == 0) {
        mir.declFn(menv, item[1])
      } else {
        e = mir.expr(menv, item[1])
        break
      }
    }
    if (e == null) {
      return
    }

    console.log(printExpr(e.v), "::", printType(mir.type(menv, e.k)))
  } catch (e) {
    if (e instanceof NLError) {
      console.error(e.message)
    } else {
      throw e
    }
  }
}

test(`
  fn hi(x: int) int { true }
  hi(7)
`)
