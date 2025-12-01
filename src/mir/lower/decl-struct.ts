import { ex, ty } from "@/lir/def"
import { at, Reason, Span } from "@/parse/span"
import { T } from "@/shared/enum"
import { Id } from "@/shared/id"
import {
  kv,
  val,
  type DeclStruct,
  type Struct,
  type TFinal,
  type Type,
} from "../def"
import { R } from "../enum"
import { issue } from "../error"
import { asConcrete } from "../ty/as-concrete"
import type { FnNamed } from "./call"
import { pushFn, setTy, type Env } from "./env"
import { resolve, type } from "./exec-ty"

export function declStruct(
  env: Env,
  { data: { name: nameRaw, fields: fieldsRaw }, span }: DeclStruct,
) {
  const name = at(nameRaw.data.fresh(), nameRaw.span)
  const namedId = nameRaw.data.fresh()

  const struct: Struct = {
    name,
    fields: null!,
    lir: ty(T.Named, namedId),
  }

  const structTy: Type = at(kv(R.Struct, struct), nameRaw.span)

  setTy(env, span, nameRaw, structTy)

  const fieldsUsed = new Map<number, Span>()
  const fields: [Id, TFinal, Type][] = []
  for (let i = 0; i < fieldsRaw.length; i++) {
    const { name, type: ttyped } = fieldsRaw[i]!

    if (fieldsUsed.has(name.data.index)) {
      issue(
        `Cannot declare field '${name.data.name}' twice in struct '${name.data.name}'.`,
        fieldsUsed
          .get(name.data.index)!
          .for(Reason.DuplicateField)
          .with(name.span.for(Reason.DuplicateField)),
      )
    }

    const type = resolve(env, ttyped)
    const tfinal = asConcrete(type, "Struct fields must be concrete types.")
    fields.push([name.data, tfinal, type])
  }

  env.g.lt.push({
    name: namedId,
    body: ty(
      T.Tuple,
      fields.map((x) => type(env, x[1])),
    ),
  })

  struct.fields = fields.map((x) => x[1])

  const cons: FnNamed = {
    name: nameRaw.data,
    span,
    args: fields.map((x) => x[2]),
    argsNamed: [],
    ret: structTy,
    exec(_, span, args) {
      return val(
        kv(R.Struct, struct),
        ex(T.Wrap, {
          target: ex(
            T.Tuple,
            args.map((x) => x.v),
          ),
          with: namedId,
        }),
        span,
      )
    },
    checked: true,
  }

  const accessors: FnNamed[] = fields.map(([name, tfinal, type], i) => ({
    name,
    span,
    args: [structTy],
    argsNamed: [],
    ret: type,
    exec(_, span, args) {
      return val(
        tfinal,
        ex(T.TupleIndex, { target: ex(T.Unwrap, args[0]!.v), index: i }),
        span,
      )
    },
    checked: true,
  }))

  pushFn(env, cons)
  accessors.forEach((x) => pushFn(env, x))
}
