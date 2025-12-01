import { Reason } from "@/parse/span"
import { bool, int, kv, never, void_, type TFinal, type Type } from "../def"
import { R } from "../enum"
import { issue } from "../error"

export function asConcrete(
  { data: { k, v }, span }: Type,
  reason: string,
): TFinal {
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
        `Expected concrete type, found 'any'.\nnote: ${reason}\nhelp: Try specifying a type like 'int' or 'bool' instead.`,
        span.for(Reason.ExpectedConcreteType),
      )
    case R.ArrayFixed:
      return kv(R.ArrayFixed, { el: asConcrete(v.el, reason), len: v.len })
    case R.ArrayDyn:
      return kv(R.ArrayDyn, asConcrete(v, reason))
    case R.Array:
      issue(
        `Expected concrete type, found '[T]'.\nnote: ${reason}\nhelp: Maybe you meant 'dyn [T]' or '[T; N]'?`,
        span.for(Reason.ExpectedConcreteType),
      )
    case R.Either:
      issue(
        `Expected concrete type, found type union.\nnote: ${reason}\nhelp: try picking one of the types`,
        span.for(Reason.ExpectedConcreteType),
      )
    case R.UnitIn:
      return kv(R.UnitIn, asConcrete(v, reason))
  }
}

/**
 * Returns some `TFinal` assignable to the input `Type`. As of 2025-11-30, this
 * is only used for the implicit coercion from `[!; 0]` to other possibly-empty
 * array types.
 *
 * Special cases:
 *
 * - If the input type is `[T; 0]` or `[T]`, the return type will be `[some type;
 *   0]`, which is constructible via `T.ArrayElements`.
 * - If the input type is `dyn [T]`, the return type will be `dyn [some type]`,
 *   which is constructible via `T.DynArrayElements`.
 */
export function getTrivialSubtype({ data: ty }: Type): TFinal {
  switch (ty.k) {
    case R.Void:
    case R.Int:
    case R.Bool:
    case R.Struct:
    case R.Extern:
    case R.Never:
      return ty
    case R.Any:
      return never
    case R.ArrayFixed:
      return kv(R.ArrayFixed, {
        el: getTrivialSubtype(ty.v.el),
        len: ty.v.len,
      })
    case R.ArrayDyn:
      return kv(R.ArrayDyn, getTrivialSubtype(ty.v))
    case R.Array:
      return kv(R.ArrayFixed, { el: getTrivialSubtype(ty.v), len: 0 })
    case R.Either:
      return getTrivialSubtype(ty.v.a)
    case R.UnitIn:
      return kv(R.UnitIn, getTrivialSubtype(ty.v))
  }
}
