import type { Value } from "./def"
import type { Env } from "./exec-env"

// some kind of transformer; used for coercion
export type Tx = true | ((env: Env, value: Value) => Value)

export function execTx(env: Env, tx: Tx, value: Value): Value {
  if (tx === true) {
    return value
  }
  return tx(env, value)
}
