import { ErrorNode, Variable, RuleRef, Operation } from './parser-tree.js';
import { FunctionTree } from "../ad/function-tree.js";
import { ParserError } from "../util/errors.js";
import { parserMapping } from "../ad/operations.js";
import grammar from "./grammar.js";
class ParserResult {
    constructor(functions, graph, err) {
        this.functions = functions;
        this._graph = graph;
        this.err = err;
    }
    isOk() {
        return this.err === undefined;
    }
    error() {
        return this.err;
    }
    expr() {
        return this.functions;
    }
    get graph() {
        return this._graph;
    }
}
function parseToTree(input, vrb, ops, onError) {
    // @ts-ignore
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
    try {
        parser.feed(input);
    }
    catch (e) {
        const lines = e.message.split("\n");
        const id = lines[3].indexOf("^");
        throw new ParserError(`Invalid syntax at line: ${lines[2].substring(0, id)} ->${lines[2].substring(id)}`);
    }
    let result = parser.results;
    if (result.length === 0) {
        throw new ParserError("Input matches nothing");
    }
    // fixme (hashcode???)
    const pieces = new Map();
    const rules = new Map();
    const graph = result[0];
    function dfs(v) {
        const str = v.toString();
        if (pieces.has(str)) {
            return;
        }
        if (!pieces.has(str)) {
            const cur = (() => {
                switch (v.constructor) {
                    case Variable:
                        return vrb(v.name);
                    case RuleRef:
                        return rules.get(v.name);
                    case Operation:
                        const op = v;
                        op.children.forEach((e) => dfs(e));
                        const operands = op.children.map((e) => pieces.get(e.toString()));
                        const operation = ops.get(op.name);
                        if (!operation) {
                            return onError(op.name, `Unknown operation ${op.name}(...)`, operands);
                        }
                        return operation(operands);
                    case ErrorNode:
                        const err = v;
                        return onError(err.content, err.message, err.children.map((e) => pieces.get(e.toString())));
                    default:
                        throw new ParserError("Parsed graph somehow contains a Node which type is not supported");
                }
            })();
            pieces.set(str, cur);
        }
    }
    function convert(r) {
        dfs(r.content);
        rules.set(r.name, pieces.get(r.content.toString()));
    }
    graph.forEach(convert);
    return [[...rules.values()], [...pieces.values()]];
}
// fixme
export const parseFunction = (input) => {
    const errors = [];
    try {
        const [rules, graph] = parseToTree(input, (name) => new FunctionTree.Variable(name), parserMapping, (content, message, children) => {
            errors.push([content, message]);
            return new FunctionTree.ErrorNode(content, message, children);
        });
        return errors.length > 0
            ? new ParserResult(rules, graph, errors.map(([from, message]) => '> ' + message).join('\n'))
            : new ParserResult(rules, graph);
    }
    catch (pe) {
        if (pe instanceof ParserError) {
            return new ParserResult([], [], pe.message);
        }
        else {
            throw pe;
        }
    }
};