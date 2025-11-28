import type { Coercions } from "./coerce"
import type { TFinal, TPrim, Type } from "./def"
import { R } from "./enum"
import type { Tx } from "./tx"

// arrays and other nested types explicitly cannot be coerced into one another
export function matches(
  cx: Coercions | null,
  given: TFinal,
  expected: Type,
): Tx | false {
  const { k: sk, v: sv } = given
  const { k: dk, v: dv } = expected.data

  if (dk == R.Any) {
    return true
  }

  if (dk == R.Either) {
    return matches(cx, given, dv.a) || matches(cx, given, dv.b)
  }

  if (cx && sk <= R.Extern && dk <= R.Extern) {
    return cx.get(given as TPrim, expected.data as TPrim)
  }

  switch (sk) {
    case R.Void:
    case R.Never:
    case R.Int:
    case R.Bool:
      return dk == sk
    case R.Extern:
      return dk == R.Extern && sv == dv
    case R.ArrayFixed:
      return (
        dk == R.ArrayFixed ? sv.len == dv.len && matches(null, sv.el, dv.el)
        : dk == R.Array ? matches(null, sv.el, dv)
        : false
      )
    case R.ArrayDyn:
      return (dk == R.ArrayDyn || dk == R.Array) && matches(null, sv, dv)
  }
}
