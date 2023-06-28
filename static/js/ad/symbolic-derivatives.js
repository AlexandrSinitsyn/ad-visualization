// noinspection JSUnusedGlobalSymbols
export var SymbolicDerivatives;
(function (SymbolicDerivatives) {
    let PriorityLevel;
    (function (PriorityLevel) {
        PriorityLevel[PriorityLevel["ADD"] = 0] = "ADD";
        PriorityLevel[PriorityLevel["MUL"] = 1] = "MUL";
        PriorityLevel[PriorityLevel["POW"] = 2] = "POW";
        PriorityLevel[PriorityLevel["UNARY"] = 3] = "UNARY";
        PriorityLevel[PriorityLevel["FUNCTION"] = 4] = "FUNCTION";
        PriorityLevel[PriorityLevel["ELEMENT"] = 5] = "ELEMENT";
    })(PriorityLevel || (PriorityLevel = {}));
    class Variable {
        constructor(name) {
            this.name = name;
        }
        get priority() {
            return PriorityLevel.ELEMENT;
        }
        simplify() {
            return this;
        }
        eq(other) {
            return other instanceof Variable && other.name === this.name;
        }
        toString() {
            return this.name;
        }
    }
    class Const {
        constructor(value) {
            this.value = value;
        }
        get name() {
            return 'const';
        }
        get priority() {
            return PriorityLevel.ELEMENT;
        }
        simplify() {
            return this;
        }
        eq(other) {
            return other instanceof Const && other.value === this.value;
        }
        toString() {
            return this.value + '';
        }
    }
    class Operation {
        constructor(name, operands, priority, assoc = [true, true]) {
            this.name = name;
            this.operands = operands;
            this._priority = priority;
            this.assoc = assoc;
        }
        get priority() {
            return this._priority;
        }
        eq(other) {
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
        simplify() {
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
            }
            else if (b instanceof Empty) {
                return a.simplify();
            }
            return this.simplifyImpl();
        }
        toString() {
            switch (this.operands.length) {
                case 1:
                    const [x] = this.operands;
                    return this.toStringImpl(x.priority < PriorityLevel.FUNCTION ? `(${x.toString()})` : x.toString());
                case 2:
                    const [a, b] = this.operands;
                    const lessAndNotVar = (n, isLeft) => n.priority < PriorityLevel.ELEMENT && (this.priority > n.priority ||
                        (!(isLeft ? this.assoc[0] : this.assoc[1]) && this.name === n.name));
                    if (!b) {
                        return this.toStringImpl(lessAndNotVar(a, true) ? `(${a.toString()})` : a.toString());
                    }
                    return this.toStringImpl(lessAndNotVar(a, true) ? `(${a.toString()})` : a.toString(), lessAndNotVar(b, false) ? `(${b.toString()})` : b.toString());
                default:
                    return this.toStringImpl(...this.operands.map((e) => e.toString()));
            }
        }
    }
    function op(name, priority, str, simplify, assoc = [true, true]) {
        const Op = class Op extends Operation {
            constructor(operands) {
                super(name, operands, priority, assoc);
            }
            simplifyImpl() {
                return simplify(this, ...this.operands.map((v) => v.simplify()));
            }
            toStringImpl(...operands) {
                return str(...operands.map((v) => v.toString()));
            }
        };
        return (...operands) => new Op(operands).simplify();
    }
    SymbolicDerivatives.Add = op('add', PriorityLevel.ADD, (a, b) => `${a} + ${b}`, (self, a, b) => a.eq(SymbolicDerivatives.ZERO) ? b : b.eq(SymbolicDerivatives.ZERO) ? a : a.eq(b) ? SymbolicDerivatives.Mul(SymbolicDerivatives.TWO, a).simplify() : self);
    SymbolicDerivatives.Sub = op('sub', PriorityLevel.ADD, (a, b) => `${a} - ${b}`, (self, a, b) => a.eq(SymbolicDerivatives.ZERO) ? SymbolicDerivatives.Neg(b).simplify() : b.eq(SymbolicDerivatives.ZERO) ? a : a.eq(b) ? SymbolicDerivatives.ZERO : self, [false, true]);
    SymbolicDerivatives.Neg = op('neg', PriorityLevel.UNARY, (x) => `-${x}`, (self, x) => x instanceof Const ? SymbolicDerivatives.Num(-x.value) : self);
    SymbolicDerivatives.Mul = op('mul', PriorityLevel.MUL, (a, b) => `${a} * ${b}`, (self, a, b) => {
        if (a.eq(SymbolicDerivatives.ZERO) || b.eq(SymbolicDerivatives.ZERO)) {
            return SymbolicDerivatives.ZERO;
        }
        else if (a.eq(SymbolicDerivatives.ONE)) {
            return b;
        }
        else if (b.eq(SymbolicDerivatives.ONE)) {
            return a;
        }
        else if (a instanceof Const && b instanceof Const) {
            return SymbolicDerivatives.Num(a.value * b.value);
        }
        else {
            return self;
        }
    });
    SymbolicDerivatives.Div = op('div', PriorityLevel.MUL, (a, b) => `${a} / ${b}`, (self, a, b) => b.eq(SymbolicDerivatives.ONE) ? a : self, [false, true]);
    SymbolicDerivatives.Pow = op('pow', PriorityLevel.POW, (a, b) => `${a} ** ${b}`, (self, a, b) => a.eq(SymbolicDerivatives.ZERO) ? SymbolicDerivatives.ZERO : a.eq(SymbolicDerivatives.ONE) ? SymbolicDerivatives.ONE : b.eq(SymbolicDerivatives.ZERO) ? SymbolicDerivatives.ONE : b.eq(SymbolicDerivatives.ONE) ? a : self, [true, false]);
    SymbolicDerivatives.Tns = op('tns', PriorityLevel.UNARY, (a) => `${a}^T`, (self, a) => self);
    SymbolicDerivatives.AOp = (name) => op(name, PriorityLevel.FUNCTION, (...args) => `${name}(${args.join(', ')})`, (self, a, b) => self);
    SymbolicDerivatives.Var = (name) => new Variable(name);
    SymbolicDerivatives.Num = (value) => new Const(value);
    SymbolicDerivatives.ZERO = SymbolicDerivatives.Num(0);
    SymbolicDerivatives.ONE = SymbolicDerivatives.Num(1);
    SymbolicDerivatives.TWO = SymbolicDerivatives.Num(2);
    class Empty {
        get name() {
            return 'empty';
        }
        get priority() {
            return PriorityLevel.ELEMENT;
        }
        simplify() {
            return this;
        }
        eq() {
            return false;
        }
        toString() {
            throw 'PRIORITY OF SymbolicDerivatives.Empty IS UNDEFINED';
        }
    }
    SymbolicDerivatives.Empty = Empty;
})(SymbolicDerivatives || (SymbolicDerivatives = {}));
