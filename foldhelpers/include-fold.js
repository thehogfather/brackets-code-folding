/**
 * 
 * @author Patrick Oladimeji
 * @date 10/24/13 9:31:51 AM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, d3, require, $, brackets, window, MouseEvent, CodeMirror */
define(function (require, exports, module) {
    "use strict";
    module.exports = function (cm, start) {
        function hasInclude(line) {
            if (line < cm.firstLine() || line > cm.lastLine()) {
                return null;
            }
            var start = cm.getTokenAt(CodeMirror.Pos(line, 1));
            if (!/\S/.test(start.string)) {
                start = cm.getTokenAt(CodeMirror.Pos(line, start.end + 1));
            }
            if (start.type === "meta" && start.string.slice(0, 8) === "#include") {
                return start.start + 8;
            }
        }
    
        start = start.line;
        var  has = hasInclude(start), end;
        if (has == null || hasInclude(start - 1) != null) {
            return null;
        }
        for (end = start;;) {
            var next = hasInclude(end + 1);
            if (next == null) { break; }
            ++end;
        }
        return {from: CodeMirror.Pos(start, has + 1), to: cm.clipPos(CodeMirror.Pos(end))};
    }
});
