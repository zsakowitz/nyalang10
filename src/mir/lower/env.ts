import type { Decl, DeclNamed } from "@/lir/def"
import type { Span, WithSpan } from "@/parse/span"
import type { Id } from "@/shared/id"
import type { NumData, TFinal, Type } from "../def"
import { issue } from "../error"
import { Coercions } from "../ty/coerce"
import type { Fn, FnNamed } from "./call"

export interface ILocal {
  mut: boolean
  ty: TFinal
  value: Id // the ID used in LIR for this local
  def: Span
}

export interface EnvGlobals {
  cx: Coercions
  lf: Decl[]
  lt: DeclNamed[]

  num: {
    extern: Id
    from(data: NumData): unknown // used as the data to T.Opaque when turned into LIR
  } | null
  str: {
    extern: Id
    from(data: string): unknown
  } | null
}

export interface Env {
  g: EnvGlobals
  fn: Map<number, Fn[]>
  ty: Map<number, Type>
  vr: Map<number, ILocal>
  ret: Type | null
}

export function env(): Env {
  return {
    g: { cx: new Coercions(), lf: [], lt: [], num: null, str: null },
    fn: new Map(),
    ty: new Map(),
    vr: new Map(),
    ret: null,
  }
}

export function pushFn(env: Env, fn: FnNamed) {
  const i = fn.name.index
  let el = env.fn.get(i)
  if (!el) {
    el = []
    env.fn.set(i, el)
  }
  el.push(fn)
}

export function setTy(env: Env, span: Span, name: WithSpan<Id>, ty: Type) {
  if (env.ty.has(name.data.index)) {
    issue(`Cannot declare type '${name.data.name}' twice.`, span)
  }

  env.ty.set(name.data.index, ty)
}

export function forkLocals(env: Env): Env {
  return {
    g: env.g,
    fn: env.fn,
    ty: env.ty,
    vr: new Map(env.vr),
    ret: env.ret,
  }
}

export function forkForDecl(env: Env, ret: Type | null): Env {
  return {
    g: env.g,
    fn: env.fn,
    ty: env.ty,
    vr: new Map(),
    ret,
  }
}
