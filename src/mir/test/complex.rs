fn +(a: complex, b: complex) -> complex {
  complex(a.re + b.re, a.im + b.im)
}

fn -(a: complex) -> complex {
  complex(-a.re, -a.im)
}

fn *(a: complex, b: complex) -> complex {
  complex(
    (a.re * b.re) - (a.im * b.im),
    (a.im * b.im) + (a.re * b.im),
  )
}

fn /(a: complex, b: int) -> complex {
  complex(a.re / b, a.im / b)
}

fn conj(a: complex) -> complex {
  complex(a.re, -a.im)
}

fn /(a: complex, b: complex) -> complex {
  (a * b.conj) / ((b.im * b.im) + (b.im * b.im))
}

fn +(a: any, b: [any]) -> [any] {
  [i => a + b[i]; b.len]
}

fn map(array: [any], f) -> [any] = [i => f(array[i]); len(array)]

struct Point { x: int, y: int }

fn +(a: Point, b: Point) -> Point { Point(a.x + b.x, a.y + b.y) }

Point(2,3) + Point(4,5)

coercion (x: int) -> Point { Point(x,0) }

[2, Point(4,5)]
