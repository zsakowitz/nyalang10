import { Reason, VSPAN } from "@/parse/span"
import { kvs, type TFinal, type Type } from "../def"
import { R } from "../enum"
import { issue } from "../error"

export function asConcrete(
  { data: { k, v }, span }: Type,
  reason: string,
): TFinal {
  switch (k) {
    case R.Void:
      return kvs(R.Void, null, span)
    case R.Int:
      return kvs(R.Int, null, span)
    case R.Bool:
      return kvs(R.Bool, null, span)
    case R.Struct:
      return kvs(R.Struct, v, span)
    case R.Extern:
      return kvs(R.Extern, v, span)
    case R.FnKnown:
      return kvs(R.FnKnown, v, span)
    case R.Never:
      return kvs(R.Never, null, span)
    case R.Any:
      issue(
        `Expected concrete type, found 'any'.\nnote: ${reason}\nhelp: Try specifying a type like 'int' or 'bool' instead.`,
        span.for(Reason.ExpectedConcreteType),
      )
    case R.ArrayFixed:
      return kvs(
        R.ArrayFixed,
        { el: asConcrete(v.el, reason), len: v.len },
        span,
      )
    case R.ArrayDyn:
      return kvs(R.ArrayDyn, asConcrete(v, reason), span)
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
      return kvs(R.UnitIn, asConcrete(v, reason), span)
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
    case R.FnKnown:
      return ty
    case R.Any:
      return kvs(R.Never, null, VSPAN)
    case R.ArrayFixed:
      return kvs(
        R.ArrayFixed,
        {
          el: getTrivialSubtype(ty.v.el),
          len: ty.v.len,
        },
        VSPAN,
      )
    case R.ArrayDyn:
      return kvs(R.ArrayDyn, getTrivialSubtype(ty.v), VSPAN)
    case R.Array:
      return kvs(R.ArrayFixed, { el: getTrivialSubtype(ty.v), len: 0 }, VSPAN)
    case R.Either:
      return getTrivialSubtype(ty.v.a)
    case R.UnitIn:
      return kvs(R.UnitIn, getTrivialSubtype(ty.v), VSPAN)
  }
}
