import { AlgorithmError } from "./errors.js";
export class Matrix {
    constructor(data) {
        this.data = data;
    }
    size() {
        return this.data.length === 0 ? [0, 0] : [this.data.length, this.data[0].length];
    }
    isZero() {
        return this instanceof ZeroMatrix;
    }
    apply(fn) {
        if (this.isZero()) {
            return new ZeroMatrix();
        }
        return new Matrix(this.data.map((row, i) => row.map((e, j) => fn(i, j, e))));
    }
    add(other) {
        other.equalSizeCheck(this);
        if (other.isZero()) {
            return new ZeroMatrix();
        }
        return this.apply((i, j, e) => e + other.get(i, j));
    }
    mul(other) {
        other.sizeCheck(s => s[0] == this.size()[1], `${this.size()[1]}, any`);
        if (other.isZero()) {
            return new ZeroMatrix();
        }
        const scalar = (a, b) => a.reduce((t, c, i) => t + c * b[i], 0);
        return Matrix.gen(this.size()[0], other.size()[1]).apply((i, j, _) => scalar(this.row(i), other.col(j)));
    }
    adamar(other) {
        other.equalSizeCheck(this);
        if (other.isZero()) {
            return new ZeroMatrix();
        }
        return this.apply((i, j, e) => e * other.get(i, j));
    }
    transpose() {
        return Matrix.gen(this.size()[1], this.size()[0]).apply((i, j, _) => this.get(j, i));
    }
    toString() {
        return this.data.map((row) => row.map(it => Number.isInteger(it) ? it : it.toFixed(3)).join(' ')).join('\\n');
    }
    equalSizeCheck(expected) {
        return this.sizeCheck(s => s[0] == expected.size()[0] && s[1] == expected.size()[1], expected.size().toString());
    }
    sizeCheck(checker, expectedSize) {
        if (!checker(this.size())) {
            throw new AlgorithmError(`Invalid matrix size. Matrix size is [${this.size()}], but was expected [${expectedSize}]`);
        }
    }
    row(i) {
        return this.data[i];
    }
    col(j) {
        return this.data.map((row) => row[j]);
    }
    get(i, j) {
        return this.data[i][j];
    }
    static gen(r, c) {
        const resData = new Array(r);
        for (let i = 0; i < resData.length; i++) {
            resData[i] = Array(c).fill(0);
        }
        return new Matrix(resData);
    }
}
export class ZeroMatrix extends Matrix {
    constructor() {
        super([[]]);
    }
    toString() {
        return '';
    }
}
