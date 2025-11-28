export const enum R {
  // coercable things
  Void,
  Never,
  Int,
  Bool,
  Extern,

  Any,

  ArrayFixed, // array with fixed length
  ArrayDyn, // array with dynamic length; not available in shaders
  Array, // generic over fixed-length array and dyn-length array

  Either,

  Unreachable, // UB to reach; one constructor for `!`
  Len, // gets the length of an array

  ArrayFill,
  ArrayFrom,
  Named,
}
