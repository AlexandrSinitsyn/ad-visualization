// noinspection JSUnusedGlobalSymbols

export namespace SymbolicDerivatives {
    enum PriorityLevel {
        ADD,
        MUL,
        POW,
        UNARY,
        FUNCTION,
        ELEMENT,
    }

    export interface Node {
        get name(): string;
        get priority(): PriorityLevel;
        simplify(): Node;
        eq(other: Node): boolean;
        toString(): string;
    }

    class Variable implements Node {
        public readonly name: string;

        public constructor(name: string) {
            this.name = name;
        }

        get priority(): PriorityLevel {
            return PriorityLevel.ELEMENT;
        }

        simplify(): Node {
            return this;
        }

        eq(other: Node): boolean {
            return other instanceof Variable && other.name === this.name;
        }

        toString(): string {
            return this.name;
        }
    }

    class Const implements Node {
        public readonly value: number;

        public constructor(value: number) {
            this.value = value;
        }

        get name(): string {
            return 'const';
        }

        get priority(): PriorityLevel {
            return PriorityLevel.ELEMENT;
        }

        simplify(): Node {
            return this;
        }

        eq(other: Node): boolean {
            return other instanceof Const && other.value === this.value;
        }

        toString(): string {
            return this.value + '';
        }
    }

    abstract class Operation<T extends [Node] | [Node, Node] | Node[]> implements Node {
        public readonly name: string;
        public readonly operands: T;
        private readonly _priority: PriorityLevel;
        private readonly assoc: [boolean, boolean];

        protected constructor(name: string, operands: T, priority: PriorityLevel, assoc: [boolean, boolean] = [true, true]) {
            this.name = name;
            this.operands = operands;
            this._priority = priority;
            this.assoc = assoc;
        }

        get priority(): PriorityLevel {
            return this._priority;
        }

        eq(other: Node): boolean {
            if (!(other instanceof Operation && other.name === this.name)) {
                return false;
            }

            const [a, b] = this.operands;
            const [$a, $b] = other.operands;

            if (!b) {
                return a.eq($a);
            }

            return (a.eq($a) && b.eq($b)) || (a.eq($b) && b.eq($a));
        }

        public simplify(): Node {
            // switch (this.operands.length) {
            //     case 1:
            //         const [x] = this.operands;
            //         return x instanceof Empty ? x : this.simplifyImpl();
            //     case 2:
            //         const [a, b] = this.operands;
            //
            //         if (a instanceof Empty) {
            //             return b!.simplify();
            //         } else if (b instanceof Empty) {
            //             return a.simplify();
            //         }
            //
            //         return this.simplifyImpl();
            //     default:
            //
            // }

            // const args = this.operands.filter((v) => !(v instanceof Empty));
            //
            // if (args.length === this.operands.length) {
            //     return this.simplifyImpl();
            // }
            //
            // if (args.length === 1) {
            //     return args[0].simplify();
            // }

            const [a, b] = this.operands;

            if (!b) {
                if (a instanceof Empty) {
                    return a;
                }

                return this.simplifyImpl();
            }

            if (a instanceof Empty) {
                return b.simplify();
            } else if (b instanceof Empty) {
                return a.simplify();
            }

            return this.simplifyImpl();
        }

        protected abstract simplifyImpl(): Node;

        public toString(): string {
            switch (this.operands.length) {
                case 1:
                    const [x] = this.operands;
                    return this.toStringImpl(x.priority < PriorityLevel.FUNCTION ? `(${x.toString()})` : x.toString());
                case 2:
                    const [a, b] = this.operands;

                    const lessAndNotVar = (n: Node, isLeft: boolean) => n.priority < PriorityLevel.ELEMENT && (this.priority > n.priority ||
                        (!(isLeft ? this.assoc[0] : this.assoc[1]) && this.name === n.name));

                    if (!b) {
                        return this.toStringImpl(lessAndNotVar(a, true) ? `(${a.toString()})` : a.toString());
                    }

                    return this.toStringImpl(
                        lessAndNotVar(a, true) ? `(${a.toString()})` : a.toString(),
                        lessAndNotVar(b, false) ? `(${b.toString()})` : b.toString(),
                    );
                default:
                    return this.toStringImpl(...this.operands.map((e) => e.toString()));
            }
        }

        protected abstract toStringImpl(...operands: string[]): string;
    }

    function op<T extends [Node] | [Node, Node]>(
        name: string,
        priority: PriorityLevel,
        str: (...operands: string[]) => string,
        simplify: (self: Node, ...operands: Node[]) => Node,
        assoc: [boolean, boolean] = [true, true],
    ): (...operands: Node[]) => Node {
        const Op = class Op extends Operation<T> {
            constructor(operands: T) {
                super(name, operands, priority, assoc);
            }

            simplifyImpl(): Node {
                return simplify(this, ...this.operands.map((v) => v.simplify()));
            }

            toStringImpl(...operands: string[]): string {
                return str(...operands.map((v) => v.toString()));
            }
        }

        return (...operands) => new Op(operands as T).simplify();
    }

    export const Add = op<[Node, Node]>('add', PriorityLevel.ADD, (a, b) => `${a} + ${b}`,
        (self, a, b) => a.eq(ZERO) ? b : b.eq(ZERO) ? a : a.eq(b) ? Mul(TWO, a).simplify() : self);
    export const Sub = op<[Node, Node]>('sub', PriorityLevel.ADD, (a, b) => `${a} - ${b}`,
        (self, a, b) => a.eq(ZERO) ? Neg(b).simplify() : b.eq(ZERO) ? a : a.eq(b) ? ZERO : self, [false, true]);
    export const Neg = op<[Node]>('neg', PriorityLevel.UNARY, (x) => `-${x}`,
        (self, x) => x instanceof Const ? Num(-x.value) : self);
    export const Mul = op<[Node, Node]>('mul', PriorityLevel.MUL, (a, b) => `${a} * ${b}`,
        (self, a, b) => {
            if (a.eq(ZERO) || b.eq(ZERO)) {
                return ZERO;
            } else if (a.eq(ONE)) {
                return b;
            } else if (b.eq(ONE)) {
                return a;
            } else if (a instanceof Const && b instanceof Const) {
                return Num(a.value * b.value);
            } else {
                return self;
            }
        });
    export const Div = op<[Node, Node]>('div', PriorityLevel.MUL, (a, b) => `${a} / ${b}`,
        (self, a, b) => b.eq(ONE) ? a : self, [false, true]);
    export const Pow = op<[Node, Node]>('pow', PriorityLevel.POW, (a, b) => `${a} ** ${b}`,
        (self, a, b) => a.eq(ZERO) ? ZERO : a.eq(ONE) ? ONE : b.eq(ZERO) ? ONE : b.eq(ONE) ? a : self, [true, false]);
    export const Tns = op<[Node]>('tns', PriorityLevel.UNARY, (a) => `${a}^T`,
        (self, a) => self);
    export const AOp = (name: string) => op<[Node, Node]>(name, PriorityLevel.FUNCTION, (...args) => `${name}(${args.join(', ')})`,
        (self, a, b) => self);

    export const Var = (name: string) => new Variable(name);
    export const Num = (value: number) => new Const(value);

    export const ZERO = Num(0);
    export const ONE = Num(1);
    export const TWO = Num(2);

    export class Empty implements Node {
        get name(): string {
            return 'empty';
        }

        get priority(): PriorityLevel {
            return PriorityLevel.ELEMENT;
        }

        simplify(): Node {
            return this;
        }

        eq(): boolean {
            return false;
        }

        toString(): string {
            throw 'PRIORITY OF SymbolicDerivatives.Empty IS UNDEFINED';
        }
    }
}
