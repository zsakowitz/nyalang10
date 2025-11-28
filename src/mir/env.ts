import type { Id } from "@/shared/id"
import { Coercions } from "./coerce"
import type { Type, Value } from "./def"
import { matches } from "./matches"
import { execTx, type Tx } from "./tx"

export class Env {
  declare private __env

  readonly cx = new Coercions()
}

export interface Fn {
  name: Id
  args: Type[]
  argsNamed: Record<string, Type>
  ret: Type
  exec(env: Env, args: Value[], argsNamed: Record<string, Value>): Value
}

export function tryCall(
  env: Env,
  fn: Fn,
  args: Value[],
  namedArgs: Record<string, Value>,
): Value | null {
  if (args.length != fn.args.length) {
    return null
  }

  const argTx: Tx[] = []
  for (let i = 0; i < args.length; i++) {
    const tx = matches(env.cx, args[i]!.k, fn.args[i]!)
    if (!tx) return null
    argTx.push(tx)
  }

  const namedArgTx: Record<string, Tx> = Object.create(null)
  for (const key in namedArgs) {
    if (!(key in fn.argsNamed)) {
      return null
    }

    const tx = matches(env.cx, namedArgs[key]!.k, fn.argsNamed[key]!)
    if (!tx) return null
    namedArgTx[key] = tx
  }

  const argsMapped = []
  for (let i = 0; i < args.length; i++) {
    argsMapped.push(execTx(env, argTx[i]!, args[i]!))
  }

  const namedArgsMapped = Object.create(null)
  for (const key in namedArgs) {
    namedArgsMapped[key] = execTx(env, namedArgTx[key]!, namedArgs[key]!)
  }

  return fn.exec(env, argsMapped, namedArgsMapped)
}
