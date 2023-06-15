import { Node, ErrorNode, Const, Variable, RuleRef, Operation, Rule } from './parser-tree.js';
import grammar from "./grammar.js";

class ParserError extends Error {}

export function parse<Tree>(
    input: string,
    cnst: (v: number) => Tree,
    vrb: (name: string) => Tree,
    ops: Map<string, (args: Tree[]) => Tree>,
    onError: (name: string, args: Tree[]) => Tree
): Tree[] {
    // @ts-ignore
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
    parser.feed(input);
    const result = parser.results;

    if (result.length == 0) {
        throw new ParserError("Input matches nothing");
    }

    // fixme (hashcode???)
    const pieces: Map<string, Tree> = new Map();

    const rules: Map<string, Tree> = new Map();

    const graph: Rule[] = result[0];

    function compress(v: Node): Node {
        if (v instanceof Operation) {
            const op = v as Operation;
            const args = op.children.map(compress).flatMap((e) =>
                e.constructor === Operation ?
                    (e as Operation).name == op.name ? (e as Operation).children : [e] : [e])

            op.children.length = 0;
            op.children.push(...args);
        }

        return v;
    }

    function dfs(v: Node): void {
        const str = v.toString();

        if (pieces.has(str)) {
            return;
        }

        if (!pieces.has(str)) {
            const cur: Tree = (() => {
                switch (v.constructor) {
                    case Const:
                        return cnst((v as Const).v);
                    case Variable:
                        return vrb((v as Variable).name);
                    case RuleRef:
                        return rules.get((v as RuleRef).name)!;
                    case Operation:
                        const op = v as Operation;
                        op.children.forEach((e) => dfs(e));
                        const operands = op.children.map((e) => pieces.get(e.toString())!);

                        const operation = ops.get(op.name);

                        if (!operation) {
                            return onError(op.name, operands);
                        }

                        return operation(operands);
                    case ErrorNode:
                        return onError((v as ErrorNode).content, (v as ErrorNode).children.map((e) => pieces.get(e.toString())!))
                    default:
                        throw new ParserError("Parsed graph somehow contains a Node which type is not supported");
                }
            })();

            pieces.set(str, cur);
        }
    }

    function convert(r: Rule): void {
        dfs(compress(r.content));
        rules.set(r.name, pieces.get(r.content.toString())!)
    }

    graph.forEach(convert);

    return [...pieces.values()];
}

export abstract class E {}
export class C implements E {
    private readonly v: number;

    constructor(v: number) {
        this.v = v;
    }
}
export class V implements E {
    private readonly name: string;

    constructor(name: string) {
        this.name = name;
    }
}
export class Sum implements E {
    private readonly args: E[];

    constructor(args: E[]) {
        this.args = args;
    }
}
export class Err implements E {
    private readonly message: string;
    private readonly args: E[];

    constructor(message: string, args: E[]) {
        this.message = message;
        this.args = args;
    }
}

