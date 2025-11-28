import * as lir from "@/lir/def"
import type { WithSpan } from "@/parse/span"
import type { Id as IdRaw } from "@/shared/id"
import type { R } from "./enum"

export type Id = WithSpan<IdRaw>

// coercable types
export type TPrim = WithSpan<
  | { k: R.Void; v: null }
  | { k: R.Never; v: null }
  | { k: R.Int; v: null }
  | { k: R.Bool; v: null }
  | { k: R.Extern; v: Id }
>

type __T<K> = WithSpan<
  | TPrim["data"]
  | { k: R.Any; v: null }
  | { k: R.ArrayFixed; v: { el: __T<K>; len: number } }
  | { k: R.ArrayDyn; v: __T<K> }
  | { k: R.Array; v: __T<K> }
  | { k: R.Either; v: { a: __T<K>; b: __T<K> } }
  | K
>

// a type as inputted by the user
export type TTyped = __T<{ k: R.Local; v: Id }>

// a type once named paths are resolved; still has implicit generics
export type Type = __T<never>

// a type which can be exported to MIR
export type TFinal = WithSpan<
  | TPrim["data"]
  | { k: R.ArrayFixed; v: { el: TFinal; len: number } }
  | { k: R.ArrayDyn; v: TFinal }
>

export type Expr = WithSpan<
  | { k: R.Void; v: null }
  | { k: R.Bool; v: boolean }
  | { k: R.Int; v: bigint }
  | { k: R.Len; v: Expr }
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
>

export interface Value {
  k: TFinal
  v: lir.Expr
}

export function kv<const K, V>(k: K, v: V) {
  return { k, v }
}
