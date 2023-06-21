import { Algorithm, Step, Update, ErrorStep } from "./algo.js";
import { FunctionTree } from "./function-tree.js";
import { BrowserInitializationError } from "../util/errors.js";

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

    constructor(algorithm: Algorithm) {
        this.algo = algorithm;
        this.updates = [];

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

            this.updates.push(nxt.value);
        }
    }

    get frameCount(): Frame {
        return this.updates.length;
    }

    public updateAlgorithm(vars: Map<string, number[][]>) {
        this.algo = this.algo.updateAlgo(vars);

        this.init();
    }

    // fixme
    public errorsFound(frame: Frame): ErrorStep | undefined {
        const errors = this.updates.slice(0, frame).filter((e) => typeof e === "string").map((e) => e as string);

        return errors.length === 0 ? undefined : errors[0];
    }

    private apply(frame: Frame): Update[] {
        const res: Update[] = [];

        for (const step of this.updates.slice(0, frame)) {
            const u = step as Update;

            const prev = res.find((e) => e.index === u.index);

            if (!prev) {
                res.push(u);
                continue;
            }

            prev.v = u.v;
            prev.df = u.df;
        }

        return res;
    }

    public toString(frame: Frame) {
        let res = "digraph {\n";

        res += "rankdir=RL;\n";
        res += "node [shape=Mrecord, color=blue];\n";

        for (const {index, name, children, v, df} of this.apply(frame)) {
            res += `${index} [label="${name}|{val: ${v ?? ''}|df:${df ?? ''}}"];\n`;

            res += children.map((c) => `${index} -> ${c};`).join('\n');
        }

        res += "}";

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

    public setFunction(algo: Algorithm) {
        this.expression = new ExpressionManager(algo);
    }

    public updateAlgorithm(vars: Map<string, number[][]>) {
        this.expression?.updateAlgorithm(vars);
    }

    public moveTo(frame: Frame): true | string {
        return this.render(frame);
    }

    public get frameCount(): Frame {
        return this.expression?.frameCount ?? 0;
    }

    private render(frame: Frame): true | string {
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
    private graphDrawer: GraphDrawer;
    private isOn: boolean;

    private readonly vars: Map<string, number[][]>;

    public constructor(elementId: string) {
        this.graphDrawer = new GraphDrawer(elementId);
        this.isOn = false;

        this.vars = new Map();
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

    public setFunction(graph: FunctionTree.Node[]) {
        this.graphDrawer.setFunction(new Algorithm(graph, this.vars));

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

    public updateValue(name: string, v: number[][]) {
        this.vars.set(name, v);

        this.graphDrawer.updateAlgorithm(this.vars);
    }
}
