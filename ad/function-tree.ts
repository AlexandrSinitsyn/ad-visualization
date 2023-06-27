export namespace FunctionTree {
    export interface Node {
        arrangeByDepth(depth: number): Map<number, Node[]>
        toString(): string;
        toTex(parentPriority: Priority | undefined): string;
    }

    abstract class Element implements Node {
        public arrangeByDepth(depth: number): Map<number, Node[]> {
            return new Map([[depth, [this]]]);
        }

        public toTex(parentPriority: Priority | undefined): string {
            return this.toString();
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

    export enum OperationType {
        PREFIX,
        POSTFIX,
        INFIX,
        FUNCTION,
    }

    export enum Priority {
        ADD,
        MUL
    }

    export abstract class Operation implements Node {
        public readonly symbol: string;
        public readonly type: OperationType;
        public readonly operands: Node[];
        public readonly priority: Priority | undefined;

        protected constructor(symbol: string, type: OperationType, operands: Node[], priority: Priority | undefined = undefined) {
            this.symbol = symbol;
            this.type = type;
            this.operands = operands;
            this.priority = priority;
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

        public toString(): string;
        public toString(operands: string[]): string;
        public toString(operands: string[] = this.operands.map((e) => e.toString())): string {
            switch (this.type) {
                case OperationType.PREFIX:
                    return this.symbol + operands.join(" ");
                case OperationType.POSTFIX:
                    return operands.join(" ") + this.symbol;
                case OperationType.INFIX:
                    return operands.join(` ${this.symbol} `);
                case OperationType.FUNCTION:
                    return this.symbol + "(" + operands.join(", ") + ")";
            }
        }

        public toTex(parentPriority: Priority | undefined): string {
            const tex = this.toTexImpl(...this.operands.map((n) => n.toTex(this.priority)));
            return (
                parentPriority !== undefined
                && this.priority !== undefined
                && parentPriority > this.priority
            ) ? `(${tex})` : tex;
        }

        protected toTexImpl(...children: string[]): string {
            return this.toString().replace(' ', '~');
        }
    }

    export class Rule /* named expression */ extends Node {
        public readonly name: string;
        public readonly content: Node;

        public constructor(name: string, content: Node) {
            super(undefined);
            this.name = name;
            this.content = content;
        }

        arrangeByDepth(depth: number): Map<number, FunctionTree.Node[]> {
            return this.content.arrangeByDepth(depth);
        }

        toString(): string;
        toString(content: string): string;
        toString(content: string = this.content.toString()): string {
            return `${this.name} = ${content}`;
        }

        toTex(parentPriority: FunctionTree.Priority | undefined): string {
            return `${this.content.toTex(parentPriority)}`;
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
            return `{\\color{red}${this.content}}\\left(${this.operands.map((e) => e.toTex(this.priority)).join(", ")}\\right)`;
        }
    }
}
