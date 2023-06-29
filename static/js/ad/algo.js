import { FunctionTree } from "./function-tree.js";
import { GraphNodes } from "./graph-nodes.js";
import { SymbolicDerivatives } from "./symbolic-derivatives.js";
import { Matrix, ZeroMatrix } from "../util/matrix.js";
import { AlgorithmError } from "../util/errors.js";
import { algoMapping } from "./operations.js";
export var AlgoStep;
(function (AlgoStep) {
    AlgoStep[AlgoStep["INIT"] = 0] = "INIT";
    AlgoStep[AlgoStep["BACKWARDS"] = 1] = "BACKWARDS";
    AlgoStep[AlgoStep["CALC"] = 2] = "CALC";
    AlgoStep[AlgoStep["DIFF"] = 3] = "DIFF";
    AlgoStep[AlgoStep["FINISH"] = 4] = "FINISH";
})(AlgoStep || (AlgoStep = {}));
export var TypeChecking;
(function (TypeChecking) {
    function isUpdate(step) {
        return step !== undefined && step !== null && typeof step === "object" &&
            ['index', 'name', 'nodeName', 'children', 'v', 'df'].map((v) => v in step).reduce((a, b) => a && b);
    }
    TypeChecking.isUpdate = isUpdate;
    function isRuleDef(step) {
        return step !== undefined && step !== null && typeof step === "object" &&
            ['name', 'index', 'content'].map((v) => v in step).reduce((a, b) => a && b);
    }
    TypeChecking.isRuleDef = isRuleDef;
    function isArrow(step) {
        return step !== undefined && step !== null && typeof step === "object" &&
            ['from', 'to', 'count', 'text'].map((v) => v in step).reduce((a, b) => a && b);
    }
    TypeChecking.isArrow = isArrow;
    function isAlgoStep(step) {
        return step !== undefined && step !== null && typeof step === "number";
    }
    TypeChecking.isAlgoStep = isAlgoStep;
    function isErrorStep(step) {
        return step !== undefined && step !== null && typeof step === "string";
    }
    TypeChecking.isErrorStep = isErrorStep;
})(TypeChecking || (TypeChecking = {}));
export class Algorithm {
    constructor(graph, vars, derivatives, withDerivatives) {
        this.seq = this.genFunName();
        this.graph = graph;
        this.mapping = new Map();
        this.vars = new Map([...vars.entries()].map(([nodeName, v]) => [nodeName, new Matrix(v)]));
        this.derivatives = new Map([...derivatives.entries()].map(([nodeName, v]) => [nodeName, new Matrix(v)]));
        this.withDerivatives = withDerivatives;
    }
    getEdges() {
        const edgeChecks = new Array(this.graph.length).fill(true);
        const dfs = (cur) => {
            const [_, curInfo] = this.mapping.get(this.graph[cur]);
            curInfo.children.filter(it => edgeChecks[it]).forEach(next => {
                edgeChecks[next] = false;
                dfs(next);
            });
        };
        for (let i = edgeChecks.length - 1; i >= 0; i--) {
            if (edgeChecks[i]) {
                dfs(i);
            }
        }
        const edgeIds = [];
        for (let i = 0; i < edgeChecks.length; i++) {
            if (edgeChecks[i]) {
                edgeIds.push(i);
            }
        }
        return edgeIds.map((it) => this.graph[it]).map((it) => this.mapping.get(it));
    }
    *step() {
        yield AlgoStep.INIT;
        yield* this.init();
        yield AlgoStep.BACKWARDS;
        yield* this.backwards();
        yield AlgoStep.CALC;
        yield* this.calc();
        if (this.withDerivatives) {
            yield AlgoStep.DIFF;
            yield* this.diff();
        }
        yield AlgoStep.FINISH;
    }
    updateAlgo(newVars, newDerivatives) {
        return new Algorithm(this.graph, newVars, newDerivatives, this.withDerivatives);
    }
    *init() {
        let index = 0;
        for (const e of this.graph) {
            let name = '';
            let nodeName = '';
            let children = [];
            const convert = (e) => {
                if (e instanceof FunctionTree.Variable) {
                    name = e.name;
                    nodeName = e.toString();
                    children = [];
                    return new GraphNodes.Var(e.name);
                }
                else if (e instanceof FunctionTree.Operation) {
                    nodeName = this.funName();
                    name = `${nodeName} = ${e.toString(e.operands.map((n) => this.mapping.get(n)[1].nodeName))}`;
                    children = e.operands.map((n) => this.mapping.get(n)[1].index);
                    const operands = e.operands.map((n) => this.mapping.get(n)[0]);
                    const fun = algoMapping.get(e.symbol);
                    if (!fun) {
                        throw 'UNKNOWN OPERATION';
                    }
                    return fun(operands);
                }
                else if (e instanceof FunctionTree.Rule) {
                    const node = convert(e.content);
                    name = e.name + ' = ' + name.split(' = ')[1];
                    nodeName = e.name;
                    return node;
                }
                else {
                    throw 'UNSUPPORTED NODE TYPE';
                }
            };
            const vertex = convert(e);
            this.mapping.set(e, [vertex, { name: name, nodeName: nodeName, index: index, children: children }]);
            yield Algorithm.nodeToUpdate(vertex, this.mapping.get(e)[1]);
            for (const c of children) {
                yield {
                    from: c,
                    to: index,
                    count: 1,
                    text: '',
                };
            }
            if (e instanceof FunctionTree.Rule) {
                // const subgraph = (e: FunctionTree.Node): number[] => {
                //     if (e instanceof FunctionTree.Operation) {
                //         return e.operands.flatMap((n) => subgraph(n));
                //     } else if (e instanceof FunctionTree.Variable) {
                //         return [];
                //     } else {
                //         return [this.mapping.get(e)![1].index];
                //     }
                // };
                //
                // const content = subgraph(e.content);
                // content.push(index);
                yield {
                    name: nodeName,
                    index: index,
                    content: [index],
                };
            }
            index++;
        }
    }
    *backwards() {
        this.getEdges().forEach(([v, { nodeName }]) => v.symbDf = SymbolicDerivatives.Var('&#916;' + nodeName));
        for (const [e, { index, children }] of [...this.mapping.values()].sort(([, { index: i1 }], [, { index: i2 }]) => i2 - i1)) {
            e.symbolicDiff(children.map((e) => this.nodeByIndex(e)[1].nodeName));
            for (let i = 0; i < children.length; i++) {
                yield {
                    from: index,
                    to: children[i],
                    count: 1,
                    text: e.symbolicDiffs[i].toString(),
                };
                yield Algorithm.nodeToUpdate(...this.nodeByIndex(children[i]));
            }
        }
    }
    *calc() {
        for (const [e, info] of [...this.mapping.values()].sort(([, { index: i1 }], [, { index: i2 }]) => i1 - i2)) {
            if (e instanceof GraphNodes.Var && this.vars.has(info.name)) {
                e.v = this.vars.get(info.name);
            }
            try {
                e.eval();
                yield Algorithm.nodeToUpdate(e, info);
            }
            catch (ex) {
                if (ex instanceof AlgorithmError) {
                    yield ex.message;
                }
                else {
                    throw ex;
                }
            }
        }
    }
    *diff() {
        for (const [e, info] of [...this.mapping.values()].sort(([, { index: i1 }], [, { index: i2 }]) => i2 - i1)) {
            try {
                if (e.df instanceof ZeroMatrix) {
                    if (!this.derivatives.has(info.nodeName)) {
                        // noinspection ExceptionCaughtLocallyJS
                        throw new AlgorithmError(`No derivative provided for "${info.nodeName}"`);
                    }
                    e.df = this.derivatives.get(info.nodeName);
                }
                e.diff();
                yield Algorithm.nodeToUpdate(e, info);
            }
            catch (ex) {
                if (ex instanceof AlgorithmError) {
                    yield ex.message;
                }
                else {
                    throw ex;
                }
            }
        }
    }
    nodeByIndex(i) {
        return [...this.mapping.values()].find(([_, { index }]) => index === i);
    }
    static nodeToUpdate(e, { name, nodeName, index, children }) {
        return {
            index: index,
            name: name,
            nodeName: nodeName,
            children: children,
            v: e.v,
            df: e.df,
            symbolicDf: e.symbDf instanceof SymbolicDerivatives.Empty ? undefined : e.symbDf.toString(),
        };
    }
    funName() {
        return this.seq.next().value;
    }
    *genFunName() {
        const chars = [...Array(26).keys()].map((_, i) => String.fromCharCode('A'.charCodeAt(0) + i));
        chars.shift(); // remove 'A'
        const res = [];
        let i = 0;
        while (true) {
            res.push('A');
            yield res.join('');
            for (const c of chars) {
                res[i] = c;
                yield res.join('');
            }
            i++;
        }
    }
}
