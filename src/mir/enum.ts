export const enum R {
  // coercable things
  Void,
  Int,
  Bool,
  Struct,
  Extern,

  Never,
  Any,

  ArrayFixed, // array with fixed length
  ArrayDyn, // array with dynamic length; not available in shaders
  Array, // generic over fixed-length array and dyn-length array

  StrFixed, // string with known, constant value
  StrDyn, // string with unknown value
  Str, // generic over StrConst and StrDyn

  Either,
  UnitIn,
  FnKnown,

  Unreachable, // UB to reach; one constructor for `!`

  ArrayFill,
  ArrayFrom,
  Local,
  Call,
  Index,
  Typeof,
  AnonFn,
  ArrayElements,
  IfElse,
  Num,
  Block,

  Expr,
  Let,
}
