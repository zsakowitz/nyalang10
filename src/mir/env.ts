import type { Id } from "@/shared/id"
import { Coercions } from "./coerce"
import type { TFinal, Type } from "./def"
import type { Fn } from "./fn"

export interface ILocal {
  mut: boolean
  ty: TFinal
  value: Id // the ID used in LIR for this local
}

export interface Env {
  cx: Coercions
  fn: Map<number, Fn[]>
  ty: Map<number, Type>
  vr: Map<number, ILocal>
}

export function env(): Env {
  return {
    cx: new Coercions(),
    fn: new Map(),
    ty: new Map(),
    vr: new Map(),
  }
}

export function forkLocals(env: Env): Env {
  return {
    cx: env.cx,
    fn: env.fn,
    ty: env.ty,
    vr: new Map(env.vr),
  }
}

export function forkForDecl(env: Env): Env {
  return {
    cx: env.cx,
    fn: new Map(Array.from(env.fn).map(([k, v]) => [k, v.slice()])),
    ty: new Map(env.ty),
    vr: new Map(),
  }
}
