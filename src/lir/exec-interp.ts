import { T } from "../shared/enum"
import type { Id } from "../shared/id"
import type { Decl, Expr, Lval, Stmt } from "./def"
import { printType } from "./def-debug"
import { lAssertIndexUB, lAssertTypeKind, lIssue, lUB } from "./error"

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
  // see note about `exec` vs `execi` on `IFn` below
  fromi(data: unknown): unknown
}

export interface OpaqueData {
  evali(): unknown
}

export interface IFn {
  // `exec` is called `execi` so that another executor can define its own function method and a single object can cover them all
  // for instance, a JS executor could define `execJs`, and a single object with `execi` and `execJs` methods could be used in both executors
  execi(args: unknown[]): unknown
}

export interface ILocal {
  val: unknown
}

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

function forkForDecl(env: Env): Env {
  return {
    opaqueExterns: env.opaqueExterns,
    fns: env.fns,
    locals: new Map(),
  }
}

type LvalFrozen =
  | { k: T.Index; v: { target: LvalFrozen; index: number } }
  | { k: T.Local; v: Id }

function lvalFreeze(env: Env, { k, v }: Lval): LvalFrozen {
  switch (k) {
    case T.ArrayIndex:
    case T.DynArrayIndex:
      return {
        k: T.Index,
        v: {
          target: lvalFreeze(env, v.target),
          index: expr(env, v.index) as number,
        },
      }
    case T.TupleIndex:
      return {
        k: T.Index,
        v: {
          target: lvalFreeze(env, v.target),
          index: v.index,
        },
      }
    case T.Local:
      return { k, v }
  }
}

function lvalGet(env: Env, { k, v }: LvalFrozen): unknown {
  switch (k) {
    case T.Index: {
      const target = lvalGet(env, v.target) as unknown[]
      lAssertIndexUB(target.length, v.index)
      return target[v.index]!
    }
    case T.Local:
      return env.locals.get(v)!.val
  }

  k satisfies never
}

function lvalSet(env: Env, { k, v }: LvalFrozen, value: unknown) {
  switch (k) {
    case T.Index: {
      const target = (lvalGet(env, v.target) as unknown[]).slice()
      lAssertIndexUB(target.length, v.index)
      target[v.index] = value
      lvalSet(env, v.target, target)
      return
    }
    case T.Local:
      env.locals.get(v)!.val = value
      return
  }

  k satisfies never
}

export function expr(env: Env, { k, v }: Expr): unknown {
  switch (k) {
    case T.Unreachable:
      lUB(`Reached 'unreachable'.`)
    case T.Int:
      return Number(BigInt.asIntN(32, v))
    case T.Bool:
      return v
    case T.Opaque: {
      if (
        typeof v.data == "object"
        && v.data != null
        && "execi" in v.data
        && typeof v.data.execi == "function"
      ) {
        return v.data.execi()
      }
      lAssertTypeKind(v.ty, "Extern", T.Extern)
      const cons = env.opaqueExterns.get(v.ty.v)
      if (!cons) lIssue(`Cannot construct '${printType(v.ty)}' via 'T.Opaque'.`)
      return cons!.fromi(v.data)
    }
    case T.ArrayFill: {
      const el = expr(env, v.el)
      return Array.from({ length: Number(v.len) | 0 }).fill(el)
    }
    case T.DynArrayFill: {
      const len = expr(env, v.len)
      const el = expr(env, v.el)
      return Array.from({ length: len as number }).fill(el)
    }
    case T.ArrayFrom:
      return Array.from({ length: Number(v.len) | 0 }, (_, i) => {
        const ienv = forkLocals(env)
        ienv.locals.set(v.idx, { val: i })
        return expr(ienv, v.el)
      })
    case T.DynArrayFrom:
      return Array.from({ length: expr(env, v.len) as number }, (_, i) => {
        const ienv = forkLocals(env)
        ienv.locals.set(v.idx, { val: i })
        return expr(ienv, v.el)
      })
    case T.ArrayElements:
      return v.els.map((x) => expr(env, x))
    case T.DynArrayElements:
      return v.els.map((x) => expr(env, x))
    case T.Tuple:
      return v.map((x) => expr(env, x))
    case T.Union:
      return { k: v.variant, v: expr(env, v.data) }
    case T.CastNever:
      expr(env, v.target)
      lUB(`Reached cast step of 'cast_never'.`)
    case T.IfElse:
      return expr(env, v.condition) ? expr(env, v.if) : expr(env, v.else)
    case T.ArrayIndex:
    case T.DynArrayIndex: {
      const target = expr(env, v.target) as VData[T.Array]
      const index = expr(env, v.index) as number
      lAssertIndexUB(target.length, index)
      return target[index]
    }
    case T.TupleIndex:
      return (expr(env, v.target) as VData[T.Tuple])[v.index]
    case T.DynArrayLen:
      return (expr(env, v) as VData[T.Array]).length
    case T.UnionVariant:
      return (expr(env, v) as VData[T.Union]).k
    case T.UnionIndex: {
      const target = expr(env, v.target) as VData[T.Union]
      if (target.k != v.index) {
        lUB(`Indexed union with inactive variant.`)
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
      return fn.execi(v.args.map((x) => expr(env, x)))
    }
    case T.Wrap:
      return expr(env, v.target)
    case T.Unwrap:
      return expr(env, v)
  }

  k satisfies never
}

export function stmt(env: Env, { k, v }: Stmt): unknown {
  switch (k) {
    case T.Expr:
      return expr(env, v)
    case T.Let:
      env.locals.set(v.name, { val: expr(env, v.val) })
      return null
    case T.AssignOne: {
      const rhs = expr(env, v.value)
      const lhs = lvalFreeze(env, v.target)
      lvalSet(env, lhs, rhs)
      return null
    }
    case T.AssignMany: {
      const rhs = expr(env, v.value) as unknown[]
      for (let i = 0; i < rhs.length; i++) {
        const lhs = lvalFreeze(env, v.target[i]!)
        lvalSet(env, lhs, rhs[i]!)
      }
      return null
    }
  }
}

export function declGroup(env: Env, fs: Decl[]) {
  fs.forEach((f) => {
    const subenv = forkForDecl(env)
    const execi: IFn["execi"] = (args) => {
      const env = forkForDecl(subenv)
      f.args.forEach(({ name }, i) => env.locals.set(name, { val: args[i]! }))
      try {
        return expr(env, f.body)
      } catch (e) {
        if (e instanceof Return) {
          return e.v
        } else {
          throw e
        }
      }
    }
    env.fns.set(f.name, { execi })
  })
}

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

export function env(): Env {
  return {
    opaqueExterns: new Map(),
    fns: new Map(),
    locals: new Map(),
  }
}
