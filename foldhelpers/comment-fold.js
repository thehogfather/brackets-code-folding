/**
 * CodeMirror comment-fold addon.
    Modularized by:
 * @author Patrick Oladimeji
 * @date 10/24/13 9:47:29 AM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, eqeq: true, continue: true */
/*global define, brackets, CodeMirror*/
define(function (require, exports, module) {
    "use strict";
    module.exports = function (cm, start) {
        var mode = cm.getModeAt(start), startToken = mode.blockCommentStart, endToken = mode.blockCommentEnd;
        if (!startToken || !endToken) { return; }
        var line = start.line, lineText = cm.getLine(line);
    
        var startCh, at, pass;
        for (at = start.ch, pass = 0; true; true) {
            var found = at <= 0 ? -1 : lineText.lastIndexOf(startToken, at - 1);
            if (found === -1) {
                if (pass === 1) { return; }
                pass = 1;
                at = lineText.length;
                continue;
            }
            if (pass === 1 && found < start.ch) { return; }
            if (/comment/.test(cm.getTokenTypeAt(CodeMirror.Pos(line, found + 1)))) {
                startCh = found + startToken.length;
                break;
            }
            at = found - 1;
        }
    
        var depth = 1, lastLine = cm.lastLine(), end, endCh, i;
outer:  for (i = line; i <= lastLine; ++i) {
            var text = cm.getLine(i), pos = i === line ? startCh : 0;
            for (;;) {
                var nextOpen = text.indexOf(startToken, pos), nextClose = text.indexOf(endToken, pos);
                if (nextOpen < 0) { nextOpen = text.length; }
                if (nextClose < 0) { nextClose = text.length; }
                pos = Math.min(nextOpen, nextClose);
                if (pos === text.length) { break; }
                if (pos === nextOpen) {
                    ++depth;
                } else if (!--depth) {
                    end = i;
                    endCh = pos;
                    break outer;
                }
                ++pos;
            }
        }
        if (end === null || (line == end && endCh == startCh)) { return; }
        return {from: CodeMirror.Pos(line, startCh), to: CodeMirror.Pos(end, endCh)};
    };

});
