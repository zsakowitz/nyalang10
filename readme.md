# critical use cases

every one of these cases should be doable within only the typesystem of MIR. the
textual format is only an abstraction over actual MIR text, and should not
require further transpilation.

## automate computational parts of abstract algebra...

the group Dn and coset computation:

- structs
- const generics
- where clauses
- arrays by `f(index)`
- somewhat complex overload resolution
  - alternative: just have separate `*`, `<*`, `*>`, and `**` operators for 1:1,
    1:N, N:1, and M:N products, since coset product is different anyway

```rs
struct D<int N> {
  rotation: int,
  flipped: bool,
}

fn *<int N>(lhs: D<N>, rhs: D<N>) D<N> {
  D {
    rotation: lhs.rotation + (if flipped then -1 else 1) * rhs.rotation,
    flipped: lhs.flipped ~ rhs.flipped,
  }
}

fn *<T, int N>(lhs: [T; N], rhs: T) [T; N]
where
  fn *(T, T) T,
{
  [i => lhs[i] * rhs; N]
}

fn *<T, int N>(lhs: T, rhs: [T; N]) [T; N]
where
  fn *(T, T) T,
{
  [i => lhs * rhs[i]; N]
}

fn *<T, int N>(lhs: [T; N], rhs: [T; N]) [T; N]
where
  fn *(T, T) T,
{
  [i => lhs[i] * rhs[i]; N]
}
```

generating a Cayley table:

- combo assignment operators like `+=`
- range syntax `a..b`
- iterator syntax `for x in Y`
- trait syntax as sugar for a set of functions
- consts are implied to be `int` when not specified

```rs
trait ToTypst<T> {
  fn to_typst(T) str;
}

trait Semigroup<T> {
  fn *(T, T) T;
}

fn table<T: ToTypst + Semigroup, int R, int C>(rows: [T; R], cols: [T; C]) -> str {
  let mut text = "";
  for c in 0..C {
    text += ",";
    text += to_typst(cols[c]);
  }
  for r in 0..R {
    text += ";";
    text += to_typst(rows[r]);
    for c in 0..C {
      text += ",";
      text += to_typst(rows[r] * cols[c]);
    }
  }
  text
}
```

definition of the identity of a group:

- multiple functions with same parameter types
- ability to call a function with reference to the desired return type

```rs
fn id(in int) int {
  0
}

fn id(in str) str {
  ""
}

fn double_identity<T>() T
where
  fn id(in T) T,
  fn +(T, T) T,
{
  id(in T) + id(in T)
}
```

## ...and biology

TODO

## multiply `Matrix<T, R int, C int>` types, generic over `T` and dimensions

```rs
struct Matrix<T, int R, int C> {
  data: [[T; C]; R],
}

fn *<T, int R, int J, int C>(mat1: Matrix<T, R, J>, mat2: Matrix<T, J, C>) Matrix<T, R, C>
where
  fn zero() T,
  fn +(T, T) T,
  fn *(T, T) T,
{
  Matrix {
    data: [row => [col => {
      let mut sum = zero();
      for i in 0..J {
        sum += mat1.data[row][i] * mat2.data[i][col];
      }
      sum
    }; C]; R]
  }
}
```

## write stylized markup, including inline scripting and math

tbd: how do we combine markup, scripts, and math? ideas:

| system | markup     | scripts    | math     | tradeoffs                  |
| ------ | ---------- | ---------- | -------- | -------------------------- |
| typst  | `[markup]` | `#script`  | `$math$` | no tuple/array distinction |
| mdx    | only JSX   | `{script}` | `$math$` | no markup                  |
| latex  | n/a        | n/a        | `$math$` | no markup                  |

Q: do we need a tuple/array distinction? maybe we consider everything to be a
tuple, but with the additional condition that homogeneous tuples can be indexed
arbitrarily. syntax becomes:

```rs
// expressions
(1, 2, 3)       // array / homogeneous tuple
(1, "23")       // regular tuple
(i => i + 1; 4) // tuple by index
(i + 1; 4)      // tuple by fill

(1, 2, 3).0     // tuple indexing also permitted on arrays
(1, "23").0     // tuple indexing
```

nope, this actually fails because a tuple like `(2.0, 3.0 * i)` doesn't
auto-coerce elements into the most general type, i.e. `Complex`. it also
conflicts weirdly with the whole type shell thing, and will make it hard to
implement functions generic over the length of an array.

can we use `` ` `` instead? maybe, but it doesn't have different opening and
closing delimeters, which makes the following ambiguous:

```rs
`#hello` - 23 - ``
// using [] as markup brackets, both these parses are possible:
// [#hello] - 23 - []
// [#hello[- 23 -]]
```

so. we need some kind of delimeter, but they're all taken:

- `()` for grouping and tuples
- `[]` for arrays
- `{}` for statement blocks
- `<>` for order comparison

TODO

## higher-level form of GLSL, for fractals and 3D rendering

- `@shader`
- iterators
- `for x in Y`
- closures

```rs
let props = (100, 3);

// @shader here is a compiler-specific builtin. it isolates the "closure" so
// that it does not have access to outer variables, and provides it with a set
// of uniforms passed from the outside world.
//
// because @shader can do static analysis, it knows the shader captures `props`,
// and therefore knows to make those values available to the script as uniforms,
// so that they can be updated quickly without recompiling the entire shader.
@shader(|pos| {
  let mut z = Complex { re: pos.0, im: pos.1 };
  let c = z;
  'a {
    for i in 0..props.0 {
      z = z * z + c;
      if (length(z) > 4) {
        break 'a rgba(0.0, 0.0, 0.0, 0.0);
      }
    }
    rgba(1.0, 1.0, 1.0, 0.0)
  }
})
```

## project nya-based interactives (geometry, slope field)

- type coercion
- tests
- `@interactive`
- closures

```rs
struct Complex {
  re: num,
  im: num,
}

// type coercion operator
fn ->(re: num) Complex {
  Complex { re, im: 0.0 }
}

fn +(a: Complex, b: Complex) Complex {
  Complex { re: a.re + b.re, im: a.im + b.im }
}

test {
  assert(2.0 + Complex { re: 3.0, im: 4.0 } == Complex { re: 5.0, im: 4.0 });
}

@interactive(Geo2D, |p0: (num, num), p1: (num, num), p2: (num, num)| {
  let midpoint = (p0 + p1 + p2) / 3.0;
  let lines = [line(p0, midpoint), line(p1, midpoint), line(p2, midpoint)];
  let mut ret = group();
  ret.push(lines);
  ret.push(midpoint);
  ret
})
```

## solve advent of code problems

TODO

## generic html/css/js scripting

- html syntax (make sure it works with most tailwind classes)
- closures

```rs
let name = prompt("what is your name?");

// a mini-DSL for defining html, sort of mimicking CSS syntax for tag name, id,
// classes, and attributes, with parentheses denoting children. it would likely
// look fantastic with good syntax highlighting

let el =
  &h1.text-xl[aria-hidden true, id "world", onclick |ev| { alert("hello!"); }](
    "my name is ", name, 45
  );

// could be syntax sugar for
// {
//   let el: Element = element("h1");
//   el.set_attr("class", "text-xl");
//   el.set_attr("name", "world");
//   el.set_event_listener("click", |ev| { alert("hello!"); });
//   el.append("my name is ");
//   el.append(name);
//   el.append(45);
//   el
// }
//
// or something more solid-like, where it clones from a template. or maybe it
// just straight-up compiles to JSX, and we let a transpiler handle it:
//
// let el = <h1 class="text-xl" name="world" onClick={ev => alert("hello!")}>
//   my name is {name}
// </h1>;

let el2 = &div.border-x.border-red-500.px-4.py-8."text-[orange]"(
  &h1.text-xl.font-semibold("world"),
  &p("my name is like your mother's"),
);

// let el2 = <div class="border-x border-red-500 px-4 py-8 text-[orange]">
//   <h1 class="text-xl font-semibold">world</h1>
//   <p>my name is like your mother's</p>
// </div>;

document.body.append(el);
document.body.append(e2);
```

## zero function

```rs
fn zero(in int) int = 0;
fn zero(in num) num = 0.0;
fn zero(in str) str = "";

fn zero<A, B>(in (A, B)) (A, B)
where
  fn zero(in A) A,
  fn zero(in B) B,
{
  (zero(in A), zero(in B))
}

fn zero<T, int N>(in [T; N]) [T; N]
where
  fn zero(in T) T,
{
  [_ => zero(in T); N]
}

let x = zero(in [(int, [str; 3]); 4]);
```
