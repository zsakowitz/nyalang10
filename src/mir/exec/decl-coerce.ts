import { ex } from "@/lir/def"
import { Reason } from "@/parse/span"
import { T } from "@/shared/enum"
import { NLError } from "@/shared/error"
import { Id } from "@/shared/id"
import { val, type DeclFn } from "../def"
import { issue } from "../error"
import { asConcrete } from "../ty/as-concrete"
import { ensureCoercible } from "../ty/coerce"
import { anonFn, type } from "./body"
import type { Env } from "./env"

export function pushCoercion(env: Env, fn: DeclFn) {
  if (fn.data.args.length != 1) {
    issue(`Coercions must accept exactly one unnamed parameter.`, fn.span)
  }

  const f = anonFn(env, fn)

  const from = asConcrete(f.args[0]!, "Coercions must accept a concrete type.")
  const into = asConcrete(f.ret, "Coercions must return a concrete type.")

  ensureCoercible(f.args[0]!.span, from)
  ensureCoercible(f.ret.span, into)

  const inputId = fn.data.args[0]!.name.data.fresh()
  const inputVal = val(from, ex(T.Local, inputId), fn.data.args[0]!.name.span)

  let body
  try {
    body = f.exec(env, fn.span, [inputVal], [])
  } catch (e) {
    if (e instanceof NLError) {
      e.with(fn.span, Reason.TraceCoercion)
    }

    throw e
  }

  const fnId = new Id("coercion")
  env.lirDecls.push({
    name: fnId,
    args: [{ name: inputId, type: type(env, from) }],
    ret: type(env, into), // technically, it returns `body.k`, but that equals `into`
    body: body.v,
  })

  env.cx.push(fn.span, {
    from,
    into, // technically, it returns `body.k`, but that equals `into`
    auto: false,
    exec(_, value) {
      return val(into, ex(T.Call, { name: fnId, args: [value.v] }), value.s)
    },
  })
}
