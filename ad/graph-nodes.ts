import { Matrix, ZeroMatrix } from "../util/matrix.js";
import { AlgorithmError } from "../util/errors.js";
import { SymbolicDerivatives } from "./symbolic-derivatives.js";

export namespace GraphNodes {
    export abstract class Element {
        public v: Matrix;
        public df: Matrix;
        public symbDf: SymbolicDerivatives.Node;

        protected constructor() {
            this.v = new ZeroMatrix();
            this.df = new ZeroMatrix();
            this.symbDf = new SymbolicDerivatives.Empty();
        }

        public abstract eval(): void;
        public abstract diff(): void;
        public abstract symbolicDiff(childrenNames: string[]): void;
    }

    export class Var extends Element {
        public readonly name: string;

        public constructor(name: string) {
            super();
            this.name = name;
        }

        eval(): void {
            if (this.v.isZero()) {
                this.v = new ZeroMatrix();
                this.df = new ZeroMatrix();

                throw new AlgorithmError(`Variable [${this.name}] is not assigned. It was interpreted as zero-matrix`)
            }

            this.df = new ZeroMatrix();
        }

        diff(): void {}

        symbolicDiff(): void {}
    }

    export abstract class Operation extends Element {
        private _children: [Element, SymbolicDerivatives.Node][];

        protected constructor(children: Element[]) {
            super();
            this._children = children.map((x) => [x, new SymbolicDerivatives.Empty()]);
        }

        public get children(): Element[] {
            return this._children.map(([x, _]) => x);
        }

        public get symbolicDiffs(): SymbolicDerivatives.Node[] {
            return this._children.map(([_, x]) => x);
        }

        public set symbolicDiffs(sdfs: SymbolicDerivatives.Node[]) {
            this._children = this._children.map(([v, _], i) => [v, sdfs[i]]);
        }

        public eval(): void {
            this.v = this.calc();
            this.df = new ZeroMatrix();
        }
        protected abstract calc(): Matrix;
    }
}
