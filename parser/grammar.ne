# @builtin "postprocessors.ne"

@{%
// @ts-ignore
const lexer = moo.compile({
    float: /0|[+-]?[1-9][0-9]*(?:\.[0-9]*)?(?:[eE][+-]?[1-9][0-9]*)?/,
    syntax: ["=", "(", ",", ")"],
    name: /[a-zA-Z]+/,
    infix: /[+\-*/]/,
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
export const functions: string[] = ['+', '-', '*', '/'];

function opOr(name: string, message: string, ...operands: Node[]): Node {
    return functions.includes(name) ? new Operation(name, operands)
        : rules.includes(name) ? new RuleRef(name, operands)
            : new ErrorNode(name, message, operands);
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

expression -> %name _ "=" _ function {%
    _(([rulename, , content]) => {
        rules.push(rulename);
        return new Rule(rulename, content);
    })
%}

function ->
    component __ %infix __ function {% _(([left, op, right]) => new Operation(op, [left, right])) %}
  | component {% id %}


component ->
    operand {% id %}
  | "(" _ function _ ")" {% _(([, f, ]) => f) %}
  | %name _ "(" _ component _ ("," _ component _):* _ ")" {%
    _(([op, , first, rest, ]) => opOr(op, `Unknown function ${op}(...)`, first, ...rest.map((e: any) => e[1])))
%}

operand ->
    %float {% _(([v]) => new Const(+v)) %}
  | %name {% _(([n]) => new Variable(n)) %}

_ -> %ws:* {% () => null %}
__ -> %ws:+ {% () => null %}
