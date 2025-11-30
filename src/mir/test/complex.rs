struct Complex { re: int, im: int }

fn +(a: Complex, b: Complex) -> Complex {
  Complex(a.re + b.re, a.im + b.im)
}

fn -(a: Complex) -> Complex {
  Complex(-a.re, -a.im)
}

fn *(a: Complex, b: Complex) -> Complex {
  Complex(
    (a.re * b.re) - (a.im * b.im),
    (a.im * b.im) + (a.re * b.im),
  )
}

fn /(a: Complex, b: int) -> Complex {
  Complex(a.re / b, a.im / b)
}

fn conj(a: Complex) -> Complex {
  Complex(a.re, -a.im)
}

fn /(a: Complex, b: Complex) -> Complex {
  (a * b.conj) / ((b.im * b.im) + (b.im * b.im))
}

fn +(a: any, b: [any]) -> [any] {
  [i => a + b[i]; b.len]
}

fn map(array: [any], f) -> [any] = [i => f(array[i]); len(array)]

struct Point { x: int, y: int }

fn +(a: Point, b: Point) -> Point { Point(a.x + b.x, a.y + b.y) }

coercion (x: int) -> Complex { Complex(x, 0) }

[0, Complex(2, 3)]

2.3
