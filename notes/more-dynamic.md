strict typing and generics and `where` clauses are tricky to implement. the
tradeoff is that the language is stable. however, we are targeting markup,
websites, advent of code, and one-off homework problems. do we actually want
incredibly strict type safety?

probably not. so what if MIR is more relaxed and defers type checking? this is
one idea behind the More Dynamic™ proposal.

the core idea: we want to be dynamic, so let's align MIR more with how Desmos,
project nya, and typst currently work, rather than Rust.

# union types

union types cover most of generics, traits, and `where` clauses. for instance,
the following function definition now compiles:

```rs
fn double(x: num | complex) -> num | complex {
  x + x
}
```

how does it work? when called, this particular overload of `double` only accepts
inputs of type `num` or `complex`; anything else is rejected, and another
overload tries to accept it. then, the body of the function is instantiated, and
the expression is checked for a proper return type, sort of like if everything
were `anytype` in Zig. so `double(x): num` if `x: num`, but `double(x): complex`
otherwise.

to switch, we can use the `is` operator mid-function.

```rs
fn two_if_num_else_zero(x: num | complex) -> int {
  if (x is num) 2 else 0
}
```

# `any`

there is now an `any` type, to which anything can be assigned. it replaces type
generics entirely. unspecified function parameters have `any` type, and
unspecified function returns have `any` type.

```rs
fn preserve(x) {
  x
}

preserve(2) // 2 :: int
preserve(23) // 23 :: void
```

there are now two array types: `[T; N]` and `[T]`. `[T; N]` is the normal array
type (`N` elements of type `T`), while `[T]` is an array of any length
containing elements of type `T`.

```rs
fn sum_both(a: [int], b: [int]) -> int {
  let mut sum = 0
  for a in a { sum += a }
  for b in b { sum += b }
  sum
}
```

we will still do as many checks on functions ahead-of-time as possible. at a
minimum, we will ensure that referenced variables exist.

# overloads are fine

geometry things still work, and are checked ahead-of-time, since all parameters
are known in advance.

```rs
struct Point { x: num, y: num }
struct Line(Point, Point)

fn y_intercept(line: Line) -> Point {
  let slope = (line.0.y - line.1.y) / (line.0.x - line.1.x);
  let y = -slope * line.0.x + line.0.y;
  Point { x: 0, y }
}
```

# recursion

we probably want things like the fibonacci numbers to work.

```rs
fn fib(n: int) int {
  if (n <= 1) n else fib(n - 1) + fib(n - 2)
}
```

if fibonacci numbers work, we should also introduce dynamic-length arrays, so
that surreal numbers also work.

```rs
struct Surreal { lhs: dyn [Surreal], rhs: dyn [Surreal] }
```

# restrictions

to make sure we can output this to wasm, glsl, or js without combinatorial
explosion (i.e. `switch`ing on the input type everywhere), things like `if`
statements still need to have matching types for all outputs.

```rs
if (true) 2 else "34" //~ ERROR: mismatched types in 'if-else' expression
```

user-defined structs and enums cannot contain possibly-dynamic types.

```rs
struct Surreal { lhs: [Surreal], rhs: [Surreal] }
//~ ERROR: member 'lhs' of struct 'Surreal' is not a well-defined type, and can
// change from invocation to invocation.
//
// this could lead to unexpected behavior, such as not being able to construct
// an array of two `Surreal` values, and is therefore not allowed.
//
// the offender is `[Surreal]`; maybe try `dyn [Surreal]` instead, a dynamic-
// length array type? note that any use of `dyn` will ban this type from working
// in shaders, since its size will be unknown. (read more)

struct Complex { re: num, im: num } // okay, since `num` is a concrete type
```

maybe we have some keyword to disable this restriction, at the cost of knowing
that the type is basically a macro which gets compiled away.

```rs
varying struct Matrix { data: [[any]] } // not a real type, so it's fine
// tbd: how would we represent this in the type system? `Matrix` isn't a real
// type, but a value `x: Matrix` isn't of any other type either.
```

# `len()` is a constant

the `len()` function to get the length of an array returns a constant if
possible. this is needed for glsl and static typing purposes.

```rs
fn double(x: [int]) [int] {
  [i => x[i]; len(x)]
}

__bikeshed_shader_kw {
  double([2, 3, 4]) // should return `[int; 3]`
}
```

# markup

for markup purposes, functions can now have optional paramaters. their values
can only be specified via explicit names.

```rs
fn heading(children: content, depth?: int) content {
  // builtin
}

heading[23]
heading(depth: 4)[78]
```

a lot of things can be coerced to `content`: `int`, `num`, `bool`, `void`,
tuples and arrays of the aforementioned, and so on.

named parameters do not participate in overload resolution.

```rs
fn x(a: int) int { ... }
fn x(a: int, depth?: int) int { ... }

x(23, depth: 78)
//~ ERROR: matched first overload, but it does not specify a 'depth' parameter.
//
// note: the first overload always shadows the second, since optional arguments
// do not participate in overload resolution.
```

# coercion

coercion exists in a restricted form: only primitives, non-varying adts, and
extern types can participate in coercion. cycles are not allowed.

```rs
fn ->(a: int) content { ... }
```

# strings

`str` is not a real data type; it operates similarly to `any`.

```rs
struct MyStr(str)
//~ ERROR: 'str' is not a concrete data type, and cannot be stored in a struct.
//
// reason: 'str' values are sometimes passed as options, and we want to validate
// those options at compile-time, not runtime.
//
// maybe you meant 'dyn str', the dynamic equivalent?

fn pick(x: str) int {
  // entire branching statement is always thrown away
  if (x == "world") 23
  else if (x == "hello") 45
  else 67
}
```

`dyn str` is its runtime js-only equivalent.

# definition of a group

we still need some way for functions to be generic over types, so that groups
can work. for instance, to validate something is a monoid, we would previously
have written:

```rs
fn validate_group<T>(in T) bool {
  // closure
  for a in elements(in T) {
    for b in elements(in T) {
      if ((a * b) !in elements(in T)) {
        return false
      }
    }
  }

  // identity exists
  if (id(in T) !in elements(in T)) {
    return false
  }

  // `id` is an identity
  for a in elements(in T) {
    if (a * id(in T) != id(in T) * a) {
      return false
    }
  }

  // has associativity
  for a in elements(in T) {
    for b in elements(in T) {
      for c in elements(in T) {
        if ((a * b) * c != a * (b * c)) {
          return false
        }
      }
    }
  }

  true
}
```

how do we do this now, seeing as types cannot be passed to functions? the main
power of generics is calling functions on them without having access to a value
of the given type.

actually, types like `in any` would work perfectly for this. just pass `in int`,
and everything is solved! we'll thus ignore this problem.

so is `in any` our equivalent of Zig's `type` type? not quite, since it
separates types and values syntactically, and is specific to the underlying
type, so that overloading works. `in any` is essentially syntax sugar for
`<T> ... in T`, but we don't have generics anymore, so only `in any` works.

so this function would be written identically, but with a header of
`validate_group(T: in any)` instead, and `elements(T)` and `id(T)` instead of
`elements(in T)` and `id(in T)` respectively.

works for me! i don't think special generic notation should be necessary; the
only remaining primitive for `in T` to be as powerful as generics is a way to
construct an `in T` given a value of type `T`. `in typeof x` could work for now,
but we should make sure it's marked as a work-in-progress.
