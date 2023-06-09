import { FunctionTree } from "./function-tree.js";
import { GraphNodes } from "./graph-nodes.js";
import { SymbolicDerivatives } from "./symbolic-derivatives.js";
import { Matrix, ZeroMatrix } from "../util/matrix.js";
import { AlgorithmError } from "../util/errors.js";
import { algoMapping } from "./operations.js";

export interface Update {
    index: number;
    name: string;
    nodeName: string;
    children: number[];
    v: Matrix | undefined;
    df: Matrix | undefined;
    symbolicDf: string | undefined;
}

export interface RuleDef {
    name: string;
    index: number;
    content: number[];
}

export interface Arrow {
    from: number;
    to: number;
    // fixme
    count: 1 | number;
    text: string;
}

export enum AlgoStep {
    INIT,
    BACKWARDS,
    CALC,
    DIFF,
    FINISH,
}

export type ErrorStep = string;

export type Meta = RuleDef | Arrow;

export type Step = Update | Meta | AlgoStep | ErrorStep;

export namespace TypeChecking {
    export function isUpdate(step: Step): step is Update {
        return step !== undefined && step !== null && typeof step === "object" &&
            ['index', 'name', 'nodeName', 'children', 'v', 'df'].map((v) => v in (step as object)).reduce((a, b) => a && b);
    }

    export function isRuleDef(step: Step): step is RuleDef {
        return step !== undefined && step !== null && typeof step === "object" &&
            ['name', 'index', 'content'].map((v) => v in (step as object)).reduce((a, b) => a && b);
    }

    export function isArrow(step: Step): step is Arrow {
        return step !== undefined && step !== null && typeof step === "object" &&
            ['from', 'to', 'count', 'text'].map((v) => v in (step as object)).reduce((a, b) => a && b);
    }

    export function isAlgoStep(step: Step): step is AlgoStep {
        return step !== undefined && step !== null && typeof step === "number";
    }

    export function isErrorStep(step: Step): step is ErrorStep {
    return step !== undefined && step !== null && typeof step === "string";
}
}

interface Info {
    index: number;
    name: string; // f = x + y
    nodeName: string, // f
    children: number[];
}

export class Algorithm {
    private readonly graph: FunctionTree.Node[];
    private readonly mapping: Map<FunctionTree.Node, [GraphNodes.Element, Info]>;
    private readonly vars: Map<string, Matrix>;
    private readonly derivatives: Map<string, Matrix>;
    private readonly withDerivatives: boolean;
    private readonly scalarMode: boolean;

    public constructor(graph: FunctionTree.Node[], vars: Map<string, number[][]>, derivatives: Map<string, number[][]>, withDerivatives: boolean, scalarMode: boolean) {
        this.graph = graph;
        this.mapping = new Map();
        this.vars = new Map([...vars.entries()].map(([nodeName, v]) => [nodeName, new Matrix(v)]));
        this.derivatives = new Map([...derivatives.entries()].map(([nodeName, v]) => [nodeName, new Matrix(v)]));
        this.withDerivatives = withDerivatives;
        this.scalarMode = scalarMode;
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

        yield AlgoStep.BACKWARDS;

        yield *this.backwards();

        if (this.withDerivatives) {
            yield AlgoStep.DIFF;

            yield* this.diff();
        }

        yield AlgoStep.FINISH;
    }

    public updateAlgo(newVars: Map<string, number[][]>, newDerivatives: Map<string, number[][]>): Algorithm {
        return new Algorithm(this.graph, newVars, newDerivatives, this.withDerivatives, this.scalarMode);
    }

    private *init(): Generator<Step> {
        let index = 0;

        for (const e of this.graph) {
            let name: string = '';
            let nodeName: string = '';
            let children: number[] = [];

            const convert = (e: FunctionTree.Node): GraphNodes.Element => {
                if (e instanceof FunctionTree.Variable) {
                    name = e.name;
                    nodeName = e.toString();
                    children = [];

                    return new GraphNodes.Var(e.name);
                } else if (e instanceof FunctionTree.Operation) {
                    nodeName = this.funName();
                    name = `${nodeName} = ${e.toString(e.operands.map((n) => this.mapping.get(n)![1].nodeName))}`;
                    children = e.operands.map((n) => this.mapping.get(n)![1].index);

                    const operands = e.operands.map((n) => this.mapping.get(n)![0]);

                    const fun = algoMapping.get(e.symbol);

                    if (!fun) {
                        throw 'UNKNOWN OPERATION';
                    }

                    return fun(operands);
                } else if (e instanceof FunctionTree.Rule) {
                    const node = convert(e.content);

                    name = e.name + ' = ' + name.split(' = ')[1];
                    nodeName = e.name;

                    return node;
                } else {
                    throw 'UNSUPPORTED NODE TYPE';
                }
            }

            const vertex: GraphNodes.Element = convert(e);

            this.mapping.set(e, [vertex, { name: name, nodeName: nodeName, index: index, children: children }]);

            yield Algorithm.nodeToUpdate(vertex, this.mapping.get(e)![1]);

            for (const c of children) {
                yield {
                    from: c,
                    to: index,
                    count: 1,
                    text: '',
                }
            }

            if (e instanceof FunctionTree.Rule) {
                // const subgraph = (e: FunctionTree.Node): number[] => {
                //     if (e instanceof FunctionTree.Operation) {
                //         return e.operands.flatMap((n) => subgraph(n));
                //     } else if (e instanceof FunctionTree.Variable) {
                //         return [];
                //     } else {
                //         return [this.mapping.get(e)![1].index];
                //     }
                // };
                //
                // const content = subgraph(e.content);
                // content.push(index);

                yield {
                    name: nodeName,
                    index: index,
                    content: [index],
                };
            }

            index++;
        }
    }

    private *backwards(): Generator<Step> {
        this.getEdges().forEach(([v, { nodeName }]) => v.symbDf = SymbolicDerivatives.Var('&#916;' + nodeName));

        for (const [e, { index, children }] of [...this.mapping.values()].sort(([ , {index: i1}], [ , {index: i2}]) => i2 - i1)) {
            e.symbolicDiff(children.map((e) => this.nodeByIndex(e)[1].nodeName), this.scalarMode);

            for (let i = 0; i < children.length; i++) {
                yield {
                    from: index,
                    to: children[i],
                    count: 1,
                    text: (e as GraphNodes.Operation).symbolicDiffs[i].toString(),
                };
                yield Algorithm.nodeToUpdate(...this.nodeByIndex(children[i]));
            }
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
                    if (!this.derivatives.has(info.nodeName)) {
                        // noinspection ExceptionCaughtLocallyJS
                        throw new AlgorithmError(`No derivative provided for "${info.nodeName}"`);
                    }

                    e.df = this.derivatives.get(info.nodeName)!;
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

    private nodeByIndex(i: number): [GraphNodes.Element, Info] {
        return [...this.mapping.values()].find(([_, { index }]) => index === i)!;
    }

    private static nodeToUpdate(e: GraphNodes.Element, { name, nodeName, index, children }: Info): Update {
        return {
            index: index,
            name: name,
            nodeName: nodeName,
            children: children,
            v: e.v,
            df: e.df,
            symbolicDf: e.symbDf instanceof SymbolicDerivatives.Empty ? undefined : e.symbDf.toString(),
        };
    }

    private seq = this.genFunName();
    private funName(): string {
        return this.seq.next().value;
    }

    private *genFunName(): Generator<string> {
        const chars = [...Array(26).keys()].map((_, i) => String.fromCharCode('A'.charCodeAt(0) + i));
        chars.shift(); // remove 'A'

        const res = [];

        let i = 0;
        while (true) {
            res.push('A');
            yield res.join('');

            for (const c of chars) {
                res[i] = c;
                yield res.join('');
            }

            i++;
        }
    }
}
