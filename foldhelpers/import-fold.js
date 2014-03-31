/**
 *
 * @author Patrick Oladimeji
 * @date 10/24/13 9:29:23 AM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, sloppy: true*/
/*global define, brackets, CodeMirror*/
define(function (require, exports, module) {
    "use strict";

    module.exports = function (cm, start) {
        function hasImport(line) {
            if (line < cm.firstLine() || line > cm.lastLine()) {
                return null;
            }
            var start = cm.getTokenAt(CodeMirror.Pos(line, 1));
            if (!/\S/.test(start.string)) {
                start = cm.getTokenAt(CodeMirror.Pos(line, start.end + 1));
            }
            if (start.type != "keyword" || start.string != "import") {
                return null;
            }
            // Now find closing semicolon, return its position
            for (var i = line, e = Math.min(cm.lastLine(), line + 10); i <= e; ++i) {
                var text = cm.getLine(i),
                    semi = text.indexOf(";");
                if (semi != -1) {
                    return {
                        startCh: start.end,
                        end: CodeMirror.Pos(i, semi)
                    };
                }
            }
        }

        start = start.line;
        var has = hasImport(start),
            prev;
        if (!has || hasImport(start - 1) || ((prev = hasImport(start - 2)) && prev.end.line == start - 1)) {
            return null;
        }
        for (var end = has.end;;) {
            var next = hasImport(end.line + 1);
            if (next === null) {
                break;
            }
            end = next.end;
        }
        return {
            from: cm.clipPos(CodeMirror.Pos(start, has.startCh + 1)),
            to: end
        };
    };
});
