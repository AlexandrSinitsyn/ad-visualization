import { AlgorithmError } from "./errors.js";

export class Matrix {
    private readonly data: number[][];

    public constructor(data: number[][]) {
        this.data = data;
    }

    public size(): [number, number] {
        return this.data.length === 0 ? [0, 0] : [this.data.length, this.data[0].length];
    }

    public row(i: number): number[] {
        if (i >= this.size()[0]) {
            throw new AlgorithmError(`Invalid matrix size. Matrix is ${this.size()}, but was expected "row(${i})"`);
        }

        return this.data[i];
    }

    public col(j: number): number[] {
        if (j >= this.size()[1]) {
            throw new AlgorithmError(`Invalid matrix size. Matrix is ${this.size()}, but was expected "col(${j})"`);
        }

        return this.data.map((row) => row[j]);
    }

    public get(i: number, j: number): number {
        const [h, w] = this.size();

        if (i >= h || j >= w) {
            throw new AlgorithmError(`Invalid matrix size. Matrix is ${this.size()}, but was expected "get(${i}, ${j})"`);
        }

        return this.data[i][j];
    }

    public isZero(): boolean {
        return this instanceof ZeroMatrix;
    }

    public apply(fn: (i: number, j: number, e: number) => number): Matrix {
        if (this.isZero()) {
            return new ZeroMatrix();
        }

        return new Matrix(this.data.map((row, i) => row.map((e, j) => fn(i, j, e))));
    }

    public add(other: Matrix): Matrix {
        if (other.isZero()) {
            return new ZeroMatrix();
        }

        return this.apply((i, j, e) => e + other.get(i, j));
    }

    public mull(other: Matrix): Matrix {
        if (other.isZero()) {
            return new ZeroMatrix();
        }

        const scalar = (a: number[], b: number[]) => a.reduce((t, c, i) => t + c * b[i], 0);

        return this.apply((i, j, e) => scalar(this.row(i), other.col(j)));
    }

    public adamar(other: Matrix): Matrix {
        if (other.isZero()) {
            return new ZeroMatrix();
        }

        return this.apply((i, j, e) => e * other.get(i, j));
    }

    public transpose(): Matrix {
        return this.apply((i, j, _) => this.get(j, i));
    }

    public toString(): string {
        return this.data.map((row) => row.join(' ')).join('\n');
    }
}

export class ZeroMatrix extends Matrix {
    public constructor() {
        super([[]]);
    }

    toString(): string {
        return '0';
    }
}
