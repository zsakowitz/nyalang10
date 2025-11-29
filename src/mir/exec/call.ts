import { Reason, type Span } from "@/parse/span"
import { NLError } from "@/shared/error"
import { Id } from "@/shared/id"
import type { Type, Value } from "../def"
import { issue } from "../error"
import { matches } from "../ty/matches"
import type { Env } from "./env"
import { execTx, type Tx } from "./tx"

export interface Fn<N extends Id | null = Id | null> {
  name: N
  span: Span
  args: Type[]
  argsNamed: Record<number, Type>
  ret: Type
  exec(
    env: Env,
    span: Span,
    args: Value[],
    argsNamed: Record<number, Value>,
  ): Value
}

export type FnNamed = Fn<Id>

export function tryCall(
  env: Env,
  span: Span,
  fn: Fn,
  args: Value[],
  namedArgs: Record<number, Value>,
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
    return fn.exec(env, span, argsMapped, namedArgsMapped)
  } catch (e) {
    if (e instanceof NLError) {
      e.with(span, Reason.Trace)
    }

    throw e
  }
}

export function call(
  env: Env,
  span: Span,
  name: Id | null,
  fns: readonly Fn[],
  args: Value[],
  argsNamed: Record<number, Value>,
): Value {
  for (const f of fns) {
    const ret = tryCall(env, span, f, args, argsNamed)
    if (ret != null) return ret
  }

  issue(
    name ?
      `'${name.name}' cannot be called with these arguments.`
    : `This function cannot be called with these arguments.`,
    span.for(Reason.TraceStart),
  )
}
