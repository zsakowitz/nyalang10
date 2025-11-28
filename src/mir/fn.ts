import type { Span } from "@/parse/span"
import { NLError } from "@/shared/error"
import { Id } from "@/shared/id"
import type { Type, Value } from "./def"
import type { Env, Scope } from "./env"
import { issue } from "./error"
import { matches } from "./matches"
import { execTx, type Tx } from "./tx"

export interface Fn {
  name: Id
  span: Span
  args: Type[]
  argsNamed: Record<string, Type>
  ret: Type
  exec(env: Env, args: Value[], argsNamed: Record<string, Value>): Value
}

export function tryCall(
  env: Env,
  span: Span,
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

  try {
    return fn.exec(env, argsMapped, namedArgsMapped)
  } catch (e) {
    if (e instanceof NLError) {
      e.push(span)
    }

    throw e
  }
}

export function call(
  scope: Scope,
  span: Span,
  name: Id,
  args: Value[],
  argsNamed: Record<string, Value>,
) {
  const fns = scope.fn.get(name.index) ?? []
  for (const f of fns) {
    const ret = tryCall(scope.env, span, f, args, argsNamed)
    if (ret != null) return ret
  }

  issue(`No matching overload of '${name.debug}' exists.`, span)
}
