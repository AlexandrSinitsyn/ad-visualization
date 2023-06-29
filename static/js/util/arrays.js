export var Arrays;
(function (Arrays) {
    function genZero(r, c) {
        const resData = new Array(r);
        for (let i = 0; i < resData.length; i++) {
            resData[i] = Array(c).fill(0);
        }
        return resData;
    }
    Arrays.genZero = genZero;
})(Arrays || (Arrays = {}));
