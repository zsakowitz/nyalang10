import { ex } from "@/lir/def"
import { T } from "@/shared/enum"
import {
  kv,
  kvs,
  val,
  type TCoercable,
  type TFinal,
  type TFinalV,
  type Type,
} from "../def"
import { R } from "../enum"
import { type } from "../lower/exec-ty"
import type { Tx } from "../lower/tx"
import { getTrivialSubtype } from "./as-concrete"
import type { Coercions } from "./coerce"

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
    return cx.get(given as TCoercable, expected.data as TCoercable)
  }

  if (
    cx
    && sk == R.ArrayFixed
    && sv.el.k == R.Never
    && sv.len == 0
    && (dk == R.Array
      || (dk == R.ArrayFixed && dv.len == 0)
      || dk == R.ArrayDyn)
  ) {
    const into = getTrivialSubtype(expected)
    const elTy = into.k == R.ArrayFixed ? into.v.el : (into.v as TFinal)
    const k = dk == R.ArrayDyn ? T.DynArrayElements : T.ArrayElements
    return {
      into,
      exec(env, value) {
        return val(
          into,
          ex(k, { elTy: type(env, elTy), els: [] }, value.s),
          value.s,
        )
      },
    }
  }

  if (cx && sk == R.ArrayFixed && dk == R.ArrayDyn) {
    return (
      matches(null, sv.el, dv) && {
        into: kvs(R.ArrayDyn, sv.el, expected.span),
        exec(_, value) {
          return val(
            kvs(R.ArrayDyn, sv.el, expected.span),
            ex(T.DynArrayOf, value.v, value.s),
            value.s,
          )
        },
      }
    )
  }

  switch (sk) {
    case R.Void:
    case R.Never:
    case R.Int:
    case R.Bool:
      return dk == sk
    case R.Struct:
    case R.Extern:
      return dk == sk && sv == dv
    case R.ArrayFixed:
      // NOTE: `matches` only returns a non-identity `Tx` when `cx != null`, so it's fine to directly return this
      return (
        dk == R.ArrayFixed ? sv.len == dv.len && matches(null, sv.el, dv.el)
        : dk == R.Array ? matches(null, sv.el, dv)
        : false
      )
    case R.ArrayDyn:
      // NOTE: `matches` only returns a non-identity `Tx` when `cx != null`, so it's fine to directly return this
      return (dk == R.ArrayDyn || dk == R.Array) && matches(null, sv, dv)
    case R.UnitIn:
      const r = dk == R.UnitIn && matches(cx, sv, dv)
      if (r === false) return false
      if (r === true) return true
      return {
        into: kvs(R.UnitIn, r.into, expected.span),
        exec(_, value) {
          return val(
            kvs(R.UnitIn, r.into, expected.span),
            ex(T.Block, [], value.s),
            value.s,
          )
        },
      }
    case R.FnKnown:
      // todo: allow requiring specific overloads
      return dk == R.FnKnown && sv.hash == dv.hash
  }
}

export function matchesFinal(
  cx: Coercions | null,
  given: TFinal,
  expected: TFinal,
): Tx | false {
  const { k: sk, v: sv } = given
  const { k: dk, v: dv } = expected

  if (cx && sk <= R.Extern && dk <= R.Extern) {
    return cx.get(given as TCoercable, expected as TCoercable)
  }

  if (
    cx
    && sk == R.ArrayFixed
    && sv.el.k == R.Never
    && sv.len == 0
    && ((dk == R.ArrayFixed && dv.len == 0) || dk == R.ArrayDyn)
  ) {
    const elTy =
      expected.k == R.ArrayFixed ? expected.v.el : (expected.v as TFinal)
    const k = dk == R.ArrayDyn ? T.DynArrayElements : T.ArrayElements
    return {
      into: expected,
      exec(env, value) {
        return val(
          expected,
          ex(k, { elTy: type(env, elTy), els: [] }, value.s),
          value.s,
        )
      },
    }
  }

  if (dk != sk) {
    return false
  }

  switch (sk) {
    case R.Void:
    case R.Never:
    case R.Int:
    case R.Bool:
      return true
    case R.Struct:
    case R.Extern:
      return sv == dv
    case R.ArrayFixed:
      return (
        sv.len == (dv as TFinalV<R.ArrayFixed>).len
        && matchesFinal(null, sv.el, (dv as TFinalV<R.ArrayFixed>).el)
      )
    case R.ArrayDyn:
      return matchesFinal(null, sv, dv as TFinalV<R.ArrayDyn>)
    case R.UnitIn:
      const r = matchesFinal(cx, sv, dv as TFinalV<R.UnitIn>)
      if (r === false) return false
      if (r === true) return true
      return {
        into: kvs(R.UnitIn, r.into, expected.s),
        exec(_, value) {
          return val(
            kvs(R.UnitIn, r.into, expected.s),
            ex(T.Block, [], value.s),
            value.s,
          )
        },
      }
    case R.FnKnown:
      // todo: allow requiring specific overloads
      return sv.hash == (dv as TFinalV<R.FnKnown>).hash
  }
}
