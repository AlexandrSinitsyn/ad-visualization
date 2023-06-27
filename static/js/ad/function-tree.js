export var FunctionTree;
(function (FunctionTree) {
    class Node {
        constructor(priority) {
            this.priority = priority;
        }
    }
    FunctionTree.Node = Node;
    class Element extends Node {
        arrangeByDepth(depth) {
            return new Map([[depth, [this]]]);
        }
        toTex(parentPriority) {
            return this.toString();
        }
    }
    class Variable extends Element {
        constructor(name) {
            super(undefined);
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
    let Priority;
    (function (Priority) {
        Priority[Priority["ADD"] = 0] = "ADD";
        Priority[Priority["MUL"] = 1] = "MUL";
    })(Priority = FunctionTree.Priority || (FunctionTree.Priority = {}));
    class Operation extends Node {
        constructor(symbol, type, operands, priority = undefined) {
            super(priority);
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
        toString(operands = this.operands.map((e) => e.toString())) {
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
        toTex(parentPriority) {
            const tex = this.toTexImpl(...this.operands.map((n) => n.toTex(this.priority)));
            return (parentPriority !== undefined
                && this.priority !== undefined
                && parentPriority > this.priority) ? `(${tex})` : tex;
        }
        toTexImpl(...children) {
            return this.toString().replace(' ', '~');
        }
    }
    FunctionTree.Operation = Operation;
    class Rule /* named expression *//* named expression */  extends Node {
        constructor(name, content) {
            super(undefined);
            this.name = name;
            this.content = content;
        }
        arrangeByDepth(depth) {
            return this.content.arrangeByDepth(depth);
        }
        toString(content = this.content.toString()) {
            return `${this.name} = ${content}`;
        }
        toTex(parentPriority) {
            return `${this.name} = ${this.content.toTex(parentPriority)}`;
        }
    }
    FunctionTree.Rule = Rule;
    class ErrorNode extends Operation {
        constructor(content, message, children) {
            super('???', OperationType.FUNCTION, children);
            this.content = content;
            this.message = message;
        }
        toTexImpl(children) {
            return `{\\color{red}${this.content}}\\left(${this.operands.map((e) => e.toTex(this.priority)).join(", ")}\\right)`;
        }
    }
    FunctionTree.ErrorNode = ErrorNode;
})(FunctionTree || (FunctionTree = {}));
