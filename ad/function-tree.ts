export namespace FunctionTree {
    export interface Node {
        arrangeByDepth(depth: number): [Node, number][];
    }

    abstract class Element implements Node {
        arrangeByDepth(depth: number): [FunctionTree.Node, number][] {
            return [[this, depth]];
        }
    }
    export class Const extends Element {
        public readonly value: number;

        public constructor(value: number) {
            super();
            this.value = value;
        }

        public toString(): string {
            return this.value + "";
        }
    }
    export class Variable extends Element {
        public readonly name: string;

        public constructor(name: string) {
            super();
            this.name = name;
        }

        public toString(): string {
            return this.name;
        }
    }

    abstract class Operation<Children extends Node | Node[]> implements Node {
        private readonly symbol: string;
        public readonly operands: Children;

        protected constructor(symbol: string, operands: Children) {
            this.symbol = symbol;
            this.operands = operands;
        }

        arrangeByDepth(depth: number): [FunctionTree.Node, number][] {
            const ops: Node[] = this.operands instanceof Node ? [this.operands as Node] : this.operands as Node[];

            const deepSearch: [Node, number][] = [[this, depth], ...ops.map((n) => n.arrangeByDepth(depth + 1)).flat()];
            return deepSearch.sort(([_, d1], [__, d2]) => d2 - d1)
        }

        public toString(): string {
            if (this.operands instanceof Node) {
                return this.symbol + this.operands.toString();
            } else {
                const ops = this.operands as Node[];

                if (ops.length === 2) {
                    return ops[0].toString() + ` ${this.symbol} ` + ops[1].toString();
                } else {
                    return this.symbol + "(" + ops.join(", ") + ")";
                }
            }
        }
    }
    export class Add extends Operation<[Node, Node]> {
        constructor(a: Node, b: Node) {
            super("+", [a, b]);
        }
    }
    export class Tanh extends Operation<Node> {
        constructor(x: Node) {
            super("tanh", x);
        }
    }
}
