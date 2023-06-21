import { Matrix, ZeroMatrix } from "../util/matrix.js";
import { AlgorithmError } from "../util/errors.js";

export namespace GraphNodes {
    export abstract class Element {
        // fixme
        public v: Matrix | undefined = new ZeroMatrix();
        public df: Matrix | undefined = new ZeroMatrix();

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
            if (this.v?.isZero() ?? true) {
                this.v = new ZeroMatrix();
                this.df = new ZeroMatrix();

                throw new AlgorithmError(`Variable [${this.name}] is not assigned. It was interpreted as zero-matrix`)
            }

            this.df = this.v!.apply(() => 0);
        }

        diff(): void {}
    }

    export abstract class Operation extends Element {
        protected readonly children: Element[];

        public constructor(children: Element[]) {
            super();
            this.children = children;
        }

        public eval(): void {
            this.v = this.calc();
            this.df = this.v.apply(() => 0);
        }
        protected abstract calc(): Matrix;
    }
}