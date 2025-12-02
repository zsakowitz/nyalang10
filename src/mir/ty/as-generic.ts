import { vspan } from "@/parse/span"
import { kv, kvs, type TFinal, type Type } from "../def"
import { R } from "../enum"

export function asGeneric(ty: TFinal): Type {
  switch (ty.k) {
    case R.Void:
    case R.Int:
    case R.Bool:
    case R.Struct:
    case R.Extern:
    case R.Never:
      return vspan(ty)
    case R.ArrayFixed:
      return vspan(kv(R.ArrayFixed, { el: asGeneric(ty.v.el), len: ty.v.len }))
    case R.ArrayDyn:
      return vspan(kv(R.ArrayDyn, asGeneric(ty.v)))
    case R.UnitIn:
      return vspan(kv(R.UnitIn, asGeneric(ty.v)))
    case R.FnKnown:
      return vspan(kvs(R.FnKnown, ty.v, ty.s))
  }
}
