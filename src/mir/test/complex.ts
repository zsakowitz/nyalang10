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
import { alt } from "@/parse"
import {
  declCoercion,
  declFn,
  expr,
  declStruct as pDeclStruct,
} from "@/parse/mir"
import { vspan, VSPAN } from "@/parse/span"
import { reset } from "@/shared/ansi"
import { T } from "@/shared/enum"
import { NLError } from "@/shared/error"
import { Id, idFor } from "@/shared/id"
import { bool, int, kv, val, type TPrim } from "../def"
import { R } from "../enum"
import { assert, unreachable } from "../error"
import { Block } from "../exec/block"
import * as mir from "../exec/body"
import type { Fn } from "../exec/call"
import { pushCoercion } from "../exec/decl-coerce"
import { env as mirEnv, pushFn } from "../exec/env"
import { declStruct } from "../exec/struct"
import source from "./complex.rs" with { type: "text" }

function setup0() {
  const numId = new Id("num")

  const m = mirEnv()
  m.g.num = {
    extern: numId,
    from(data) {
      return data.f64
    },
  }
  m.ty.set(idFor("num").index, vspan(kv(R.Extern, vspan(numId))))

  const li = lirInterpEnv()
  li.opaqueExterns.set(numId, {
    fromi(data) {
      return data
    },
  })

  const lt = lirTypeckEnv()

  return { m, li, lt, num: kv(R.Extern, vspan(numId)) satisfies TPrim }
}

function setup() {
  const { m, li, lt, num } = setup0()

  pushFn(m, {
    name: idFor("len"),
    args: [vspan(kv(R.Array, vspan(kv(R.Any, null))))],
    argsNamed: [],
    ret: vspan(int),
    span: VSPAN,
    exec(_env, span, [arg], _argsNamed) {
      switch (arg!.k.k) {
        case R.ArrayFixed: {
          const block = new Block()
          block.push(arg!)
          return block.return(val(int, ex(T.Int, BigInt(arg!.k.v.len)), span))
        }
        case R.ArrayDyn:
          return val(int, ex(T.DynArrayLen, arg!.v), span)
        default:
          unreachable(span)
      }
    },
  })

  pushFn(m, {
    name: idFor("el"),
    args: [vspan(kv(R.UnitIn, vspan(kv(R.Array, vspan(kv(R.Any, null))))))],
    argsNamed: [],
    ret: vspan(int),
    span: VSPAN,
    exec(_env, span, [arg], _argsNamed) {
      const block = new Block()
      block.push(arg!)

      assert(arg!.k.k == R.UnitIn, span)
      switch (arg!.k.v.k) {
        case R.ArrayFixed:
          return block.returnUnitIn(arg!.k.v.v.el, span)
        case R.ArrayDyn:
          return block.returnUnitIn(arg!.k.v.v, span)
        default:
          unreachable(span)
      }
    },
  })

  dec("-", [int], int, ([a]) => -a | 0)
  dec("+", [int, int], int, ([a, b]) => (a + b) | 0)
  dec("-", [int, int], int, ([a, b]) => (a - b) | 0)
  dec("*", [int, int], int, ([a, b]) => (a * b) | 0)
  dec("/", [int, int], int, ([a, b]) => (a / b) | 0)
  dec("==", [int, int], bool, ([a, b]) => a == b)
  dec("!=", [int, int], bool, ([a, b]) => a != b)
  dec("<", [int, int], bool, ([a, b]) => a < b)
  dec(">", [int, int], bool, ([a, b]) => a > b)
  dec("<=", [int, int], bool, ([a, b]) => a <= b)
  dec(">=", [int, int], bool, ([a, b]) => a >= b)

  dec("-", [num], num, ([a]) => -a)
  dec("+", [num, num], num, ([a, b]) => a + b)
  dec("-", [num, num], num, ([a, b]) => a - b)
  dec("*", [num, num], num, ([a, b]) => a * b)
  dec("/", [num, num], num, ([a, b]) => a / b)
  dec("==", [num, num], bool, ([a, b]) => a == b)
  dec("!=", [num, num], bool, ([a, b]) => a != b)
  dec("<", [num, num], bool, ([a, b]) => a < b)
  dec(">", [num, num], bool, ([a, b]) => a > b)
  dec("<=", [num, num], bool, ([a, b]) => a <= b)
  dec(">=", [num, num], bool, ([a, b]) => a >= b)

  dec("&", [bool, bool], bool, ([a, b]) => a && b)
  dec("|", [bool, bool], bool, ([a, b]) => a || b)
  dec("!", [bool], bool, ([a]) => !a)

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

    const mirFn: Fn<Id> = {
      name: idFor(name),
      args: args.map(vspan),
      argsNamed: [],
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

    return mirFn
  }
}

function test(x: string) {
  const { m: menv, li, lt } = setup()
  const done = new Set<Decl>()

  try {
    const items = alt([";", expr, declFn, pDeclStruct, declCoercion])
      .sepBy("")
      .parse(x)
    const e: string[] = []

    for (const { k, v } of items) {
      switch (k) {
        case 0:
          break
        case 1: {
          const ex = mir.expr(menv, v)

          menv.g.lir.forEach((decl) => {
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
          break
        }
        case 2:
          mir.declFn(menv, v)
          break
        case 3:
          declStruct(menv, v)
          break
        case 4:
          pushCoercion(menv, v)
          break
      }
    }

    if (e == null) {
      return
    }

    for (const el of menv.g.lir) {
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

test(source)
