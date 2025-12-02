import { cyan, green, magenta, red, reset, yellow } from "../shared/ansi"
import { T } from "../shared/enum"
import { ex, type Decl, type Expr, type Stmt, type Type } from "./def"

export function printType({ k, v }: Type): string {
  switch (k) {
    case T.Void:
      return cyan + "void" + reset
    case T.Never:
      return cyan + "!" + reset
    case T.Int:
      return cyan + "int" + reset
    case T.Bool:
      return cyan + "bool" + reset
    case T.Extern:
      return cyan + "~" + v.debug + reset
    case T.Named:
      return cyan + "&" + v.debug + reset
    case T.Array:
      return `[${printType(v.el)}; ${v.len}]`
    case T.DynArray:
      return `dyn [${printType(v)}]`
    case T.Tuple:
      return `(${v.map(printType).join(", ")}${v.length == 1 ? "," : ""})`
    case T.Union:
      return `union(${v.map(printType).join(", ")}${v.length == 1 ? "," : ""})`
  }
}

function wrap(expr: Expr) {
  const text = printExpr(expr)
  if (/^(?:union|match|if)/.test(text)) {
    return `(${text})`
  } else {
    return text
  }
}

export function printExpr({ k, v }: Expr): string {
  switch (k) {
    case T.Unreachable:
      return magenta + "unreachable" + reset
    case T.Int:
    case T.Bool:
      return magenta + v + reset
    case T.Opaque:
      return `opaque<${printType(v.ty)}>(${magenta}${JSON.stringify(v.data)}${reset})`
    case T.ArrayFill:
      return `[fill ${printExpr(v.el)}; ${v.len}]`
    case T.ArrayFrom:
      return `[${yellow}$${v.idx.debug} => ${printExpr(v.el)}; ${v.len}]`
    case T.ArrayElements:
      return `[each ${printType(v.elTy)}; ${v.els.map(printExpr).join(", ")}]`
    case T.DynArrayOf:
      return `dyn of ${printExpr(v)}`
    case T.DynArrayFill:
      return `dyn [fill ${printExpr(v.el)}; ${printExpr(v.len)}]`
    case T.DynArrayFrom:
      return `dyn [${yellow}$${v.idx.debug} => ${printExpr(v.el)}; ${printExpr(v.len)}]`
    case T.DynArrayElements:
      return `dyn [each ${printType(v.elTy)}; ${v.els.map(printExpr).join(", ")}]`
    case T.Tuple:
      return `(${v.map(printExpr).join(", ")}${v.length == 1 ? "," : ""})`
    case T.Union:
      return `${printType(v.unionTy)}#${v.variant}(${printExpr(v.data)})`
    case T.CastNever:
      return `${wrap(v.target)}.cast(${printType(v.into)})`
    case T.IfElse:
      return `if ${printExpr(v.condition)} -> ${printType(v.type)} then ${printExpr(v.if)} else ${printExpr(v.else)}`
    case T.ArrayIndex:
      return `${wrap(v.target)}[${printExpr(v.index)}]`
    case T.DynArrayIndex:
      return `${wrap(v.target)}.dyn[${printExpr(v.index)}]`
    case T.TupleIndex:
      return `${wrap(v.target)}.${v.index}`
    case T.DynArrayLen:
      return `${wrap(v)}.len`
    case T.UnionVariant:
      return `${wrap(v)}.variant`
    case T.UnionIndex:
      return `${wrap(v.target)}#${v.index}`
    case T.UnionMatch:
      return `match ${printExpr(v.target)} as ${yellow}$${v.data.debug} -> ${printType(v.type)} (${v.arms.map(printExpr).join(", ")}${v.arms.length == 1 ? "," : ""})`
    case T.Block:
      if (v.length == 0) return `{}`
      return `{\n  ${printBlockContents(v).replaceAll("\n", "\n  ")}\n}`
    case T.Label:
      return `${v.loop ? "loop " : ""}${green}'${v.label.debug} ${printType(v.type)} ${printExpr(v.body)}`
    case T.Return:
      return `return ${printExpr(v)}`
    case T.Break:
      return `break ${green}'${v.label.debug} ${printExpr(v.body)}`
    case T.Continue:
      return `continue ${green}'${v.debug}`
    case T.Local:
      return `${yellow}$${v.debug}`
    case T.Call:
      if (v.args.length == 1) {
        return `${wrap(v.args[0]!)}.${red}@${v.name.debug}`
      }
      return `${red}@${v.name.debug}(${v.args.map(printExpr).join(", ")})`
    case T.Wrap:
      // wrapped types are not references; this notation just exists for debug
      // purposes
      return `${printExpr(v.target)}.&${v.with.debug}`
    case T.Unwrap:
      return `${printExpr(v)}.*`
  }
}

function printStmtRaw({ k, v, s }: Stmt): string {
  switch (k) {
    case T.Expr:
      return printExpr(v) + ";"
    case T.Let:
      return `let${v.mut ? " mut" : ""} ${yellow}$${v.name.debug} = ${printExpr(v.val)};`
    case T.AssignOne:
      return `assign ${printExpr(v.target)} = ${printExpr(v.value)};`
    case T.AssignMany:
      return `assign ${printExpr(ex(T.Tuple, v.target, s))} = ${printExpr(v.value)};`
  }
}

export function printBlockContents(v: Stmt[]): string {
  if (v.length == 0) return ""

  let finalSemi = false
  const last = v[v.length - 1]!
  if (last.k == T.Expr && last.v.k == T.Block && last.v.v.length == 0) {
    v = v.slice(0, -1)
    finalSemi = true
  }

  if (v.length == 0) return ""

  const text = v.map(printStmtRaw).join("\n")
  if (v[v.length - 1]!.k == T.Expr && !finalSemi) {
    return text.slice(0, -1)
  } else {
    return text
  }
}

function split(x: string) {
  const rungs = x.split(/(?<=[( ])/)
  let ret = ""
  let cur = ""
  for (const el of rungs) {
    if (Bun.stringWidth(cur + el) > 60) {
      ret += "\n  " + cur
      cur = el
    } else {
      cur += el
    }
  }
  if (cur) {
    ret += "\n  " + cur
  }
  return ret.slice(3)
}

export function printDecl({ name, args, ret, body }: Decl): string {
  const expr = body.k == T.Block ? printExpr(body) : `= ${printExpr(body)};`
  return split(
    `fn ${red}@${name.debug}(${args
      .map(({ name, type }) => `${yellow}$${name.debug} ${printType(type)}`)
      .join(", ")}) ${printType(ret)} ${expr}`,
  )
}
