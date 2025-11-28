import { lIce } from "@/lir/error"
import { kv, type Expr, type Type } from "@/mir/def"
import { R } from "@/mir/enum"
import { issue } from "@/mir/error"
import { Id, idFor } from "@/shared/id"
import { any, from, lazy, Parser, seq } from "."
import { at, type WithSpan } from "./span"

const RESERVED =
  "in|fn|struct|union|enum|len|any|int|bool|void|never|num|str|let|mut|const|type|typeof|unreachable|assert|if|else|match|when|switch|case|for|in|true|false|null|none|len"

function kw(x: string) {
  if (!/^[A-Za-z]+$/.test(x)) {
    lIce(`'${x}' is not a valid keyword.`)
  }
  return from(new RegExp("\\b" + x + "\\b", "y"))
}

const bigint = from(/\d+(?!\w)/y).map(BigInt)

const u32 = bigint.span().map(({ data, span }) => {
  if (BigInt.asUintN(32, data) != data) {
    issue(`Expected integer '${data}' to be from 0 to 2^32-1, inclusive.`, span)
  }
  return Number(data)
})

const id = from(
  new RegExp(`\\b(?!(?:${RESERVED})\\b)[A-Za-z][A-Za-z0-9_]*\\b`, "y"),
)
  .map(idFor)
  .span()

const type: Parser<Type> = lazy(() => type_)
const expr: Parser<Expr> = lazy(() => expr_)
const block = seq(["{", expr, "}"]).key(1)

const namedParam = any([
  seq([kw("in"), type]).map((x) => ({
    name: at(new Id("_"), x[1].span),
    type: x[1],
  })),
  seq([id, ":", type]).map((x) => ({ name: x[0], type: x[2] })),
  // todo: make type in `id: type` optional; defaults to 'any'
])

const namedArg = seq([id, ":", expr]).map((x) => ({ name: x[0], value: x[2] }))

const typeOne_ = any<Type["data"]>([
  kw("void").as(kv(R.Void, null)),
  from("!").as(kv(R.Never, null)),
  kw("int").as(kv(R.Int, null)),
  kw("bool").as(kv(R.Bool, null)),
  kw("any").as(kv(R.Any, null)),
  seq(["[", type, seq([";", u32]).opt(), "]"]).map((x) => {
    const el = x[1]
    const len = x[2]?.[1]
    if (len == null) {
      return kv(R.Array, el)
    }
    return kv(R.ArrayFixed, { el, len })
  }),
  seq([kw("dyn"), "[", type, "]"]).map((x) => kv(R.ArrayDyn, x[2])),
]).span()

const type_: Parser<Type> = typeOne_
  .then(seq(["|", type]).opt())
  .map(([a, b]) => (b ? kv(R.Either, { a, b: b[1] }) : a.data))
  .span()

const expr_ = any<Expr["data"]>([
  kw("void").as(kv(R.Void, null)),
  bigint.map((x) => kv(R.Int, x)),
  kw("true").as(kv(R.Bool, true)),
  kw("false").as(kv(R.Bool, false)),
  seq([kw("len"), "(", expr, from(",").opt(), ")"]).map((x) => kv(R.Len, x[2])),
  seq(["[", expr, seq(["=>", expr]).opt(), ";", expr]).map((x) => {
    const el = x[1]
    const snd = x[2]?.[1]
    const len = x[4]
    if (snd == null) {
      return kv(R.ArrayFill, { el, len })
    }
    if (el.data.k != R.Local) {
      issue(
        `Array defined using '[index => expr; len]' notation must have only a single variable used for the index.`,
        el.span,
      )
    }
    return kv(R.ArrayFrom, { bind: el.data.v, el: snd, len })
  }),
  id
    .then(seq(["(", expr.alt(namedArg).sepBy(), ")"]).opt())
    .map(([name, argsRaw]): Expr["data"] => {
      if (argsRaw == null) {
        return kv(R.Local, name)
      }
      const args: Expr[] = []
      const argsNamed: { name: WithSpan<Id>; value: Expr }[] = []
      for (const el of argsRaw[1]) {
        if (el[0] == 0) {
          if (argsNamed.length) {
            issue(
              `Named arguments must be specified after positional arguments.`,
              el[1].span,
            )
          }
          args.push(el[1])
        } else {
          argsNamed.push(el[1])
        }
      }
      return kv(R.Call, { name, args, argsNamed })
    }),
  seq(["(", expr, ")"])
    .key(1)
    .map((x) => x.data),
  block.map((x) => x.data),
]).span()

const fn = seq([
  kw("fn"),
  id,
  "(",
  namedParam.sepBy(","),
  ")",
  type, // todo: make type optional; defaults to 'any'
  block,
]).map((x) => ({
  name: x[1],
  args: x[3],
  ret: x[5],
  body: x[6],
}))

export { expr, fn, type }
