import { at } from "@/parse/span"
import { kv, type TTyped, type Type } from "./def"
import { R } from "./enum"
import type { Env } from "./env"
import { issue } from "./error"

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
  }
}
