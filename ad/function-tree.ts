export namespace FunctionTree {
    export interface Node {
        arrangeByDepth(depth: number): [Node, number][];
        toString(): string;
        toTex(): string;
    }

    abstract class Element implements Node {
        public arrangeByDepth(depth: number): [FunctionTree.Node, number][] {
            return [[this, depth]];
        }

        public toTex(): string {
            return this.toString();
        }
    }

    export class Const extends Element {
        public readonly value: number;

        public constructor(value: number) {
            super();
            this.value = value;
        }

        public toString(): string {
            return this.value + '';
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
        readonly symbol: string;
        public readonly operands: Children;

        protected constructor(symbol: string, operands: Children) {
            this.symbol = symbol;
            this.operands = operands;
        }

        arrangeByDepth(depth: number): [FunctionTree.Node, number][] {
            const ops: Node[] = (this.operands instanceof Array ? this.operands as Node[] : [this.operands as Node]);

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

        public toTex(): string {
            console.log(this.operands)
            console.log(typeof this.operands, typeof Node)
            return this.toTexImpl(...
                this.operands instanceof Array ?
                    (this.operands as Node[]).map((n) => n.toTex())
                    : [(this.operands as Node).toTex()]
            );
        }

        protected abstract toTexImpl(...children: string[]): string;
    }
    export class Add extends Operation<[Node, Node]> {
        public constructor(a: Node, b: Node) {
            super("+", [a, b]);
        }

        protected toTexImpl(a: string, b: string): string {
            return a + ' + ' + b;
        }
    }
    export class Div extends Operation<[Node, Node]> {
        public constructor(a: Node, b: Node) {
            super("/", [a, b]);
        }

        protected toTexImpl(a: string, b: string): string {
            return `\\dfrac{${a}}{${b}}`;
        }
    }
    export class Tanh extends Operation<Node> {
        public constructor(x: Node) {
            super("tanh", x);
        }

        protected toTexImpl(x: string): string {
            return `\\tanh{\\left(${x}\\right)}`;
        }
    }
}
