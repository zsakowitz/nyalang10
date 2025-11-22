import { T } from "../enum"
import { assertIndexUB, issue, ub } from "../error"
import type { Id } from "../id"
import { type Expr, type Stmt, type Type } from "./def"
import { printType } from "./def-debug"
import { assertTypeKind } from "./exec-typeck"

export interface VData {
  [T.Void]: null
  [T.Never]: never
  [T.Int]: number
  [T.Bool]: boolean
  [T.Extern]: unknown
  [T.Array]: unknown[]
  [T.Tuple]: unknown[]
  [T.Union]: { k: number; v: unknown }
}

export interface IOpaque {
  from(data: unknown): unknown
}

export interface IFn {
  exec(args: unknown[]): unknown
}

export interface ILocal {
  val: unknown
}

export type ILabel = null

export interface Env {
  opaqueExterns: Map<Id, IOpaque>
  fns: Map<Id, IFn>
  locals: Map<Id, ILocal>
}

function forkLocals(env: Env): Env {
  return {
    opaqueExterns: env.opaqueExterns,
    fns: env.fns,
    locals: new Map(env.locals),
  }
}

function forkForDecl(env: Env, ret: Type): Env {
  return {
    opaqueExterns: env.opaqueExterns,
    fns: env.fns,
    locals: new Map(),
  }
}

export function expr(env: Env, { k, v }: Expr): unknown {
  switch (k) {
    case T.Unreachable:
      ub(`Reached 'unreachable'.`)
    case T.Int:
      return Number(v) | 0
    case T.Bool:
      return v
    case T.Opaque: {
      assertTypeKind(v.ty, "Extern", T.Extern)
      const cons = env.opaqueExterns.get(v.ty.v)
      if (!cons) issue(`Cannot construct '${printType(v.ty)}' via 'T.Opaque'.`)
      return cons!.from(v.data)
    }
    case T.ArrayFill: {
      const el = expr(env, v.el)
      return Array.from({ length: Number(v.len) | 0 }).fill(el)
    }
    case T.ArrayMap:
      return Array.from({ length: Number(v.len) | 0 }, (_, i) => {
        const ienv = forkLocals(env)
        ienv.locals.set(v.idx, { val: i })
        return expr(ienv, v.el)
      })
    case T.ArrayElements:
      return v.els.map((x) => expr(env, x))
    case T.Tuple:
      return v.map((x) => expr(env, x))
    case T.Union:
      return { k: v.variant, v: expr(env, v.data) }
    case T.CastNever:
      ub(`Reached 'cast_never'.`)
    case T.IfElse:
      return expr(env, v.condition) ? expr(env, v.if) : expr(env, v.else)
    case T.ArrayIndex: {
      const target = expr(env, v.target) as VData[T.Array]
      const index = expr(env, v.index) as number
      assertIndexUB(target.length, index)
      return target[index]
    }
    case T.TupleIndex:
      return (expr(env, v.target) as VData[T.Tuple])[v.index]
    case T.UnionVariant:
      return (expr(env, v) as VData[T.Union]).k
    case T.UnionIndex: {
      const target = expr(env, v.target) as VData[T.Union]
      if (target.k != v.index) {
        ub(`Tried to index union with non-active variant.`)
      }
      return target.v
    }
    case T.UnionMatch: {
      const target = expr(env, v.target) as VData[T.Union]
      const arm = v.arms[target.k]!
      const locals = forkLocals(env)
      locals.locals.set(v.data, { val: target.v })
      return expr(locals, arm)
    }
    case T.Block: {
      if (v.length == 0) return null
      let ret = null
      env = forkLocals(env)
      v.forEach((st) => (ret = stmt(env, st)))
      return ret
    }
    case T.Label: {
      try {
        if (v.loop) {
          while (true) expr(env, v.body)
        } else {
          return expr(env, v.body)
        }
      } catch (e) {
        if (e instanceof Break && e.k == v.label) {
          return e.v
        } else {
          throw e
        }
      }
    }
    case T.Return:
      throw new Return(expr(env, v))
    case T.Break:
      throw new Break(v.label, expr(env, v.body))
    case T.Continue:
      throw new Continue(v)
    case T.Local:
      return env.locals.get(v)!.val
    case T.Call: {
      const fn = env.fns.get(v.name)!
      return fn.exec(v.args.map((x) => expr(env, x)))
    }
  }
}

export function stmt(env: Env, { k, v }: Stmt): unknown {}

class Break {
  constructor(
    readonly k: Id,
    readonly v: unknown,
  ) {}
}

class Continue {
  constructor(readonly k: Id) {}
}

class Return {
  constructor(readonly v: unknown) {}
}
