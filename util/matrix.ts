import { AlgorithmError } from "./errors.js";
import { Arrays } from "../util/arrays.js";

export class Matrix {
    private readonly data: number[][];

    public constructor(data: number[][]) {
        this.data = data;
    }

    public size(): [number, number] {
        return this.data.length === 0 ? [0, 0] : [this.data.length, this.data[0].length];
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
        other.equalSizeCheck(this)
        if (other.isZero()) {
            return new ZeroMatrix();
        }

        return this.apply((i, j, e) => e + other.get(i, j));
    }

    public mul(other: Matrix): Matrix {
        other.sizeCheck(s => s[0] == this.size()[1], `${this.size()[1]}, any`)
        if (other.isZero()) {
            return new ZeroMatrix();
        }

        const scalar = (a: number[], b: number[]) => a.reduce((t, c, i) => t + c * b[i], 0);

        return Matrix.gen(this.size()[0], other.size()[1]).apply((i, j, _) => scalar(this.row(i), other.col(j)));
    }

    public adamar(other: Matrix): Matrix {
        other.equalSizeCheck(this)
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

    private equalSizeCheck(expected: Matrix) {
        return this.sizeCheck(
            s => s[0] == expected.size()[0] && s[1] == expected.size()[1],
            expected.size().toString()
        );
    }

    private sizeCheck(checker: (_: [number, number]) => boolean, expectedSize: string) {
        if (!checker(this.size())) {
            throw new AlgorithmError(`Invalid matrix size. Matrix size is [${this.size()}], but was expected [${expectedSize}]`);
        }
    }

    private row(i: number): number[] {
        return this.data[i];
    }

    private col(j: number): number[] {
        return this.data.map((row) => row[j]);
    }

    private get(i: number, j: number): number {
        return this.data[i][j];
    }

    private static gen(r: number, c: number): Matrix {
        return new Matrix(Arrays.genZero(r, c));
    }
}

export class ZeroMatrix extends Matrix {
    public constructor() {
        super([[]]);
    }

    toString(): string {
        return '';
    }
}
