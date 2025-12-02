coercion (x: int) -> num = int_to_num(x)

struct Complex { re: num, im: num }

coercion (x: num) -> Complex = Complex(x, 0.0)

fn +(a: Complex, b: Complex) -> Complex {
  Complex(a.re + b.re, a.im + b.im)
}

Complex(2.0, 3.0) + Complex(4.0, 5.0)

fn -(a: Complex) -> Complex {
  Complex(-a.re, -a.im)
}

-Complex(2.0, 3.0)

fn *(a: Complex, b: Complex) -> Complex {
  Complex(
    (a.re * b.re) - (a.im * b.im),
    (a.im * b.im) + (a.re * b.im),
  )
}

Complex(2.0, 3.0) * Complex(4.0, 5.0)

fn /(a: Complex, b: num) -> Complex {
  Complex(a.re / b, a.im / b)
}

Complex(2.0, 3.0) / 5.0

fn conj(a: Complex) -> Complex {
  Complex(a.re, -a.im)
}

Complex(3.0, 4.0).conj

fn /(a: Complex, b: Complex) -> Complex {
  (a * b.conj) / ((b.im * b.im) + (b.im * b.im))
}

Complex(2.0, 3.0) / Complex(4.0, 5.0)

fn ==(a: Complex, b: Complex) -> bool {
  (a.re == b.re) & (a.im == b.im)
}

Complex(2, 3) + Complex(2, 2) == Complex(4, 5)

fn !=(a: Complex, b: Complex) -> bool {
  (a.re != b.re) | (a.im != b.im)
}

Complex(2.0, 3.0) != Complex(4.0, 5.0)

struct Point {
  x: num,
  y: num,
}

struct Line {
  p1: Point,
  p2: Point,
}

fn line(p1: Point, p2: Point) -> Line {
  Line(p1, p2)
}

fn /(p: Point, n: num) -> Point {
  Point(p.x / n, p.y / n)
}

fn _isec(p1: Point, p2: Point, p3: Point, p4: Point) -> Point {
  let d = ((p1.x - p2.x) * (p3.y - p4.y)) - ((p1.y - p2.y) * (p3.x - p4.x))

  let x1y2 = p1.x * p2.y
  let x2y1 = p1.y * p2.x
  let x3y4 = p3.x * p4.y
  let x4y3 = p3.y * p4.x

  Point(
    ((x1y2 - x2y1) * (p3.x - p4.x)) - ((p1.x - p2.x) * (x3y4 - x4y3)),
    ((x1y2 - x2y1) * (p3.y - p4.y)) - ((p1.y - p2.y) * (x3y4 - x4y3)),
  ) / d
}

fn isec(l1: Line, l2: Line) -> Point {
  _isec(l1.p1, l1.p2, l2.p1, l2.p2)
}

isec(line(Point(2,3), Point(4,5)), line(Point(8,2),Point(0,6)))

fn fact(x: int) -> int {
  if (x == 0) {
    1
  } else {
    x * fact(x - 1)
  }
}

fact(5)

"world"

fn hi(a: dyn [int]) {
  a
}

hi([])

struct Sur {
  lhs: dyn [Sur],
  rhs: dyn [Sur],
}

fn Sur(x: dyn [Sur]) -> Sur {
  Sur(x, [])
}

Sur( ; )

fn S0() = Sur( ; )

fn S1() = Sur(S0(); )

S1()

fn map(x: [any], f) -> [any] {
  [i => f(x[i]); x.len]
}

fn -(x: Sur) -> Sur {
  Sur(
    x.rhs.map(|x| -x),
    x.lhs.map(|x| -x),
  )
}

-S1()

{
  let 0 = S0()
  let 1 = S1()
  1
}

fn every(data: [any], check) -> bool {
  [i => if (check(data[i])) {} else return false; data.len];
  true
}

fn some(data: [any], check) -> bool {
  [i => if (check(data[i])) return true else {}; data.len];
  false
}

![2, 4, 3].every(|x| x % 2 == 0)

[2, 4, 3].some(|x| x % 2 == 0)

fn <=(a: Sur, b: Sur) -> bool {
  [i => if (b <= a.lhs[i]) return false else {}; a.lhs.len];
  [i => if (b.rhs[i] <= a) return false else {}; b.rhs.len];
  true
}

fn <(a: Sur, b: Sur) -> bool {
  (a <= b) & !(b <= a)
}

fn >(a: Sur, b: Sur) -> bool {
  (b <= a) & !(a <= b)
}

fn >=(a: Sur, b: Sur) -> bool {
  b <= a
}

fn ==(a: Sur, b: Sur) -> bool {
  (a <= b) & (b <= a)
}

fn !=(a: Sur, b: Sur) -> bool {
  !(a == b)
}

S0() <= S1()
!(S1() <= S0())
S1() != S0()
!(S1() < S0())
S1() > S0()
S1() >= S0()

fn join(a: [any], b: [any]) -> dyn [any] {
  [i => if (i < a.len) {
    a[i]
  } else {
    b[i - a.len]
  }; a.len + b.len]
}

join([1,2,3],[4,5,6])

fn +(a: [any], b: any) -> [any] {
  [i => a[i] + b; a.len]
}

fn +(a: any, b: [any]) -> [any] {
  [i => a + b[i]; b.len]
}

[1,2,3]+4

fn +(a: Sur, b: Sur) -> Sur {
  Sur(
    join(a.lhs + b, a + b.lhs),
    join(a.rhs + b, a + b.rhs),
  )
}

fn -(a: Sur, b: Sur) -> Sur {
  a + -b
}

S0() - S1()

S1() + S0() == S1()

{
  let 0   = Sur(  ;  )
  let 1   = Sur(0 ;  )
  let 2   = 1 + 1
  let 1.5 = Sur(1 ; 2)
  let s   = Sur(0 ; 0)
  [s + s == 0, 1.5 + 1.5 == 1 + 2]
}

// original
// 2404µs parsing
// 0010µs env setup
// 0170µs mir
// 0027µs lir
// ????µs end-to-end

// with partial spans
// 2527µs parsing
// 0009µs env setup
// 0150µs mir
// 0032µs lir
// 2520µs end-to-end
