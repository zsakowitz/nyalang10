import { cyan, green, magenta, red, reset, yellow } from "../shared/ansi"
import { T } from "../shared/enum"
import type { Decl, Expr, Stmt, Type } from "./def"

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
    case T.Array:
      return `[${printType(v.el)}; ${v.len}]`
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
    case T.TupleIndex:
      return `${wrap(v.target)}.${v.index}`
    case T.UnionVariant:
      return `${wrap(v)}.variant`
    case T.UnionIndex:
      return `${wrap(v.target)}#${v.index}`
    case T.UnionMatch:
      return `match ${printExpr(v.target)} as ${yellow}$${v.data.debug} -> ${printType(v.type)} (${v.arms.map(printExpr).join(", ")}${v.arms.length == 1 ? "," : ""})`
    case T.Block:
      if (v.length == 0) return `{}`
      return `{\n  ${v.map(printStmt).join("\n").replaceAll("\n", "\n  ")}\n}`
    case T.Label:
      return `${v.loop ? "loop " : ""}${green}'${v.label.debug} -> ${printType(v.type)} ${printExpr(v.body)}`
    case T.Return:
      return `return ${printExpr(v)}`
    case T.Break:
      return `break ${green}'${v.label.debug} ${printExpr(v.body)}`
    case T.Continue:
      return `continue ${green}'${v.debug}`
    case T.Local:
      return `${yellow}$${v.debug}`
    case T.Call:
      return `${red}@${v.name.debug}(${v.args.map(printExpr).join(", ")})`
  }
}

export function printStmt({ k, v }: Stmt): string {
  switch (k) {
    case T.Expr:
      return printExpr(v)
    case T.Let:
    case T.AssignOne:
    case T.AssignMany:
  }
  return Bun.inspect({ k, v })
}

export function printDecl({ name, args, ret, body }: Decl): string {
  return `fn ${red}@${name.debug}(${args.map(
    ({ name, type }) => `${yellow}$${name.debug} ${printType(type)}`,
  )}) ${printType(ret)} = ${printExpr(body)};`
}
