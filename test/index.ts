import { ex } from "@/lir/def"
import * as itp from "@/lir/exec-interp"
import * as tck from "@/lir/exec-typeck"
import {
  bool,
  int,
  kv,
  val,
  void_,
  type TFinal,
  type TPrim,
  type Value,
} from "@/mir/def"
import { printTFinal } from "@/mir/def-debug"
import { R } from "@/mir/enum"
import { assert, issue, unreachable } from "@/mir/error"
import { Block } from "@/mir/lower/block"
import type { Fn } from "@/mir/lower/call"
import { pushCoercion } from "@/mir/lower/decl-coerce"
import { declFn } from "@/mir/lower/decl-fn"
import { declStruct } from "@/mir/lower/decl-struct"
import { env as mirEnv, pushFn } from "@/mir/lower/env"
import { expr } from "@/mir/lower/exec-expr"
import * as mir from "@/mir/lower/exec-ty"
import { execTx } from "@/mir/lower/tx"
import { asGeneric } from "@/mir/ty/as-generic"
import { hash, type Hash } from "@/mir/ty/hash"
import { matchesFinal } from "@/mir/ty/matches"
import { alt, Parser } from "@/parse"
import * as parse from "@/parse/mir"
import { vspan, VSPAN } from "@/parse/span"
import { blue, quote, reset } from "@/shared/ansi"
import { T } from "@/shared/enum"
import { NLError } from "@/shared/error"
import { Id, idFor } from "@/shared/id"
import source from "./index.rs" with { type: "text" }

function setup0() {
  const numId = new Id("num")
  const strId = new Id("str")
  const contentId = new Id("content")

  const m = mirEnv()
  m.g.num = { extern: numId, from: (data) => data.f64 }
  m.g.str = { extern: strId, from: (data) => data }
  m.ty.set(idFor("num").index, vspan(kv(R.Extern, vspan(numId))))
  m.ty.set(idFor("str").index, vspan(kv(R.Extern, vspan(strId))))
  m.ty.set(idFor("content").index, vspan(kv(R.Extern, vspan(contentId))))

  const li = itp.env()
  li.opaqueExterns.set(numId, { fromi: (x) => x })
  li.opaqueExterns.set(strId, { fromi: (x) => x })

  const lt = tck.env()

  return {
    m,
    li,
    lt,
    num: kv(R.Extern, vspan(numId)) satisfies TPrim,
    str: kv(R.Extern, vspan(strId)) satisfies TPrim,
    content: kv(R.Extern, vspan(contentId)) satisfies TPrim,
    tests: [] as Value[],
    dec,
  }

  function dec(
    name: string,
    args: TFinal[],
    ret: TFinal,
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
      args: args.map(asGeneric),
      argsNamed: [],
      ret: asGeneric(ret),
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
      checked: true,
    }

    pushFn(m, mirFn)
    li.fns.set(lirId, lirFn)
    lt.fns.set(lirId, lirFn)

    return mirFn
  }
}

function setup1({ m, num, dec }: Setup) {
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
    checked: true,
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
    checked: true,
  })

  dec("-", [int], int, ([a]) => -a | 0)
  dec("+", [int, int], int, ([a, b]) => (a + b) | 0)
  dec("-", [int, int], int, ([a, b]) => (a - b) | 0)
  dec("*", [int, int], int, ([a, b]) => (a * b) | 0)
  dec("/", [int, int], int, ([a, b]) => (a / b) | 0)
  dec("%", [int, int], int, ([a, b]) => (((((a % b) | 0) + b) | 0) % b) | 0)
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
}

// we cheat. content is actually just typst content code
function setup2({ dec, num, str, content }: Setup) {
  function encode(s: string): string {
    return JSON.stringify(s).replaceAll(
      /(\\{2})*\\(b|f|u....)/g,
      (x) =>
        x[1]
        + "\\u{"
        + (x[2] == "b" ? "8"
        : x[2] == "f" ? "c"
        : x[2]!.slice(1, 5))
        + "}",
    )
  }

  dec("to_content", [int], content, ([a]) => "" + a)
  dec("to_content", [bool], content, ([a]) => "" + a)
  dec("to_content", [num], content, ([a]) => {
    if (a == 1 / 0) return "#(float.inf)"
    if (a == -1 / 0) return "#(-float.inf)"
    if (a == 0 / 0) return "#(float.nan)"
    let s = "" + a
    if (!/[.e]/.test(s)) return s + ".0"
    return s
  })
  dec("to_content", [str], content, ([a]) => "#" + encode(a))

  dec("+", [content, content], content, ([a, b]) => a + b)

  dec("md_p", [content], content, ([a]) => `#par[${a}]`)
  dec(
    "md_math",
    [content, bool],
    content,
    ([a, b]) => `#math.equation(block: ${b})[${a}]`,
  )
}

function setupPush({ m, li, lt }: Setup) {
  const cache: Record<Hash, Id> = Object.create(null)

  pushFn(m, {
    name: idFor("push"),
    span: VSPAN,
    args: [
      vspan(kv(R.ArrayDyn, vspan(kv(R.Any, null)))),
      vspan(kv(R.Any, null)),
    ],
    argsNamed: [],
    ret: vspan(void_),
    exec(env, span, [arr, el], []) {
      const ak = arr!.k as Extract<TFinal, { k: R.ArrayDyn }>
      const tx = matchesFinal(env.g.cx, el!.k, ak.v)
      if (!tx) {
        issue(
          `Cannot push ${quote(blue, printTFinal(el!.k))} onto ${quote(blue, printTFinal(arr!.k))}.`,
          span,
        )
      }

      const pushed = execTx(env, tx, el!)
      const fhash = hash(ak.v)

      if (cache[fhash]) {
        return val(
          void_,
          ex(T.Call, { name: cache[fhash], args: [arr!.v, pushed.v] }),
          span,
        )
      }

      const fname = new Id("__")

      li.fns.set(fname, {
        execi: ([a, b]) => {
          ;(a as any).push(b)
          return null
        },
      })

      lt.fns.set(fname, {
        args: [mir.type(env, arr!.k), mir.type(env, pushed.k)],
        ret: kv(T.Void, null),
      })

      cache[fhash] = fname

      return val(
        void_,
        ex(T.Call, { name: fname, args: [arr!.v, pushed.v] }),
        span,
      )
    },
    checked: true,
  })
}

function setup() {
  const s = setup0()
  setup1(s)
  setup2(s)
  setupPush(s)
  return s
}

type Setup = ReturnType<typeof setup0>

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

    tck.declNamed(s.lt, s.m.g.lt)
    tck.declGroup(s.lt, s.m.g.lf)
    itp.declGroup(s.li, s.m.g.lf)

    for (const el of s.tests) {
      tck.expr(s.lt, el.v)
      const res = itp.expr(s.li, el.v)
      console.log(res, "::", printTFinal(el.k))
    }

    for (const v of s.m.fn.values()) {
      for (const el of v) {
        if (!el.checked) {
          issue(
            `Function '${el.name!.name}' is unused.\nnote: Functions are not type-checked until they are used, so unused functions\nnote:   would otherwise never error. This error ensures you don't write a\nnote:   function without checking it for validity.`,
            el.span,
          )
        }
      }
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
      setup.tests.push(expr(setup.m, v))
      break
    case 2:
      declFn(setup.m, v)
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
    tck.declNamed(lt, s.m.g.lt)
    tck.declGroup(lt, s.m.g.lf)
    s.tests.forEach((x) => tck.expr(lt, x.v))
  })

  bench1("end-to-end", () => {
    const p = ITEM.sepBy("").parse(source)
    const s = setup()
    p.forEach((x) => go(s, x))
    tck.declNamed(s.lt, s.m.g.lt)
    tck.declGroup(s.lt, s.m.g.lf)
    s.tests.forEach((x) => tck.expr(s.lt, x.v))
  })
}

if (test()) {
  console.log("\n== BENCHMARKS ==")
  bench()
}
