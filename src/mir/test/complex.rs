fn +(a: complex, b: complex) -> complex {
  complex(a.re + b.re, a.im + b.im)
}

fn -(a: complex) -> complex {
  complex(-a.re, -a.im)
}

fn *(a: complex, b: complex) -> complex {
  complex(
    (a.re * b.im) - (a.im * b.im),
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

[i => i; 5].map(|x| x + x)
