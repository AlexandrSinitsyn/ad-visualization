export var FunctionTree;
(function (FunctionTree) {
    class Element {
        arrangeByDepth(depth) {
            return new Map([[depth, [this]]]);
        }
        toTex() {
            return this.toString();
        }
    }
    class Variable extends Element {
        constructor(name) {
            super();
            this.name = name;
        }
        toString() {
            return this.name;
        }
    }
    FunctionTree.Variable = Variable;
    let OperationType;
    (function (OperationType) {
        OperationType[OperationType["PREFIX"] = 0] = "PREFIX";
        OperationType[OperationType["POSTFIX"] = 1] = "POSTFIX";
        OperationType[OperationType["INFIX"] = 2] = "INFIX";
        OperationType[OperationType["FUNCTION"] = 3] = "FUNCTION";
    })(OperationType = FunctionTree.OperationType || (FunctionTree.OperationType = {}));
    class Operation {
        constructor(symbol, type, operands) {
            this.symbol = symbol;
            this.type = type;
            this.operands = operands;
        }
        arrangeByDepth(depth) {
            return this.operands.map((n) => n.arrangeByDepth(depth + 1)).reduce((t, c) => {
                [...c.entries()].forEach(([k, v]) => {
                    if (!t.has(k)) {
                        t.set(k, []);
                    }
                    t.get(k).push(...v);
                });
                return t;
            });
        }
        toString() {
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
        toTex() {
            return this.toTexImpl(...this.operands.map((n) => n.toTex()));
        }
        toTexImpl(...children) {
            return this.toString().replace(' ', '~');
        }
    }
    FunctionTree.Operation = Operation;
    class ErrorNode extends Operation {
        constructor(content, message, children) {
            super('???', OperationType.FUNCTION, children);
            this.content = content;
            this.message = message;
        }
        toTexImpl(children) {
            return `{\\color{red}${this.content}}\\left(${this.operands.map((e) => e.toTex()).join(", ")}\\right)`;
        }
    }
    FunctionTree.ErrorNode = ErrorNode;
})(FunctionTree || (FunctionTree = {}));
