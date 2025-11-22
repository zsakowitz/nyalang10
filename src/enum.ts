export const enum T {
  Void,
  Never,
  Int,
  Bool,
  Extern,
  Array,
  Tuple,
  Union,

  Local,
  Call,

  Unreachable,
  Opaque,
  ArrayFill,
  ArrayMap,
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
