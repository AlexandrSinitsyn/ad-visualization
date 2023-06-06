import { FunctionTree } from "./function-tree.js";
import { Algo, AlgoUpdate } from "./algo.js";
// @ts-ignore <- fail warning. This lib is imported on index.html:19
import * as d3 from "./d3";

export namespace BrowserManager {
    export class Player {
        private time: number;
        private frameTime: number;
        // noinspection JSMismatchedCollectionQueryUpdate
        private algo: Generator<AlgoUpdate> | undefined;
        public finished: boolean;
        private graphManager: GraphManager;

        constructor(graphManager: GraphManager, frameTime: number) {
            this.graphManager = graphManager;
            this.frameTime = frameTime;
            this.time = frameTime;
            this.finished = false;
        }

        public frame(dt: number) {
            if (!this.algo) {
                return;
            }

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
        private expr: FunctionTree.Node | undefined;
        private readonly graphManager: GraphManager;

        public constructor(graphManager: GraphManager, frame: Seconds) {
            this.graphManager = graphManager;
            this.player = new Player(graphManager, frame * 1000);
            this.isOn = false;
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

        public step() {
            this.player.step();
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
            if (!this.expr) {
                return;
            }

            this.pause();

            this.graphManager.reset();

            this.player.updateFunction(this.expr);
        }

        public setFunction(fun: FunctionTree.Node) {
            this.expr = fun;
            this.player.updateFunction(fun);
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

        public reset() {
            this.nodes.length = 0;
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

        public constructor(elementId: string) {
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

        public onUpdate(update: AlgoUpdate) {
            this.graph.apply(update);

            this.render();
        }

        public reset() {
            this.graph.reset();

            this.render();
        }

        private render() {
            GraphManager.graphviz.renderDot(this.graph.toString());
        }
    }
}
