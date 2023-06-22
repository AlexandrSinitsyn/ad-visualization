import { FunctionTree } from "./function-tree.js";
import { GraphNodes } from "./graph-nodes.js";
import { Matrix } from "../util/matrix.js";
import { AlgorithmError } from "../util/errors.js";
import { algoMapping } from "./operations.js";

export interface Update {
    index: number;
    name: string;
    children: number[];
    v: Matrix | undefined;
    df: Matrix | undefined;
}

export type ErrorStep = string;
export type Step = Update | ErrorStep;

interface Info {
    index: number;
    name: string;
    children: number[];
}

export class Algorithm {
    private readonly graph: FunctionTree.Node[];
    private readonly mapping: Map<FunctionTree.Node, [GraphNodes.Element, Info]>;
    private readonly vars: Map<string, number[][]>;

    public constructor(graph: FunctionTree.Node[], vars: Map<string, number[][]>) {
        this.graph = graph;
        this.mapping = new Map();
        this.vars = vars;
    }

    public *step(): Generator<Step> {
        yield* this.init();

        yield* this.calc();

        yield* this.diff();
    }

    private *init(): Generator<Step> {
        let index = 0;

        for (const e of this.graph) {
            let name: string;
            let children: number[];

            const vertex: GraphNodes.Element = (() => {
                if (e instanceof FunctionTree.Variable) {
                    name = e.name;
                    children = [];
                    const variable = new GraphNodes.Var(e.name);

                    if (this.vars.has(name)) {
                        variable.v = new Matrix(this.vars.get(name)!);
                    }

                    return variable;
                } else if (e instanceof FunctionTree.Operation) {
                    name = e.symbol;
                    children = e.operands.map((n) => this.mapping.get(n)![1].index);

                    const operands = e.operands.map((n) => this.mapping.get(n)![0]);

                    const fun = algoMapping.get(e.symbol);

                    if (!fun) {
                        throw 'UNKNOWN OPERATION';
                    }

                    return fun(operands);
                } else {
                    throw 'UNSUPPORTED NODE TYPE';
                }
            })();

            yield Algorithm.nodeToUpdate(vertex, {name, index, children});

            this.mapping.set(e, [vertex, { name: name, index: index, children: children }]);

            index++;
        }
    }

    private *calc(): Generator<Step> {
        for (const [e, info] of [...this.mapping.values()].sort(([ , {index: i1}], [ , {index: i2}]) => i1 - i2)) {
            try {
                e.eval();

                yield Algorithm.nodeToUpdate(e, info);
            } catch (ex: any) {
                if (ex instanceof AlgorithmError) {
                    yield ex.message;
                } else {
                    throw ex;
                }
            }
        }
    }

    private *diff(): Generator<Step> {
        for (const [e, info] of [...this.mapping.values()].sort(([ , {index: i1}], [ , {index: i2}]) => i2 - i1)) {
            try {
                e.diff();

                yield Algorithm.nodeToUpdate(e, info);
            } catch (ex: any) {
                if (ex instanceof AlgorithmError) {
                    yield ex.message;
                } else {
                    throw ex;
                }
            }
        }
    }

    private static nodeToUpdate(e: GraphNodes.Element, {name, index, children}: Info): Update {
        return {
            index: index,
            name: name,
            children: children,
            v: e.v,
            df: e.df,
        };
    }

    public updateAlgo(newVars: Map<string, number[][]>): Algorithm {
        return new Algorithm(this.graph, newVars);
    }
}
