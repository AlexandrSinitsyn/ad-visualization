import { Algorithm, Update } from "./algo.js";
import { FunctionTree } from "./function-tree.js";

export type Millis = number;
export type Frame = number;

class Player {
    private time: Millis;
    private frameTime: Millis;
    private onUpdate: (frame: Frame) => void;
    private index: Frame;
    private readonly last: Frame;
    public finished: boolean;

    public constructor(frameTime: Millis, frameNumber: Frame, onUpdate: (frame: Frame) => void) {
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

            this.onUpdate(this.index);

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

class GraphManager {
    private algo: Algorithm;
    private readonly updates: Update[];

    constructor(algorithm: Algorithm) {
        this.algo = algorithm;
        this.updates = [];

        const steps = algorithm.step();

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

    public acceptValue(name: string, v: number[][]) {
        this.algo.acceptValue(name, v);
    }

    private apply(frame: Frame): Update[] {
        const res: Update[] = [];

        for (const u of this.updates.slice(0, frame)) {
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
    private graph: GraphManager | undefined;
    private isAnimated: boolean;

    public constructor(elementId: string) {
        try {
            const _ = document.getElementById(elementId)!

            // @ts-ignore
            GraphDrawer.graphviz = d3.select(`#${elementId}`).graphviz().transition(() =>
                // @ts-ignore
                d3.transition("main").ease(d3.easeLinear).delay(500).duration(1500)).logEvents(false);
        } catch (e: any) {
            throw new Error(`Can not initialize GraphManager due to invalid element id "${elementId}"`)
        }

        this.isAnimated = true;
    }

    public setFunction(algo: Algorithm) {
        this.graph = new GraphManager(algo);
    }

    public acceptValue(name: string, v: number[][]) {
        this.graph?.acceptValue(name, v);
    }

    public moveTo(frame: Frame) {
        this.render(frame);
    }

    public get frameCount(): Frame {
        return this.graph?.frameCount ?? 0;
    }

    private render(frame: Frame) {
        if (!this.graph) {
            throw 'NO FUNCTION IS PROVIDED';
        }

        GraphDrawer.graphviz.renderDot(this.graph.toString(frame));
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
    private boundPlayer!: (frame: Frame) => void;
    private graphDrawer: GraphDrawer;
    private isOn: boolean;

    public constructor(elementId: string) {
        this.graphDrawer = new GraphDrawer(elementId);
        this.isOn = false;
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
        this.graphDrawer.setFunction(new Algorithm(graph));

        this.player = new Player(500, this.graphDrawer.frameCount, (frame) => {
            this.graphDrawer.moveTo(frame);
            this.boundPlayer(frame);
        });

        return this.graphDrawer.frameCount;
    }

    public bindPlayer(onUpdate: (frame: Frame) => void) {
        this.boundPlayer = onUpdate;
    }

    public updateValue(name: string, v: number[][]) {
        this.graphDrawer.acceptValue(name, v);
    }
}
