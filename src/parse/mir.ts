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
} from "../mir/def"
import { T } from "../shared/enum"
import { idFor } from "../shared/id"

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

const id = from(
  new RegExp(`\\b(?!${RESERVED.join("|")}\\b)[A-Za-z]\\w*\\b`, "y"),
)
  .map(idFor)
  .span()

const path: Parser<Path> = id.sepBy1(".").span()

const pathArgs = path.then(seq(["<", targ_.sepBy(), ">"]).key(1)).span()

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
    .map(([first, rest]) => {
      if (first == null) {
        return ty(T.Tuple, [])
      }
    }),
]).span()

const targ: Parser<TArg> = any<TArg["data"]>([
  kw("_").as(kv(T.Infer, null)),
  pathArgs.map(({ data: [path, args], span }) =>
    args.length ?
      kv(T.Type, at(kv(T.Path, { path, args }), span))
    : kv(T.TypeOrConst, path),
  ),
  int.map((x): TArg["data"] => kv(T.Const, at(kv(T.Int, x.data), x.span))),
  type.map((x) => kv(T.Type, x)),
]).span()

const constInt: Parser<ConstInt> = any<ConstInt["data"]>([
  path.map((p) => kv(T.Path, p)),
  int.map((x) => kv(T.Int, x.data)),
]).span()

const expr: Parser<Expr> = any<Expr["data"]>([
  kw("unreachable").as(kv(T.Unreachable, null)),
  int.map((x) => kv(T.Int, x.data)),
  kw("true").as(kv(T.Bool, true)),
  kw("false").as(kv(T.Bool, false)),
]).span()

const stmt: Parser<Stmt> = any<Stmt["data"]>([]).span()
