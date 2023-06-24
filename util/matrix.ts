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

        return Matrix.gen(this.size()[0], other.size()[1]).apply((i, j, _) => scalar(this.row(i), other.col(j)));
    }

    public adamar(other: Matrix): Matrix {
        if (other.isZero()) {
            return new ZeroMatrix();
        }

        return this.apply((i, j, e) => e * other.get(i, j));
    }

    public transpose(): Matrix {
        return Matrix.gen(this.size()[1], this.size()[0]).apply((i, j, _) => this.get(j, i));
    }

    public toString(): string {
        return this.data.map((row) => row.map(it => Number.isInteger(it) ? it : it.toFixed(3)).join(' ')).join('\\n');
    }

    private static gen(r: number, c: number): Matrix {
        const resData = new Array(r);
        for (let i = 0; i < resData.length; i++) {
            resData[i] = Array(c).fill(0);
        }
        return new Matrix(resData)
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
