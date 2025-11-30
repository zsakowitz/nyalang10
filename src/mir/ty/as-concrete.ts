import { Reason } from "@/parse/span"
import { bool, int, kv, never, void_, type TFinal, type Type } from "../def"
import { R } from "../enum"
import { issue } from "../error"

export function asConcrete({ data: { k, v }, span }: Type): TFinal {
  switch (k) {
    case R.Void:
      return void_
    case R.Int:
      return int
    case R.Bool:
      return bool
    case R.Struct:
      return kv(R.Struct, v)
    case R.Extern:
      return kv(R.Extern, v)
    case R.Never:
      return never
    case R.Any:
      issue(
        `Expected concrete type, found 'any'.\nhelp: try specifying a type like 'int' or 'bool' instead`,
        span.for(Reason.ExpectedConcreteType),
      )
    case R.ArrayFixed:
      return kv(R.ArrayFixed, { el: asConcrete(v.el), len: v.len })
    case R.ArrayDyn:
      return kv(R.ArrayDyn, asConcrete(v))
    case R.Array:
      issue(
        `Expected concrete type, found '[T]'.\nhelp: maybe you meant 'dyn [T]' or '[T; N]'?`,
        span.for(Reason.ExpectedConcreteType),
      )
    case R.Either:
      issue(
        `Expected concrete type, found type union.\nhelp: try picking one of the types`,
        span.for(Reason.ExpectedConcreteType),
      )
    case R.UnitIn:
      return kv(R.UnitIn, asConcrete(v))
  }
}
