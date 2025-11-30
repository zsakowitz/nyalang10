import * as lir from "@/lir/def"
import { at } from "@/parse/span"
import { T } from "@/shared/enum"
import { kv, type TFinal, type TTyped, type Type } from "../def"
import { R } from "../enum"
import { issue } from "../error"
import { type Env } from "./env"

export function resolve(env: Env, ty: TTyped): Type {
  const { k, v } = ty.data

  switch (k) {
    case R.Void:
    case R.Never:
    case R.Int:
    case R.Bool:
    case R.Any:
    case R.Struct:
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
      return at(refd.data, ty.span)
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
    case R.Struct:
      return ty.v.lir
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
