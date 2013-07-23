/*
* Copyright (c) 2013 Patrick Oladimeji. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a
* copy of this software and associated documentation files (the "Software"),
* to deal in the Software without restriction, including without limitation
* the rights to use, copy, modify, merge, publish, distribute, sublicense,
* and/or sell copies of the Software, and to permit persons to whom the
* Software is furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in
* all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
* FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
* DEALINGS IN THE SOFTWARE.
*
*/
/**
 * Replaces a specified range of text with a string or an html widget.
 * [Based on code originally written by Daniel Glazman for CodeMirror code folding addon]
 * @author Patrick Oladimeji
 * @date 4/23/13 9:00:11 AM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, d3, require, $, brackets, window, document, CodeMirror */
define(function (require, exports, module) {
    "use strict";
    var         _foldMarker             = "\u2194";
    module.exports = function (rangeFinder, widget, onRangeCleared) {
        if (!widget) {
            widget = _foldMarker;
        }
        if (typeof widget === "string") {
            var text = document.createTextNode(widget);
            widget = document.createElement("span");
            widget.appendChild(text);
            widget.className = "CodeMirror-foldmarker";
        }
    
        return function (cm, pos) {
            if (typeof pos === "number") {
                pos = CodeMirror.Pos(pos, 0);
            }
    
            var present = cm.findMarksAt({line: pos.line + 1, ch: 0}), cleared = 0, i, range;
            for (i = 0; i < present.length; ++i) {
                if (present[i].__isFold) {
                    ++cleared;
                    present[i].clear();
                }
            }
            if (cleared) {
                return;
            }
            
            range = rangeFinder(cm, pos);
            
            if (!range) {
                return;
            }
            
            var myWidget = widget.cloneNode(true);
            var myRange = cm.markText(range.from, range.to, {
                replacedWith: myWidget,
                clearOnEnter: true,
                __isFold: true
            });
            CodeMirror.on(widget, "mousedown", function () {
                myRange.clear();
            });
            CodeMirror.on(myRange, "clear", function () {
                if (onRangeCleared) {
                    onRangeCleared(cm, pos.line);
                }
            });
            return range;
        };
    };
});