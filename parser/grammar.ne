# @builtin "postprocessors.ne"

@{%
// @ts-ignore
const lexer = moo.compile({
    syntax: ["=", "(", ",", ")"],
    name: /[a-zA-Z]+/,
    add_lvl_op: /[+]/,
    mul_lvl_op: /[*]/,
    ws: { match: /[ \t\n\r\f]/, lineBreaks: true },
});
%}

@lexer lexer

@preprocessor typescript
# @skip_unmatch true

@{%
//postprocessors.ne

const nth = (n: number): any => (d: any[]) => d[n];

type obj = {[key: string]: any};

function $(o: obj) {
    return function (d: any[]): obj {
        const ret: obj = {};

        Object.keys(o).forEach((k: string) => ret[k] = d[o[k]]);

        return ret;
    };
}
%}

@{%
import { Node, ErrorNode, Variable, RuleRef, Operation, Rule } from "./parser-tree.js";
import { functions } from '../ad/operations.js';

export const graph: Node[] = [];
export const rules: string[] = [];

function opOr(name: string, message: string, ...operands: Node[]): Node {
    return functions.has(name) ? new Operation(name, operands) : new ErrorNode(name, message, operands);
}

function unwrap(args: any[]): any[] {
    const value = (e: any) => e === null ? null : e.hasOwnProperty("value") ? e["value"] : e;

    return args.map((e: any) => value(e)).filter((e: any) => e !== null).map((e: any) => e instanceof Array ? unwrap(e as any[]) : e);
}

function _(fn: (args: any[]) => any): any {
    return (d: any[]) => fn(unwrap(d));
}
%}

main -> (_ expression _):+ {% (d) => d[0].map((e: any) => e[1]) %}

expression -> %name _ "=" _ add_lvl {%
    _(([rulename, , content]) => {
        rules.push(rulename);
        return new Rule(rulename, content);
    })
%}

add_lvl ->
    mul_lvl _ %add_lvl_op _ add_lvl {% _(([left, op, right]) => new Operation(op, [left, right])) %}
  | mul_lvl {% id %}

mul_lvl ->
    component _ %mul_lvl_op _ mul_lvl {% _(([left, op, right]) => new Operation(op, [left, right])) %}
  | component {% id %}

component ->
    operand {% id %}
  | "(" _ add_lvl _ ")" {% _(([, f, ]) => f) %}
  | %name _ "(" _ add_lvl _ ("," _ add_lvl _):* _ ")" {%
    _(([op, , first, rest, ]) => opOr(op, `Unknown function ${op}(...)`, first, ...rest.map((e: any) => e[1])))
%}

operand ->
    %name {% _(([n]) => rules.includes(n) ? new RuleRef(n, []) : new Variable(n)) %}

_ -> %ws:* {% () => null %}