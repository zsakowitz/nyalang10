import * as lir from "@/lir/def"
import { ex } from "@/lir/def"
import { Reason, vspan } from "@/parse/span"
import { blue, quote, red } from "@/shared/ansi"
import { T } from "@/shared/enum"
import { idFor } from "@/shared/id"
import { kvs, val, type Expr, type Value } from "../def"
import { printTFinal } from "../def-debug"
import { R } from "../enum"
import { issue } from "../error"
import { asConcrete } from "../ty/as-concrete"
import { nextHash } from "../ty/hash"
import { matchesFinal } from "../ty/matches"
import { unifyValues } from "../ty/unify"
import { Block } from "./block"
import { call } from "./call"
import { evalFn } from "./decl-fn"
import { forkLocals, type Env } from "./env"
import { asConstInt } from "./exec-const-int"
import { type } from "./exec-ty"
import { block } from "./stmt"
import { execTx } from "./tx"

export function expr(env: Env, { data: { k, v }, span }: Expr): Value {
  switch (k) {
    case R.Void:
      return val(kvs(R.Void, null, span), ex(T.Block, [], span), span)
    case R.Int: {
      const vr = env.vr.get(idFor("" + v).index)
      if (vr) {
        return val(vr.ty, ex(T.Local, vr.value, span), span)
      }
      return val(kvs(R.Int, null, span), ex(T.Int, v, span), span)
    }
    case R.Num: {
      const vr = env.vr.get(idFor("" + v.raw).index)
      if (vr) {
        return val(vr.ty, ex(T.Local, vr.value, span), span)
      }

      if (!env.g.num) {
        issue(`'num' literals are not supported in this executor.`, span)
      }

      return val(
        kvs(R.Extern, vspan(env.g.num.extern), span),
        ex(
          T.Opaque,
          {
            ty: lir.ty(T.Extern, env.g.num.extern, span),
            data: env.g.num.from(v),
          },
          span,
        ),
        span,
      )
    }
    case R.Bool:
      return val(kvs(R.Bool, null, span), ex(T.Bool, v, span), span)
    case R.ArrayFill: {
      const lenRaw = expr(env, v.len)
      const len = asConstInt(v.len.span, lenRaw)
      const el = expr(env, v.el)
      if (len == null) {
        return val(
          kvs(R.ArrayDyn, el.k, span),
          ex(T.DynArrayFill, { el: el.v, len: lenRaw.v }, span),
          span,
        )
      }
      return val(
        kvs(R.ArrayFixed, { el: el.k, len }, span),
        ex(T.ArrayFill, { el: el.v, len }, span),
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
        ty: kvs(R.Int, null, v.bind.span),
        value: idx,
        def: v.bind.span,
      })
      const el = expr(subenv, v.el)

      if (len == null) {
        return val(
          kvs(R.ArrayDyn, el.k, span),
          ex(T.DynArrayFrom, { idx, el: el.v, len: lenRaw.v }, span),
          span,
        )
      }
      return val(
        kvs(R.ArrayFixed, { el: el.k, len }, span),
        ex(T.ArrayFrom, { idx, el: el.v, len }, span),
        span,
      )
    }
    case R.Local: {
      const vr = env.vr.get(v.data.index)
      if (vr != null) {
        return val(vr.ty, ex(T.Local, vr.value, span), span)
      }
      const fn = env.fn.get(v.data.index)
      if (fn != null) {
        return val(
          kvs(R.FnKnown, { name: v.data, hash: nextHash(), f: fn }, span),
          ex(T.Block, [], span),
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
      const f = evalFn(env, v.f)
      return val(
        kvs(R.FnKnown, { name: null, hash: v.hash, f: [f] }, span),
        ex(T.Block, [], span),
        span,
      )
    }
    case R.ArrayElements: {
      const vals = unifyValues(
        env,
        "Cannot construct an array unless all elements have compatible types.",
        v.map((x) => expr(env, x)),
        span,
      )
      return val(
        kvs(R.ArrayFixed, { el: vals.k, len: vals.v.length }, vals.k.s),
        ex(
          T.ArrayElements,
          {
            elTy: type(env, vals.k),
            els: vals.v.map((x) => x.v),
          },
          span,
        ),
        span,
      )
    }
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
            ex(T.ArrayIndex, { target: target.v, index: index.v }, span),
            span,
          )
        case R.ArrayDyn:
          return val(
            target.k.v,
            ex(T.DynArrayIndex, { target: target.v, index: index.v }, span),
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
        span,
      )

      return val(
        k,
        ex(
          T.IfElse,
          {
            condition: cond.v,
            type: type(env, k),
            if: b1!.v,
            else: b0!.v,
          },
          span,
        ),
        span,
      )
    }
    case R.Block:
      return block(env, span, v)
    case R.Str: {
      if (!env.g.str) {
        issue(`This executor does not support 'str' literals.`, span)
      }

      return val(
        kvs(R.Extern, vspan(env.g.str.extern), span),
        ex(
          T.Opaque,
          {
            ty: lir.ty(T.Extern, env.g.str.extern, span),
            data: env.g.str.from(v),
          },
          span,
        ),
        span,
      )
    }
    case R.Return: {
      if (!env.ret) {
        issue(
          `'return' statements are only allowed in functions.`,
          span.for(Reason.NotInAFunction),
        )
      }

      const ret = asConcrete(
        env.ret,
        "For now, 'return' can only exist functions which return a concrete type.\nnote: This is a known limitation, and will be removed in the future.",
      )

      const retval = expr(env, v)

      const tx = matchesFinal(env.g.cx, retval.k, ret)

      if (!tx) {
        issue(
          `Cannot return ${quote(red, printTFinal(retval.k))} from a function which expects to return ${quote(blue, printTFinal(ret))}`,
          retval.s
            .for(Reason.TyActual)
            .with(env.ret.span.for(Reason.TyExpected)),
        )
      }

      const actualRetval = execTx(env, tx, retval)

      return val(
        kvs(R.Never, null, span),
        ex(T.Return, actualRetval.v, span),
        span,
      )
    }
  }
}
