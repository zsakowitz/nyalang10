import { Reason, type Span } from "@/parse/span"
import { blue, bold, quote, reset, yellow } from "@/shared/ansi"
import { NLError } from "@/shared/error"
import { Id } from "@/shared/id"
import type { Type, Value } from "../def"
import { printTFinal } from "../def-debug"
import { issue } from "../error"
import { matches } from "../ty/matches"
import type { Env } from "./env"
import { execTx, type Tx } from "./tx"

export interface Fn<N extends Id | null = Id | null> {
  name: N
  span: Span
  args: Type[]
  argsNamed: [number, Type][]
  ret: Type
  exec(env: Env, span: Span, args: Value[], argsNamed: [number, Value][]): Value
}

export type FnNamed = Fn<Id>

export function tryCall(
  env: Env,
  span: Span,
  fn: Fn,
  args: Value[],
  argsNamed: [number, Value][],
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

  const argNamedTx: Tx[] = []
  for (let i = 0; i < argsNamed.length; i++) {
    const [k, v] = argsNamed[i]!

    const expected = fn.argsNamed.find((x) => x[0] == k)
    if (!expected) {
      return null
    }

    const tx = matches(env.cx, v.k, expected[1])
    if (!tx) return null
    argNamedTx.push(tx)
  }

  const argsMapped = []
  for (let i = 0; i < args.length; i++) {
    argsMapped.push(execTx(env, argTx[i]!, args[i]!))
  }

  const namedArgsMapped: [number, Value][] = []
  for (let i = 0; i < argsNamed.length; i++) {
    const [k, v] = argsNamed[i]!
    namedArgsMapped.push([k, execTx(env, argNamedTx[i]!, v)])
  }

  try {
    return fn.exec(env, span, argsMapped, namedArgsMapped)
  } catch (e) {
    if (e instanceof RangeError && e.message.includes("stack size")) {
      issue(
        `Function calls are nested too deeply.\nhelp: Recursive functions are not supported yet.\nhelp: Make sure no function calls itself.`,
        span.for(Reason.Trace),
      )
    }

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
  argsNamed: [number, Value][],
): Value {
  for (const f of fns) {
    const ret = tryCall(env, span, f, args, argsNamed)
    if (ret != null) return ret
  }

  issue(
    (name ? quote(name.name, yellow) : `This function`)
      + " cannot be called with "
      + (args.length == 0 ?
        "no arguments"
      : args.map((x) => quote(printTFinal(x.k), blue)).join(", "))
      + (argsNamed.length ? " and some named arguments" : ""),
    span.for(Reason.TraceStart),
  )
}
