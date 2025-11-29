import { lIce } from "@/lir/error"
import { kv, type DeclFnNamed, type Expr, type TTyped } from "@/mir/def"
import { R } from "@/mir/enum"
import { issue } from "@/mir/error"
import { Id, idFor } from "@/shared/id"
import { any, from, lazy, Parser, seq } from "."
import { at, type WithSpan } from "./span"

const RESERVED =
  "in|fn|struct|union|enum|any|int|bool|void|never|num|str|let|mut|const|type|typeof|unreachable|assert|if|else|match|when|switch|case|for|in|true|false|null|none"

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

const ID_REGEX = new RegExp(
  `\\b(?!(?:${RESERVED})\\b)[A-Za-z][A-Za-z0-9_]*\\b`,
  "y",
)

const id = from(ID_REGEX).map(idFor).span()

const PUNC_BINARY = /\*>|<\*|\*\*|\+>|<\+|\+\+|[=<!>]=|[+\-/^*%&|~<>]/y
const PUNC_UNARY_PREFIX = /[-+!]/y // we still want some dedicated 1/x symbol, akin to 0-x. `/` is a possible candidate

const idOrSym = from(
  new RegExp(
    ID_REGEX.source + "|" + PUNC_BINARY.source + "|" + PUNC_UNARY_PREFIX.source,
    "y",
  ),
)
  .map(idFor)
  .span()

const type: Parser<TTyped> = lazy(() => type_)

const expr: Parser<Expr> = lazy(() => exprWithOps_)

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

const typeOne_ = any<TTyped["data"]>([
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
  id.map((x) => kv(R.Local, x)),
]).span()

const type_: Parser<TTyped> = typeOne_
  .then(seq(["|", type]).opt())
  .map(([a, b]) => (b ? kv(R.Either, { a, b: b[1] }) : a.data))
  .span()

const exprArray = seq(["[", expr, seq(["=>", expr]).opt(), ";", expr, "]"]).map(
  (x) => {
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
  },
)

const fnArgs = seq(["(", expr.alt(namedArg).sepBy(), ")"]).map((raw) => {
  const args: Expr[] = []
  const argsNamed: { name: WithSpan<Id>; value: Expr }[] = []
  for (const el of raw[1]) {
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
  return { args, argsNamed }
})

const exprParen = seq(["(", expr, ")"])
  .key(1)
  .map((x) => x.data)

const exprUnitIn = kw("in")
  .skipThen(kw("typeof"))
  .skipThen(expr)
  .map((x): Expr["data"] => kv(R.Typeof, x))

function local(name: WithSpan<Id>): Expr {
  return at(kv(R.Local, name), name.span)
}

const expr_ = any<Expr["data"]>([
  kw("void").as(kv(R.Void, null)),
  bigint.map((x) => kv(R.Int, x)),
  kw("true").as(kv(R.Bool, true)),
  kw("false").as(kv(R.Bool, false)),
  exprArray,
  id.map((x) => kv(R.Local, x)),
  exprParen,
  block.map((x) => x.data),
  exprUnitIn,
])
  .span()
  .suffixedBySpan([
    seq(["[", expr, "]"]).map(
      (index) =>
        (target): Expr["data"] =>
          kv(R.Index, { target, index: index[1] }),
    ),
    seq([".", id, fnArgs.opt()]).map(
      ([, name, args]) =>
        (arg0): Expr["data"] => {
          const target: Expr = local(name)

          if (args) {
            args.args.unshift(arg0)
            return kv(R.Call, {
              target,
              args: args.args,
              argsNamed: args.argsNamed,
            })
          } else {
            return kv(R.Call, {
              target,
              args: [arg0],
              argsNamed: [],
            })
          }
        },
    ),
    fnArgs.map(
      (a) =>
        (target): Expr["data"] =>
          kv(R.Call, { target, args: a.args, argsNamed: a.argsNamed }),
    ),
  ])

const exprWithUnary = from(PUNC_UNARY_PREFIX)
  .map(idFor)
  .span()
  .many()
  .then(expr_)
  .map(([a, b]) =>
    a.reduceRight(
      (arg, op) =>
        op.data.name == "+" ?
          at(arg.data, arg.span.join(op.span))
        : at(
            kv(R.Call, {
              target: local(op),
              args: [arg],
              argsNamed: [],
            }),
            arg.span.join(op.span),
          ),
      b,
    ),
  )

const exprWithOps_ = exprWithUnary
  .then(seq([from(PUNC_BINARY).map(idFor).span(), exprWithUnary]).opt())
  .map(([arg, op]): Expr => {
    if (op == null) return arg
    return at(
      kv(R.Call, {
        target: local(op[0]),
        args: [arg, op[1]],
        argsNamed: [],
      }),
      arg.span.join(op[1].span),
    )
  })

const fn: Parser<DeclFnNamed> = seq([
  kw("fn"),
  idOrSym,
  "(",
  namedParam.sepBy(","),
  ")",
  type, // todo: make type optional; defaults to 'any'
  block,
])
  .map((x) => ({ name: x[1], args: x[3], ret: x[5], body: x[6] }))
  .span()

export { expr, fn, type }
