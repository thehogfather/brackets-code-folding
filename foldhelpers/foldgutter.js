/**
 * Based on http://codemirror.net/addon/fold/foldgutter.js
   Modulised by:
 * @author Patrick Oladimeji
 * @date 10/24/13 10:14:01 AM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, brackets, document, clearTimeout, setTimeout, $*/
define(function (require, exports, module) {
    "use strict";
    var CodeMirror = brackets.getModule("thirdparty/CodeMirror2/lib/codemirror");
    var prefs = require("Prefs");
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
            var minFoldSize = prefs.getSetting("minFoldSize") || 2;
            var opts = cm.state.foldGutter.options;
            var fade = prefs.getSetting("fadeFoldButtons");
            var gutter = $(cm.getGutterElement());
            cm.eachLine(from, to, function (line) {
                var mark = marker("CodeMirror-foldgutter-blank");
                var pos = CodeMirror.Pos(line.lineNo()),
                    func = opts.rangeFinder || CodeMirror.fold.auto;
                var range = func && func(cm, pos);

                var tabSize = cm.getOption("tabSize");
                var lineIndent = CodeMirror.countColumn(line.text, null, tabSize);
                var maxIndent = prefs.getSetting("maxIndent");
                if (lineIndent > maxIndent) { return; }

                if (!fade || (fade && gutter.is(":hover"))) {
                    if (isFolded(cm, line.lineNo())) {
                        //expand fold if invalid
                        if (range) {
                            mark = marker(opts.indicatorFolded);
                        } else {
                            cm.findMarksAt(pos).filter(function (m) {
                                return m.__isFold;
                            }).forEach(function (m) { m.clear(); });
                        }
                    } else {
                        if (range && range.to.line - range.from.line >= minFoldSize) {
                            mark = marker(opts.indicatorOpen);
                        }
                    }
                }
                cm.setGutterMarker(line, opts.gutter, mark);
            });
        }

        function clearGutter(cm) {
            var opts = cm.state.foldGutter.options;
            cm.clearGutter(opts.gutter);
            var blank = marker("CodeMirror-foldgutter-blank");
            var vp = cm.getViewport();
            cm.operation(function () {
                cm.eachLine(vp.from, vp.to, function (line) {
                    cm.setGutterMarker(line.lineNo(), opts.gutter, blank);
                });
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
            state.changeUpdate = setTimeout(function () {
                updateInViewport(cm);
            }, prefs.getSetting("foldOnChangeTimeSpan") || 600);
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
            }, prefs.getSetting("updateViewportTimeSpan") || 400);
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

        return {
            clearGutter: clearGutter,
            updateInViewport: updateInViewport
        };
    };
});
