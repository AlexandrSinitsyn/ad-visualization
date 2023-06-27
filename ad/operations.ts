// noinspection JSUnusedLocalSymbols

import { FunctionTree } from "./function-tree.js";
import { GraphNodes } from "./graph-nodes.js";
import { Matrix } from "../util/matrix.js";

export const parserMapping: Map<string, (args: FunctionTree.Node[]) => FunctionTree.Node> = new Map();
export const algoMapping: Map<string, (args: GraphNodes.Element[]) => GraphNodes.Operation> = new Map();
export const functions: Map<string, FunctionTree.OperationType> = new Map();

function factory(symbol: string, type: FunctionTree.OperationType,
                 calc: (...operands: GraphNodes.Element[]) => Matrix,
                 toTex: (...operands: string[]) => string,
                 diff: (df: Matrix, ...operands: GraphNodes.Element[]) => void,
                 symbolicDiff: (sdf: string, ...operands: [GraphNodes.Element, string][]) => string[],
                 priority: FunctionTree.Priority | undefined = undefined): true {
    const ParserOp = class ParserOp extends FunctionTree.Operation {
        constructor(operands: FunctionTree.Node[]) {
            super(symbol, type, operands, priority);
        }

        toTexImpl(...children: string[]): string {
            return toTex(...children);
        }
    }

    const AlgoOp = class AlgoOp extends GraphNodes.Operation {
        constructor(operands: GraphNodes.Element[]) {
            super(operands);
        }

        calc(): Matrix {
            return calc(...this.children);
        }

        diff(): void {
            this.children.forEach(it => it.df = it.v.apply(() => 0))
            diff(this.df, ...this.children);
        }

        symbolicDiff(operands: [GraphNodes.Element, string][]): void {
            const symbs = symbolicDiff(this.symbDf, ...operands);

            this.children.forEach((c, i) => c.symbDf += symbs[i]);
            this.symbolicDiffs = this.symbolicDiffs.map((_, i) => symbs[i]);
        }
    }

    parserMapping.set(symbol, (args) => new ParserOp(args));
    algoMapping.set(symbol, (args) => new AlgoOp(args));
    functions.set(symbol, type);

    return true;
}

const Plus = factory(
    '+', FunctionTree.OperationType.INFIX,
    (a, b) => a.v.add(b.v),
    (a, b) => `${a} + ${b}`,
    (df, a, b) => {
        a.df = a.df.add(df);
        b.df = b.df.add(df);
    },
    (sdf, [a, $a], [b, $b]) => [sdf, sdf],
    FunctionTree.Priority.ADD
);

const Add = factory(
    'add', FunctionTree.OperationType.FUNCTION,
    (...args) => args.map((e) => e.v).reduce((t, c) => t.add(c)),
    (...args) => `add\\left(${args.join(', ')}\\right)`,
    (df, ...args) => args.forEach((e) => e.df = e.df.add(df)),
    (sdf, ...operands) => operands.map(([e, $e]) => sdf),
);

const Tanh = factory(
    'tanh', FunctionTree.OperationType.FUNCTION,
    (x) => x.v.apply((i, j, e) => Math.tanh(e)),
    (x) => `\\tanh\\left(${x}\\right)`,
    (df, x) => x.df = x.df.add(df.apply((i, j, e) => 1 - e ** 2)),
    (sdf, [x, $x]) => [`${sdf} / (1 - ${$x} * ${$x})`] // [`\\dfrac{df}{1 - ${x} * ${x}}`]
);

const Mul = factory(
    '*', FunctionTree.OperationType.INFIX,
    (a, b) => a.v.mul(b.v),
    (a, b) => `${a} * ${b}`,
    (df, a, b) => {
        a.df = a.df.add(df.mul(b.v.transpose()));
        b.df = b.df.add(a.v.transpose().mul(df));
    },
    (sdf, [a, $a], [b, $b]) => [`${sdf} * ${$b}^T`, `${$a}^T * ${sdf}`],
    FunctionTree.Priority.MUL
);

const Adamar = factory(
    'had', FunctionTree.OperationType.FUNCTION,
    (...args) => args.map((e) => e.v).reduce((a, b) => a.adamar(b)),
    (...args) => `had\\left(${args.join(', ')}\\right)`,
    (df, ...args) => args.forEach((child) => {
        const ms = args.filter((x) => x !== child).map((e) => e.v);
        ms.push(df);
        child.df = child.df.add(ms.reduce((a, b) => a.adamar(b)))
    }),
    (sdf, ...operands) => [...Array(operands.length).keys()].map((i) => {
        const row = operands.map(([v, $v]) => $v);
        row[i] = sdf;
        return 'had(' + row.join(', ') + ')';
    })
);
