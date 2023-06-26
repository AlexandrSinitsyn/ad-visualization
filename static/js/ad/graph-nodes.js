import { ZeroMatrix } from "../util/matrix.js";
import { AlgorithmError } from "../util/errors.js";
export var GraphNodes;
(function (GraphNodes) {
    class Element {
        constructor() {
            this.v = new ZeroMatrix();
            this.df = new ZeroMatrix();
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
    }
    GraphNodes.Var = Var;
    class Operation extends Element {
        constructor(children) {
            super();
            this.children = children;
        }
        eval() {
            this.v = this.calc();
            this.df = new ZeroMatrix();
        }
    }
    GraphNodes.Operation = Operation;
})(GraphNodes || (GraphNodes = {}));
