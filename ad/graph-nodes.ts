import { Matrix, ZeroMatrix } from "../util/matrix.js";
import { AlgorithmError } from "../util/errors.js";

export namespace GraphNodes {
    export abstract class Element {
        public v: Matrix;
        public df: Matrix;
        public symbDf: string;

        protected constructor() {
            this.v = new ZeroMatrix();
            this.df = new ZeroMatrix();
            this.symbDf = '1';
        }

        public abstract eval(): void;
        public abstract diff(): void;
        public abstract symbolicDiff(operands: [Element, string][]): void;
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
        private readonly _children: Element[];

        protected constructor(children: Element[]) {
            super();
            this._children = children;
        }

        public get children(): Element[] {
            return this._children;
        }

        public eval(): void {
            this.v = this.calc();
            this.df = new ZeroMatrix();
        }
        protected abstract calc(): Matrix;
    }
}
