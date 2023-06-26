import { AlgorithmError } from "./errors.js";

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
        other.sizeCheck(([w, _]) => w == this.size()[1], `${this.size()[1]}, any`)

        if (other.isZero()) {
            return new ZeroMatrix();
        }

        const scalar = (a: number[], b: number[]) => a.reduce((t, c, i) => t + c * b[i], 0);

        return Matrix.gen(...this.size()).apply((i, j, _) => scalar(this.row(i), other.col(j)));
    }

    public adamar(other: Matrix): Matrix {
        other.equalSizeCheck(this)
        if (other.isZero()) {
            return new ZeroMatrix();
        }

        return this.apply((i, j, e) => e * other.get(i, j));
    }

    public transpose(): Matrix {
        return Matrix.gen(...this.size()).apply((i, j, _) => this.get(j, i));
    }

    public toString(): string {
        return this.data.map((row) => row.map(it => Number.isInteger(it) ? it : it.toFixed(3)).join(' ')).join('\\n');
    }

    private equalSizeCheck(expected: Matrix) {
        const [r, c] = expected.size();

        this.sizeCheck(([w, h]) => w === r && h === c, expected.size().toString());
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
        return '';
    }
}
