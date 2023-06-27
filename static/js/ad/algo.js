import { FunctionTree } from "./function-tree.js";
import { GraphNodes } from "./graph-nodes.js";
import { Matrix, ZeroMatrix } from "../util/matrix.js";
import { AlgorithmError } from "../util/errors.js";
import { algoMapping } from "./operations.js";
export var AlgoStep;
(function (AlgoStep) {
    AlgoStep[AlgoStep["INIT"] = 0] = "INIT";
    AlgoStep[AlgoStep["CALC"] = 1] = "CALC";
    AlgoStep[AlgoStep["DIFF"] = 2] = "DIFF";
    AlgoStep[AlgoStep["FINISH"] = 3] = "FINISH";
})(AlgoStep || (AlgoStep = {}));
function isMeta(obj) {
    return typeof obj !== undefined;
}
export class Algorithm {
    constructor(graph, vars, derivatives) {
        this.seq = this.genFunName();
        this.graph = graph;
        this.mapping = new Map();
        this.vars = new Map([...vars.entries()].map(([name, v]) => [name, new Matrix(v)]));
        this.derivatives = new Map([...derivatives.entries()].map(([name, v]) => [name, new Matrix(v)]));
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
        yield AlgoStep.CALC;
        yield* this.calc();
        yield AlgoStep.DIFF;
        yield* this.diff();
        yield AlgoStep.FINISH;
    }
    updateAlgo(newVars, newDerivatives) {
        return new Algorithm(this.graph, newVars, newDerivatives);
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
                    const [node, { name: _name, nodeName: _nodeName, index: _index, children: _children }] = this.mapping.get(e.content);
                    name = e.name + ' = ' + _name.split(' = ')[1];
                    nodeName = e.name;
                    index = _index;
                    children = _children;
                    return node;
                }
                else {
                    throw 'UNSUPPORTED NODE TYPE';
                }
            };
            const vertex = convert(e);
            this.mapping.set(e, [vertex, { name: name, nodeName: nodeName, index: index, children: children }]);
            yield Algorithm.nodeToUpdate(vertex, this.mapping.get(e)[1]);
            if (e instanceof FunctionTree.Rule) {
                const subgraph = (e) => {
                    if (e instanceof FunctionTree.Operation) {
                        const inner = e.operands.flatMap((n) => subgraph(n));
                        inner.push(this.mapping.get(e)[1].index);
                        return inner;
                    }
                    else {
                        return [this.mapping.get(e)[1].index];
                    }
                };
                yield {
                    name: nodeName,
                    content: subgraph(e),
                };
            }
            index++;
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
                    if (!this.derivatives.has(info.name)) {
                        // noinspection ExceptionCaughtLocallyJS
                        throw new AlgorithmError(`No derivative provided for "${info.name}"`);
                    }
                    e.df = this.derivatives.get(info.name);
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
    static nodeToUpdate(e, { name, index, children }) {
        return {
            index: index,
            name: name,
            children: children,
            v: e.v,
            df: e.df,
        };
    }
    funName() {
        return this.seq.next().value;
    }
    *genFunName() {
        const chars = [...Array(26).keys()].map((_, i) => String.fromCharCode(97 + i));
        chars.shift(); // remove 'a'
        const res = [];
        let i = 0;
        while (true) {
            res.push('a');
            yield res.join('');
            for (const c of chars) {
                res[i] = c;
                yield res.join('');
            }
            i++;
        }
    }
}
