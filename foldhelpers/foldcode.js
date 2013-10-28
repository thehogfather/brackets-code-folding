/**
 * 
 * @author Patrick Oladimeji
 * @date 10/28/13 8:41:46 AM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, d3, require, $, brackets, window, CodeMirror, document */
define(function (require, exports, module) {
    "use strict";
    module.exports = function () {
        function doFold(cm, pos, options, force) {
            var finder = options && (options.call ? options : options.rangeFinder);
            if (!finder) { finder = cm.getHelper(pos, "fold"); }
            if (!finder) { return; }
            if (typeof pos === "number") { pos = CodeMirror.Pos(pos, 0); }
            var minSize = (options && options.minFoldSize) || 1;

            function getRange(allowFolded) {
                var range = finder(cm, pos);
                if (!range || range.to.line - range.from.line < minSize) { return null; }
                var marks = cm.findMarksAt(range.from), i;
                for (i = 0; i < marks.length; ++i) {
                    if (marks[i].__isFold && force !== "fold") {
                        if (!allowFolded) { return null; }
                        range.cleared = true;
                        marks[i].clear();
                    }
                }
                return range;
            }
            
            function makeWidget(options) {
                var widget = (options && options.widget) || "\u2194";
                if (typeof widget === "string") {
                    var text = document.createTextNode(widget);
                    widget = document.createElement("span");
                    widget.appendChild(text);
                    widget.className = "CodeMirror-foldmarker";
                }
                return widget;
            }
            
            var range = options.range || getRange(true);
            if (options && options.scanUp) {
                while (!range && pos.line > cm.firstLine()) {
                    pos = CodeMirror.Pos(pos.line - 1, 0);
                    range = getRange(false);
                }
            }
            if (!range || range.cleared || force === "unfold") { return; }

            var myWidget = makeWidget(options);
            var myRange = cm.markText(range.from, range.to, {
                replacedWith: myWidget,
                clearOnEnter: true,
                __isFold: true
            });
            CodeMirror.on(myWidget, "mousedown", function () { myRange.clear(); });
            myRange.on("clear", function (from, to) {
                CodeMirror.signal(cm, "unfold", cm, from, to);
            });
            CodeMirror.signal(cm, "fold", cm, range.from, range.to);
            return range;
        }
        
        //get the folded mark and clear it
        function unFold(cm, pos) {
            if (typeof pos === "number") {
                pos = CodeMirror.Pos(pos, 0);
            }
            var i,  marks = cm.findMarksAt(pos);
            for (i = 0; i < marks.length; i++) {
                if (marks[i].__isFold) { marks[i].clear(); }
            }
        }

        CodeMirror.defineExtension("foldCode", function (pos, options, force) {
            return doFold(this, pos, options, force);
        });
    
        //define an unfoldCode extension to quickly unfold folded code
        CodeMirror.defineExtension("unfoldCode", function (pos) {
            unFold(this, pos);
        });

        CodeMirror.registerHelper("fold", "combine", function () {
            var funcs = Array.prototype.slice.call(arguments, 0);
            return function (cm, start) {
                var i;
                for (i = 0; i < funcs.length; ++i) {
                    var found = funcs[i](cm, start);
                    if (found) { return found; }
                }
            };
        });
        
        CodeMirror.defineExtension("isFolded", function (line) {
            var marks = this.findMarksAt(CodeMirror.Pos(line)), i;
            for (i = 0; i < marks.length; ++i) {
                if (marks[i].__isFold && marks[i].find().from.line === line) {
                    return true;
                }
            }
        });
    };
});
