import * as lir from "@/lir/def"
import { ex } from "@/lir/def"
import { at, Reason, type Span } from "@/parse/span"
import { blue, quote, red } from "@/shared/ansi"
import { T } from "@/shared/enum"
import type { Id } from "@/shared/id"
import {
  bool,
  int,
  kv,
  val,
  void_,
  type DeclFn,
  type Expr,
  type TFinal,
  type TTyped,
  type Type,
  type Value,
} from "./def"
import { printTFinal, printType } from "./def-debug"
import { R } from "./enum"
import { issue } from "./error"
import { call, type Fn } from "./exec-call"
import { forkForDecl, forkLocals, pushFn, type Env } from "./exec-env"
import { Block } from "./exec-seq"
import { hashList, type Hash } from "./ty-hash"
import { matches } from "./ty-matches"

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
    case R.UnitIn:
      return lir.void_
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
      if (vr == null) {
        issue(`Variable '${v.data.debug}' is not defined.`, span)
      }
      return val(vr.ty, ex(T.Local, vr.value), span)
    }
    case R.Call: {
      const args = []
      for (let i = 0; i < v.args.length; i++) {
        args.push(expr(env, v.args[i]!))
      }

      const argsNamed = Object.create(null)
      for (let i = 0; i < v.argsNamed.length; i++) {
        const { name, value } = v.argsNamed[i]!
        if (name.data.index in argsNamed) {
          issue(
            `Named argument '${name.data.debug}' passed twice in function call.`,
            name.span,
          )
        }
        argsNamed[name.data.index] = expr(env, value)
      }

      return call(env, span, v.name.data, args, argsNamed)
    }
    case R.Typeof: {
      const block = new Block()
      const target = block.store(expr(env, v))
      return block.returnUnitIn(target.k, span)
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
  }
}

export function declFn(env: Env, { data: fn, span }: DeclFn) {
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

  const final: Fn = {
    name: fn.name.data,
    span,
    args: argsResolved,
    argsNamed: Object.create(null),
    ret: retResolved,
    exec(_, span, args, _argsNamed) {
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

      const fname = fn.name.data.fresh()

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

      const decl: lir.Decl = {
        name: fname,
        args: declArgs,
        ret: type(subenv, body.k),
        body: body.v,
      }

      _.lirDecls.push(decl)

      fs[fhash] = { fname, ty: body.k }
      return val(
        body.k,
        lir.ex(T.Call, { name: fname, args: args.map((x) => x.v) }),
        span,
      )
    },
  }

  pushFn(env, final)

  return final
}
