import { FunctionTree } from "./function-tree.js";

class Matrix {
    private readonly data: number[][];

    public constructor(data: number[][]) {
        this.data = data;
    }

    public size(): [number, number] {
        return this.data.length === 0 ? [0, 0] : [this.data.length, this.data[0].length];
    }

    public apply(fn: (i: number, j: number, e: number) => number): Matrix {
        return new Matrix(this.data.map((row, i) => row.map((e, j) => fn(i, j, e))));
    }

    public add(other: Matrix): Matrix {
        return this.apply((i, j, e) => e + other.data[i][j]);
    }

    public mull(other: Matrix): Matrix {
        const scalar = (a: number[], b: number[]) => a.reduce((t, c, i) => t + c * b[i], 0);

        return this.apply((i, j, e) => scalar(this.data[i], other.data.map((row) => row[j])));
    }

    public transpose(): Matrix {
        return this.apply((i, j, _) => this.data[j][i]);
    }
}

export namespace GraphNodes {
    export abstract class Element {
        public v: Matrix | undefined;
        public df: Matrix | undefined;

        public eval(): void {
            this.v = this.calc();
            this.df = this.v.apply(() => 0);
        }
        protected abstract calc(): Matrix;

        public abstract diff(): void;
    }

    export class Var extends Element {
        public readonly name: string;

        public constructor(name: string) {
            super();
            this.name = name;
        }

        calc(): Matrix {
            if (!this.v) {
                this.v = new Matrix([[0]]);
                alert(`Variable [${this.name}] is not assigned. It was interpreted as [[0]]`)
            }

            return this.v;
        }

        diff(): void {}
    }

    export abstract class Operation extends Element {
        protected readonly children: Element[];

        public constructor(children: Element[]) {
            super();
            this.children = children;
        }
    }
    export class Add extends Operation {
        calc(): Matrix {
            return this.children.reduce((t, c) => t.add(c.v!), new Matrix([[0]]));
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

interface Info {
    index: number;
    name: string;
    children: number[];
}

export class Algorithm {
    private readonly graph: FunctionTree.Node[];
    private readonly mapping: Map<FunctionTree.Node, [GraphNodes.Element, Info]>;
    private readonly vars: Map<string, GraphNodes.Var>;

    public constructor(graph: FunctionTree.Node[]) {
        this.graph = graph;
        this.mapping = new Map();
        this.vars = new Map();
    }

    public *step(): Generator<Update> {
        yield* this.init();

        yield* this.calc();

        yield* this.diff();
    }

    private *init(): Generator<Update> {
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

                    switch (e.constructor) {
                        case FunctionTree.Add:
                            return new GraphNodes.Add(e.operands.map((n) => this.mapping.get(n)![0]));
                        case FunctionTree.Tanh:
                            return new GraphNodes.Tanh(e.operands.map((n) => this.mapping.get(n)![0]));
                        default:
                            throw 'UNKNOWN OPERATION';
                    }
                } else {
                    throw 'UNSUPPORTED NODE TYPE';
                }
            })();

            yield {
                index: index,
                name: name,
                children: children,
                v: vertex.v,
                df: vertex.df,
            };

            this.mapping.set(e, [vertex, { name: name, index: index, children: children }]);

            index++;
        }
    }

    private *calc(): Generator<Update> {
        for (const [e, {name, index, children}] of [...this.mapping.values()].sort(([ , {index: i1}], [ , {index: i2}]) => i2 - i1)) {
            e.eval();

            yield {
                index: index,
                name: name,
                children: children,
                v: e.v,
                df: e.df,
            }
        }
    }

    private *diff(): Generator<Update> {
        for (const [e, {name, index, children}] of [...this.mapping.values()].sort(([ , {index: i1}], [ , {index: i2}]) => i2 - i1).reverse()) {
            e.diff();

            yield {
                index: index,
                name: name,
                children: children,
                v: e.v,
                df: e.df,
            }
        }
    }

    public acceptValue(name: string, v: number[][]) {
        if (!this.vars.has(name)) {
            throw `UNKNOWN VARIABLE "${name}"=${v}`;
        }

        this.vars.get(name)!.v = new Matrix(v);
    }
}
