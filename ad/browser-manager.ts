import { FunctionTree } from "./function-tree.js";
import { Algo, AlgoUpdate } from "./algo.js";
// @ts-ignore <- fail warning. This lib is imported on index.html:19
import * as d3 from "./d3";

export namespace BrowserManager {
    export class Player {
        private time: number;
        private frameTime: number;
        // noinspection JSMismatchedCollectionQueryUpdate
        private algo: Generator<AlgoUpdate>;
        public finished: boolean;
        private graphManager: GraphManager;

        constructor(fun: FunctionTree.Node, graphManager: GraphManager, frameTime: number) {
            this.graphManager = graphManager;
            this.frameTime = frameTime;
            this.time = frameTime;
            this.finished = false;

            this.algo = new Algo(fun).step();
        }

        public frame(dt: number) {
            this.time -= dt;

            if (this.time <= 0) {
                let update = this.algo.next();
                this.finished = update.done ?? true;

                if (!this.finished) {
                    this.graphManager.onUpdate(update.value);
                }

                this.time = this.frameTime;
            }
        }

        public step() {
            this.frame(this.frameTime);
        }

        public speedUp(frameTime: number) {
            this.frameTime = frameTime;
        }

        public updateFunction(fun: FunctionTree.Node) {
            this.algo = new Algo(fun).step();
        }
    }

    export type Seconds = number;

    export class ExpressionManager {
        private player: Player;
        private isOn: boolean;
        private expr: FunctionTree.Node;
        private readonly graphManager: GraphManager;

        public constructor(
            onStepId: string,
            onResumeId: string,
            onPauseId: string,
            onRestartId: string,
            frame: Seconds,
            expr: FunctionTree.Node,
            graphManager: GraphManager,
        ) {
            this.expr = expr;
            this.graphManager = graphManager;
            this.player = new Player(expr, graphManager, frame * 1000);
            this.isOn = false;

            try {
                document.getElementById(onStepId)!.onclick = () => this.step();
                document.getElementById(onResumeId)!.onclick = () => this.resume();
                document.getElementById(onPauseId)!.onclick = () => this.pause();
                document.getElementById(onRestartId)!.onclick = () => this.restart();
            } catch (e: any) {
                throw new Error("Can not initialize Browser manager. Your ids are invalid: " +
                    `"[${onStepId}, ${onResumeId}, ${onPauseId}, ${onRestartId}]", because "${e.toString()}"`);
            }

            this.startTimer();
        }

        private startTimer() {
            const run = () => {
                this.player.frame(100);

                if (this.isOn && !this.player.finished) {
                    setTimeout(run, 100);
                }
            }
            setTimeout(run, 100);
        }

        private step() {
            this.player.step();
        }

        // fixme if is already running and double click "stop - start" this will left two timers (!)
        private resume() {
            if (!this.isOn) {
                this.isOn = true;
                this.startTimer();
            }
        }

        private pause() {
            this.isOn = false;
        }

        private restart() {
            this.pause();
            this.player.updateFunction(this.expr);
        }
    }

    class Graph {
        private readonly nodes: AlgoUpdate[] = []

        public apply(update: AlgoUpdate) {
            const previous = this.nodes.find((e) => e.index === update.index);

            if (!previous) {
                this.nodes.push(update);
                return
            }

            previous.value = update.value;
            previous.df = update.df;
        }

        public toString(): string {
            let res = "digraph {\n";

            res += "rankdir=RL;\n"
            res += "node [shape=Mrecord, color=blue];\n"

            for (const {index, name, children, value, df} of this.nodes) {
                res += `${index} [label="${name}|{val: ${value ?? ''}|df:${df ?? ''}}"];\n`;
                for (const child of children) {
                    res += `${index} -> ${child};\n`;
                }
            }

            res += "}";

            return res;
        }
    }

    export class GraphManager {
        private static graphviz: any;
        private graph: Graph;

        constructor(elementId: string) {
            try {
                const _ = document.getElementById(elementId)!

                GraphManager.graphviz = d3.select(`#${elementId}`).graphviz().transition(function () {
                        return d3.transition("main")
                            .ease(d3.easeLinear)
                            .delay(500)
                            .duration(1500);
                    })
                    .logEvents(false);
            } catch (e: any) {
                throw new Error(`Can not initialize GraphManager due to invalid element id "${elementId}"`)
            }
            this.graph = new Graph();
        }

        onUpdate(update: AlgoUpdate) {
            console.log(update.toString());
            this.graph.apply(update);

            GraphManager.graphviz.renderDot(this.graph.toString());
        }
    }
}
