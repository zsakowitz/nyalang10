import { ex, type Decl } from "@/lir/def"
import { printDecl, printExpr, printType } from "@/lir/def-debug"
import {
  decl as eiDecl,
  expr as eiExpr,
  env as lirInterpEnv,
  type IFn as IEFn,
} from "@/lir/exec-interp"
import {
  decl as etDecl,
  expr as etExpr,
  env as lirTypeckEnv,
  type IFn as ITFn,
} from "@/lir/exec-typeck"
import * as mir from "@/mir/exec-body"
import { expr, fn } from "@/parse/mir"
import { vspan, VSPAN } from "@/parse/span"
import { reset } from "@/shared/ansi"
import { T } from "@/shared/enum"
import { NLError } from "@/shared/error"
import { Id, idFor } from "@/shared/id"
import { int, val, type TPrim } from "./def"
import type { Fn } from "./exec-call"
import { env as mirEnv, pushFn } from "./exec-env"

function setup() {
  const m = mirEnv()
  const li = lirInterpEnv()
  const lt = lirTypeckEnv()

  dec("-", [int], int, ([a]) => -a | 0)
  dec("+", [int, int], int, ([a, b]) => (a + b) | 0)
  dec("-", [int, int], int, ([a, b]) => (a - b) | 0)
  dec("*", [int, int], int, ([a, b]) => (a * b) | 0)
  dec("/", [int, int], int, ([a, b]) => (a / b) | 0)

  return { m, li, lt }

  function dec(
    name: string,
    args: TPrim[],
    ret: TPrim,
    exec: (v: any[]) => any,
  ) {
    const lirId = new Id(name)

    const lirFn: IEFn & ITFn = {
      args: args.map((x) => mir.type(m, x)),
      ret: mir.type(m, ret),
      execi: exec,
    }

    const mirFn: Fn = {
      name: idFor(name),
      args: args.map(vspan),
      argsNamed: Object.create(null),
      ret: vspan(ret),
      span: VSPAN,
      exec(_, span, args, _argsNamed) {
        return val(
          ret,
          ex(T.Call, {
            name: lirId,
            args: args.map((x) => x.v),
          }),
          span,
        )
      },
    }

    pushFn(m, mirFn)
    li.fns.set(lirId, lirFn)
    lt.fns.set(lirId, lirFn)
  }
}

function test(x: string) {
  const { m: menv, li, lt } = setup()
  const done = new Set<Decl>()

  try {
    const items = fn.alt(expr).sepBy("").parse(x)
    const e: string[] = []

    for (const item of items) {
      if (item[0] == 0) {
        mir.declFn(menv, item[1])
      } else {
        const ex = mir.expr(menv, item[1])

        menv.lirDecls.forEach((decl) => {
          if (done.has(decl)) return
          etDecl(lt, decl)
          eiDecl(li, decl)
          done.add(decl)
        })

        etExpr(lt, ex.v)
        const value = eiExpr(li, ex.v)

        const text =
          printExpr(ex.v)
          + " :: "
          + printType(mir.type(menv, ex.k))
          + " = "
          + (globalThis as any).Bun.inspect(value, { colors: true })

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
  fn +(a: any, b: [any]) [any] { [i => a + b[i]; len(b)] }

  [i => i; 4]
`)
