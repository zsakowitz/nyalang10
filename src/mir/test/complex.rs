coercion (x: int) -> num { int_to_num(x) }

struct Complex { re: num, im: num }

coercion (x: num) -> Complex { Complex(x, 0.0) }

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

Complex(2.0, 3.0) == Complex(4.0, 5.0)

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

isec(Line(Point(2,3), Point(4,5)), Line(Point(8,2),Point(0,6)))

fn fact(x: int) -> int {
  if (x == 0) {
    1
  } else {
    x * fact(x - 1)
  }
}

fact(5)
