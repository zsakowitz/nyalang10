import * as lir from "@/lir/def"
import type { Span, WithSpan } from "@/parse/span"
import type { Id as IdRaw } from "@/shared/id"
import { R } from "./enum"

export type Id = WithSpan<IdRaw>

// coercable types
export type TCoercable =
  | { k: R.Void; v: null }
  | { k: R.Int; v: null }
  | { k: R.Bool; v: null }
  | { k: R.Extern; v: Id }

// primitive types
export type TPrim = TCoercable | { k: R.Never; v: null }

type __T<K> = WithSpan<
  | TCoercable
  | { k: R.Never; v: null }
  | { k: R.Any; v: null }
  | { k: R.ArrayFixed; v: { el: __T<K>; len: number } }
  | { k: R.ArrayDyn; v: __T<K> }
  | { k: R.Array; v: __T<K> }
  | { k: R.Either; v: { a: __T<K>; b: __T<K> } }
  | { k: R.UnitIn; v: __T<K> }
  | K
>

// a type as inputted by the user
export type TTyped = __T<{ k: R.Local; v: Id }>

// a type once named paths are resolved; still has implicit generics
export type Type = __T<never>

// a type which can be exported to MIR
export type TFinal =
  | TCoercable
  | { k: R.Never; v: null }
  | { k: R.ArrayFixed; v: { el: TFinal; len: number } }
  | { k: R.ArrayDyn; v: TFinal }
  | { k: R.UnitIn; v: TFinal }

export type Expr = WithSpan<
  | { k: R.Void; v: null }
  | { k: R.Bool; v: boolean }
  | { k: R.Int; v: bigint }
  | { k: R.ArrayFill; v: { el: Expr; len: Expr } }
  | { k: R.ArrayFrom; v: { bind: Id; el: Expr; len: Expr } }
  | { k: R.Local; v: Id }
  | {
      k: R.Call
      v: {
        name: Id
        args: Expr[]
        argsNamed: { name: Id; value: Expr }[]
      }
    }
  | { k: R.Index; v: { target: Expr; index: Expr } }
  | { k: R.Typeof; v: Expr }
>

export interface Value {
  k: TFinal
  v: lir.Expr
  s: Span
}

export function val(k: TFinal, v: lir.Expr, s: Span): Value {
  return { k, v, s }
}

export function kv<const K, V>(k: K, v: V) {
  return { k, v }
}

export const void_: TCoercable = kv(R.Void, null)
export const never: TPrim = kv(R.Never, null)
export const int: TCoercable = kv(R.Int, null)
export const bool: TCoercable = kv(R.Bool, null)

export type DeclFn = WithSpan<{
  name: Id
  args: { name: Id; type: TTyped }[]
  ret: TTyped
  body: Expr
}>
