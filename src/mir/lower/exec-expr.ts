import * as lir from "@/lir/def"
import { ex } from "@/lir/def"
import { Reason, vspan } from "@/parse/span"
import { T } from "@/shared/enum"
import { idFor } from "@/shared/id"
import { bool, int, kv, val, void_, type Expr, type Value } from "../def"
import { R } from "../enum"
import { issue } from "../error"
import { nextHash } from "../ty/hash"
import { unifyValues } from "../ty/unify"
import { Block } from "./block"
import { call } from "./call"
import { evalFn } from "./decl-fn"
import { forkLocals, type Env } from "./env"
import { asConstInt } from "./exec-const-int"
import { type } from "./exec-ty"
import { block } from "./stmt"

export function expr(env: Env, { data: { k, v }, span }: Expr): Value {
  switch (k) {
    case R.Void:
      return val(void_, ex(T.Block, []), span)
    case R.Int: {
      const vr = env.vr.get(idFor("" + v).index)
      if (vr) {
        return val(vr.ty, ex(T.Local, vr.value), span)
      }
      return val(int, ex(T.Int, v), span)
    }
    case R.Num: {
      if (!env.g.num) {
        issue(`'num' literals are not supported in this executor.`, span)
      }

      return val(
        kv(R.Extern, vspan(env.g.num.extern)),
        ex(T.Opaque, {
          ty: kv(T.Extern, env.g.num.extern),
          data: env.g.num.from(v),
        }),
        span,
      )
    }
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
      const f = evalFn(env, v.f)
      return val(
        kv(R.FnKnown, { name: null, hash: v.hash, f: [f] }),
        ex(T.Block, []),
        span,
      )
    }
    case R.ArrayElements: {
      const vals = unifyValues(
        env,
        "Cannot construct an array unless all elements have compatible types.",
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
    case R.Block:
      return block(env, span, v)
    case R.Str: {
      if (!env.g.str) {
        issue(`This executor does not support 'str' literals.`, span)
      }

      return val(
        kv(R.Extern, vspan(env.g.str.extern)),
        ex(T.Opaque, {
          ty: kv(T.Extern, env.g.str.extern),
          data: env.g.str.from(v),
        }),
        span,
      )
    }
  }
}
