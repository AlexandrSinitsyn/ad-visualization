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
}

export class Const extends Node {
    public readonly v: number;

    public constructor(v: number) {
        super();
        this.v = v;
    }
}

export class Variable extends Node {
    public readonly name: string;

    public constructor(name: string) {
        super();
        this.name = name;
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
}

export class Operation extends Node {
    public readonly name: string;
    public readonly children: Node[];

    public constructor(name: string, children: Node[]) {
        super();
        this.name = name;
        this.children = children;
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
