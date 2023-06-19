import { FunctionTree } from "./function-tree.js";

class Matrix {
    private readonly data: number[][];

    public constructor(data: number[][]) {
        this.data = data;
    }

    public size(): [number, number] {
        return this.data.length === 0 ? [0, 0] : [this.data.length, this.data[0].length];
    }

    public row(i: number): number[] {
        if (i >= this.size()[0]) {
            throw new AlgorithmError(`Invalid matrix size. Matrix is ${this.size()}, but was expected "row(${i})"`);
        }

        return this.data[i];
    }

    public col(j: number): number[] {
        if (j >= this.size()[1]) {
            throw new AlgorithmError(`Invalid matrix size. Matrix is ${this.size()}, but was expected "col(${j})"`);
        }

        return this.data.map((row) => row[j]);
    }

    public get(i: number, j: number): number {
        const [h, w] = this.size();

        if (i >= h || j >= w) {
            throw new AlgorithmError(`Invalid matrix size. Matrix is ${this.size()}, but was expected "get(${i}, ${j})"`);
        }

        return this.data[i][j];
    }

    public isZero(): boolean {
        return this instanceof ZeroMatrix;
    }

    public apply(fn: (i: number, j: number, e: number) => number): Matrix {
        if (this.isZero()) {
            return new ZeroMatrix();
        }

        return new Matrix(this.data.map((row, i) => row.map((e, j) => fn(i, j, e))));
    }

    public add(other: Matrix): Matrix {
        if (other.isZero()) {
            return new ZeroMatrix();
        }

        return this.apply((i, j, e) => e + other.get(i, j));
    }

    public mull(other: Matrix): Matrix {
        if (other.isZero()) {
            return new ZeroMatrix();
        }

        const scalar = (a: number[], b: number[]) => a.reduce((t, c, i) => t + c * b[i], 0);

        return this.apply((i, j, e) => scalar(this.row(i), other.col(j)));
    }

    public transpose(): Matrix {
        return this.apply((i, j, _) => this.get(j, i));
    }

    public toString(): string {
        return this.data.map((row) => row.join(' ')).join('\n');
    }
}

class ZeroMatrix extends Matrix {
    public constructor() {
        super([[]]);
    }

    toString(): string {
        return '0';
    }
}

class AlgorithmError extends Error {}

namespace GraphNodes {
    export abstract class Element {
        // fixme
        public v: Matrix | undefined = new ZeroMatrix();
        public df: Matrix | undefined = new ZeroMatrix();

        public abstract eval(): void;
        public abstract diff(): void;
    }

    export class Var extends Element {
        public readonly name: string;

        public constructor(name: string) {
            super();
            this.name = name;
        }

        eval(): void {
            if (this.v?.isZero() ?? true) {
                this.v = new ZeroMatrix();
                this.df = new ZeroMatrix();

                throw new AlgorithmError(`Variable [${this.name}] is not assigned. It was interpreted as zero-matrix`)
            }

            this.df = this.v!.apply(() => 0);
        }

        diff(): void {}
    }

    export abstract class Operation extends Element {
        protected readonly children: Element[];

        public constructor(children: Element[]) {
            super();
            this.children = children;
        }

        public eval(): void {
            this.v = this.calc();
            this.df = this.v.apply(() => 0);
        }
        protected abstract calc(): Matrix;
    }
    export class Add extends Operation {
        calc(): Matrix {
            return this.children.map((e) => e.v!).reduce((t, c) => t.add(c));
        }

        diff(): void {
            this.children.forEach((e) => e.df = this.df!);
        }
    }
    export class Tanh extends Operation {
        calc(): Matrix {
            return this.children[0].v!.apply((i, j, e) => Math.tanh(e));
        }

        diff(): void {
            this.children[0].df = this.df!.apply((i, j, e) => 1 - e ** 2);
        }
    }
    export class Mul extends Operation {
        calc(): Matrix {
            const [a, b] = this.children;

            return a.v!.mull(b.v!);
        }

        diff(): void {
            const [a, b] = this.children;

            a.df = this.df!.mull(b.df!.transpose());
            b.df = a.df!.transpose().mull(this.df!);
        }
    }
}

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

                    switch (e.constructor) {
                        case FunctionTree.Add:
                            return new GraphNodes.Add(operands);
                        case FunctionTree.Mul:
                            return new GraphNodes.Mul(operands);
                        case FunctionTree.Tanh:
                            return new GraphNodes.Tanh(operands);
                        default:
                            throw 'UNKNOWN OPERATION';
                    }
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
        for (const [e, info] of [...this.mapping.values()].sort(([ , {index: i1}], [ , {index: i2}]) => i2 - i1)) {
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
        for (const [e, info] of [...this.mapping.values()].sort(([ , {index: i1}], [ , {index: i2}]) => i2 - i1).reverse()) {
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
