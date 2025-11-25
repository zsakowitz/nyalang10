import { SignatureKind } from "typescript"
import { always, any, at, from, lazy, seq, type Parser, type WithSpan } from "."
import {
  type Type,
  type Expr,
  type ConstInt,
  type DeclAdt,
  type DeclFn,
  type FnSignature,
  type Lval,
  type MatchArm,
  type Path,
  type Stmt,
  type TArg,
  type TParam,
  type TypeR,
  type TypedArg,
  ty,
  ex,
  lv,
  st,
  kv,
  type FieldArg,
} from "../mir/def"
import { T } from "../shared/enum"
import { Id, idFor } from "../shared/id"
import { ice } from "../shared/error"

function kw(text: string): Parser<WithSpan<null>> {
  return from(new RegExp("\\b" + RegExp.escape(text) + "\\b", "y"))
    .as(null)
    .span()
}

const RESERVED = [
  "void",
  "never",
  "int",
  "bool",
  "in",
  "unreachable",
  "true",
  "false",
  "if",
  "else",
  "match",
  "loop",
  "return",
  "break",
  "continue",
  "struct",
  "union",

  // for future expansion
  "do",
  "async",
  "await",
  "yield",
  "gen",
  "throw",
  "raise",
  "switch",
  "case",
  "when",
  "num",
  "str",
  "type",
  "enum",
  "extern",
  "opaque",
  "each",
  "for",
  "in",
]

const type_: Parser<Type> = lazy(() => type)
const targ_: Parser<TArg> = lazy(() => targ)
const expr_: Parser<Expr> = lazy(() => expr)
const stmt_: Parser<Stmt> = lazy(() => stmt)
const constInt_: Parser<ConstInt> = lazy(() => constInt)
const field_: Parser<FieldArg> = lazy(() => field)

const id = from(
  new RegExp(`\\b(?!${RESERVED.join("|")}\\b)[A-Za-z]\\w*\\b`, "y"),
)
  .map(idFor)
  .span()

const path: Parser<Path> = id.sepBy1(".").span()

const pathArgs = path
  .then(seq(["<", targ_.sepBy(), ">"]).key(1).opt())
  .map(([k, v]) => ({ path: k, args: v ?? [] }))
  .span()

const label = from(
  new RegExp(`'(?!${RESERVED.join("|")}\\b)[A-Za-z]\\w*\\b`, "y"),
)
  .map((x) => idFor(x.slice(1)))
  .span()

const int = from(/\d+(?!\w)/y)
  .map(BigInt)
  .span()

const _closingRparen = from(")").as(kv(T.Void, null))

const _typeAfterFirstLparen = any<
  | { k: T.Void; v: null }
  | { k: T.Type; v: null }
  | { k: T.Tuple; v: Type[] }
  | { k: T.Array; v: ConstInt }
>([
  from(")").as(kv(T.Type, null)),
  from(",")
    .skipThen(type_.sepBy())
    .thenSkip(")")
    .map((x) => kv(T.Tuple, x)),
  from(";")
    .skipThen(constInt_)
    .thenSkip(")")
    .map((x) => kv(T.Array, x)),
])

const type: Parser<Type> = any<Type["data"]>([
  kw("void").as(ty(T.Void, null)),
  from("!").as(ty(T.Never, null)),
  kw("int").as(ty(T.Int, null)),
  kw("bool").as(ty(T.Bool, null)),
  kw("in")
    .skipThen(type_)
    .map((x) => ty(T.UnitIn, x)),
  from("(")
    .skipThen(type_.opt())
    .switch((first) => (first ? _typeAfterFirstLparen : _closingRparen))
    .map<Type["data"]>(([first, rest]) => {
      if (first == null) {
        return ty(T.Tuple, [])
      }
      switch (rest.k) {
        case T.Void: // unreachable
        case T.Type:
          return first.data
        case T.Tuple:
          rest.v.unshift(first)
          return ty(T.Tuple, rest.v)
        case T.Array:
          return ty(T.Array, { el: first, len: rest.v })
      }
    }),
  pathArgs.map((x) => ty(T.Path, x.data)),
]).span()

const targ: Parser<TArg> = any<TArg["data"]>([
  kw("_").as(kv(T.Infer, null)),
  pathArgs.map(({ data, span }) =>
    data.args.length ?
      kv(T.Type, at(kv(T.Path, data), span))
    : kv(T.TypeOrConst, data.path),
  ),
  int.map((x): TArg["data"] => kv(T.Const, at(kv(T.Int, x.data), x.span))),
  type.map((x) => kv(T.Type, x)),
]).span()

const constInt: Parser<ConstInt> = any<ConstInt["data"]>([
  path.map((p) => kv(T.Path, p)),
  int.map((x) => kv(T.Int, x.data)),
]).span()

const _exprAfterFirstLparen = any<
  | { k: T.Void; v: null }
  | { k: T.Expr; v: null }
  | { k: T.Tuple; v: Expr[] }
  | { k: T.ArrayFill; v: ConstInt }
  | { k: T.ArrayFrom; v: readonly [Expr, ConstInt] }
>([
  from(")").as(kv(T.Expr, null)),
  from(",")
    .skipThen(expr_.sepBy())
    .thenSkip(")")
    .map((x) => kv(T.Tuple, x)),
  from(";")
    .skipThen(constInt_)
    .thenSkip(")")
    .map((x) => kv(T.ArrayFill, x)),
])

const _exprAfterFirstLparenOrArrow = _exprAfterFirstLparen.or(
  seq(["=>", expr_, ";", constInt_, ")"]).map(([, a, , b]) =>
    kv(T.ArrayFrom, [a, b] as const),
  ),
)

const expr: Parser<Expr> = any<Expr["data"]>([
  kw("unreachable").as(kv(T.Unreachable, null)),
  int.map((x) => kv(T.Int, x.data)),
  kw("true").as(kv(T.Bool, true)),
  kw("false").as(kv(T.Bool, false)),
  from("@")
    .then("(")
    .skipThen(expr_.sepBy())
    .thenSkip(")")
    .map((x) => kv(T.ArrayElements, x)),
  from("(")
    .skipThen(expr_.opt())
    .switch((first) =>
      first ?
        (
          first.data.k == T.Path
          && first.data.v.name.data.length == 1
          && first.data.v.targs == null
          && first.data.v.args == null
        ) ?
          _exprAfterFirstLparenOrArrow
        : _exprAfterFirstLparen
      : _closingRparen,
    )
    .map<Expr["data"]>(([first, rest]) => {
      if (first == null) {
        return ex(T.Tuple, [])
      }
      switch (rest.k) {
        case T.Void: // unreachable
        case T.Expr:
          return first.data
        case T.Tuple:
          rest.v.unshift(first)
          return ex(T.Tuple, rest.v)
        case T.ArrayFill:
          return ex(T.ArrayFill, { el: first, len: rest.v })
        case T.ArrayFrom:
          if (first.data.k != T.Path) ice(`unreachable`)
          return ex(T.ArrayFrom, {
            idx: first.data.v.name.data[0]!,
            el: rest.v[0],
            len: rest.v[1],
          })
      }
    }),
  kw("in")
    .skipThen(type_)
    .map((x) => ex(T.UnitIn, x)),
  path
    .then(seq(["<", targ_.sepBy(), ">"]).key(1).opt())
    .then(
      seq(["(", expr_.sepBy(), ")"])
        .key(1)
        .alt(seq(["{", field_.sepBy(), "}"]).key(1))
        .opt(),
    )
    .map(([[a, b], c]) =>
      c && c[0] == 1 ?
        ex(T.Adt, { name: a, targs: b, fields: c[1] })
      : ex(T.Path, { name: a, targs: b, args: c?.[1] ?? null }),
    ),
]).span()

const field = seq([id, ":", expr])
  .map(([a, , b]) => ({ name: a, value: b }))
  .span()

const stmt: Parser<Stmt> = any<Stmt["data"]>([]).span()

console.log(expr.parse("(x => 2; 3)"))
