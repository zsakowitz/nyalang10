//== SUPPLEMENTARY DEFINITIONS ==//
// this is only used for tests, feel free to skip over it
fn ==(a: [any], b: [any]) -> bool {
  if (a.len != b.len) { return false };
  [i => if (a[i] != b[i]) { return false }; a.len]
  true
}




//== INTRODUCTION TO THE LANGUAGE ==//

// basic arithmetic operators
test 1 + 1 == 2
test 4.6 / 2.3 == 2.0

// blocks let you define variables
// `;` separates multiple statements on one line
// the last expression of a block is returned, unless it is "suppressed" via `;`
test { let x = 2; x < 3 }

// function definitions are strictly typed, so you can trust them more
fn square(x: int) -> int {
  x * x
}

test square(4) == 16
// test square(3.4)     // <-- would be an error, since `3.4` is not an 'int'

// single-expression functions can be written via `=` instead of `{ ... }`
// also, the return type can be inferred in non-recursive functions
fn square_short(x: int) = x * x

square_short(4)

// the parameter type can be inferred
fn square_any(x) = x * x

// in this case, the function body is still checked
test square_any(4) == 16
test square_any(3.4) == 11.559999999999999 // boy do i sure love floating-point arithmetic
// test square_any(true) // errors, since you cannot multiply 'bool' by 'bool'




//== DEFINITION OF A SURREAL NUMBER ==//
struct Sur {
  // `dyn [Sur]` is the type of a dynamically-sized array of `Sur` values.
  // we use this so a surreal number can have any number of left and right values.
  lhs: dyn [Sur],
  rhs: dyn [Sur],
}

// our first number: zero! we made it by using the automatically-generated
// constructor function, which takes each field of the struct in order and
// returns the composite value. (this syntax may change in the future.)
Sur([], [])

// our second surreal number: one!
Sur([Sur([], [])], [])
// but it's tiring and confusing to nest numbers like this. instead, let's use...




//== REDEFINING THE INTEGERS ==//
{
  // { ... } is a statement block, which allows temporary variable definitions
  let zero = Sur([],     [])
  let one  = Sur([zero], [])
  let two  = Sur([one],  [])

  // so many surreal numbers! but those variable names and expressions look very
  // inconsistent. if we're making a language geared specifically towards math,
  // why not let us redefine the integers?
  let 0 = Sur([],  [])
  let 1 = Sur([0], [])
  let 2 = Sur([1], [])

  // much better! fractions?
  let 0.5 = Sur([0], [1])
  let 1.5 = Sur([1], [2])
}




//== INTERLUDE: ARRAYS ==//

// there are three ways to make an array:

// 1. list every element
[1, 1, 2, 3, 5, 8]

// 2. specify one element, and repeat it an arbitrary number of times
[2.3; 4] == [2.3, 2.3, 2.3, 2.3]

// 3. generate elements given their index in the array
[i => i * i; 4] == [0, 1, 4, 9]

// there are two ways to use an array:

// 1. ask for its length
[3, 7, 5].len == 3

// 2. ask for a specific element
[3, 7, 5][1] == 7

// these can be combined into most other array operations.

fn negate_each(x: [any]) -> [any] {
  [i => -x[i]; x.len]
}

negate_each([3, -7, 5]) == [-3, 7, -5]

fn join(x: [any], y: [any]) -> [any] {
  [i => {
    if (i < x.len) x[i]
    else           y[i - x.len]
  }; x.len + y.len]
}

join([7, 1, 2], [3, 4, 5]) == [7, 1, 2, 3, 4, 5]

// generic arguments and first-class functions make a powerful combination.

fn map(array: [any], f) -> [any] {
  [i => f(array[i]); array.len]
}

[3, 7, 5].map(|x| x + 2) == [5, 9, 7]
//            ^^^^^^^^^ inline function syntax looks like Rust
//                      types are inferred once this is called




//== BASIC OPERATORS ==//
// we can define operators on our types using normal function syntax.
fn -(x: Sur) -> Sur {
  Sur(
    x.rhs.map(|el| -el),
    x.lhs.map(|el| -el),
  )
}

{
  let 0  = Sur([] ,  [])
  let 1  = Sur([0],  [])
  let m1 = Sur([] , [0]); // semicolon since it tries to grab the `-` on the line below
  -m1 // same as 1, hopefully, but we haven't defined equality yet
}

fn <=(a: Sur, b: Sur) -> bool {
  // there isn't proper loop syntax yet, so we use the array construction syntax
  // along with early returns instead
  [i => if (b <= a.lhs[i]) return false; a.lhs.len];
  [i => if (b.rhs[i] <= a) return false; b.rhs.len];
  true
}

{
  let 0 = Sur([], [])
  let 1 = Sur([0], [])

  // yay, relational operators!
  0 <= 1;
  -1 <= 0
}

fn ==(a: Sur, b: Sur) -> bool {
  // `&` is used for boolean AND, since && is usually short-circuiting and I
  // haven't taken the time to implement it yet
  (a <= b) & (b <= a)
}

{
  let 0 = Sur([], [])
  let 1 = Sur([0], [])

  // yay, equality operators!
  Sur([-1], [1]) == 0
}

// helper function; we can't use `.map()` because inline functions can't yet
// capture local variables, so `a.map(|x| x + b)` would error with "variable
// 'b' is not defined"
fn +(a: [Sur], b: Sur) -> [Sur] {
  [i => a[i] + b; a.len]
}

fn +(a: Sur, b: Sur) -> Sur {
  Sur(
    join(a.lhs + b, b.lhs + a),
    join(a.rhs + b, b.rhs + a),
  )
}

{
  let 0 = Sur([], [])
  let 1 = Sur([0], [])
  1 + 1 == Sur([1], [])
  0 == -1 + 1
}

fn -(a: Sur, b: Sur) -> Sur {
  a + -b
}

{
  let 0 = Sur([], [])
  let 1 = Sur([0], [])
  let 3 = 1 + 1 + 1
  let 5 = 3 + 1 + 1
  let 4 = 1 + 3
  5 - 1 == 4
}




//== SHORTHAND FOR SURREAL NUMBERS ==//
{
  let 0   = Sur([],  [])
  let 1   = Sur([0], [])
  let 2   = Sur([1], [])
  let 0.5 = Sur([0], [1])
  let 1.5 = Sur([1], [2])

  // many things are constructed from lists of numbers: matrices, vectors, and
  // surreal numbers, and so on.
  //
  // we therefore introduce a shorthand: `;` collects previous arguments to a
  // function into an array, and passes it as a new argument.
  Sur([0, 0.5], [1.5, 2]) == Sur(0, 0.5; 1.5, 2;)

  // the final `;` can be left off the end, so long as there is at least one argument
  Sur(0, 0.5; 1.5, 2)
}
