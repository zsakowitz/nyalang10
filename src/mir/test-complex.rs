fn +(a: complex, b: complex) complex {
  complex(re(a) + re(b), im(a) + im(b))
}

fn -(a: complex) complex {
  complex(-re(a), -im(a))
}

fn *(a: complex, b: complex) complex {
  complex(
    (re(a) * re(b)) - (im(a) * im(b)),
    (im(a) * re(b)) + (re(a) * im(b)),
  )
}

fn /(a: complex, b: int) complex {
  complex(re(a) / b, im(a) / b)
}

fn conj(a: complex) complex {
  complex(re(a), -im(a))
}

fn /(a: complex, b: complex) complex {
  (a * conj(b)) / ((re(b) * re(b)) + (im(b) * im(b)))
}

fn +(a: any, b: [any]) [any] {
  [i => a + b[i]; len(b)]
}

in typeof 2
