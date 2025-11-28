import { printDecl, printExpr, printType } from "@/lir/def-debug"
import * as mir from "@/mir/exec-body"
import { expr, fn } from "@/parse/mir"
import { reset } from "@/shared/ansi"
import { NLError } from "@/shared/error"
import { env } from "./exec-env"

function test(x: string) {
  try {
    const menv = env()
    const items = fn.alt(expr).sepBy("").parse(x)
    const e: string[] = []

    for (const item of items) {
      if (item[0] == 0) {
        mir.declFn(menv, item[1])
      } else {
        const ex = mir.expr(menv, item[1])
        const text = printExpr(ex.v) + " :: " + printType(mir.type(menv, ex.k))
        e.push(text)
      }
    }
    if (e == null) {
      return
    }

    for (const el of menv.lirDecls) {
      console.log(printDecl(el))
    }
    for (const el of e) {
      console.log(el)
    }
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
  fn f(x: int) int { 2 }
  f(3)

  fn f(x: [int]) [int] { [2; len(x)] }
  fn cloak(x: int) int { x }
  f([7; 78])
  f([7; 2])
  f([4; 78])
  f([4; 78])
  f([4; cloak(4)])
`)

test(`
  fn f(x: int) [int] { [2; x] }

  f(4)
`)
