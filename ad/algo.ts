import { FunctionTree } from "./function-tree.js";
import Matrix = MO.Matrix;

export namespace MO {
    export type Matrix = number[][];

    export function add(a: Matrix, b: Matrix): Matrix {
        return indexedApplyByTemplate(a, (i, j) => a[i][j] + b[i][j]);
    }

    export function adamar(a: Matrix, b: Matrix): Matrix {
        return indexedApplyByTemplate(a, (i, j) => a[i][j] * b[i][j]);
    }

    export function apply(a: Matrix, f: (_: number) => number): Matrix {
        return indexedApplyByTemplate(a, (i, j) => f(a[i][j]));
    }

    export function mul(a: Matrix, b: Matrix): Matrix {
        const l = a.length;
        const m = b.length;
        const n = b[0].length;
        const res = genMatrix(l, n)
        for (let i = 0; i < l; i++) {
            for (let j = 0; j < n; j++) {
                for (let k = 0; k < m; k++) {
                    res[i][j] += a[i][k] * b[k][j];
                }
            }
        }
        return res;
    }

    export function transpose(a: Matrix): Matrix {
        const r = a.length;
        const c = a[0].length;
        return indexedApply(c, r, (i, j) => a[j][i]);
    }

    export function genMatrix(r: number, c: number): Matrix {
        const res: Matrix = [];
        for (let i = 0; i < r; i++) {
            res[i] = [];
            for (let j = 0; j < c; j++) {
                res[i][j] = 0.0;
            }
        }
        return res;
    }

    function indexedApplyByTemplate(a: Matrix, f: (r_ind: number, c_ind: number) => number): Matrix {
        return indexedApply(a.length, a[0].length, f);
    }

    function indexedApply(r: number, c: number, f: (r_ind: number, c_ind: number) => number): Matrix {
        const res = genMatrix(r, c)
        for (let i = 0; i < r; i++) {
            for (let j = 0; j < c; j++) {
                res[i][j] = f(i, j);
            }
        }
        return res;
    }
}

export namespace AD {
    import Matrix = MO.Matrix
    import genMatrix = MO.genMatrix;
    import add = MO.add;
    import apply = MO.apply;
    import adamar = MO.adamar;
    import mul = MO.mul;
    import transpose = MO.transpose;

    export abstract class ExpressionElement {
        public value!: Matrix;
        public df!: Matrix;

        public calcInitDf() {
            this.value = this.calc();
            this.df = genMatrix(this.value.length, this.value[0].length)
        }

        protected abstract calc(): Matrix;

        public toString(): string {
            return `${this.constructor.name}(${this.value}, ${this.df})`;
        }
    }

    export class Var extends ExpressionElement {
        readonly name: string;
        val!: Matrix;

        public constructor(name: string) {
            super();
            this.name = name;
        }

        calc(): Matrix {
            return this.val;
        }
    }

    export abstract class OperationNode<Children> extends ExpressionElement {
        public children: Children;

        protected constructor(children: Children) {
            super();
            this.children = children;
        }

        public abstract diffProp(): void;
    }

    export class Tanh extends OperationNode<ExpressionElement> {
        private child: ExpressionElement;

        public constructor(child: ExpressionElement) {
            super(child);
            this.child = child
        }

        calc(): Matrix {
            return apply(this.child.value, Math.tanh);
        }

        diffProp() {
            this.child.df = add(this.child.df, adamar(this.df, apply(this.value, x => 1 - x ** 2)))
        }
    }

    export class Add extends OperationNode<ExpressionElement[]> {
        public constructor(children: ExpressionElement[]) {
            super(children);
        }

        calc(): Matrix {
            return this.children.map(x => x.df).reduce((a, b) => add(a, b));
        }

        diffProp() {
            this.children.forEach(x => x.df = add(x.df, this.df));
        }
    }

    export class Adamar extends OperationNode<ExpressionElement[]> {
        public constructor(children: ExpressionElement[]) {
            super(children);
        }

        calc(): Matrix {
            return this.reduceAdamar(this.children.map(x => x.value));
        }

        private reduceAdamar(ms: Matrix[]): Matrix {
            return ms.reduce((a, b) => adamar(a, b))
        }

        diffProp() {
            for (const child of this.children) {
                const ms = this.children.filter(x => x != child).map(x => x.value)
                ms.push(this.df)
                child.df = add(child.df, this.reduceAdamar(ms));
            }
        }
    }

    export class Mul extends OperationNode<[ExpressionElement, ExpressionElement]> {
        public constructor(children: [ExpressionElement, ExpressionElement]) {
            super(children);
        }

        calc(): Matrix {
            return mul(this.children[0].value, this.children[1].value)
        }

        diffProp() {
            this.children[0].df = add(this.children[0].df, mul(this.df, transpose(this.children[1].value)))
            this.children[1].df = add(this.children[1].df, mul(transpose(this.children[0].value), this.df))
        }
    }
}

import Var = AD.Var;

export interface AlgoUpdate {
    index: number;
    name: string;
    children: number[];
    value: Matrix | undefined;
    df: Matrix | undefined;
}

export class UpdateInfo {
    name: string;
    children: number[];

    constructor(name: string, children: number[]) {
        this.name = name;
        this.children = children;
    }
}

export class Algo {
    private readonly graph: FunctionTree.Node[];
    private readonly nodeToId: Map<FunctionTree.Node, number>;
    private readonly infos: UpdateInfo[];
    private readonly tokens: (Var | AD.OperationNode<any>)[];
    private readonly vars: Map<string, Matrix>;

    constructor(fun: FunctionTree.Node[]) {
        this.graph = fun;
        this.nodeToId = new Map();
        this.infos = [];
        this.tokens = [];
        this.vars = new Map();
    }

    public *step(): Generator<AlgoUpdate> {
        yield* this.init();

        yield* this.calc();

        yield* this.diff();
    }

    private *init(): Generator<AlgoUpdate> {
        let index = 0;
        for (const level of this.graph) {
            let children: number[];
            let name: string;
            let element: Var | AD.OperationNode<any>;
            if (level instanceof FunctionTree.Variable) {
                name = level.name;
                children = [];
                element = new AD.Var(level.name);

                if (!this.vars.has(element.name)) {
                    alert(`Variable is [${element.name}] not assigned`);
                    throw "UNASSIGNED";
                }

                element.val = this.vars.get(element.name)!;
            } else if (level instanceof FunctionTree.Operation) {
                name = level.symbol;
                children = level.operands.map((o) => this.nodeToId.get(o)!);

                if (level instanceof FunctionTree.Add) {
                    element = new AD.Add(children.map(i => this.tokens[i]));
                } else if (level instanceof FunctionTree.Tanh) {
                    element = new AD.Tanh(this.tokens[children[0]]);
                } else {
                    throw new Error("unreachable");
                }
            } else {
                throw new Error("unreachable");
            }

            this.infos.push(new UpdateInfo(name, children));
            this.tokens.push(element);
            this.nodeToId.set(level, index++);

            yield {
                index: index,
                name: name,
                children: children,
                value: undefined,
                df: undefined,
            }
        }
    }

    private *calc(): Generator<AlgoUpdate> {
        for (let i = 0; i < this.tokens.length; i++) {
            let element = this.tokens[i]
            let info = this.infos[i];

            element.calcInitDf();

            yield {
                index: i,
                name: info.name,
                children: info.children,
                value: element.value,
                df: element.df,
            };
        }
    }

    private *diff(): Generator<AlgoUpdate> {
        for (let i = this.tokens.length - 1; i >= 0; i--) {
            let element = this.tokens[i]
            if (element instanceof AD.OperationNode) {
                element.diffProp();
            }
            let info = this.infos[i]
            yield {
                index: i,
                name: info.name,
                children: info.children,
                value: element.value,
                df: element.df,
            };
        }
    }

    public acceptValue(name: string, v: Matrix) {
        this.vars.set(name, v);
    }
}
