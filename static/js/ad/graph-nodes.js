import { ZeroMatrix } from "../util/matrix.js";
import { AlgorithmError } from "../util/errors.js";
export var GraphNodes;
(function (GraphNodes) {
    class Element {
        constructor() {
            this.v = new ZeroMatrix();
            this.df = new ZeroMatrix();
            this.symbDf = '1';
        }
    }
    GraphNodes.Element = Element;
    class Var extends Element {
        constructor(name) {
            super();
            this.name = name;
        }
        eval() {
            if (this.v.isZero()) {
                this.v = new ZeroMatrix();
                this.df = new ZeroMatrix();
                throw new AlgorithmError(`Variable [${this.name}] is not assigned. It was interpreted as zero-matrix`);
            }
            this.df = new ZeroMatrix();
        }
        diff() { }
        symbolicDiff() { }
    }
    GraphNodes.Var = Var;
    class Operation extends Element {
        constructor(children) {
            super();
            this._children = children.map((x) => [x, '']);
        }
        get children() {
            return this._children.map(([x, _]) => x);
        }
        get symbolicDiffs() {
            return this._children.map(([_, x]) => x);
        }
        set symbolicDiffs(sdfs) {
            this._children = this._children.map(([v, _], i) => [v, sdfs[i]]);
        }
        eval() {
            this.v = this.calc();
            this.df = new ZeroMatrix();
        }
    }
    GraphNodes.Operation = Operation;
})(GraphNodes || (GraphNodes = {}));
