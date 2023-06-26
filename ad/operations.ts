// noinspection JSUnusedLocalSymbols

import { FunctionTree } from "./function-tree.js";
import { GraphNodes } from "./graph-nodes.js";
import { Matrix } from "../util/matrix.js";

export const parserMapping: Map<string, (args: FunctionTree.Node[]) => FunctionTree.Node> = new Map();
export const algoMapping: Map<string, (args: GraphNodes.Element[]) => GraphNodes.Operation> = new Map();
export const functions: Map<string, FunctionTree.OperationType> = new Map();

function factory(symbol: string, type: FunctionTree.OperationType,
                 toTex: (...operands: string[]) => string,
                 calc: (...operands: GraphNodes.Element[]) => Matrix,
                 diff: (df: Matrix, ...operands: GraphNodes.Element[]) => void): true {
    const ParserOp = class ParserOp extends FunctionTree.Operation {
        constructor(operands: FunctionTree.Node[]) {
            super(symbol, type, operands);
        }

        protected toTexImpl(...children: string[]): string {
            return toTex(...children);
        }
    }

    const AlgoOp = class AlgoOp extends GraphNodes.Operation {
        constructor(operands: GraphNodes.Element[]) {
            super(operands);
        }

        protected calc(): Matrix {
            return calc(...this.children);
        }

        diff(): void {
            this.children.forEach(it => it.df = it.v.apply(() => 0))
            diff(this.df, ...this.children);
        }
    }

    parserMapping.set(symbol, (args) => new ParserOp(args));
    algoMapping.set(symbol, (args) => new AlgoOp(args));
    functions.set(symbol, type);

    return true;
}

const Plus = factory(
    '+', FunctionTree.OperationType.INFIX,
    (a, b) => `${a} + ${b}`,
    (a, b) => a.v.add(b.v),
    (df, a, b) => {
        a.df = a.df.add(df);
        b.df = b.df.add(df);
    }
);

const Add = factory(
    'add', FunctionTree.OperationType.FUNCTION,
    (...args) => `add\\left(${args.join(', ')}\\right)`,
    (...args) => args.map((e) => e.v).reduce((t, c) => t.add(c)),
    (df, ...args) => args.forEach((e) => e.df = e.df.add(df))
);

const Tanh = factory(
    'tanh', FunctionTree.OperationType.FUNCTION,
    (x) => `\\tanh\\left(${x}\\right)`,
    (x) => x.v.apply((i, j, e) => Math.tanh(e)),
    (df, x) => x.df = x.df.add(df.apply((i, j, e) => 1 - e ** 2))
);

const Mul = factory(
    '*', FunctionTree.OperationType.INFIX,
    (a, b) => `${a} * ${b}`,
    (a, b) => a.v.mul(b.v),
    (df, a, b) => {
        a.df = a.df.add(df.mul(b.v.transpose()));
        b.df = b.df.add(a.v.transpose().mul(df));
    }
);

const Adamar = factory(
    'had', FunctionTree.OperationType.FUNCTION,
    (...args) => `had\\left(${args.join(', ')}\\right)`,
    (...args) => args.map((e) => e.v).reduce((a, b) => a.adamar(b)),
    (df, ...args) => args.forEach((child) => {
        const ms = args.filter((x) => x !== child).map((e) => e.v);
        ms.push(df);
        child.df = child.df.add(ms.reduce((a, b) => a.adamar(b)))
    })
);
