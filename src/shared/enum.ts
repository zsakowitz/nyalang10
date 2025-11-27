export const enum T {
  // types which can be coerced into each other
  Void,
  Never,
  Int,
  Bool,
  Extern,

  // types which cannot have coercions
  Array,
  Tuple,
  Union,

  Local,
  Call,

  Unreachable,
  Opaque,
  ArrayFill,
  ArrayFrom,
  ArrayElements,

  CastNever,
  IfElse,
  ArrayIndex,
  TupleIndex,
  UnionVariant,
  UnionIndex,
  UnionMatch,

  Block,
  Label,
  Return,
  Continue,
  Break,

  Expr,
  Let,
  AssignOne,
  AssignMany,

  Index,
}
