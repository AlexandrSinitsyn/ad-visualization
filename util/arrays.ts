export namespace Arrays {
    export function genZero(r: number, c: number): number[][] {
        const resData = new Array(r);
        for (let i = 0; i < resData.length; i++) {
            resData[i] = Array(c).fill(0);
        }
        return resData;
    }
}