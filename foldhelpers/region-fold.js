// Function copied from brace-fold.js addon in CodeMirror Library with minor altering.
// CodeMirror 4.1.1, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE
/*jshint eqnull:true, unused:true, undef: true*/
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, eqeq:true */
/*global define, brackets*/
define(function (require, exports, module) {
    "use strict";
    var CodeMirror = brackets.getModule("thirdparty/CodeMirror2/lib/codemirror"),
        startRegion = /\W+region/i,
        endRegion = /\W+endregion/i;
    
    module.exports = function(cm,start) {
        var line = start.line;
        var startCh = 0, stack = [], token;
        var lastLine = cm.lastLine(), end, endCh, nextOpen, nextClose;
		//no need to fold on single line files
		if (line === lastLine) { return; }

        for (var i = line; i <= lastLine; ++i) {
            var text = cm.getLine(i), pos = startCh;
            for (var j = pos; j < text.length; ) {
                token = cm.getTokenAt(CodeMirror.Pos(i, j));
                if (token && token.type === "comment") {
                    nextOpen = token.string.toLowerCase().match(startRegion) ? token.end : -1;
                    nextClose = token.string.toLowerCase().match(endRegion) ? token.start : -1;
                    if (nextOpen  > -1) {
                        stack.push(nextOpen);
                    }
                    if (nextClose > -1) {
                        if (stack.length === 1) {
                            endCh = nextClose;
                            end = i;
                             return {from: CodeMirror.Pos(line, stack[0]),
                                     to: CodeMirror.Pos(end, endCh)};
                        }
                        stack.pop();
                    }
                }
                j = token ? token.end + 1: text.length;
            }
            if (stack.length === 0) { break; }
        }
        if (end == null || line == end && endCh == startCh) return;
        return {from: CodeMirror.Pos(line, stack[0]),
              to: CodeMirror.Pos(end, endCh)};
    };

});
