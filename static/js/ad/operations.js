// noinspection JSUnusedLocalSymbols
import { FunctionTree } from "./function-tree.js";
import { GraphNodes } from "./graph-nodes.js";
import { SymbolicDerivatives } from "./symbolic-derivatives.js";
const SAdd = SymbolicDerivatives.Add;
const SSub = SymbolicDerivatives.Sub;
const SNeg = SymbolicDerivatives.Neg;
const SMul = SymbolicDerivatives.Mul;
const SDiv = SymbolicDerivatives.Div;
const SPow = SymbolicDerivatives.Pow;
const STns = SymbolicDerivatives.Tns;
const SAOp = SymbolicDerivatives.AOp;
const SVar = SymbolicDerivatives.Var;
const SNum = SymbolicDerivatives.Num;
export const parserMapping = new Map();
export const algoMapping = new Map();
export const functions = new Map();
export const functionsProhibitForScalar = new Set();
function factory(symbol, type, calc, toTex, diff, symbolicDiff, priority = undefined, prohibitedForScalar = false) {
    const ParserOp = class ParserOp extends FunctionTree.Operation {
        constructor(operands) {
            super(symbol, type, operands, priority);
        }
        toTexImpl(...children) {
            return toTex(...children);
        }
    };
    const AlgoOp = class AlgoOp extends GraphNodes.Operation {
        constructor(operands) {
            super(operands);
        }
        calc() {
            return calc(...this.children);
        }
        diff() {
            this.children.forEach(it => it.df = it.v.apply(() => 0));
            diff(this.df, ...this.children);
        }
        symbolicDiff(childrenNames, scalarMode) {
            this.symbolicDiffs = childrenNames.map((x) => SVar(x));
            const symbs = symbolicDiff(scalarMode, this.symbDf, ...this.symbolicDiffs).map((e) => e.simplify());
            this.children.forEach((c, i) => c.symbDf = c.symbDf instanceof SymbolicDerivatives.Empty ? symbs[i] : SAdd(c.symbDf, symbs[i]));
            this.symbolicDiffs = this.symbolicDiffs.map((_, i) => symbs[i]);
        }
    };
    parserMapping.set(symbol, (args) => new ParserOp(args));
    algoMapping.set(symbol, (args) => new AlgoOp(args));
    functions.set(symbol, type);
    if (prohibitedForScalar)
        functionsProhibitForScalar.add(symbol);
    return true;
}
const Plus = factory('+', FunctionTree.OperationType.INFIX, (a, b) => a.v.add(b.v), (a, b) => `${a} + ${b}`, (df, a, b) => {
    a.df = a.df.add(df);
    b.df = b.df.add(df);
}, (_, sdf, a, b) => [sdf, sdf], FunctionTree.Priority.ADD);
const Add = factory('add', FunctionTree.OperationType.FUNCTION, (...args) => args.map((e) => e.v).reduce((t, c) => t.add(c)), (...args) => `add\\left(${args.join(', ')}\\right)`, (df, ...args) => args.forEach((e) => e.df = e.df.add(df)), (_, sdf, ...operands) => operands.map((e) => sdf));
const Tanh = factory('tanh', FunctionTree.OperationType.FUNCTION, (x) => x.v.apply((i, j, e) => Math.tanh(e)), (x) => `\\tanh\\left(${x}\\right)`, (df, x) => x.df = x.df.add(df.apply((i, j, e) => 1 - e ** 2)), (_, sdf, x) => [SSub(SNum(1), SMul(sdf, sdf))]);
const Mul = factory('*', FunctionTree.OperationType.INFIX, (a, b) => a.v.mul(b.v), (a, b) => `${a} * ${b}`, (df, a, b) => {
    a.df = a.df.add(df.mul(b.v.transpose()));
    b.df = b.df.add(a.v.transpose().mul(df));
}, (scalarMode, sdf, a, b) => [SMul(sdf, scalarMode ? b : STns(b)), SMul(scalarMode ? a : STns(a), sdf)], FunctionTree.Priority.MUL);
const Adamar = factory('had', FunctionTree.OperationType.FUNCTION, (...args) => args.map((e) => e.v).reduce((a, b) => a.adamar(b)), (...args) => `had\\left(${args.join(', ')}\\right)`, (df, ...args) => args.forEach((child) => {
    const ms = args.filter((x) => x !== child).map((e) => e.v);
    ms.push(df);
    child.df = child.df.add(ms.reduce((a, b) => a.adamar(b)));
}), (_, sdf, ...operands) => [...Array(operands.length).keys()].map((i) => {
    const row = [...operands];
    row[i] = sdf;
    return SAOp('had')(...row);
}), undefined, true);
