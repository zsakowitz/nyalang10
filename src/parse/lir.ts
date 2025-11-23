import { any, from, lazy, lazyAny, Parser, seq, State, todo } from "."
import { T } from "../enum"
import { idFor } from "../id"
import {
  ex,
  lv,
  st,
  T_BOOL,
  T_INT,
  T_NEVER,
  T_VOID,
  ty,
  type Decl,
  type Expr,
  type Lval,
  type Stmt,
  type Type,
} from "../lir/def"

const ID_FN = from(/@([A-Za-z]\w*)/y).map((x) => idFor(x[1]!))
const ID_LOCAL = from(/\$([A-Za-z]\w*)/y).map((x) => idFor(x[1]!))
const ID_EXTERN = from(/~([A-Za-z]\w*)/y).map((x) => idFor(x[1]!))
const ID_LABEL = from(/'([A-Za-z]\w*)/y).map((x) => idFor(x[1]!))

const INDEX = from(/\d+/y).map((x) => Number(BigInt.asIntN(32, BigInt(x[0]))))
const INT = from(/\d+/y).map((x) => BigInt(x[0]))

export const TYPE: Parser<Type> = lazyAny<Type>(() => [
  from("void").as(T_VOID),
  from("!").as(T_NEVER),
  from("int").as(T_INT),
  from("bool").as(T_BOOL),
  ID_EXTERN.map((v) => ty(T.Extern, v)),
  seq(["[", TYPE, ";", INDEX, "]"])
    .keys([1, 3])
    .map(([el, len]) => ty(T.Array, { el, len })),
  seq(["(", TYPE.sepByRaw(), ")"]).map(([, el]) =>
    !el.trailing && el.items.length == 1 ? el.items[0]! : ty(T.Tuple, el.items),
  ),
  seq(["union", "(", TYPE.sepBy(), ")"])
    .key(2)
    .map((el) => ty(T.Union, el)),
])

const TUPLE_INDEX = from(".").skipThen(INDEX)
const ARRAY_INDEX = seq(["[", lazy(() => EXPR), "]"]).key(1)

export const LVAL: Parser<Lval> = ID_LOCAL.map((x) =>
  lv(T.Local, x),
).suffixedBy([
  TUPLE_INDEX.map((index) => (target) => lv(T.TupleIndex, { target, index })),
  ARRAY_INDEX.map((index) => (target) => lv(T.ArrayIndex, { target, index })),
])

const OPAQUE_NUM = from(/[+-]?(?:\d+(?:\.\d+)?(?:e[+-]?\d+)?|inf)|nan/y).key(0)
const OPAQUE_STR = from(/"[^"]*"/y).key(0)

export const EXTERN_NUM = ty(T.Extern, idFor("num"))
export const EXTERN_STR = ty(T.Extern, idFor("str"))

const EXPRL: Parser<Expr> = lazy(() => EXPR)

export const EXPR: Parser<Expr> = lazyAny<Expr>(() => [
  // constructors
  from("unreachable").as(ex(T.Unreachable, null)),
  INT.map((x) => ex(T.Int, x)),
  from("true").as(ex(T.Bool, true)),
  from("false").as(ex(T.Bool, false)),
  OPAQUE_NUM.map((x) => ex(T.Opaque, { ty: EXTERN_NUM, data: x })),
  OPAQUE_STR.map((x) => ex(T.Opaque, { ty: EXTERN_STR, data: x })),
  seq([ID_EXTERN, any([OPAQUE_NUM, OPAQUE_STR])]).map(([k, v]) =>
    ex(T.Opaque, { ty: ty(T.Extern, k), data: v }),
  ),
  seq(["opaque", TYPE, any([OPAQUE_NUM, OPAQUE_STR])]).map(([, k, v]) =>
    ex(T.Opaque, { ty: k, data: v }),
  ),
  seq([/\[\s*fill/y, EXPR, ";", INDEX, "]"]).map(([, el, , len]) =>
    ex(T.ArrayFill, { el, len }),
  ),
  seq(["[", ID_LOCAL, "=>", EXPR, ";", INDEX, "]"]).map(
    ([, idx, , el, , len]) => ex(T.ArrayFrom, { idx, el, len }),
  ),
  seq([/\[\s*each/y, TYPE, ";", EXPR.sepBy(), "]"]).map(([, elTy, , els]) =>
    ex(T.ArrayElements, { elTy, els }),
  ),
  seq(["(", EXPR.sepByRaw(), ")"]).map(([, el]) =>
    !el.trailing && el.items.length == 1 ? el.items[0]! : ex(T.Tuple, el.items),
  ),
  seq(["union", "(", TYPE.sepBy(), ")", "#", INDEX, "(", EXPR, ")"]).map(
    ([, , unionTy, , , variant, , data]) =>
      ex(T.Union, { unionTy: ty(T.Union, unionTy), variant, data }),
  ),

  // destructors other than `if` and `match` are suffixes
  seq(["if", EXPR, "->", TYPE, "then", EXPR, "else", EXPR]).map(
    ([, condition, , type, , _if, , _else]) =>
      ex(T.IfElse, { condition, type, if: _if, else: _else }),
  ),
  seq(["match", EXPR, "as", ID_LOCAL, "->", TYPE, "(", EXPR.sepBy(), ")"]).map(
    ([, target, , data, , type, , arms]) =>
      ex(T.UnionMatch, { target, data, type, arms }),
  ),

  // control flow
  seq(["{", BLOCK_CONTENTS, "}"]).map(([, x]) => ex(T.Block, x)),
  seq([from("loop").opt(), ID_LABEL, "->", TYPE, EXPR]).map(
    ([loop, label, , type, body]) =>
      ex(T.Label, { loop: !!loop, label, type, body }),
  ),
  seq(["return", EXPR]).map((x) => ex(T.Return, x[1])),
  seq(["break", ID_LABEL, EXPR]).map(([, label, body]) =>
    ex(T.Break, { label, body }),
  ),
  seq(["continue", ID_LABEL]).map((x) => ex(T.Continue, x[1])),

  // variables
  ID_LOCAL.map((x) => ex(T.Local, x)),
  seq([ID_FN, "(", EXPR.sepBy(), ")"]).map(([name, , args]) =>
    ex(T.Call, { name, args }),
  ),
]).suffixedBy([
  seq([".cast", "(", TYPE, ")"]).map(
    ([, , into]) =>
      (target) =>
        ex(T.CastNever, { target, into }),
  ),
  seq(["[", EXPRL, "]"]).map(
    ([, index]) =>
      (target) =>
        ex(T.ArrayIndex, { target, index }),
  ),
  // T.UnionVariant comes before T.TupleIndex so it parses properly
  from(".variant").map(() => (target) => ex(T.UnionVariant, target)),
  seq([".", INDEX]).map(
    ([, index]) =>
      (target) =>
        ex(T.TupleIndex, { target, index }),
  ),
  seq(["#", INDEX]).map(
    ([, index]) =>
      (target) =>
        ex(T.UnionIndex, { target, index }),
  ),
])

const STMT_RAW = lazyAny<[stmt: Stmt, needsVoid: boolean]>(() => [
  // expr is last, since it's the obvious one
  seq(["let", from("mut").opt(), ID_LOCAL, "=", EXPR, ";"]).map(
    ([, mut, name, , val]) => [st(T.Let, { mut: !!mut, name, val }), false],
  ),
  seq(["assign", "(", LVAL.sepByRaw(), ")", "=", EXPR, ";"]).map(
    ([, , lval, , , value]) =>
      lval.items.length == 1 && !lval.trailing ?
        [st(T.AssignOne, { target: lval.items[0]!, value }), false]
      : [st(T.AssignMany, { target: lval.items, value }), false],
  ),
  seq(["assign", LVAL, "=", EXPR, ";"]).map(([, target, , value]) => [
    st(T.AssignOne, { target, value }),
    false,
  ]),
  EXPR.map((x) => st(T.Expr, x)).then(
    any([from(/(?=\s*\}|$)/y).as(false), from(/;/y).as(true)]),
  ),
])

export const BLOCK_CONTENTS = STMT_RAW.many().map((x) => {
  const needsVoid = !!x[x.length - 1]?.[1]
  const stmts = x.map((x) => x[0])
  if (needsVoid) {
    stmts.push(st(T.Expr, ex(T.Block, [])))
  }
  return stmts
})

// export const DECL: Parser<Decl> = todo()

console.log(BLOCK_CONTENTS.go(new State(`2`)))
