import { printDecl, printExpr, printType } from "@/lir/def-debug"
import * as mir from "@/mir/exec"
import { expr, fn } from "@/parse/mir"
import { reset } from "@/shared/ansi"
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

    for (const el of menv.lirDecls) {
      console.log(printDecl(el))
    }
    console.log(printExpr(e.v), "::", printType(mir.type(menv, e.k)))
    console.log()
  } catch (e) {
    if (e instanceof NLError) {
      console.error("[error] " + reset + e.message)
      console.log()
    } else {
      throw e
    }
  }
}

test(`
  fn hi(x: int) int { x }
  hi(2)
`)

test(`
  fn fill_with_two(x: [int]) [int] { [2; len(x)] }
  fill_with_two([7; 78])
`)
