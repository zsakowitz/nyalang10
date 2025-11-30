import type { Decl } from "@/lir/def"
import type { Span, WithSpan } from "@/parse/span"
import type { Id } from "@/shared/id"
import type { TFinal, Type } from "../def"
import { issue } from "../error"
import { Coercions } from "../ty/coerce"
import type { Fn, FnNamed } from "./call"

export interface ILocal {
  mut: boolean
  ty: TFinal
  value: Id // the ID used in LIR for this local
  def: Span
}

export interface Env {
  cx: Coercions
  fn: Map<number, Fn[]>
  ty: Map<number, Type>
  vr: Map<number, ILocal>

  lirDecls: Decl[]
}

export function env(): Env {
  return {
    cx: new Coercions(),
    fn: new Map(),
    ty: new Map(),
    vr: new Map(),
    lirDecls: [],
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
    cx: env.cx,
    fn: env.fn,
    ty: env.ty,
    vr: new Map(env.vr),
    lirDecls: env.lirDecls,
  }
}

export function forkForDecl(env: Env): Env {
  return {
    cx: env.cx,
    fn: env.fn,
    ty: env.ty,
    vr: new Map(),
    lirDecls: env.lirDecls,
  }
}
