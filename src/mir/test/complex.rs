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

fn inc(x: int | complex) -> int | complex {
  x + 1
}

fn map(array: [any], f) -> [any] = [i => f(array[i]); len(array)]

fn is_zero(x: int) -> bool = x == 0
fn is_zero(x: [any]) -> [bool] = x.map(is_zero)

is_zero([2, 3, 4, 0])

[2, complex(3, 4)].map(|x| x * x)

fn two_if_zero(x) = if (x == 0) 2 else 0

two_if_zero(true)
