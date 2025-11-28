fn +(a: complex, b: complex) complex {
  complex(re(a) + re(b), im(a) + im(b))
}

fn -(a: complex, b: complex) complex {
  complex(re(a) - re(b), im(a) - im(b))
}

fn *(a: complex, b: complex) complex {
  complex(
    (re(a) * re(b)) - (im(a) * im(b)),
    (im(a) * re(b)) + (re(a) * im(b)),
  )
}

fn +(a: any, b: [any]) [any] {
  [i => a + b[i]; len(b)]
}

(3 * complex(4, 2)) * complex(0, 1)
