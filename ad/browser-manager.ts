import { Algorithm, AlgoStep, Update, Meta, RuleDef, Arrow, ErrorStep, Step, TypeChecking } from "./algo.js";
import { FunctionTree } from "./function-tree.js";
import { BrowserInitializationError } from "../util/errors.js";
import { phantomTextSize } from "../setup.js";

export type Millis = number;
export type Frame = number;

class Player {
    private time: Millis;
    private frameTime: Millis;
    private readonly onUpdate: (frame: Frame) => boolean;
    private index: Frame;
    private readonly last: Frame;
    public finished: boolean;

    public constructor(frameTime: Millis, frameNumber: Frame, onUpdate: (frame: Frame) => boolean) {
        this.frameTime = frameTime;
        this.time = frameTime;
        this.onUpdate = onUpdate;

        this.index = 0;
        this.last = frameNumber;
        this.finished = false;
    }

    public frame(dt: number) {
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

    public step() {
        this.frame(this.frameTime);
    }

    public goto(frame: Frame) {
        this.index = frame - 1;
        this.step();
    }

    public speedup(frameTime: number) {
        this.frameTime = frameTime;
        this.time = Math.min(this.time, frameTime);
    }
}

class ExpressionManager {
    private algo: Algorithm;
    private readonly updates: Step[];

    private vars: Map<string, number[][]>;
    private derivatives: Map<string, number[][]>;

    private readonly withDetails: boolean;

    constructor(algorithm: Algorithm, withDetails: boolean) {
        this.algo = algorithm;
        this.updates = [];

        this.vars = new Map();
        this.derivatives = new Map();

        this.withDetails = withDetails;

        this.init();
    }

    private init(): void {
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

            switch (val as AlgoStep) {
                case AlgoStep.INIT:
                case AlgoStep.BACKWARDS:
                case AlgoStep.CALC:
                case AlgoStep.DIFF:
                case AlgoStep.FINISH:
                    break;
            }
        }
    }

    get frameCount(): Frame {
        return this.updates.length;
    }

    public updateVars(vars: Map<string, number[][]>): [string, [number, number]][] {
        this.vars = vars;
        this.algo = this.algo.updateAlgo(this.vars, this.derivatives);

        this.init();

        return this.algo.getEdges().map(([e, { nodeName }]) => [nodeName, e.v.size()]);
    }

    public updateDerivative(derivatives: Map<string, number[][]>) {
        this.derivatives = derivatives;
        this.algo = this.algo.updateAlgo(this.vars, this.derivatives);

        this.init();
    }

    public errorsFound(frame: Frame): ErrorStep | undefined {
        return this.updates.slice(0, frame).find((e) => TypeChecking.isErrorStep(e)) as (ErrorStep | undefined);
    }

    private apply(frame: Frame): (Update | Meta)[] {
        const res: (Update | Meta)[] = [];

        for (const step of this.updates.slice(0, frame)) {
            if (TypeChecking.isRuleDef(step)) {
                res.push({ ...step })
                continue;
            } else if (TypeChecking.isArrow(step)) {
                const a = step as Arrow;

                const prev = res.find((e) => TypeChecking.isArrow(e) &&
                    e.from === a.to && e.to === a.from) as Arrow;

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

            const u = step as Update;

            const prev = res.find((e) => TypeChecking.isUpdate(e) && e.index === u.index) as Update;

            if (!prev) {
                res.push({ ...u });
                continue;
            }

            prev.name = u.name
            prev.v = u.v;
            prev.df = u.df;
            prev.symbolicDf = u.symbolicDf;
        }

        return res;
    }

    public toString(frame: Frame) {
        let res = "digraph {\n";

        res += `
        // graph [layout = fdp]
        rankdir=LR;
        node [shape=Mrecord, color=blue];
        splines="compound";
        pack=false;
        node [fontname="Comic Sans MS, Comic Sans, cursive"; fontname="italic"];
        `;

        const clusters: RuleDef[] = [];

        let previousArrow = '';

        const x_char = phantomTextSize('x', 'Comic Sans MS, Comic Sans, cursive');
        const space = phantomTextSize('x', 'TimesNewRoman') /
            phantomTextSize('x', 'Comic Sans MS, Comic Sans, cursive');

        const untrim = (text: string): string => {
            const escaped = text.replace(/&#916;/, '\u0394');
            const tnr = phantomTextSize(escaped, 'TimesNewRoman');
            const csm = phantomTextSize(escaped, 'Comic Sans MS, Comic Sans, cursive');

            const x = Math.ceil((csm - tnr) / 2 * space / x_char);

            return '&nbsp;'.repeat(x) + escaped + '&nbsp;'.repeat(x);
        }

        for (const f of this.apply(frame)) {
            if (TypeChecking.isRuleDef(f)) {
                clusters.push(f);
            } else if (TypeChecking.isArrow(f)) {
                res += previousArrow;
                previousArrow = `${f.from} -> ${f.to} [label="${untrim(f.text)}"];\n`;
            } else {
                const { index, name, nodeName, v, df, symbolicDf } = f;

                const matrixSize = v?.isZero() ? '' : `\\n[${v!.size()}]`;
                const valD = v?.isZero() || !this.withDetails ? '' : `|{val\\n${v!}|&#916;${nodeName}\\n${df ?? ''}}`;
                const sdf = symbolicDf === undefined ? '' : `|{${untrim(symbolicDf)}}`;

                res += `${index} [label="${untrim(name)}${matrixSize}${sdf}${valD}"; constraint=false; class="testing"];\n`;
            }
        }

        res += previousArrow.length === 0 ? '' : previousArrow.slice(0, previousArrow.length - 3) + '; color=green; fontcolor=green];\n';

        for (const c of clusters) {
            res += `subgraph cluster_${c.name} {`;
            res += c.content.join('\n');
            res += `\nlabel="${c.name}"`;
            res += `}\n`;
        }

        res += '}';

        return res;
    }
}

class GraphDrawer {
    private static graphviz: any;
    private expression: ExpressionManager | undefined;
    private isAnimated: boolean;

    public constructor(elementId: string) {
        try {
            const _ = document.getElementById(elementId)!

            // @ts-ignore
            GraphDrawer.graphviz = d3.select(`#${elementId}`).graphviz().transition(() =>
                // @ts-ignore
                d3.transition("main").ease(d3.easeLinear).delay(500).duration(1500)).logEvents(false);
        } catch (e: any) {
            throw new BrowserInitializationError(`Can not initialize GraphManager due to invalid element id "${elementId}"`)
        }

        this.isAnimated = true;
    }

    public setFunction(algo: Algorithm, withDetails: boolean) {
        this.expression = new ExpressionManager(algo, withDetails);
    }

    /**
     * Sets variables in the algorithm to the given
     *
     * @param vars map [name -> matrix]
     * @return names and sizes of derivatives of the functions in the algorithm
     */
    public updateVars(vars: Map<string, number[][]>): [string, [number, number]][] {
        return this.expression?.updateVars(vars) ?? [];
    }

    public updateDerivative(derivatives: Map<string, number[][]>) {
        this.expression?.updateDerivative(derivatives);
    }

    public moveTo(frame: Frame): true | ErrorStep {
        return this.render(frame);
    }

    public get frameCount(): Frame {
        return this.expression?.frameCount ?? 0;
    }

    private render(frame: Frame): true | ErrorStep {
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

    public speedup(frameTime: number) {
        // @ts-ignore
        GraphDrawer.graphviz.transition(() => d3.transition("main").ease(d3.easeLinear).delay(frameTime / 6).duration(frameTime / 2));
    }

    public switchAnimation(): boolean {
        this.isAnimated = !this.isAnimated;
        return this.isAnimated;
    }
}

export class BrowserManager {
    private player: Player | undefined;
    private boundPlayer!: (frame: Frame, result: true | string) => void;
    private derivativeAcceptor!: (...[name, [rows, cols]]: [string, [number, number]][]) => void;
    private graphDrawer: GraphDrawer;
    private isOn: boolean;

    private readonly vars: Map<string, number[][]>;
    private readonly derivatives: Map<string, number[][]>;

    public constructor(elementId: string) {
        this.graphDrawer = new GraphDrawer(elementId);
        this.isOn = false;

        this.vars = new Map();
        this.derivatives = new Map();
    }

    private startTimer() {
        const run = () => {
            if (!this.player) {
                return;
            }

            this.player.frame(100);

            if (this.isOn && !this.player.finished) {
                setTimeout(run, 100);
            }
        }
        setTimeout(run, 100);
    }

    public step() {
        this.player?.step();
    }

    // fixme if is already running and double click "stop - start" this will left two timers (!)
    public resume() {
        if (!this.isOn) {
            this.isOn = true;
            this.startTimer();
        }
    }

    public pause() {
        this.isOn = false;
    }

    public restart() {
        this.pause();

        this.player?.goto(0);
    }

    public speedup(frameTime: Millis) {
        this.player?.speedup(frameTime);
        this.graphDrawer.speedup(frameTime)
    }

    public switchAnimation(): boolean {
        return this.graphDrawer.switchAnimation();
    }

    public moveTo(frame: Frame) {
        this.player?.goto(frame);
    }

    public setFunction(graph: FunctionTree.Node[], inputMatrixMode: boolean, scalarMode: boolean) {
        this.graphDrawer.setFunction(new Algorithm(graph, this.vars, this.derivatives, inputMatrixMode, scalarMode), inputMatrixMode);

        this.player = new Player(500, this.graphDrawer.frameCount, (frame) => {
            const result = this.graphDrawer.moveTo(frame);
            this.boundPlayer(frame, result);

            return result === true;
        });

        return this.graphDrawer.frameCount;
    }

    public bindPlayer(onUpdate: (frame: Frame, result: true | string) => void) {
        this.boundPlayer = onUpdate;
    }

    public updateValue(name: string, v: number[][], withDerivatives: boolean) {
        this.vars.set(name, v);

        const derivatives = this.graphDrawer.updateVars(this.vars);

        if (!withDerivatives) return;

        this.derivativeAcceptor(...derivatives);
    }

    public updateDerivative(name: string, v: number[][]) {
        this.derivatives.set(name, v);

        this.graphDrawer.updateDerivative(this.derivatives);
    }

    public onAcceptDerivative(acceptor: (...[name, [rows, cols]]: [string, [number, number]][]) => void) {
        this.derivativeAcceptor = acceptor;
    }
}
