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
    class AbstractOperation {
        constructor(name, operands, priority) {
            this.name = name;
            this.operands = operands;
            this._priority = priority;
        }
        get priority() {
            return this._priority;
        }
        toString() {
            return this.toStringImpl(...this.operands.map((e) => e.toString()));
        }
    }
    class Operation extends AbstractOperation {
        constructor(name, operands, priority, assoc = [true, true]) {
            super(name, operands, priority);
            this.assoc = assoc;
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
            const [a, b] = this.operands;
            const lessAndNotVar = (n, isLeft) => n.priority < PriorityLevel.ELEMENT && (this.priority > n.priority ||
                (!(isLeft ? this.assoc[0] : this.assoc[1]) && this.name === n.name));
            if (!b) {
                return this.toStringImpl(lessAndNotVar(a, true) ? `(${a.toString()})` : a.toString());
            }
            return this.toStringImpl(lessAndNotVar(a, true) ? `(${a.toString()})` : a.toString(), lessAndNotVar(b, false) ? `(${b.toString()})` : b.toString());
        }
    }
    class NamedOperation extends AbstractOperation {
        constructor(name, operands) {
            super(name, operands, PriorityLevel.FUNCTION);
        }
        eq(other) {
            if (!(other instanceof NamedOperation && other.name === this.name && other.operands.length === this.operands.length)) {
                return false;
            }
            const used = new Array(other.operands.length).map((_) => false);
            let res = true;
            this.operands.forEach((v) => {
                const found = other.operands.map((e, i) => [e, i]).find(([e, i]) => v.eq(e) && !used[i]);
                if (!found) {
                    res = false;
                }
                else {
                    used[found[1]] = true;
                }
            });
            return used.reduce((a, b) => a && b, res);
        }
        simplify() {
            const args = this.operands.filter((v) => !(v instanceof Empty)).flatMap((v) => {
                if (v instanceof NamedOperation && v.name === this.name) {
                    return v.operands;
                }
                return [v];
            });
            return new NamedOperation(this.name, args);
        }
        toStringImpl(...operands) {
            return this.name + '(' + operands.join(', ') + ')';
        }
    }
    SymbolicDerivatives.NamedOperation = NamedOperation;
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
    SymbolicDerivatives.Neg = op('neg', PriorityLevel.UNARY, (x) => `-${x}`, (self, x) => x instanceof Const ? SymbolicDerivatives.Num(-x.value) : x instanceof Operation && x.name === 'neg' ? x.operands : self);
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
    SymbolicDerivatives.AOp = (name) => (...operands) => new NamedOperation(name, operands);
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
