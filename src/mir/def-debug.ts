import type { TFinal, Type } from "./def"
import { R } from "./enum"

export function printType({ data: { k, v } }: Type): string {
  switch (k) {
    case R.Void:
      return "void"
    case R.Int:
      return "int"
    case R.Bool:
      return "bool"
    case R.Extern:
      return v.data.name
    case R.Never:
      return "!"
    case R.Any:
      return "any"
    case R.ArrayFixed:
      return `[${printType(v.el)}; ${v.len}]`
    case R.ArrayDyn:
      return `dyn [${printType(v)}]`
    case R.Array:
      return `[${printType(v)}]`
    case R.Either:
      return `${printType(v.a)} | ${printType(v.b)}`
    case R.UnitIn:
      return `in ${printType(v)}`
  }
}

export function printTFinal({ k, v }: TFinal): string {
  switch (k) {
    case R.Void:
      return "void"
    case R.Int:
      return "int"
    case R.Bool:
      return "bool"
    case R.Extern:
      return v.data.name
    case R.Never:
      return "!"
    case R.ArrayFixed:
      return `[${printTFinal(v.el)}; ${v.len}]`
    case R.ArrayDyn:
      return `dyn [${printTFinal(v)}]`
    case R.UnitIn:
      return `in ${printTFinal(v)}`
  }
}
