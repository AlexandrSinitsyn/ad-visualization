import { Node } from './parser-tree.js';
import grammar from "./grammar.js";

class ParserError extends Error {}

export function parse(input: string): Node {
    // @ts-ignore
    const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
    parser.feed(input);
    const result = parser.results;

    if (result.length == 0) {
        throw new ParserError("Input matches nothing");
    }

    const graph: Node = result[0];

    return graph;
}
