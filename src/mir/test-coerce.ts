import * as ld from "@/lir/def"
import { lAssert } from "@/lir/error"
import * as li from "@/lir/exec-interp"
import * as lt from "@/lir/exec-typeck"
import { VSPAN, vspan } from "@/parse/span"
import { T } from "@/shared/enum"
import { idFor } from "@/shared/id"
import { Coercions } from "./coerce"
import { tyr } from "./def"
import { Env } from "./env"
import { fn } from "@/lir/exec-helper"
import { printType } from "@/lir/def-debug"

const cx = new Coercions()
const env = new Env()

const int = vspan(tyr(T.Int, null))
const bool = vspan(tyr(T.Bool, null))
const num = vspan(tyr(T.Extern, vspan(idFor("num"))))
const complex = vspan(tyr(T.Extern, vspan(idFor("complex"))))

cx.push({
  span: VSPAN,
  from: bool,
  into: int,
  auto: false,
  exec(_, value) {
    return ld.ex(T.IfElse, {
      condition: value,
      type: ld.int,
      if: ld.ex(T.Int, 1n),
      else: ld.ex(T.Int, 0n),
    })
  },
})

cx.push({
  span: VSPAN,
  from: int,
  into: num,
  auto: false,
  exec(_, value) {
    return ld.ex(T.Call, {
      name: idFor("as_num"),
      args: [value],
    })
  },
})

cx.push({
  span: VSPAN,
  from: num,
  into: complex,
  auto: false,
  exec(_, value) {
    const ZERO = ld.ex(T.Call, {
      name: idFor("as_num"),
      args: [ld.ex(T.Int, 0n)],
    })

    return ld.ex(T.Call, {
      name: idFor("reim"),
      args: [value, ZERO],
    })
  },
})

const ret = cx.unsafeExec(env, bool, complex, ld.ex(T.Bool, true))

const ienv = li.env()
const tenv = lt.env()

const lnum = ld.ty(T.Extern, idFor("num"))

fn(ienv, tenv, "as_num", {
  args: [ld.int],
  ret: lnum,
  execi([vint]) {
    return vint
  },
})

fn(ienv, tenv, "reim", {
  args: [lnum, lnum],
  ret: ld.ty(T.Extern, idFor("complex")),
  execi([re, im]) {
    return { re, im }
  },
})

const ty = printType(lt.expr(tenv, ret))
console.log(li.expr(ienv, ret), "::", ty)
