// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
// Bypasses TS6133. Allow declared but unused functions.
// @ts-ignore
function id(d) { return d[0]; }
// @ts-ignore
const lexer = moo.compile({
    syntax: ["=", "(", ",", ")"],
    name: /[a-zA-Z]+/,
    add_lvl_op: /[+]/,
    mul_lvl_op: /[*]/,
    ws: { match: /[ \t\n\r\f]/, lineBreaks: true },
});
//postprocessors.ne
const nth = (n) => (d) => d[n];
function $(o) {
    return function (d) {
        const ret = {};
        Object.keys(o).forEach((k) => ret[k] = d[o[k]]);
        return ret;
    };
}
import { ErrorNode, Variable, RuleRef, Operation, Rule } from "./parser-tree.js";
import { functions } from '../ad/operations.js';
export const graph = [];
export const rules = [];
function opOr(name, message, ...operands) {
    return functions.has(name) ? new Operation(name, operands)
        : rules.includes(name) ? new RuleRef(name, operands)
            : new ErrorNode(name, message, operands);
}
function unwrap(args) {
    const value = (e) => e === null ? null : e.hasOwnProperty("value") ? e["value"] : e;
    return args.map((e) => value(e)).filter((e) => e !== null).map((e) => e instanceof Array ? unwrap(e) : e);
}
function _(fn) {
    return (d) => fn(unwrap(d));
}
;
;
;
;
const grammar = {
    Lexer: lexer,
    ParserRules: [
        { "name": "main$ebnf$1$subexpression$1", "symbols": ["_", "expression", "_"] },
        { "name": "main$ebnf$1", "symbols": ["main$ebnf$1$subexpression$1"] },
        { "name": "main$ebnf$1$subexpression$2", "symbols": ["_", "expression", "_"] },
        { "name": "main$ebnf$1", "symbols": ["main$ebnf$1", "main$ebnf$1$subexpression$2"], "postprocess": (d) => d[0].concat([d[1]]) },
        { "name": "main", "symbols": ["main$ebnf$1"], "postprocess": (d) => d[0].map((e) => e[1]) },
        { "name": "expression", "symbols": [(lexer.has("name") ? { type: "name" } : name), "_", { "literal": "=" }, "_", "add_lvl"], "postprocess": _(([rulename, , content]) => {
                rules.push(rulename);
                return new Rule(rulename, content);
            })
        },
        { "name": "add_lvl", "symbols": ["mul_lvl", "_", (lexer.has("add_lvl_op") ? { type: "add_lvl_op" } : add_lvl_op), "_", "add_lvl"], "postprocess": _(([left, op, right]) => new Operation(op, [left, right])) },
        { "name": "add_lvl", "symbols": ["mul_lvl"], "postprocess": id },
        { "name": "mul_lvl", "symbols": ["component", "_", (lexer.has("mul_lvl_op") ? { type: "mul_lvl_op" } : mul_lvl_op), "_", "mul_lvl"], "postprocess": _(([left, op, right]) => new Operation(op, [left, right])) },
        { "name": "mul_lvl", "symbols": ["component"], "postprocess": id },
        { "name": "component", "symbols": ["operand"], "postprocess": id },
        { "name": "component", "symbols": [{ "literal": "(" }, "_", "add_lvl", "_", { "literal": ")" }], "postprocess": _(([, f,]) => f) },
        { "name": "component$ebnf$1", "symbols": [] },
        { "name": "component$ebnf$1$subexpression$1", "symbols": [{ "literal": "," }, "_", "add_lvl", "_"] },
        { "name": "component$ebnf$1", "symbols": ["component$ebnf$1", "component$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]]) },
        { "name": "component", "symbols": [(lexer.has("name") ? { type: "name" } : name), "_", { "literal": "(" }, "_", "add_lvl", "_", "component$ebnf$1", "_", { "literal": ")" }], "postprocess": _(([op, , first, rest,]) => opOr(op, `Unknown function ${op}(...)`, first, ...rest.map((e) => e[1])))
        },
        { "name": "operand", "symbols": [(lexer.has("name") ? { type: "name" } : name)], "postprocess": _(([n]) => new Variable(n)) },
        { "name": "_$ebnf$1", "symbols": [] },
        { "name": "_$ebnf$1", "symbols": ["_$ebnf$1", (lexer.has("ws") ? { type: "ws" } : ws)], "postprocess": (d) => d[0].concat([d[1]]) },
        { "name": "_", "symbols": ["_$ebnf$1"], "postprocess": () => null }
    ],
    ParserStart: "main",
};
export default grammar;
