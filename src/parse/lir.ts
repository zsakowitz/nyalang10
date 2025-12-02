import { kv } from "@/mir/def"
import { any, from, lazy, lazyAny, Parser, seq } from "."
import {
  bool,
  ex,
  int,
  never,
  num,
  st,
  str,
  ty,
  void_,
  type Decl,
  type Expr,
  type Lval,
  type Stmt,
  type Type,
} from "../lir/def"
import { T } from "../shared/enum"
import { idFor } from "../shared/id"
import type { Span } from "./span"

const ID_FN = from(/@([A-Za-z]\w*)/y).map((x) => idFor(x.slice(1)))
const ID_LOCAL = from(/\$([A-Za-z]\w*)/y).map((x) => idFor(x.slice(1)))
const ID_EXTERN = from(/~([A-Za-z]\w*)/y).map((x) => idFor(x.slice(1)))
const ID_LABEL = from(/'([A-Za-z]\w*)/y).map((x) => idFor(x.slice(1)))

const INDEX = from(/\d+(?![.e])/y).map((x) =>
  Number(BigInt.asIntN(32, BigInt(x))),
)
const INT = from(/\d+(?![.e])/y).map((x) => BigInt(x))

export const TYPE: Parser<Type> = lazyAny<Omit<Type, "s">>(() => [
  from("void").as(void_),
  from("!").as(never),
  from("int").as(int),
  from("bool").as(bool),
  ID_EXTERN.map((v) => kv(T.Extern, v)),
  seq([from("dyn").opt(), "[", TYPE, ";", INDEX, "]"])
    .keys([0, 2, 4])
    .map(([dyn, el, len]) => kv(dyn ? T.DynArray : T.Array, { el, len })),
  seq(["(", TYPE.sepByRaw(), ")"]).map(([, el]) =>
    !el.trailing && el.items.length == 1 ? el.items[0]! : kv(T.Tuple, el.items),
  ),
  seq(["union", "(", TYPE.sepBy(), ")"])
    .key(2)
    .map((el) => kv(T.Union, el)),
]).s()

const TUPLE_INDEX = from(".").skipThen(INDEX)
const ARRAY_INDEX = seq(["[", lazy(() => EXPR), "]"]).key(1)
const DYN_ARRAY_INDEX = seq([".dyn[", lazy(() => EXPR), "]"]).key(1)

export const LVAL: Parser<Lval> = ID_LOCAL.map((x) => kv(T.Local, x))
  .s<Lval>()
  .suffixedByS([
    TUPLE_INDEX.map((index) => (target) => kv(T.TupleIndex, { target, index })),
    ARRAY_INDEX.map((index) => (target) => kv(T.ArrayIndex, { target, index })),
    DYN_ARRAY_INDEX.map(
      (index) => (target) => kv(T.DynArrayIndex, { target, index }),
    ),
  ])

const OPAQUE_NUM = from(/[+-]?(?:\d+(?:\.\d+)?(?:e[+-]?\d+)?|inf)|nan/y).key(0)
const OPAQUE_STR = from(/"[^"]*"/y).key(0)

const EXPRL: Parser<Expr> = lazy(() => EXPR)

export const EXPR: Parser<Expr> = lazyAny<Omit<Expr, "s">>(() => [
  // constructors
  from("unreachable").as(kv(T.Unreachable, null)),
  INT.map((x) => kv(T.Int, x)),
  from("true").as(kv(T.Bool, true)),
  from("false").as(kv(T.Bool, false)),
  OPAQUE_NUM.map((x) => kv(T.Opaque, { ty: num, data: x })),
  OPAQUE_STR.map((x) => kv(T.Opaque, { ty: str, data: x })),
  seq([ID_EXTERN.span(), "(", any([OPAQUE_NUM, OPAQUE_STR]), ")"]).map(
    ([k, v]) => kv(T.Opaque, { ty: ty(T.Extern, k.data, k.span), data: v }),
  ),
  seq(["opaque", "<", TYPE, ">", "(", any([OPAQUE_NUM, OPAQUE_STR]), ")"]).map(
    ([, , k, , , v]) => kv(T.Opaque, { ty: k, data: v }),
  ),
  seq([/\[\s*fill/y, EXPR, ";", INDEX, "]"]).map(([, el, , len]) =>
    kv(T.ArrayFill, { el, len }),
  ),
  // T.ArrayElements is before T.ArrayFrom so it matches properly
  seq([/\[\s*each/y, TYPE, ";", EXPR.sepBy(), "]"]).map(([, elTy, , els]) =>
    kv(T.ArrayElements, { elTy, els }),
  ),
  seq(["[", ID_LOCAL, "=>", EXPR, ";", INDEX, "]"]).map(
    ([, idx, , el, , len]) => kv(T.ArrayFrom, { idx, el, len }),
  ),
  seq([/dyn\s*\[\s*fill/y, EXPR, ";", EXPR, "]"]).map(([, el, , len]) =>
    kv(T.DynArrayFill, { el, len }),
  ),
  // T.ArrayElements is before T.ArrayFrom so it matches properly
  seq([/dyn\s*\[\s*each/y, TYPE, ";", EXPR.sepBy(), "]"]).map(
    ([, elTy, , els]) => kv(T.DynArrayElements, { elTy, els }),
  ),
  seq(["dyn", "[", ID_LOCAL, "=>", EXPR, ";", EXPR, "]"]).map(
    ([, , idx, , el, , len]) => kv(T.DynArrayFrom, { idx, el, len }),
  ),
  seq(["(", EXPR.sepByRaw(), ")"]).map(([, el]) =>
    !el.trailing && el.items.length == 1 ? el.items[0]! : kv(T.Tuple, el.items),
  ),
  seq([
    seq(["union", "(", TYPE.sepBy(), ")"]).key(2).span(),
    "#",
    INDEX,
    "(",
    EXPR,
    ")",
  ]).map(([unionTy, , variant, , data]) =>
    kv(T.Union, {
      unionTy: ty(T.Union, unionTy.data, unionTy.span),
      variant,
      data,
    }),
  ),

  // destructors other than `if` and `match` are suffixes
  seq(["if", EXPR, "->", TYPE, "then", EXPR, "else", EXPR]).map(
    ([, condition, , type, , _if, , _else]) =>
      kv(T.IfElse, { condition, type, if: _if, else: _else }),
  ),
  seq(["match", EXPR, "as", ID_LOCAL, "->", TYPE, "(", EXPR.sepBy(), ")"]).map(
    ([, target, , data, , type, , arms]) =>
      kv(T.UnionMatch, { target, data, type, arms }),
  ),

  // control flow
  seq(["{", BLOCK_CONTENTS, "}"]).map(([, x]) => kv(T.Block, x)),
  seq([from("loop").opt(), ID_LABEL, TYPE, EXPR]).map(
    ([loop, label, type, body]) =>
      kv(T.Label, { loop: !!loop, label, type, body }),
  ),
  seq(["return", EXPR]).map((x) => kv(T.Return, x[1])),
  seq(["break", ID_LABEL, EXPR]).map(([, label, body]) =>
    kv(T.Break, { label, body }),
  ),
  seq(["continue", ID_LABEL]).map((x) => kv(T.Continue, x[1])),

  // variables
  ID_LOCAL.map((x) => kv(T.Local, x)),
  seq([ID_FN, "(", EXPR.sepBy(), ")"]).map(([name, , args]) =>
    kv(T.Call, { name, args }),
  ),
])
  .s<Expr>()
  .suffixedByS([
    seq([".cast", "(", TYPE, ")"]).map(
      ([, , into]) =>
        (target) =>
          kv(T.CastNever, { target, into }),
    ),
    seq(["[", EXPRL, "]"]).map(
      ([, index]) =>
        (target) =>
          kv(T.ArrayIndex, { target, index }),
    ),
    seq([".dyn", "[", EXPRL, "]"]).map(
      ([, , index]) =>
        (target) =>
          kv(T.DynArrayIndex, { target, index }),
    ),
    // T.UnionVariant comes before T.TupleIndex so it parses properly
    from(".variant").map(() => (target) => kv(T.UnionVariant, target)),
    from(".len").map(() => (target) => kv(T.DynArrayLen, target)),
    seq([".", INDEX]).map(
      ([, index]) =>
        (target) =>
          kv(T.TupleIndex, { target, index }),
    ),
    seq(["#", INDEX]).map(
      ([, index]) =>
        (target) =>
          kv(T.UnionIndex, { target, index }),
    ),
  ])

const STMT_RAW = any<[stmt: Stmt, needsVoid: null | Span]>([
  // expr is last, since it's the obvious one
  seq(["let", from("mut").opt(), ID_LOCAL, "=", EXPR, ";"])
    .span()
    .map(({ data: [, mut, name, , val], span }) => [
      st(T.Let, { mut: !!mut, name, val }, span),
      null,
    ]),
  seq([/assign\s*\(/y, LVAL.sepByRaw(), ")", "=", EXPR, ";"])
    .span()
    .map(({ data: [, lval, , , value], span }) =>
      lval.items.length == 1 && !lval.trailing ?
        [st(T.AssignOne, { target: lval.items[0]!, value }, span), null]
      : [st(T.AssignMany, { target: lval.items, value }, span), null],
    ),
  seq(["assign", LVAL, "=", EXPR, ";"])
    .span()
    .map(({ data: [, target, , value], span }) => [
      st(T.AssignOne, { target, value }, span),
      null,
    ]),
  EXPR.span()
    .map((x) => st(T.Expr, x.data, x.span))
    .then(
      any([
        from(/(?=[^\n]*\n|\s*$|\})/y).as(null),
        from(/;/y)
          .span()
          .map((x) => x.span),
      ]),
    ),
])

export const BLOCK_CONTENTS = STMT_RAW.many().map((x) => {
  const needsVoid = x[x.length - 1]?.[1]
  const stmts = x.map((x) => x[0])
  if (needsVoid) {
    stmts.push(st(T.Expr, ex(T.Block, [], needsVoid), needsVoid))
  }
  return stmts
})

export const DECL: Parser<Decl> = seq([
  "fn",
  ID_FN,
  "(",
  seq([ID_LOCAL, TYPE])
    .map(([name, type]) => ({ name, type }))
    .sepBy(),
  ")",
  TYPE,
  any([
    seq(["=", EXPR, ";"]).key(1),
    seq(["{", BLOCK_CONTENTS, "}"])
      .span()
      .map((x) => ex(T.Block, x.data[1], x.span)),
  ]),
])
  .map(([, name, , args, , ret, body]) => ({ name, args, ret, body }))
  .s()
