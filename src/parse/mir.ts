import { lIce } from "@/lir/error"
import {
  kv,
  type DeclFn,
  type DeclFnNamed,
  type DeclStruct,
  type Expr,
  type NumData,
  type Stmt,
  type TTyped,
} from "@/mir/def"
import { R } from "@/mir/enum"
import { issue } from "@/mir/error"
import { nextHash } from "@/mir/ty/hash"
import { Id, idFor } from "@/shared/id"
import { always, any, from, lazy, NO_NL, Parser, seq, type ParserLike } from "."
import { at, type WithSpan } from "./span"

const RESERVED =
  "nan|inf|coercion|in|fn|struct|union|enum|any|int|bool|void|never|let|mut|const|type|typeof|unreachable|assert|if|else|match|when|switch|case|for|in|true|false|null|none"

function kw(x: string) {
  if (!/^[A-Za-z]+$/.test(x)) {
    lIce(`'${x}' is not a valid keyword.`)
  }
  return from(new RegExp("\\b" + x + "\\b", "y"))
}

const bigint = from(/\d+(?!\w|\.\d)/y).map(BigInt)

const num = from(/\d+(?=[.e])(\.\d+)?(e[+-]?\d+)?|inf|nan/y).map(
  (x): NumData => ({
    raw: x,
    f64:
      x == "inf" ? 1 / 0
      : x == "nan" ? 0 / 0
      : Number(x),
  }),
)

const str = from(
  /"(?:[^\\"\x00-\x1f\x7f]|\\x[0-9A-Fa-f][0-9A-Fa-f]|\\u\{[0-9A-Fa-f]+\}|\\u[0-9A-Fa-f]{4}|\\["\\nrtbf/])*"/y,
).map((x) => {
  let ret = ""
  const end = x.length - 1

  for (let i = 1; i < end; i++) {
    if (x[i] != "\\") {
      ret += x[i]
      continue
    }

    switch (x[i + 1]) {
      case "/":
        ret += "/"
        i++
        break
      case "n":
        ret += "\n"
        i++
        break
      case "b":
        ret += "\b"
        i++
        break
      case "f":
        ret += "\f"
        i++
        break
      case "r":
        ret += "\r"
        i++
        break
      case "t":
        ret += "\t"
        i++
        break
      case '"':
      case "\\":
        ret += x[i + 1]
        i++
        break
      case "x":
        ret += String.fromCodePoint(parseInt(x.slice(i + 2, i + 4), 16))
        i += 3
        break
      case "u":
        if (x[i + 2] == "{") {
          i += 3
          let n = 0
          while (x[i] != "}") {
            n = 16 * n + parseInt(x[i]!, 16)
            i++
          }
          ret += String.fromCodePoint(n)
        } else {
          ret += String.fromCodePoint(parseInt(x.slice(i + 2, i + 4), 16))
          i += 6
        }
        break
    }
  }

  return ret
})

const u32 = bigint.span().map(({ data, span }) => {
  if (BigInt.asUintN(32, data) != data) {
    issue(`Expected integer '${data}' to be from 0 to 2^32-1, inclusive.`, span)
  }
  return Number(data)
})

const ID_REGEX = new RegExp(
  `\\b(?!(?:${RESERVED})\\b)(?:[A-Za-z][A-Za-z0-9_]*|_[A-Za-z0-9_]+)\\b`,
  "y",
)

const id = from(ID_REGEX).map(idFor).span()

const PUNC_BINARY = /\*\*|\+\+|[=<!>]=|[+\-/^*%&|~<>]/y
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

const stmt: Parser<Stmt> = lazy(() => stmt_)

const block: Parser<Expr> = seq(["{", stmt.many(), "}"])
  .key(1)
  .map((x) => kv(R.Block, x))
  .span()

const namedParam = seq([id, maybeType(":")]).map((x) => ({
  name: x[0],
  type: x[1],
}))
// TODO: unnamed `in T` parameters

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

const exprArray = seq([
  "[",
  expr,
  seq([seq(["=>", expr]).opt(), ";", expr]).alt(
    from(",").skipThen(expr).many().thenSkip(from(",").opt()),
  ),
  "]",
]).map(([, el, data]): Expr["data"] => {
  if (data[0] == 1) {
    const rest = data[1]
    rest.unshift(el)
    return kv(R.ArrayElements, rest)
  }

  const snd = data[1][0]?.[1]
  const len = data[1][2]

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
})

const fnArgs = seq([NO_NL, "(", expr.alt(namedArg).sepBy(), ")"]).map((raw) => {
  const args: Expr[] = []
  const argsNamed: { name: WithSpan<Id>; value: Expr }[] = []
  for (const el of raw[2]) {
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

const exprAnonFn: Parser<Expr["data"]> = seq([
  "|",
  namedParam.sepBy(","),
  "|",
  maybeType("->"),
  expr,
])
  .span()
  .map(({ data: x, span }) => {
    const f: DeclFn<null> = at(
      { name: null, args: x[1], ret: x[3], body: x[4] },
      span,
    )
    return kv(R.AnonFn, { hash: nextHash(), f })
  })

const exprIfElse: Parser<Expr["data"]> = seq([
  kw("if"),
  "(",
  expr,
  ")",
  expr,
  "else",
  expr,
]).map(([, , cond, , if_, , else_]) =>
  kv(R.IfElse, { cond, if: if_, else: else_ }),
)

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
  exprAnonFn,
  exprIfElse,
  num.map((x) => kv(R.Num, x)),
  str.map((x) => kv(R.Str, x)),
])
  .span()
  .suffixedBySpan([
    seq([NO_NL, "[", expr, "]"]).map(
      (index) =>
        (target): Expr["data"] =>
          kv(R.Index, { target, index: index[2] }),
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

const stmtLet = seq([kw("let"), kw("mut").opt(), id, "=", expr]).map(
  ([, mut, name, , value]) => kv(R.Let, { mut: !!mut, name, value }),
)

const stmt_ = any<Stmt["data"]>([
  expr.map((x) => kv(R.Expr, x)),
  from(";")
    .as(kv(R.Void, null))
    .span()
    .map((x) => kv(R.Expr, x)),
  stmtLet,
]).span()

const fnBody = any([block, from("=").skipThen(expr)])

const declFn: Parser<DeclFnNamed> = seq([
  kw("fn"),
  idOrSym,
  "(",
  namedParam.sepBy(","),
  ")",
  maybeType("->"),
  fnBody,
])
  .map((x) => ({ name: x[1], args: x[3], ret: x[5], body: x[6] }))
  .span()

export const declCoercion: Parser<DeclFn> = seq([
  kw("coercion"),
  "(",
  namedParam.sepBy(","),
  ")",
  "->",
  type,
  fnBody,
])
  .map((x) => ({ name: null, args: x[2], ret: x[5], body: x[6] }))
  .span()

export const declStruct: Parser<DeclStruct> = seq([
  kw("struct"),
  id,
  "{",
  namedParam.sepBy(","),
  "}",
])
  .map((x): DeclStruct["data"] => ({ name: x[1], fields: x[3] }))
  .span()

export { declFn, expr, type }

function maybeType(start: ParserLike<unknown>): Parser<TTyped> {
  return any([from(start).skipThen(type), always(kv(R.Any, null)).span()])
}
