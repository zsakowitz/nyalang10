import { ex, st } from "@/lir/def"
import { printDecl } from "@/lir/def-debug"
import * as itp from "@/lir/exec-interp"
import * as tck from "@/lir/exec-typeck"
import { alt, Parser } from "@/parse"
import * as parse from "@/parse/mir"
import { vspan, VSPAN } from "@/parse/span"
import { reset } from "@/shared/ansi"
import { T } from "@/shared/enum"
import { NLError } from "@/shared/error"
import { Id, idFor } from "@/shared/id"
import { bool, int, kv, val, type TPrim, type Value } from "../def"
import { R } from "../enum"
import { assert, unreachable } from "../error"
import { Block } from "../exec/block"
import * as mir from "../exec/body"
import type { Fn } from "../exec/call"
import { pushCoercion } from "../exec/decl-coerce"
import { env as mirEnv, pushFn } from "../exec/env"
import { declStruct } from "../exec/struct"
import source from "./complex.rs" with { type: "text" }
import { printTFinal } from "../def-debug"

function setup0() {
  const numId = new Id("num")

  const m = mirEnv()
  m.g.num = { extern: numId, from: (data) => data.f64 }
  m.ty.set(idFor("num").index, vspan(kv(R.Extern, vspan(numId))))

  const li = itp.env()
  li.opaqueExterns.set(numId, {
    fromi(data) {
      return data
    },
  })

  const lt = tck.env()

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

  dec("int_to_num", [int], num, ([a]) => a)
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

  return { m, li, lt, tests: [] as Value[] }

  function dec(
    name: string,
    args: TPrim[],
    ret: TPrim,
    exec: (v: any[]) => any,
  ) {
    const lirId = new Id(name)

    const lirFn: itp.IFn & tck.IFn = {
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

type Setup = ReturnType<typeof setup>

const ITEM = alt([
  ";",
  parse.expr,
  parse.declFn,
  parse.declStruct,
  parse.declCoercion,
])
type Item = typeof ITEM extends Parser<infer U> ? U : never

function test() {
  const s = setup()

  try {
    const items = ITEM.sepBy("").parse(source)
    items.forEach((item) => go(s, item))

    for (const el of s.m.g.lir) {
      console.log(printDecl(el))
      tck.decl(s.lt, el)
      itp.decl(s.li, el)
    }

    for (const el of s.tests) {
      tck.expr(s.lt, el.v)
      const res = itp.expr(s.li, el.v)
      console.log(res, "::", printTFinal(el.k))
    }
  } catch (e) {
    if (e instanceof NLError) {
      console.error("[error] " + reset + e.message)
    } else {
      throw e
    }
    return false
  }

  return true
}

function go(setup: Setup, { k, v }: Item) {
  switch (k) {
    case 0:
      break
    case 1:
      setup.tests.push(mir.expr(setup.m, v))
      break
    case 2:
      mir.declFn(setup.m, v)
      break
    case 3:
      declStruct(setup.m, v)
      break
    case 4:
      pushCoercion(setup.m, v)
      break
    default:
      k satisfies never
  }
}

function bench1(name: string, f: () => void) {
  const N = 1e4

  // warm up
  for (let i = 0; i < 1e3; i++) {
    f()
  }
  const start = Date.now()
  for (let i = 0; i < N; i++) {
    f()
  }
  const end = Date.now()

  const per = (1000 * (end - start)) / N

  console.log(Math.round(per).toString().padStart(3, "0") + "µs", name)
}

function bench() {
  bench1("parsing", () => ITEM.sepBy("").parse(source))
  bench1("env setup", setup)

  const p = ITEM.sepBy("").parse(source)
  bench1("mir", () => {
    const s = setup()
    p.forEach((x) => go(s, x))
  })

  const s = setup()
  p.forEach((x) => go(s, x))
  bench1("lir", () => {
    const lt = tck.env()
    lt.fns = new Map(s.lt.fns)
    s.m.g.lir.forEach((x) => tck.decl(lt, x))
    s.tests.forEach((x) => tck.expr(lt, x.v))
  })

  bench1("end-to-end", () => {
    const p = ITEM.sepBy("").parse(source)
    const s = setup()
    p.forEach((x) => go(s, x))
    s.m.g.lir.forEach((x) => tck.decl(s.lt, x))
    s.tests.forEach((x) => tck.expr(s.lt, x.v))
  })
}

if (test()) {
  console.log("\n== BENCHMARKS ==")
  bench()
}
