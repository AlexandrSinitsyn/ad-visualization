import { Node, ErrorNode, Const, Variable, RuleRef, Operation, Rule } from './parser-tree.js';
import { FunctionTree } from "../ad/function-tree.js";
import grammar from "./grammar.js";

class ParserError extends Error {}

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
    cnst: (v: number) => Tree,
    vrb: (name: string) => Tree,
    ops: Map<string, (...args: Tree[]) => Tree>,
    onError: (content: string, message: string, args: Tree[]) => Tree
): [Tree[], Tree[]] {
    // @ts-ignore
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
    parser.feed(input);
    const result = parser.results;

    console.log('>>>>>', result)

    if (result.length === 0) {
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
                            return onError(op.name, `Unknown operation ${op.name}(...)`, operands);
                        }

                        return operation(...operands);
                    case ErrorNode:
                        const err = v as ErrorNode;

                        return onError(err.content, err.message, err.children.map((e) => pieces.get(e.toString())!))
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

    return [[...rules.values()], [...pieces.values()]];
}

// fixme
export const parseFunction = (input: string): ParserResult<FunctionTree.Node> => {
    const errors: [string, string][] = [];

    try {
        const [rules, graph] = parseToTree<FunctionTree.Node>(
            input,
            (v) => new FunctionTree.Const(v),
            (name) => new FunctionTree.Variable(name),
            new Map([
                ['+', (...args) => new FunctionTree.Add(args)],
                ['/', (...args) => new FunctionTree.Div(args)],
                ['tanh', (x) => new FunctionTree.Tanh(x)],
            ]),
            (content, message, children) => {
                errors.push([content, message]);
                return new FunctionTree.ErrorNode(content, message, children);
            }
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
