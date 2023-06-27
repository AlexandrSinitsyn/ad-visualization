export class Node {
    constructor() {
        this._parents = [];
    }
    get parents() {
        return this._parents;
    }
}
export class ErrorNode extends Node {
    constructor(content, message, children) {
        super();
        this.content = content;
        this.message = message;
        this.children = children;
    }
    toString() {
        return `ERROR[${this.content}] of (${this.children.map((e) => e.toString()).join(", ")})`;
    }
}
export class Variable extends Node {
    constructor(name) {
        super();
        this.name = name;
    }
    toString() {
        return this.name;
    }
}
export class RuleRef extends Node {
    constructor(name, operands) {
        super();
        this.name = name;
        this.operands = operands;
    }
    toString() {
        return `ref:${this.name}(${this.operands.map((e) => e.toString()).join(", ")})`;
    }
}
export class Operation extends Node {
    constructor(name, children) {
        super();
        this.name = name;
        this.children = children;
    }
    toString() {
        return `${this.name}(${this.children.map((e) => e.toString()).join(", ")})`;
    }
}
export class Rule {
    constructor(name, content) {
        this.name = name;
        this.content = content;
    }
    toString() {
        return `${this.name} = ${this.content.toString()}`;
    }
}
