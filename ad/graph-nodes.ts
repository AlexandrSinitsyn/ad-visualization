import { Matrix, ZeroMatrix } from "../util/matrix.js";
import { AlgorithmError } from "../util/errors.js";

export namespace GraphNodes {
    export abstract class Element {
        public v: Matrix;
        public df: Matrix;

        protected constructor() {
            this.v = new ZeroMatrix();
            this.df = new ZeroMatrix();
        }

        public abstract eval(): void;
        public abstract diff(): void;
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
    }

    export abstract class Operation extends Element {
        protected readonly children: Element[];

        protected constructor(children: Element[]) {
            super();
            this.children = children;
        }

        public eval(): void {
            this.v = this.calc();
            this.df = new ZeroMatrix();
        }
        protected abstract calc(): Matrix;
    }
}
