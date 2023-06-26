import { FunctionTree } from "./function-tree.js";
import { GraphNodes } from "./graph-nodes.js";
import { Matrix, ZeroMatrix } from "../util/matrix.js";
import { AlgorithmError } from "../util/errors.js";
import { algoMapping } from "./operations.js";

export interface Update {
    index: number;
    name: string;
    children: number[];
    v: Matrix | undefined;
    df: Matrix | undefined;
}

export enum AlgoStep {
    INIT,
    CALC,
    DIFF,
    FINISH,
}

export type ErrorStep = string;
export type Step = Update | ErrorStep | AlgoStep;

interface Info {
    index: number;
    name: string;
    children: number[];
}

export class Algorithm {
    private readonly graph: FunctionTree.Node[];
    private readonly mapping: Map<FunctionTree.Node, [GraphNodes.Element, Info]>;
    private readonly vars: Map<string, Matrix>;
    private readonly derivatives: Map<string, Matrix>;

    public constructor(graph: FunctionTree.Node[], vars: Map<string, number[][]>, derivatives: Map<string, number[][]>) {
        this.graph = graph;
        this.mapping = new Map();
        this.vars = new Map([...vars.entries()].map(([name, v]) => [name, new Matrix(v)]));
        this.derivatives = new Map([...derivatives.entries()].map(([name, v]) => [name, new Matrix(v)]));
    }

    public getEdges(): [GraphNodes.Element, Info][] {
        const edgeChecks = new Array<boolean>(this.graph.length).fill(true);
        const dfs = (cur: number) => {
            const [_, curInfo] = this.mapping.get(this.graph[cur])!;
            curInfo.children.filter(it => edgeChecks[it]).forEach(next => {
                edgeChecks[next] = false;
                dfs(next);
            })
        }
        for (let i = edgeChecks.length - 1; i >= 0; i--) {
            if (edgeChecks[i]) {
                dfs(i);
            }
        }
        const edgeIds: number[] = [];
        for (let i = 0; i < edgeChecks.length; i++) {
            if (edgeChecks[i]) {
                edgeIds.push(i);
            }
        }
        return edgeIds.map((it) => this.graph[it]).map((it) => this.mapping.get(it)!);
    }

    public *step(): Generator<Step> {
        yield AlgoStep.INIT;

        yield* this.init();

        yield AlgoStep.CALC;

        yield* this.calc();

        yield AlgoStep.DIFF;

        yield* this.diff();

        yield AlgoStep.FINISH;
    }

    public updateAlgo(newVars: Map<string, number[][]>, newDerivatives: Map<string, number[][]>): Algorithm {
        return new Algorithm(this.graph, newVars, newDerivatives);
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

                    return new GraphNodes.Var(e.name);
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
            if (e instanceof GraphNodes.Var && this.vars.has(info.name)) {
                e.v = this.vars.get(info.name)!;
            }

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
                if (e.df instanceof ZeroMatrix) {
                    if (!this.derivatives.has(info.name)) {
                        // noinspection ExceptionCaughtLocallyJS
                        throw new AlgorithmError(`No derivative provided for "${info.name}"`);
                    }

                    e.df = this.derivatives.get(info.name)!;
                }

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
}
