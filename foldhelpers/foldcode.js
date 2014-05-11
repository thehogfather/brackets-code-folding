/**
 * Based on http://codemirror.net/addon/fold/foldcode.js
   MOdified by:
 * @author Patrick Oladimeji
 * @date 10/28/13 8:41:46 AM
 * @last modified 20 April 2014
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, brackets, document*/
define(function (require, exports, module) {
    "use strict";
    var CodeMirror = brackets.getModule("thirdparty/CodeMirror2/lib/codemirror");

    module.exports = function () {
        function doFold(cm, pos, options, force) {
            if (typeof pos === "number") {
                pos = CodeMirror.Pos(pos, 0);
            }
            //combine the foldhelper for the current mode with the comment fold helper
            var finder = CodeMirror.fold.auto;
            var minSize = (options && options.minFoldSize) || 2;

            function getRange(allowFolded) {
                var range = finder(cm, pos);
                if (!range || range.to.line - range.from.line < minSize) {
                    return null;
                }
                var marks = cm.findMarksAt(range.from),
                    i;
                for (i = 0; i < marks.length; ++i) {
                    if (marks[i].__isFold && force !== "fold") {
                        if (!allowFolded) {
                            return null;
                        }
                        range.cleared = true;
                        marks[i].clear();
                    }
                }
                //check for overlapping folds
                var lastMark, foldMarks;
                if (marks && marks.length) {
                    foldMarks = marks.filter(function (d) { return d.__isFold; });
                    if (foldMarks && foldMarks.length) {
                        lastMark = foldMarks[foldMarks.length - 1].find();
                        if (lastMark && range.from.line <= lastMark.to.line && lastMark.to.line < range.to.line) {
                            return null;
                        }
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

            var range = getRange(true);
            if (options && options.scanUp) {
                while (!range && pos.line > cm.firstLine()) {
                    pos = CodeMirror.Pos(pos.line - 1, 0);
                    range = getRange(false);
                }
            }
            if (!range || range.cleared || force === "unfold" || range.to.line - range.from.line < minSize) {
                return;
            }

            var myWidget = makeWidget(options);
            var myRange = cm.markText(range.from, range.to, {
                replacedWith: myWidget,
                clearOnEnter: true,
                __isFold: true
            });
            CodeMirror.on(myWidget, "mousedown", function () {
                myRange.clear();
            });
            myRange.on("clear", function (from, to) {
                CodeMirror.signal(cm, "unfold", cm, from, to);
            });
            CodeMirror.signal(cm, "fold", cm, range.from, range.to);
            return range;
        }

        CodeMirror.defineExtension("foldCode", function (pos, options, force) {
            return doFold(this, pos, options, force);
        });

        //define an unfoldCode extension to quickly unfold folded code
        CodeMirror.defineExtension("unfoldCode", function (pos) {
            return doFold(this, pos, null, "unfold");
        });

        CodeMirror.registerHelper("fold", "combine", function () {
            var funcs = Array.prototype.slice.call(arguments, 0);
            return function (cm, start) {
                var i;
                for (i = 0; i < funcs.length; ++i) {
                    var found = funcs[i] && funcs[i](cm, start);
                    if (found) {
                        return found;
                    }
                }
            };
        });

        CodeMirror.defineExtension("isFolded", function (line) {
            var marks = this.findMarksAt(CodeMirror.Pos(line)),
                i;
            for (i = 0; i < marks.length; ++i) {
                if (marks[i].__isFold && marks[i].find().from.line === line) {
                    return true;
                }
            }
        });

        CodeMirror.commands.toggleFold = function (cm) {
            cm.foldCode(cm.getCursor());
        };
        CodeMirror.commands.fold = function (cm) {
            cm.foldCode(cm.getCursor(), null, "fold");
        };
        CodeMirror.commands.unfold = function (cm) {
            cm.foldCode(cm.getCursor(), null, "unfold");
        };
        CodeMirror.commands.foldAll = function (cm) {
            cm.operation(function () {
                var i, e;
                for (i = cm.firstLine(), e = cm.lastLine(); i <= e; i++) {
                    cm.foldCode(CodeMirror.Pos(i, 0), null, "fold");
                }
            });
        };
        CodeMirror.commands.unfoldAll = function (cm) {
            cm.operation(function () {
                var i, e;
                for (i = cm.firstLine(), e = cm.lastLine(); i <= e; i++) {
                    cm.foldCode(CodeMirror.Pos(i, 0), null, "unfold");
                }
            });
        };

        CodeMirror.registerHelper("fold", "auto", function (cm, start) {
            var helpers = cm.getHelpers(start, "fold"), i, cur;
            for (i = 0; i < helpers.length; i++) {
                cur = helpers[i](cm, start);
                if (cur) { return cur; }
            }
        });
    };
});