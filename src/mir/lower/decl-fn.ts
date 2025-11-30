import * as lir from "@/lir/def"
import {
  Reason,
  type Span,
  type WithoutSpan,
  type WithSpan,
} from "@/parse/span"
import { blue, quote, red } from "@/shared/ansi"
import { T } from "@/shared/enum"
import { Id } from "@/shared/id"
import {
  val,
  type DeclFn,
  type DeclFnNamed,
  type TFinal,
  type Value,
} from "../def"
import { printTFinal, printType } from "../def-debug"
import { issue } from "../error"
import { hashList, type Hash } from "../ty/hash"
import { matches } from "../ty/matches"
import type { Fn } from "./call"
import { forkForDecl, pushFn, type Env } from "./env"
import { expr } from "./exec-expr"
import { resolve, type } from "./exec-ty"
import { execTx } from "./tx"

export function evalFn<N extends WithSpan<Id> | null>(
  env: Env,
  { data: fn, span }: DeclFn<N>,
) {
  const subenv = forkForDecl(env)

  const used = new Set<number>()
  for (let i = 0; i < fn.args.length; i++) {
    const id = fn.args[i]!.name.data
    if (used.has(id.index)) {
      issue(`Cannot accept two arguments with the same name.`, span)
    }
    used.add(id.index)
  }

  const argsResolved = fn.args.map((x) => resolve(env, x.type))
  const retResolved = resolve(env, fn.ret)

  const fs: Record<Hash, { fname: Id; ty: TFinal }> = Object.create(null)

  const final: Fn<WithoutSpan<N>> = {
    name: (fn.name?.data ?? null) as any,
    span,
    args: argsResolved,
    argsNamed: [],
    ret: retResolved,
    exec,
  }

  return final

  function exec(_: Env, span: Span, args: Value[]) {
    const fhash = hashList(args.map((x) => x.k))
    if (fhash in fs) {
      return val(
        fs[fhash]!.ty,
        lir.ex(T.Call, {
          name: fs[fhash]!.fname,
          args: args.map((x) => x.v),
        }),
        span,
      )
    }

    const fname = fn.name ? fn.name.data.fresh() : new Id("anon")

    const declArgs = fn.args.map(({ name }, i) => ({
      name: name.data.fresh(),
      type: type(subenv, args[i]!.k),
    }))

    const env = forkForDecl(subenv)
    for (let i = 0; i < fn.args.length; i++) {
      env.vr.set(fn.args[i]!.name.data.index, {
        mut: false,
        ty: args[i]!.k,
        value: declArgs[i]!.name,
        def: fn.args[i]!.name.span,
      })
    }

    const body = expr(env, fn.body)

    const tx = matches(env.g.cx, body.k, retResolved)
    if (!tx) {
      issue(
        `Function said it would return ${quote(printType(retResolved), blue)}, but it actually returned ${quote(printTFinal(body.k), red)}.\nhelp: This is usually a problem with the called function, not the caller.\nhelp: Check that the function is implemented correctly.`,
        fn.ret.span.for(Reason.TyExpected).with(body.s.for(Reason.TyActual)),
      )
    }

    const realBody = execTx(env, tx, body)

    const decl: lir.Decl = {
      name: fname,
      args: declArgs,
      ret: type(subenv, realBody.k),
      body: realBody.v,
    }

    _.g.lir.push(decl)

    fs[fhash] = { fname, ty: body.k }

    return val(
      body.k,
      lir.ex(T.Call, { name: fname, args: args.map((x) => x.v) }),
      span,
    )
  }
}

export function declFn(env: Env, fn: DeclFnNamed) {
  const f = evalFn(env, fn)
  pushFn(env, f)
}
