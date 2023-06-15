export abstract class Node {
    private readonly _parents: Node[];

    protected constructor() {
        this._parents = [];
    }

    get parents(): Node[] {
        return this._parents;
    }
}

export class ErrorNode extends Node {
    public readonly content: string;
    public readonly children: Node[];

    public constructor(content: string, children: Node[]) {
        super();
        this.content = content;
        this.children = children;
    }

    public toString(): string {
        return `ERROR[${this.content}] of (${this.children.map((e) => e.toString()).join(", ")})`;
    }
}

export class Const extends Node {
    public readonly v: number;

    public constructor(v: number) {
        super();
        this.v = v;
    }

    public toString(): string {
        return this.v + '';
    }
}

export class Variable extends Node {
    public readonly name: string;

    public constructor(name: string) {
        super();
        this.name = name;
    }

    public toString(): string {
        return this.name;
    }
}

export class RuleRef extends Node {
    public readonly name: string;
    public readonly operands: Node[];

    public constructor(name: string, operands: Node[]) {
        super();
        this.name = name;
        this.operands = operands;
    }

    public toString(): string {
        return `ref:${this.name}(${this.operands.map((e) => e.toString()).join(", ")})`;
    }
}

export class Operation extends Node {
    public readonly name: string;
    public readonly children: Node[];

    public constructor(name: string, children: Node[]) {
        super();
        this.name = name;
        this.children = children;
    }

    public toString(): string {
        return `${this.name}(${this.children.map((e) => e.toString()).join(", ")})`;
    }
}

export class Rule {
    public readonly name: string;
    public readonly content: Node;

    public constructor(name: string, content: Node) {
        this.name = name;
        this.content = content;
    }
}
