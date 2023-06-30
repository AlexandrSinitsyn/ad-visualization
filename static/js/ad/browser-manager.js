import { Algorithm, AlgoStep, TypeChecking } from "./algo.js";
import { BrowserInitializationError } from "../util/errors.js";
import { phantomTextSize } from "../setup.js";
class Player {
    constructor(frameTime, frameNumber, onUpdate) {
        this.frameTime = frameTime;
        this.time = frameTime;
        this.onUpdate = onUpdate;
        this.index = 0;
        this.last = frameNumber;
        this.finished = false;
    }
    frame(dt) {
        this.time -= dt;
        if (this.time <= 0) {
            if (this.index > this.last) {
                this.finished = true;
                return;
            }
            this.index++;
            const ok = this.onUpdate(this.index);
            if (!ok) {
                this.index--;
            }
            this.time = this.frameTime;
        }
    }
    step() {
        this.frame(this.frameTime);
    }
    goto(frame) {
        this.index = frame - 1;
        this.step();
    }
    speedup(frameTime) {
        this.frameTime = frameTime;
        this.time = Math.min(this.time, frameTime);
    }
}
class ExpressionManager {
    constructor(algorithm, withDetails) {
        this.algo = algorithm;
        this.updates = [];
        this.vars = new Map();
        this.derivatives = new Map();
        this.withDetails = withDetails;
        this.init();
    }
    init() {
        this.updates.length = 0;
        const steps = this.algo.step();
        while (true) {
            const nxt = steps.next();
            if (nxt.done) {
                break;
            }
            const val = nxt.value;
            if (!TypeChecking.isAlgoStep(val)) {
                this.updates.push(nxt.value);
                continue;
            }
            switch (val) {
                case AlgoStep.INIT:
                case AlgoStep.BACKWARDS:
                case AlgoStep.CALC:
                case AlgoStep.DIFF:
                case AlgoStep.FINISH:
                    break;
            }
        }
    }
    get frameCount() {
        return this.updates.length;
    }
    updateVars(vars) {
        this.vars = vars;
        this.algo = this.algo.updateAlgo(this.vars, this.derivatives);
        this.init();
        return this.algo.getEdges().map(([e, { nodeName }]) => [nodeName, e.v.size()]);
    }
    updateDerivative(derivatives) {
        this.derivatives = derivatives;
        this.algo = this.algo.updateAlgo(this.vars, this.derivatives);
        this.init();
    }
    errorsFound(frame) {
        return this.updates.slice(0, frame).find((e) => TypeChecking.isErrorStep(e));
    }
    apply(frame) {
        const res = [];
        for (const step of this.updates.slice(0, frame)) {
            if (TypeChecking.isRuleDef(step)) {
                res.push({ ...step });
                continue;
            }
            else if (TypeChecking.isArrow(step)) {
                const a = step;
                const prev = res.find((e) => TypeChecking.isArrow(e) &&
                    e.from === a.to && e.to === a.from);
                if (!prev) {
                    res.push({ ...a });
                    continue;
                }
                prev.from = a.from;
                prev.to = a.to;
                prev.text = a.text;
                res.push(prev);
                res.splice(res.indexOf(prev), 1);
                continue;
            }
            const u = step;
            const prev = res.find((e) => TypeChecking.isUpdate(e) && e.index === u.index);
            if (!prev) {
                res.push({ ...u });
                continue;
            }
            prev.name = u.name;
            prev.v = u.v;
            prev.df = u.df;
            prev.symbolicDf = u.symbolicDf;
        }
        return res;
    }
    toString(frame) {
        let res = "digraph {\n";
        res += `
        // graph [layout = fdp]
        rankdir=LR;
        node [shape=Mrecord, color=blue; style="filled"; fillcolor="white"];
        splines="compound";
        pack=false;
        node [fontname="Comic Sans MS, Comic Sans, cursive"; fontname="italic"];
        `;
        let previousArrow = '';
        const x_char = phantomTextSize('x', 'Comic Sans MS, Comic Sans, cursive');
        const space = phantomTextSize('x', 'TimesNewRoman') /
            phantomTextSize('x', 'Comic Sans MS, Comic Sans, cursive');
        const untrim = (text) => {
            const escaped = text.replace(/&#916;/, '\u0394');
            const tnr = phantomTextSize(escaped, 'TimesNewRoman');
            const csm = phantomTextSize(escaped, 'Comic Sans MS, Comic Sans, cursive');
            const x = Math.ceil((csm - tnr) / 2 * space / x_char);
            return '&nbsp;'.repeat(x) + escaped + '&nbsp;'.repeat(x);
        };
        for (const f of this.apply(frame)) {
            if (TypeChecking.isArrow(f)) {
                res += previousArrow;
                previousArrow = `${f.from} -> ${f.to} [label="${untrim(f.text)}"];\n`;
                if (f.from < f.to) {
                    previousArrow = `${f.from} -> ${f.to} [label="${untrim(f.text)}"];\n`;
                }
                else {
                    previousArrow = `${f.to} -> ${f.from} [label="${untrim(f.text)}"; dir=back; arrowtail=normal];\n`;
                }
            }
            else if (!TypeChecking.isRuleDef(f)) {
                const { index, name, nodeName, v, df, symbolicDf } = f;
                const matrixSize = (v === null || v === void 0 ? void 0 : v.isZero()) ? '' : `\\n[${v.size()}]`;
                const valD = (v === null || v === void 0 ? void 0 : v.isZero()) || !this.withDetails ? '' : `|{val\\n${v}|&#916;${nodeName}\\n${df !== null && df !== void 0 ? df : ''}}`;
                const sdf = symbolicDf === undefined ? '' : `|{${untrim(symbolicDf)}}`;
                res += `${index} [label="${untrim(name)}${matrixSize}${sdf}${valD}"; constraint=false; class="testing"];\n`;
            }
        }
        res += previousArrow.length === 0 ? '' : previousArrow.slice(0, previousArrow.length - 3) + '; color=green; fontcolor=green];\n';
        res += '}';
        return res;
    }
}
class GraphDrawer {
    constructor(elementId) {
        try {
            const _ = document.getElementById(elementId);
            // @ts-ignore
            GraphDrawer.graphviz = d3.select(`#${elementId}`).graphviz().transition(() => 
            // @ts-ignore
            d3.transition("main").ease(d3.easeLinear).delay(500).duration(1500)).logEvents(false);
        }
        catch (e) {
            throw new BrowserInitializationError(`Can not initialize GraphManager due to invalid element id "${elementId}"`);
        }
        this.isAnimated = true;
    }
    setFunction(algo, withDetails) {
        this.expression = new ExpressionManager(algo, withDetails);
    }
    /**
     * Sets variables in the algorithm to the given
     *
     * @param vars map [name -> matrix]
     * @return names and sizes of derivatives of the functions in the algorithm
     */
    updateVars(vars) {
        var _a, _b;
        return (_b = (_a = this.expression) === null || _a === void 0 ? void 0 : _a.updateVars(vars)) !== null && _b !== void 0 ? _b : [];
    }
    updateDerivative(derivatives) {
        var _a;
        (_a = this.expression) === null || _a === void 0 ? void 0 : _a.updateDerivative(derivatives);
    }
    moveTo(frame) {
        return this.render(frame);
    }
    get frameCount() {
        var _a, _b;
        return (_b = (_a = this.expression) === null || _a === void 0 ? void 0 : _a.frameCount) !== null && _b !== void 0 ? _b : 0;
    }
    render(frame) {
        if (!this.expression) {
            throw 'NO FUNCTION IS PROVIDED';
        }
        const errors = this.expression.errorsFound(frame);
        if (errors) {
            return errors;
        }
        GraphDrawer.graphviz.renderDot(this.expression.toString(frame));
        return true;
    }
    speedup(frameTime) {
        // @ts-ignore
        GraphDrawer.graphviz.transition(() => d3.transition("main").ease(d3.easeLinear).delay(frameTime / 6).duration(frameTime / 2));
    }
    switchAnimation() {
        this.isAnimated = !this.isAnimated;
        return this.isAnimated;
    }
}
export class BrowserManager {
    constructor(elementId) {
        this.graphDrawer = new GraphDrawer(elementId);
        this.isOn = false;
        this.vars = new Map();
        this.derivatives = new Map();
    }
    startTimer() {
        const run = () => {
            if (!this.player) {
                return;
            }
            this.player.frame(100);
            if (this.isOn && !this.player.finished) {
                setTimeout(run, 100);
            }
        };
        setTimeout(run, 100);
    }
    step() {
        var _a;
        (_a = this.player) === null || _a === void 0 ? void 0 : _a.step();
    }
    // fixme if is already running and double click "stop - start" this will left two timers (!)
    resume() {
        if (!this.isOn) {
            this.isOn = true;
            this.startTimer();
        }
    }
    pause() {
        this.isOn = false;
    }
    restart() {
        var _a;
        this.pause();
        (_a = this.player) === null || _a === void 0 ? void 0 : _a.goto(0);
    }
    speedup(frameTime) {
        var _a;
        (_a = this.player) === null || _a === void 0 ? void 0 : _a.speedup(frameTime);
        this.graphDrawer.speedup(frameTime);
    }
    switchAnimation() {
        return this.graphDrawer.switchAnimation();
    }
    moveTo(frame) {
        var _a;
        (_a = this.player) === null || _a === void 0 ? void 0 : _a.goto(frame);
    }
    setFunction(graph, inputMatrixMode, scalarMode) {
        this.graphDrawer.setFunction(new Algorithm(graph, this.vars, this.derivatives, inputMatrixMode, scalarMode), inputMatrixMode);
        this.player = new Player(500, this.graphDrawer.frameCount, (frame) => {
            const result = this.graphDrawer.moveTo(frame);
            this.boundPlayer(frame, result);
            return result === true;
        });
        return this.graphDrawer.frameCount;
    }
    bindPlayer(onUpdate) {
        this.boundPlayer = onUpdate;
    }
    updateValue(name, v, withDerivatives) {
        this.vars.set(name, v);
        const derivatives = this.graphDrawer.updateVars(this.vars);
        if (!withDerivatives)
            return;
        this.derivativeAcceptor(...derivatives);
    }
    updateDerivative(name, v) {
        this.derivatives.set(name, v);
        this.graphDrawer.updateDerivative(this.derivatives);
    }
    onAcceptDerivative(acceptor) {
        this.derivativeAcceptor = acceptor;
    }
}
