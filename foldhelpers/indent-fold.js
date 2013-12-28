/**
 * 
 * @author Patrick Oladimeji
 * @date 10/24/13 9:36:30 AM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, d3, require, $, brackets, window, CodeMirror */
define(function (require, exports, module) {
    "use strict";
    module.exports = function (cm, start) {
        var lastLine = cm.lastLine(),
            tabSize = cm.getOption("tabSize"),
            firstLine = cm.getLine(start.line),
            myIndent = CodeMirror.countColumn(firstLine, null, tabSize),
            token = cm.getTokenAt(CodeMirror.Pos(start.line, 0));
        //ignore blank lines or comment lines
        if (firstLine.trim().length === 0 || (token && token.type === "comment")) { return; }

        function foldEnded(curColumn, prevColumn) {
            return curColumn < myIndent ||
                    (curColumn == myIndent && prevColumn >= myIndent) ||
                    (curColumn > myIndent && i == lastLine);
        }

        for (var i = start.line + 1; i <= lastLine; i++) {
            var curColumn = CodeMirror.countColumn(cm.getLine(i), null, tabSize);
            var prevColumn = CodeMirror.countColumn(cm.getLine(i-1), null, tabSize);

            if (foldEnded(curColumn, prevColumn)) {
                var lastFoldLineNumber = curColumn > myIndent && i == lastLine ? i : i-1;
                var lastFoldLine = cm.getLine(lastFoldLineNumber);
                return {from: CodeMirror.Pos(start.line, firstLine.length),
                        to: CodeMirror.Pos(lastFoldLineNumber, lastFoldLine.length)};
            }
        }
};
});