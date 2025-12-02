import { T } from "../shared/enum"
import { Id } from "../shared/id"
import {
  bool,
  int,
  never,
  ty,
  void_,
  type Decl,
  type DeclNamed,
  type Expr,
  type Lval,
  type Stmt,
  type Type,
} from "./def"
import { printType } from "./def-debug"
import { lAssertIndex, lAssertTypeKind, lIssue } from "./error"

export interface IFn {
  args: Type[]
  ret: Type
}

export interface ILocal {
  mut: boolean
  ty: Type
}

export interface ILabel {
  loop: boolean
  ty: Type
}

export interface Env {
  fns: Map<Id, IFn>
  named: Map<Id, Type>

  locals: Map<Id, ILocal>
  labels: Map<Id, ILabel>
  return: Type | null
}

function forkLocals(env: Env): Env {
  return {
    fns: env.fns,
    named: env.named,
    locals: new Map(env.locals),
    labels: env.labels,
    return: env.return,
  }
}

function forkLabels(env: Env): Env {
  return {
    fns: env.fns,
    named: env.named,
    locals: env.locals,
    labels: new Map(env.labels),
    return: env.return,
  }
}

function forkForDecl(env: Env, ret: Type): Env {
  return {
    fns: env.fns,
    named: env.named,
    locals: new Map(),
    labels: new Map(),
    return: ret,
  }
}

function eq(src: Type, dst: Type): boolean {
  if (src === dst) {
    return true
  }

  if (src.k !== dst.k) {
    return false
  }

  switch (src.k) {
    case T.Void:
    case T.Never:
    case T.Int:
    case T.Bool:
      return true
    case T.Extern:
      return src.v === dst.v
    case T.Array: {
      const sv = src.v as Extract<Type, { k: T.Array }>["v"]
      const dv = dst.v as Extract<Type, { k: T.Array }>["v"]
      return sv.len === dv.len && eq(sv.el, dv.el)
    }
    case T.DynArray: {
      const sv = src.v as Extract<Type, { k: T.DynArray }>["v"]
      const dv = dst.v as Extract<Type, { k: T.DynArray }>["v"]
      return eq(sv, dv)
    }
    case T.Tuple:
    case T.Union: {
      const sv = src.v as Extract<Type, { k: T.Tuple | T.Union }>["v"]
      const dv = dst.v as Extract<Type, { k: T.Tuple | T.Union }>["v"]
      return sv.length === dv.length && sv.every((s, i) => eq(s, dv[i]!))
    }
    case T.Named:
      return src.v == dst.v
  }
}

function assertAssignable(src: Type, dst: Type) {
  if (src.k != T.Never && !eq(src, dst)) {
    lIssue(`Expected '${printType(dst)}', found '${printType(src)}'.`)
  }
}

function lval(env: Env, { k, v }: Lval): Type {
  switch (k) {
    case T.ArrayIndex: {
      assertAssignable(expr(env, v.index), int)
      const target = lval(env, v.target)
      lAssertTypeKind(target, "Array", T.Array)
      return target.v.el
    }
    case T.DynArrayIndex: {
      assertAssignable(expr(env, v.index), int)
      const target = lval(env, v.target)
      lAssertTypeKind(target, "DynArray", T.DynArray)
      return target.v
    }
    case T.TupleIndex: {
      const target = lval(env, v.target)
      lAssertTypeKind(target, "Tuple", T.Tuple)
      lAssertIndex(target.v.length, v.index)
      return target.v[v.index]!
    }
    case T.Local: {
      const local = env.locals.get(v)
      if (!local) lIssue(`Local $${v.debug} does not exist.`)
      if (!local.mut) lIssue(`Cannot assign to non-mut local $${v.debug}.`)
      return local.ty
    }
  }
}

export function expr(env: Env, { k, v }: Expr): Type {
  switch (k) {
    case T.Unreachable:
      return never
    case T.Int:
      return int
    case T.Bool:
      return bool
    case T.Opaque:
      return v.ty
    case T.ArrayFill:
      return ty(T.Array, { el: expr(env, v.el), len: v.len })
    case T.ArrayFrom: {
      env = forkLocals(env)
      env.locals.set(v.idx, { mut: false, ty: int })
      return ty(T.Array, { el: expr(env, v.el), len: v.len })
    }
    case T.ArrayElements: {
      checkType(env, v.elTy)
      v.els.forEach((el) => assertAssignable(expr(env, el), v.elTy))
      return ty(T.Array, { el: v.elTy, len: v.els.length })
    }
    case T.DynArrayOf: {
      const target = expr(env, v)
      lAssertTypeKind(target, "Array", T.Array)
      return ty(T.DynArray, target.v.el)
    }
    case T.DynArrayFill:
      assertAssignable(expr(env, v.len), int)
      return ty(T.DynArray, expr(env, v.el))
    case T.DynArrayFrom: {
      assertAssignable(expr(env, v.len), int)
      env = forkLocals(env)
      env.locals.set(v.idx, { mut: false, ty: int })
      return ty(T.DynArray, expr(env, v.el))
    }
    case T.DynArrayElements: {
      checkType(env, v.elTy)
      v.els.forEach((el) => assertAssignable(expr(env, el), v.elTy))
      return ty(T.DynArray, v.elTy)
    }
    case T.Tuple:
      return ty(
        T.Tuple,
        v.map((x) => expr(env, x)),
      )
    case T.Union: {
      checkType(env, v.unionTy)
      lAssertTypeKind(v.unionTy, "Union", T.Union)
      lAssertIndex(v.unionTy.v.length, v.variant)
      assertAssignable(expr(env, v.data), v.unionTy.v[v.variant]!)
      return v.unionTy
    }
    case T.CastNever: {
      checkType(env, v.into)
      assertAssignable(expr(env, v.target), never)
      return v.into
    }
    case T.IfElse: {
      checkType(env, v.type)
      assertAssignable(expr(env, v.condition), bool)
      assertAssignable(expr(env, v.if), v.type)
      assertAssignable(expr(env, v.else), v.type)
      return v.type
    }
    case T.ArrayIndex: {
      assertAssignable(expr(env, v.index), int)
      const target = expr(env, v.target)
      lAssertTypeKind(target, "Array", T.Array)
      return target.v.el
    }
    case T.DynArrayIndex: {
      assertAssignable(expr(env, v.index), int)
      const target = expr(env, v.target)
      lAssertTypeKind(target, "DynArray", T.DynArray)
      return target.v
    }
    case T.TupleIndex: {
      const target = expr(env, v.target)
      lAssertTypeKind(target, "Tuple", T.Tuple)
      lAssertIndex(target.v.length, v.index)
      return target.v[v.index]!
    }
    case T.DynArrayLen: {
      const target = expr(env, v)
      lAssertTypeKind(target, "DynArray", T.DynArray)
      return int
    }
    case T.UnionVariant: {
      const target = expr(env, v)
      lAssertTypeKind(target, "Union", T.Union)
      return int
    }
    case T.UnionIndex: {
      const target = expr(env, v.target)
      lAssertTypeKind(target, "Union", T.Union)
      lAssertIndex(target.v.length, v.index)
      return target.v[v.index]!
    }
    case T.UnionMatch: {
      checkType(env, v.type)
      const target = expr(env, v.target)
      lAssertTypeKind(target, "Union", T.Union)
      if (v.arms.length != target.v.length) {
        lIssue(
          `Must list '${target.v.length}' arm(s) to match '${printType(target)}'.`,
        )
      }
      for (let i = 0; i < v.arms.length; i++) {
        const data = target.v[i]!
        const arm = v.arms[i]!
        const locals = forkLocals(env)
        locals.locals.set(v.data, { mut: false, ty: data })
        assertAssignable(expr(locals, arm), v.type)
      }
      return v.type
    }
    case T.Block: {
      if (v.length == 0) return void_
      let ret: Type = void_
      env = forkLocals(env)
      v.forEach((st) => {
        ret = stmt(env, st)
      })
      return ret
    }
    case T.Label: {
      checkType(env, v.type)
      env = forkLabels(env)
      env.labels.set(v.label, { loop: v.loop, ty: v.type })
      const body = expr(env, v.body)
      if (!v.loop) {
        assertAssignable(body, v.type)
      }
      return v.type
    }
    case T.Return: {
      if (!env.return) lIssue(`Cannot return from this context.`)
      assertAssignable(expr(env, v), env.return)
      return never
    }
    case T.Break: {
      const label = env.labels.get(v.label)
      if (!label) lIssue(`Label '${v.label.debug} does not exist.`)
      assertAssignable(expr(env, v.body), label.ty)
      return never
    }
    case T.Continue: {
      const label = env.labels.get(v)
      if (!label) lIssue(`Label '${v.debug} does not exist.`)
      if (!label.loop)
        lIssue(`Cannot 'continue' to non-loop label '${v.debug}.`)
      return never
    }
    case T.Local: {
      const local = env.locals.get(v)
      if (!local) lIssue(`Local $${v.debug} does not exist.`)
      return local.ty
    }
    case T.Call: {
      if (env.locals.get(v.name)) {
        lIssue(
          `Cannot call a function whose name is shadowed by a local variable.`,
        )
      }
      const fn = env.fns.get(v.name)
      if (!fn) {
        lIssue(`Function @${v.name.debug} does not exist.`)
      }
      if (fn.args.length != v.args.length) {
        lIssue(`Wrong number of arguments to function @${v.name.debug}.`)
      }
      for (let i = 0; i < fn.args.length; i++) {
        const src = expr(env, v.args[i]!)
        const dst = fn.args[i]!
        assertAssignable(src, dst)
      }
      return fn.ret
    }
    case T.Wrap: {
      const named = env.named.get(v.with)
      if (!named) lIssue(`Named type '&${v.with.debug}' is not defined.`)

      const inner = expr(env, v.target)
      assertAssignable(inner, named)

      return ty(T.Named, v.with)
    }
    case T.Unwrap: {
      const el = expr(env, v)
      lAssertTypeKind(el, "Named", T.Named)

      const named = env.named.get(el.v)
      if (!named) lIssue(`Named type '&${el.v.debug}' is not defined.`)

      return named
    }
  }
}

export function stmt(env: Env, { k, v }: Stmt): Type {
  switch (k) {
    case T.Expr:
      return expr(env, v)
    case T.Let:
      env.locals.set(v.name, { mut: v.mut, ty: expr(env, v.val) })
      return void_
    case T.AssignOne:
      assertAssignable(lval(env, v.target), expr(env, v.value))
      return void_
    case T.AssignMany:
      const lhs = v.target.map((x) => lval(env, x))
      assertAssignable(ty(T.Tuple, lhs), expr(env, v.value))
      return void_
    // TODO: allow assignment through named types
  }
}

// functions declared in a group can reference each other and themselves recursively
export function declGroup(env: Env, fs: Decl[]): void {
  // push all fns into global scope
  for (let i = 0; i < fs.length; i++) {
    const { name, args, ret } = fs[i]!
    if (env.fns.has(name)) {
      lIssue(`Cannot redeclare function '@${name.debug}'.`)
    }

    const used = new Set<Id>()
    args.forEach((x) => {
      if (used.has(x.name)) {
        lIssue(
          `Declaration of '@${name.debug}' cannot have more than one argument named '$${name.debug}'.`,
        )
      }
      used.add(x.name)
      checkType(env, x.type)
    })
    checkType(env, ret)
    env.fns.set(name, { args: args.map((x) => x.type), ret })
  }

  // check bodies; this enables recursive functions
  for (let i = 0; i < fs.length; i++) {
    const { args, ret, body } = fs[i]!
    const subenv = forkForDecl(env, ret)
    args.forEach((x) => subenv.locals.set(x.name, { mut: false, ty: x.type }))
    assertAssignable(expr(subenv, body), ret)
  }
}

function checkType(env: Env, { k, v }: Type): void {
  switch (k) {
    case T.Void:
    case T.Never:
    case T.Int:
    case T.Bool:
    case T.Extern:
      // TODO: check that extern types exist
      return
    case T.Array:
      checkType(env, v.el)
      return
    case T.DynArray:
      checkType(env, v)
      return
    case T.Tuple:
    case T.Union:
      v.forEach((x) => checkType(env, x))
      return
    case T.Named:
      if (!env.named.has(v)) {
        lIssue(`Named type '&${v.debug}' is not defined.`)
      }
      return
    default:
      k satisfies never
  }
}

export function declNamed(env: Env, ds: DeclNamed[]): void {
  for (let i = 0; i < ds.length; i++) {
    const { name, body } = ds[i]!
    if (env.named.has(name)) {
      lIssue(`Cannot redeclare named type '&${name.debug}'.`)
    }

    env.named.set(name, body)
  }

  for (let i = 0; i < ds.length; i++) {
    checkType(env, ds[i]!.body)
  }
}

export function env(): Env {
  return {
    fns: new Map(),
    named: new Map(),
    labels: new Map(),
    locals: new Map(),
    return: null,
  }
}
