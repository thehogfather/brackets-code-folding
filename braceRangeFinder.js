// the tagRangeFinder function is
//   Copyright (C) 2011 by Daniel Glazman <daniel@glazman.org>
// released under the MIT license (../../LICENSE) like the rest of CodeMirror

/**
 * Range Finder for javascript functions to support code folding
 * @author Daniel Glazman (modified for Brackets by Patrick Oladimeji <thehogfather@dustygem.co.uk>)
 * @date 4/14/13 18:29:41 PM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, d3, require, $, brackets, window, MouseEvent, CodeMirror */
define(function (require, exports, module) {
    "use strict";
    
    var _commentRegex = /^(comment|string)/;
    function rangeFinder(cm, start) {
        var line = start.line, lineText = cm.getLine(line);
        var at = lineText.length, startChar, tokenType;
        for (;;) {
            var found = lineText.lastIndexOf("{", at);
            if (found < start.ch) {
                break;
            }
            tokenType = cm.getTokenAt(CodeMirror.Pos(line, found + 1)).type;
            if (!_commentRegex.test(tokenType)) { startChar = found; break; }
            at = found - 1;
        }
        if (startChar === null || lineText.lastIndexOf("}") > startChar) {
            return;
        }
        var count = 1, lastLine = cm.lineCount(), end, endCh, i;
outer:  for (i = line + 1; i < lastLine; ++i) {
            var text = cm.getLine(i), pos = 0;
            for (;;) {
                var nextOpen = text.indexOf("{", pos), nextClose = text.indexOf("}", pos);
                if (nextOpen < 0) {
                    nextOpen = text.length;
                }
                if (nextClose < 0) {
                    nextClose = text.length;
                }
                pos = Math.min(nextOpen, nextClose);
                if (pos === text.length) {
                    break;
                }
                if (cm.getTokenAt(CodeMirror.Pos(i, pos + 1)).type === tokenType) {
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
        if (end === null || end === line + 1) {
            return;
        }
        
        return {from: CodeMirror.Pos(line, startChar + 1),
                  to: CodeMirror.Pos(end, endCh)};
    }
    
    module.exports = {
        rangeFinder: rangeFinder,
        canFold:    function (cm, lineNum) {
            var lineText = cm.getLine(lineNum);
            var openBraceIndex = lineText.lastIndexOf("{"), closeBraceIndex = lineText.lastIndexOf("}");
            var tokenType = cm.getTokenAt(CodeMirror.Pos(lineNum, openBraceIndex + 1)).type;
            return !_commentRegex.test(tokenType) && openBraceIndex > closeBraceIndex;
        }
    };
});