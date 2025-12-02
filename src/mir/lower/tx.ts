import { ex } from "@/lir/def"
import { T } from "@/shared/enum"
import { kvs, val, type TFinal, type Value } from "../def"
import { R } from "../enum"
import type { Env } from "./env"
import { type } from "./exec-ty"

// some kind of transformer; used for coercion
export type Tx = true | { into: TFinal; exec(env: Env, value: Value): Value }

export function execTx(env: Env, tx: Tx, value: Value): Value {
  if (tx === true) {
    return value
  }
  return tx.exec(env, value)
}

export function castNever(into: TFinal): Tx {
  return {
    into,
    exec(env, value) {
      return val(
        into,
        ex(
          T.CastNever,
          {
            target: value.v,
            into: type(env, into),
          },
          value.s,
        ),
        value.s,
      )
    },
  }
}

/** Turns a `Tx` of `T -> U` into a `Tx` of `in T -> in U`. */
export function txForUnitIn(tx: Tx): Tx {
  if (tx === true) return true

  return {
    into: kvs(R.UnitIn, tx.into, tx.into.s),
    exec(_, value) {
      return val(
        kvs(R.UnitIn, tx.into, tx.into.s),
        ex(T.Block, [], value.s),
        value.s,
      )
    },
  }
}
