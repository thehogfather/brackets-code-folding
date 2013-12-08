/**
 * Based on http://codemirror.net/addon/fold/foldgutter.js
   Modulised by:
 * @author Patrick Oladimeji
 * @date 10/24/13 10:14:01 AM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, d3, require, $, brackets, window, document, CodeMirror, clearTimeout, setTimeout*/
define(function (require, exports, module) {
    "use strict";

    module.exports = function () {
        function State(options) {
            this.options = options;
            this.from = this.to = 0;
        }
    
        function parseOptions(opts) {
            if (opts === true) { opts = {}; }
            if (!opts.gutter) { opts.gutter = "CodeMirror-foldgutter"; }
            if (!opts.indicatorOpen) { opts.indicatorOpen = "CodeMirror-foldgutter-open"; }
            if (!opts.indicatorFolded) { opts.indicatorFolded = "CodeMirror-foldgutter-folded"; }
            return opts;
        }
    
        function isFolded(cm, line) {
            var marks = cm.findMarksAt(CodeMirror.Pos(line)), i;
            for (i = 0; i < marks.length; ++i) {
                if (marks[i].__isFold && marks[i].find().from.line === line) { return true; }
            }
        }
    
        function marker(spec) {
            if (typeof spec === "string") {
                var elt = document.createElement("div");
                elt.className = spec;
                return elt;
            } else {
                return spec.cloneNode(true);
            }
        }

        function updateFoldInfo(cm, from, to) {
            var opts = cm.state.foldGutter.options, cur = from;
            cm.eachLine(from, to, function (line) {
                var mark = marker("CodeMirror-foldgutter-blank");
                if (isFolded(cm, cur)) {
                    mark = marker(opts.indicatorFolded);
                } else {
                    var pos = CodeMirror.Pos(cur, 0),
                        func = opts.rangeFinder || new CodeMirror.fold.combine(cm.getHelper(pos, "fold"), CodeMirror.fold.comment);
                    var range = func && func(cm, pos);
                    if (range && range.from.line + 1 < range.to.line) {
                        mark = marker(opts.indicatorOpen);
                    }
                }
                cm.setGutterMarker(line, opts.gutter, mark);
                ++cur;
            });
        }

        function updateInViewport(cm) {
            var vp = cm.getViewport(), state = cm.state.foldGutter;
            if (!state) { return; }
            cm.operation(function () {
                updateFoldInfo(cm, vp.from, vp.to);
            });
            state.from = vp.from;
            state.to = vp.to;
        }

        function onChange(cm) {
            var state = cm.state.foldGutter;
            state.from = state.to = 0;
            clearTimeout(state.changeUpdate);
            state.changeUpdate = setTimeout(function () { updateInViewport(cm); }, 600);
        }

        function onViewportChange(cm) {
            var state = cm.state.foldGutter;
            clearTimeout(state.changeUpdate);
            state.changeUpdate = setTimeout(function () {
                var vp = cm.getViewport();
                if (state.from === state.to || vp.from - state.to > 20 || state.from - vp.to > 20) {
                    updateInViewport(cm);
                } else {
                    cm.operation(function () {
                        if (vp.from < state.from) {
                            updateFoldInfo(cm, vp.from, state.from);
                            state.from = vp.from;
                        }
                        if (vp.to > state.to) {
                            updateFoldInfo(cm, state.to, vp.to);
                            state.to = vp.to;
                        }
                    });
                }
            }, 400);
        }

        function onFold(cm, from) {
            var state = cm.state.foldGutter, line = from.line;
            if (line >= state.from && line < state.to) {
                updateFoldInfo(cm, line, line + 1);
            }
        }
         
        CodeMirror.defineOption("foldGutter", false, function (cm, val, old) {
            if (old && old !== CodeMirror.Init) {
                cm.clearGutter(cm.state.foldGutter.options.gutter);
                cm.state.foldGutter = null;
                cm.off("gutterClick", old.onGutterClick);
                cm.off("change", onChange);
                cm.off("viewportChange", onViewportChange);
                cm.off("fold", onFold);
                cm.off("unfold", onFold);
                cm.off("swapDoc", updateInViewport);
            }
            if (val) {
                cm.state.foldGutter = new State(parseOptions(val));
                updateInViewport(cm);
                cm.on("gutterClick", val.onGutterClick);
                cm.on("change", onChange);
                cm.on("viewportChange", onViewportChange);
                cm.on("fold", onFold);
                cm.on("unfold", onFold);
                cm.on("swapDoc", updateInViewport);
            }
        });
    };
});