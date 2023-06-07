import { FunctionTree } from "./function-tree.js";

export namespace AD {
    export abstract class ExpressionElement {
        public value: number;
        public df: number;
        public initialized: boolean;

        public constructor(value: number) {
            this.value = value;
            this.df = 0;
            this.initialized = false;
        }

        toString(): string {
            return `${this.constructor.name}(${this.value}, ${this.df})`;
        }
    }

    export class Const extends ExpressionElement {}
    export class Var extends ExpressionElement {
        constructor() {
            super(0);
        }
    }

    abstract class OperationNode<Children> extends ExpressionElement {
        public children: Children;

        public constructor(children: Children) {
            super(0);
            this.children = children;
        }

        public abstract calc(children: Children): void;

        public abstract diff(children: Map<number, number>, child: number, de: number): number;
    }

    export class Add extends OperationNode<number[]> {
        calc(children: number[]) {
            this.value = children.reduce((a, b) => a + b);
        }

        diff(children: Map<number, number>, child: number, de: number): number {
            this.df = de;
            return de;
        }
    }

    export class Div extends OperationNode<number[]> {
        calc(children: number[]) {
            this.value = children.reduce((a, b) => a / b);
        }

        diff(children: Map<number, number>, child: number, de: number): number {
            this.df = de;
            return - de / (this.value * this.value);
        }
    }

    export class Tanh extends OperationNode<number> {
        calc(child: number) {
            this.value = Math.tanh(child);
        }

        diff(children: Map<number, number>, child: number, de: number): number {
            return (1 - this.value * this.value) * de;
        }
    }
}

export interface AlgoUpdate {
    index: number;
    name: string;
    children: number[];
    value: number | undefined;
    df: number | undefined;
}

export class Algo {
    private readonly fun: FunctionTree.Node;
    private readonly tree: Map<FunctionTree.Node, number>;
    private readonly graph: AD.ExpressionElement[];
    private index: number;

    constructor(fun: FunctionTree.Node) {
        this.fun = fun;
        this.index = 0;
        this.tree = new Map();
        this.graph = [];
    }

    public *step(): Generator<AlgoUpdate> {
        yield* this.init();
    }

    private *init(): Generator<AlgoUpdate> {
        for (const [level, _] of this.fun.arrangeByDepth(0)) {
            this.tree.set(level, this.index);

            if (level instanceof FunctionTree.Const) {
                this.graph.push(new AD.Const(level.value));
                yield {
                    index: this.index,
                    name: "Const",
                    children: [],
                    value: level.value,
                    df: undefined,
                };
            } else if (level instanceof FunctionTree.Variable) {
                this.graph.push(new AD.Var());
                yield {
                    index: this.index,
                    name: level.name,
                    children: [],
                    value: undefined,
                    df: undefined,
                };
            } else if (level instanceof FunctionTree.Add) {
                let children = level.operands.map((o) => this.tree.get(o)!);
                this.graph.push(new AD.Add(children))
                yield {
                    index: this.index,
                    name: level.symbol,
                    children: children,
                    value: undefined,
                    df: undefined,
                };
            } else if (level instanceof FunctionTree.Div) {
                let children = level.operands.map((o) => this.tree.get(o)!);
                this.graph.push(new AD.Div(children))
                yield {
                    index: this.index,
                    name: level.symbol,
                    children: children,
                    value: undefined,
                    df: undefined,
                };
            } else if (level instanceof FunctionTree.Tanh) {
                let children = this.tree.get(level.operands)!;
                this.graph.push(new AD.Tanh(children))
                yield {
                    index: this.index,
                    name: level.symbol,
                    children: [children],
                    value: undefined,
                    df: undefined,
                };
            }

            this.index++;
        }
    }
}
