# @builtin "postprocessors.ne"

@{%
// @ts-ignore
const lexer = moo.compile({
    float: /0|[+-]?[1-9][0-9]*(?:\.[0-9]*)?(?:[eE][+-]?[1-9][0-9]*)?/,
    eq: "=",
    name: /[a-zA-Z]+/,
    infix: /\S+/,
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
import { Node, ErrorNode, Const, Variable, RuleRef, Operation, Rule } from "./parser-tree.js";

export const graph: Node[] = [];
export const rules: string[] = [];
export const functions: string[] = [];
export const infixr = ['+', '*'];
export const infixl = ['-', '/'];

function opOr(name: string, lookup: string[], ...operands: Node[]): Node {
    return lookup.includes(name) ? new Operation(name, operands)
        : rules.includes(name) ? new RuleRef(name, operands)
            : new ErrorNode(name, operands);
}
%}

main -> _ input _ {% (d) => d[1] %}

input -> _ (expression _):+ _ {% (d) => d[1].map((e: any) => e[0]) %}

expression -> _ rulename _ "=" _ function _ {%
    function (d) {
        console.log(d);
        rules.push(d[1]);
        return new Rule(d[1], d[5]);
    }
%}

function ->
    _ component _ {% (d) => d[1] %}
  | _ function _ infixl _ component _ {% (d) => opOr(d[3], infixl, d[1], d[5]) %}
  | _ component _ infixr _ function _ {% (d) => opOr(d[3], infixr, d[1], d[5]) %}


component ->
    _ operand _ {% (d) => d[1] %}
  | _ funname _ "(" _ component _ ("," _ component _):* _ ")" _ {% (d) => opOr(d[1], functions, d[5], ...d[7].map((e: any) => e[2])) %}

rulename -> _ %name _ {% (d) => d[0] %}

infixl -> _ %infix _ {% (d) => d[1] %}
infixr -> _ %infix _ {% (d) => d[1] %}

operand ->
    _ %float _ {% (d) => new Const(d[1]) %}
  | _ %name _ {% (d) => new Variable(d[1]) %}

funname -> _ %name _ {% (d) => d[1] %}

_ -> %ws:* {% function (d) { return null; } %}
