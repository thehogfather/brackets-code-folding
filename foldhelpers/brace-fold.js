/**
 * CodeMirror brace-fold addon
 * Slightly modularised by Patrick Oladimeji
 * @date 10/24/13 8:26:34 AM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, d3, require, $, brackets, window, MouseEvent, CodeMirror*/
define(function (require, exports, module) {
    "use strict";
    module.exports = function (cm, start) {
        var line = start.line, lineText = cm.getLine(line);
        var startCh, tokenType = null;

        function findOpening(openCh) {
            var at, pass;
            for (at = start.ch, pass = 0; true; true) {
                var found = at <= 0 ? -1 : lineText.lastIndexOf(openCh, at - 1);
                if (found === -1) {
                    if (pass === 1) { break; }
                    pass = 1;
                    at = lineText.length;
                    continue;
                }
                if (pass === 1 && found < start.ch) { break; }
                tokenType = cm.getTokenTypeAt(CodeMirror.Pos(line, found + 1));
                if (!/^(comment|string)/.test(tokenType)) { return found + 1; }
                at = found - 1;
            }
        }

        var startToken = "{", endToken = "}";
        startCh = findOpening("{");
        if (startCh === null || startCh === undefined) {
            startToken = "[";
            endToken = "]";
            startCh = findOpening("[");
        }

        if (startCh === null || startCh === undefined) { return; }
        var count = 1, lastLine = cm.lastLine(), end, endCh, i;
outer:  for (i = line; i <= lastLine; ++i) {
            var text = cm.getLine(i), pos = i === line ? startCh : 0;
            for (;;) {
                var nextOpen = text.indexOf(startToken, pos), nextClose = text.indexOf(endToken, pos);
                if (nextOpen < 0) { nextOpen = text.length; }
                if (nextClose < 0) { nextClose = text.length; }
                pos = Math.min(nextOpen, nextClose);
                if (pos === text.length) { break; }
                if (cm.getTokenTypeAt(CodeMirror.Pos(i, pos + 1)) == tokenType) {//need == here cos tokenType can be null or undefined
                    if (pos === nextOpen) {
                        ++count;
                    } else if (!--count) {
                        end = i;
                        endCh = pos;
                        break outer;
                    }
                }
                ++pos;
            }
        }
        if (end === null || end === undefined || (line === end && endCh === startCh)) { return; }
        
        return {from: CodeMirror.Pos(line, startCh),
            to: CodeMirror.Pos(end, endCh)};
    };
});
