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
