import { Node, ErrorNode, Variable, RuleRef, Operation, Rule } from './parser-tree.js';
import { FunctionTree } from "../ad/function-tree.js";
import { ParserError } from "../util/errors.js";
import { parserMapping, functionsProhibitForScalar } from "../ad/operations.js";
import grammar from "./grammar.js";

class ParserResult<Tree> {
    private readonly functions: Tree[] | undefined;
    private readonly _graph: Tree[] | undefined;
    private readonly err: string | undefined;

    public constructor(functions: Tree[], graph: Tree[]);
    public constructor(functions: Tree[], graph: Tree[], err: string);
    public constructor(functions?: Tree[], graph?: Tree[], err?: string) {
        this.functions = functions;
        this._graph = graph;
        this.err = err;
    }

    public isOk(): boolean {
        return this.err === undefined;
    }

    public error(): string {
        return this.err!;
    }

    public expr(): Tree[] {
        return this.functions!;
    }

    get graph(): Tree[] {
        return this._graph!;
    }
}

function parseToTree<Tree>(
    input: string,
    vrb: (name: string) => Tree,
    ops: Map<string, (args: Tree[]) => Tree>,
    rule: (name: string, arg: Tree) => Tree,
    onError: (content: string, message: string, args: Tree[]) => Tree,
    scalarMode: boolean
): { rules: Tree[], graph: Tree[] } {
    // @ts-ignore
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
    try {
        parser.feed(input);
    } catch (e: any) {
        const lines = e.message.split("\n");
        const id = lines[3].indexOf("^")
        throw new ParserError(`Invalid syntax at line: ${lines[2].substring(0, id)} ->${lines[2].substring(id)}`);
    }
    let result = parser.results;

    if (result.length === 0) {
        throw new ParserError("Input matches nothing");
    }

    // fixme (hashcode???)
    const pieces: Map<string, Tree> = new Map();

    // name -> [hashCode, Tree]
    const rules: Map<string, [string, Tree]> = new Map();

    const graph: Rule[] = result[0];

    function dfs(v: Node): void {
        const str = v.toString();

        if (pieces.has(str)) {
            return;
        }

        if (!pieces.has(str)) {
            const cur: Tree = (() => {
                switch (v.constructor) {
                    case Variable:
                        return vrb((v as Variable).name);
                    case RuleRef:
                        return rules.get((v as RuleRef).name)![1];
                    case Operation:
                        const op = v as Operation;
                        if (scalarMode && functionsProhibitForScalar.has(op.name)) throw new ParserError(`${op.name} not supported in scalar mode`);
                        op.children.forEach((e) => dfs(e));
                        const operands = op.children.map((e) => pieces.get(e.toString())!);

                        const operation = ops.get(op.name);

                        if (!operation) {
                            return onError(op.name, `Unknown operation ${op.name}(...)`, operands);
                        }

                        return operation(operands);
                    case ErrorNode:
                        const err = v as ErrorNode;

                        return onError(err.content, err.message, err.children.map((e) => pieces.get(e.toString())!))
                    default:
                        throw new ParserError("Parsed graph somehow contains a Node which type is not supported");
                }
            })();

            if (v instanceof RuleRef) {
                pieces.delete(rules.get(v.name)![0]);
            }

            pieces.set(str, cur);
        }
    }

    function convert(r: Rule): void {
        if (r.content instanceof Variable) throw new ParserError("Can't declare variable");
        dfs(r.content);

        const content = pieces.get(r.content.toString())!;

        pieces.set(r.content.toString(), rule(r.name, content));

        rules.set(r.name, [r.content.toString(), pieces.get(r.content.toString())!]);

        // console.log(rules, pieces)
    }

    graph.forEach(convert);

    return { rules: [...rules.values()].map(([_, tree]) => tree), graph: [...pieces.values()] };
}

// fixme
export const parseFunction = (input: string, scalarMode: boolean): ParserResult<FunctionTree.Node> => {
    const errors: [string, string][] = [];

    try {
        const { rules, graph } = parseToTree<FunctionTree.Node>(
            input,
            (name) => new FunctionTree.Variable(name),
            parserMapping,
            (name, content) => new FunctionTree.Rule(name, content),
            (content, message, children) => {
                errors.push([content, message]);
                return new FunctionTree.ErrorNode(content, message, children);
            },
            scalarMode
        );

        return errors.length > 0
            ? new ParserResult<FunctionTree.Node>(rules, graph, errors.map(([from, message]) => '> ' + message).join('\n'))
            : new ParserResult<FunctionTree.Node>(rules, graph);
    } catch (pe: any) {
        if (pe instanceof ParserError) {
            return new ParserResult<FunctionTree.Node>([], [], pe.message);
        } else {
            throw pe;
        }
    }
}
