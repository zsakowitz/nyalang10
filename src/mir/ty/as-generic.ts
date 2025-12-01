import { VSPAN, vspan } from "@/parse/span"
import { kv, type TFinal, type Type } from "../def"
import { R } from "../enum"
import { ice } from "../error"

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
      ice("Function types cannot be represented in text.", VSPAN)
  }
}
