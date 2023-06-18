export namespace FunctionTree {
    export interface Node {
        arrangeByDepth(depth: number): Map<number, Node[]>
        toString(): string;
        toTex(): string;
    }

    abstract class Element implements Node {
        public arrangeByDepth(depth: number): Map<number, Node[]> {
            return new Map([[depth, [this]]]);
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

    enum OperationType {
        PREFIX,
        POSTFIX,
        INFIX,
        FUNCTION,
    }

    export abstract class Operation implements Node {
        public readonly symbol: string;
        public readonly type: OperationType;
        public readonly operands: Node[];

        protected constructor(symbol: string, type: OperationType, operands: Node[]) {
            this.symbol = symbol;
            this.type = type;
            this.operands = operands;
        }

        arrangeByDepth(depth: number): Map<number, FunctionTree.Node[]> {
            return this.operands.map((n) => n.arrangeByDepth(depth + 1)).reduce((t, c) => {
                [...c.entries()].forEach(([k, v]) => {
                    if (!t.has(k)) {
                        t.set(k, []);
                    }

                    t.get(k)!.push(...v);
                })

                return t;
            });
        }

        public toString(): string {
            switch (this.type) {
                case OperationType.PREFIX:
                    return this.symbol + this.operands.join(" ");
                case OperationType.POSTFIX:
                    return this.operands.join(" ") + this.symbol;
                case OperationType.INFIX:
                    return this.operands.join(` ${this.symbol} `);
                case OperationType.FUNCTION:
                    return this.symbol + "(" + this.operands.join(", ") + ")";
            }
        }

        public toTex(): string {
            return this.toTexImpl(...this.operands.map((n) => n.toTex()));
        }

        protected toTexImpl(...children: string[]): string {
            return this.toString().replace(' ', '~');
        }
    }
    export class Add extends Operation {
        public constructor(args: Node[]) {
            super("+", OperationType.INFIX, args);
        }
    }
    export class Div extends Operation {
        public constructor(args: Node[]) {
            super("/", OperationType.INFIX, args);
        }

        protected toTexImpl(...args: string[]): string {
            return args.reduce((t, c) => `\\dfrac{${t}}{${c}}`);
        }
    }
    export class Tanh extends Operation {
        public constructor(x: Node) {
            super("tanh", OperationType.FUNCTION, [x]);
        }

        protected toTexImpl(x: string): string {
            return `\\tanh{\\left(${x}\\right)}`;
        }
    }

    export class ErrorNode extends Operation {
        private readonly content: string;
        private readonly message: string;

        public constructor(content: string, message: string, children: Node[]) {
            super('???', OperationType.FUNCTION, children);
            this.content = content;
            this.message = message;
        }

        protected toTexImpl(children: string): string {
            return `{\\color{red}${this.content}}\\left(${this.operands.map((e) => e.toTex()).join(", ")}\\right)`;
        }
    }
}
