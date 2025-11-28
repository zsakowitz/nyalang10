export const enum T {
  Void,
  Never,
  Int,
  Bool,
  Extern,

  Array,
  DynArray,
  Tuple,
  Union,

  Local,
  Call,

  Unreachable,
  Opaque,

  ArrayFill,
  ArrayFrom,
  ArrayElements,

  DynArrayFill,
  DynArrayFrom,
  DynArrayElements,

  CastNever,
  IfElse,
  ArrayIndex,
  DynArrayIndex,
  TupleIndex,
  DynArrayLen,
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
