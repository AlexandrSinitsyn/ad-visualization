import { BrowserManager } from "./ad/browser-manager.js";
import { FunctionTree } from "./ad/function-tree.js";
import { parseFunction } from "./parser/parser.js";
import { Arrays } from "./util/arrays.js";

export const browser = new BrowserManager("graph");

console.log("Browser manager:", browser);
console.log('parser', (input: string) => parseFunction(input));

// fixme
function notify(message: string) {
    alert(message);
    browser.pause();
}

function int(element: JQuery<HTMLElement>): number {
    return +(element.val() ?? 0);
}

function str(element: JQuery<HTMLElement>): string {
    return element.val() + '';
}

// setup aside
$(document).ready(function () {
    const elements: {[key: string]: [string, () => void]} = {
        'play': ['play-fill', () => browser.resume()],
        'step': ['file-play', () => browser.step()],
        'pause': ['pause', () => browser.pause()],
        'stop': ['stop-fill', () => browser.restart()],
    };

    const $aside = $('aside');

    for (const [name, [clazz, callback]] of Object.entries(elements)) {
        $aside.append(
`<div id="action-${name}" class="${name} btn btn-outline-primary">
    <span style="margin-right: 0.5rem">${name.charAt(0).toUpperCase() + name.slice(1)}</span>
    <i class="bi bi-${clazz}"></i>
</div>`
        );

        $aside.find(`#action-${name}`).click(callback);
    }

    // switch animation
    $aside.append(
`<div id="action-remove-animation" class="remove-animation btn btn-outline-primary" style="
    display: flex;
    align-items: center;
    justify-content: space-evenly;
    flex-direction: row;
">
    <div class="bi">Disable</br>animation</div>
    <i class="bi bi-film"></i>
</div>`
    );

    $aside.find('#action-remove-animation').click(function () {
        const now = browser.switchAnimation();

        $(this).find('span').text(now ? 'Disable</br>animation' : 'Enable</br>animation');
    });
});

function newMatrix($parent: JQuery<HTMLElement>, name: string, onUpdate: (data: number[][]) => void, fixed: [number, number] | boolean): JQuery<HTMLElement> {
    const $new = $($parent.find('template').prop('content')).clone();

    const $cell = $($new.find('template').prop('content'));

    const $tbody = $new.find('tbody');

    const getRowCount = () => $tbody.children().length;
    const getColCount = () => $tbody.children().first()?.children()?.length ?? 0;

    const $nameField = $new.find('.variable-name > .marker');
    $nameField.text(name);

    const genCell = () => {
        const $newCell = $cell.clone();
        const $inputField = $newCell.find('.table-item');

        // fixme
        $inputField.keyup(function () {
            const VALUE: number[][] = [];

            $tbody.find('tr').each(function (i: number) {
                VALUE.push([]);
                $(this).find('td').each(function () {
                    VALUE[i].push(int($(this).find('.table-item')));
                })
            });

            console.log('>', name, '=', VALUE);

            onUpdate(fixed === true ? Arrays.genZero(VALUE[0][0], VALUE[0][1]) : VALUE);
        });

        return $newCell;
    };

    const newRow = () => {
        const rows = getRowCount();
        if (rows >= 4) {
            notify('Number of rows is not supported to be greater than 4')
            return;
        }

        const $tr = $('<tr></tr>').appendTo($tbody);
        $tbody.children().first().children().each((j) => {
            $tr.append(genCell());
        });
    };
    const newCol = () => {
        const cols = getColCount();
        if (cols >= 4) {
            notify('Number of columns is not supported to be greater than 4')
            return;
        }

        $tbody.children().each((i, c) => {
            $(c).append(genCell());
        })
    };

    // single cell
    newRow();
    newCol();

    if (!fixed) {
        $new.find('.expand-right').click(newCol);
        $new.find('.expand-down').click(newRow);
    } else {
        let fixedArr = fixed === true ? [1, 2] : fixed;

        for (let i = 0; i < fixedArr[0] - 1; i++) {
            newRow();
        }
        for (let i = 0; i < fixedArr[1] - 1; i++) {
            newCol();
        }
    }

    $parent.append($new);

    return $new;
}

const $variables = $('.variables').find('.content');
const $derivatives = $('.derivatives').find('.content');

// setup variables-input
$(document).ready(function () {
    browser.onAcceptDerivative((...args: [string, [number, number]][]) => {
        $derivatives.children('.var').remove();

        for (const [name, [rows, cols]] of args) {
            const $new = newMatrix($derivatives, name, (v) => browser.updateDerivative(name, v), [rows, cols]);

            const $name = $new.find('.variable-name > .marker');

            $name.text(name);
        }
    })
});

// LaTeX visualizer
$(document).ready(function () {
    const $funInput = $('#function-input');
    const $inputMatrixMode = document.getElementById('input-matrix-mode') as HTMLInputElement;

    $funInput.keyup(function () {
        const expr = parseFunction(str($("#function-input")));

        const $functionError = $("#function-error");
        if (!expr.isOk()) {
            $functionError.text(expr.error());
            // $functionError.show();
        } else {
            // $functionError.hide();
            $functionError.text('');
        }

        const $function = $('#function-show');
        $function.text(expr.expr().map((e) => {
            const rule = e as FunctionTree.Rule;
            return '\\[' + rule.name + ' = ' + rule.toTex(undefined) + '\\]'
        }).join(''));

        // @ts-ignore
        MathJax.typeset();

        $variables.children('.var').remove();

        expr.graph.filter((e) => e instanceof FunctionTree.Variable).forEach((n) => {
            const name = (n as FunctionTree.Variable).name;
            newMatrix($variables, name, (v) => browser.updateValue(name, v, $inputMatrixMode.checked), !$inputMatrixMode.checked);
        })

        const max = browser.setFunction(expr.graph, $inputMatrixMode.checked);

        const $player = $('#player');
        $player.attr('max', max)

        $('#graph').css('height', 'calc(' + $('main').css('max-height') + ' - ' + $function.height() + 'px - ' + $player.height() + 'px - 2rem)');
    });

    $funInput.text('f = x + y * tanh(x)\ng = x + f(x) * f(x)');

    $funInput.trigger('keyup');
});

// fps init
$(document).ready(() => {
    // number of frames in one second
    const available = [0.2, 0.5, 1, 2, 3, 4, 5, 10];

    const $slider = $('#frametime');
    $slider.attr('min', 0);
    $slider.attr('max', available.length - 1);
    $slider.attr('step', 1);

    const $frametime = $('#frametime-show');
    const onupdate = () => {
        const v = available[int($slider)];
        $frametime.text(v < 1 ? `1/${1 / v} fps` : `${v}/1 fps`);
        $frametime.attr('title', v < 1 ? `1 frames /${1 / v} sec` : `${v} frames / 1 ses`);

        browser.speedup(1 / v * 1000);
    };
    onupdate();
    $slider.change(onupdate);
    $slider.mousemove(onupdate);
});

// player init
$(document).ready(function () {
    const $player = $('#player');
    $player.mouseup(() => browser.moveTo(int($player)));

    browser.bindPlayer((frame, result) => {
        $player.val(frame);

        if (result !== true) {
            notify(result);
        }
    });
});

$(document).ready(function () {
    const $funInput = $('#function-input');
    const $inputMatrixMode = document.getElementById('input-matrix-mode');

    $inputMatrixMode!.addEventListener('change', () => $funInput.trigger('keyup'));
});

export function phantomTextSize(text: string, font: string): number {
    const $field = $('.frame-update > #textholder');

    $field.text(text);
    $field.css('font-family', font);

    return $field.innerWidth() ?? 0;
}
