import * as lir from "@/lir/def"
import { ex } from "@/lir/def"
import {
  at,
  Reason,
  type Span,
  type WithoutSpan,
  type WithSpan,
} from "@/parse/span"
import { blue, quote, red } from "@/shared/ansi"
import { T } from "@/shared/enum"
import { Id } from "@/shared/id"
import {
  bool,
  int,
  kv,
  val,
  void_,
  type DeclFn,
  type DeclFnNamed,
  type Expr,
  type TFinal,
  type TTyped,
  type Type,
  type Value,
} from "../def"
import { printTFinal, printType } from "../def-debug"
import { R } from "../enum"
import { issue } from "../error"
import { hashList, nextHash, type Hash } from "../ty/hash"
import { matches } from "../ty/matches"
import { unifyValues } from "../ty/unify"
import { Block } from "./block"
import { call, type Fn } from "./call"
import { forkForDecl, forkLocals, pushFn, type Env } from "./env"
import { execTx } from "./tx"

export function resolve(env: Env, ty: TTyped): Type {
  const { k, v } = ty.data

  switch (k) {
    case R.Void:
    case R.Never:
    case R.Int:
    case R.Bool:
    case R.Any:
    case R.Extern:
      return ty as Type
    case R.ArrayFixed:
      return at(
        kv(R.ArrayFixed, { el: resolve(env, v.el), len: v.len }),
        ty.span,
      )
    case R.ArrayDyn:
    case R.Array:
      return at(kv(k, resolve(env, v)), ty.span)
    case R.Either:
      return at(
        kv(R.Either, { a: resolve(env, v.a), b: resolve(env, v.b) }),
        ty.span,
      )
    case R.Local:
      const refd = env.ty.get(v.data.index)
      if (refd == null) {
        issue(`Type '${v.data.debug}' is not defined.`, ty.span)
      }
      return refd
    case R.UnitIn:
      return at(kv(R.UnitIn, resolve(env, v)), ty.span)
  }
}

export function type(env: Env, ty: TFinal): lir.Type {
  switch (ty.k) {
    case R.Void:
    case R.UnitIn:
    case R.FnKnown:
      return lir.void_
    case R.Int:
      return lir.int
    case R.Bool:
      return lir.bool
    case R.Extern:
      return lir.ty(T.Extern, ty.v.data)
    case R.Never:
      return lir.never
    case R.ArrayFixed:
      return lir.ty(T.Array, { el: type(env, ty.v.el), len: ty.v.len })
    case R.ArrayDyn:
      return lir.ty(T.DynArray, type(env, ty.v))
  }
}

export function asConstInt(span: Span, value: Value): number | null {
  if (value.k.k != R.Int) {
    issue(
      `Array length must be an ${quote("int", blue)}.`,
      span.for(Reason.ExpectedInt),
    )
  }
  if (value.v.k == T.Int) {
    const v = value.v.v
    if (BigInt.asUintN(32, v) != v) {
      issue(`Array lengths must be between 0 and 2^32-1.`, span)
    }
    return Number(v)
  }
  if (value.v.k == T.Block && value.v.v.length != 0) {
    const last = value.v.v[value.v.v.length - 1]!
    if (last.k != T.Expr || last.v.k != T.Int) {
      return null
    }
    const v = last.v.v
    if (BigInt.asUintN(32, v) != v) {
      issue(`Array lengths must be between 0 and 2^32-1.`, span)
    }
    return Number(v)
  }
  return null
}

export function expr(env: Env, { data: { k, v }, span }: Expr): Value {
  switch (k) {
    case R.Void:
      return val(void_, ex(T.Block, []), span)
    case R.Int:
      return val(int, ex(T.Int, v), span)
    case R.Bool:
      return val(bool, ex(T.Bool, v), span)
    case R.ArrayFill: {
      const lenRaw = expr(env, v.len)
      const len = asConstInt(v.len.span, lenRaw)
      const el = expr(env, v.el)
      if (len == null) {
        return val(
          kv(R.ArrayDyn, el.k),
          ex(T.DynArrayFill, { el: el.v, len: lenRaw.v }),
          span,
        )
      }
      return val(
        kv(R.ArrayFixed, { el: el.k, len }),
        ex(T.ArrayFill, { el: el.v, len }),
        span,
      )
    }
    case R.ArrayFrom: {
      const lenRaw = expr(env, v.len)
      const len = asConstInt(v.len.span, lenRaw)

      const subenv = forkLocals(env)
      const idx = v.bind.data.fresh()
      subenv.vr.set(v.bind.data.index, {
        mut: false,
        ty: int,
        value: idx,
        def: v.bind.span,
      })
      const el = expr(subenv, v.el)

      if (len == null) {
        return val(
          kv(R.ArrayDyn, el.k),
          ex(T.DynArrayFrom, { idx, el: el.v, len: lenRaw.v }),
          span,
        )
      }
      return val(
        kv(R.ArrayFixed, { el: el.k, len }),
        ex(T.ArrayFrom, { idx, el: el.v, len }),
        span,
      )
    }
    case R.Local: {
      const vr = env.vr.get(v.data.index)
      if (vr != null) {
        return val(vr.ty, ex(T.Local, vr.value), span)
      }
      const fn = env.fn.get(v.data.index)
      if (fn != null) {
        return val(
          kv(R.FnKnown, { name: v.data, hash: nextHash(), f: fn }),
          lir.ex(T.Block, []),
          span,
        )
      }
      issue(`'${v.data.debug}' is not defined.`, span)
    }
    case R.Call: {
      const target = expr(env, v.target)
      if (target.k.k != R.FnKnown) {
        issue(
          `Attempted to call non-function.`,
          v.target.span
            .for(Reason.ExpectedFn)
            .with(span.for(Reason.TraceStart)),
        )
      }

      const args = []
      for (let i = 0; i < v.args.length; i++) {
        args.push(expr(env, v.args[i]!))
      }

      const argsNamed: [number, Value][] = []
      for (let i = 0; i < v.argsNamed.length; i++) {
        const { name, value } = v.argsNamed[i]!
        if (name.data.index in argsNamed) {
          issue(
            `Named argument '${name.data.debug}' passed twice in function call.`,
            name.span,
          )
        }
        argsNamed.push([name.data.index, expr(env, value)])
      }

      return call(env, span, target.k.v.name, target.k.v.f, args, argsNamed)
    }
    case R.Typeof: {
      const block = new Block()
      const target = block.store(expr(env, v))
      return block.returnUnitIn(target.k, span)
    }
    case R.AnonFn: {
      const f = anonFn(env, v.f)
      return val(
        kv(R.FnKnown, { name: null, hash: v.hash, f: [f] }),
        ex(T.Block, []),
        span,
      )
    }
    case R.ArrayElements: {
      const vals = unifyValues(
        env,
        "cannot construct array from these elements",
        v.map((x) => expr(env, x)),
      )
      return val(
        kv(R.ArrayFixed, { el: vals.k, len: vals.v.length }),
        ex(T.ArrayElements, {
          elTy: type(env, vals.k),
          els: vals.v.map((x) => x.v),
        }),
        span,
      )
    }

    // destructors
    case R.Index: {
      const target = expr(env, v.target)
      const index = expr(env, v.index)
      if (index.k.k != R.Never && index.k.k != R.Int) {
        issue(`Arrays are indexed by 'int'.`, index.s.for(Reason.ExpectedInt))
      }
      switch (target.k.k) {
        case R.ArrayFixed:
          return val(
            target.k.v.el,
            ex(T.ArrayIndex, { target: target.v, index: index.v }),
            span,
          )
        case R.ArrayDyn:
          return val(
            target.k.v,
            ex(T.DynArrayIndex, { target: target.v, index: index.v }),
            span,
          )
      }
      issue(`Only arrays can be indexed.`, target.s.for(Reason.ExpectedArray))
    }
    case R.IfElse: {
      const cond = expr(env, v.cond)
      if (cond.k.k != R.Bool) {
        issue(
          `The condition of an 'if' statement must be a boolean.`,
          cond.s.for(Reason.ExpectedBool),
        )
      }

      const {
        k,
        v: [b1, b0],
      } = unifyValues(
        env,
        "cannot return these values from the same 'if' expression",
        [expr(env, v.if), expr(env, v.else)],
      )

      return val(
        k,
        ex(T.IfElse, {
          condition: cond.v,
          type: type(env, k),
          if: b1!.v,
          else: b0!.v,
        }),
        span,
      )
    }
  }
}

export function declFn(env: Env, fn: DeclFnNamed) {
  const f = anonFn(env, fn)
  pushFn(env, f)
}

export function anonFn<N extends WithSpan<Id> | null>(
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

    const tx = matches(env.cx, body.k, retResolved)
    if (!tx) {
      issue(
        `Function said it would return ${quote(printType(retResolved), blue)}, but it actually returned ${quote(printTFinal(body.k), red)}.`,
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

    _.lirDecls.push(decl)

    fs[fhash] = { fname, ty: body.k }
    return val(
      body.k,
      lir.ex(T.Call, { name: fname, args: args.map((x) => x.v) }),
      span,
    )
  }
}
