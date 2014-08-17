/**
 * Based on http://codemirror.net/addon/fold/foldgutter.js
   Modulised by:
 * @author Patrick Oladimeji
 * @date 10/24/13 10:14:01 AM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, brackets, document, clearTimeout, setTimeout*/
define(function (require, exports, module) {
    "use strict";
    var CodeMirror = brackets.getModule("thirdparty/CodeMirror2/lib/codemirror");
    var minFoldSize = 1;
    module.exports = function () {
        function State(options) {
            this.options = options;
            this.from = this.to = 0;
        }
    
        function parseOptions(opts) {
            if (opts === true) { opts = {}; }
            if (!opts.gutter) { opts.gutter = "CodeMirror-foldgutter"; }
			if (!opts.indicatorRange) {opts.indicatorRange = "CodeMirror-foldgutter-range"; }
            if (!opts.indicatorOpen) { opts.indicatorOpen = "CodeMirror-foldgutter-open CodeMirror-foldgutter-range"; }
            if (!opts.indicatorFolded) { opts.indicatorFolded = "CodeMirror-foldgutter-folded"; }
			if (!opts.beginRange) { opts.beginRange = "CodeMirror-foldgutter-beginrange CodeMirror-foldgutter-range"; }
			if (!opts.endRange) {opts.endRange = "CodeMirror-foldgutter-endrange CodeMirror-foldgutter-range"; }
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

		function markRange(cm, range) {
			var opts = cm.state.foldGutter.options;
			var pos = CodeMirror.Pos(range.from.line);
			var mark = marker("CodeMirror-foldgutter-range"),
				blank = marker("CodeMirror-foldgutter-blank");
			
		 	if (isFolded(cm, range.from.line)) {
				//expand fold if invalid
				if (range){
					mark = marker(opts.indicatorFolded);
				} else {
					cm.findMarksAt(pos).filter(function (m) {
						return m.__isFold;
					}).forEach(function (m) { m.clear(); });
				}
			} else {
				if (range && range.to.line - range.from.line >= minFoldSize) {
					mark = marker(opts.beginRange);
					//visually mark the range
					cm.operation(function () {
						cm.eachLine(range.from.line, range.to.line, function (line) {
							if (isFolded(cm, line.lineNo())) {
								cm.setGutterMarker(line, opts.gutter, marker(opts.indicatorFolded));
							} else {
								cm.setGutterMarker(line, opts.gutter, marker(opts.indicatorRange));
							}
						});
					});
				}
			}
			cm.setGutterMarker(range.from.line, opts.gutter, mark);
		}
		
        function updateFoldInfo(cm, from, to) {
            var opts = cm.state.foldGutter.options;
            cm.eachLine(from, to, function (line) {
                var pos = CodeMirror.Pos(line.lineNo()),
                        func = opts.rangeFinder || CodeMirror.fold.auto;
                var range = func && func(cm, pos);
				if (range) {
					markRange(cm, range);
				}
            });
        }

		function updateRange(cm, line) {
			//derive the range based on the current line - assume that if the current line itself is not
			//an fold range start, then need to look above it to find  the first range that contains the current line
			var opts = cm.state.foldGutter.options;
			var pos = CodeMirror.Pos(line),
				func = opts.rangeFinder || CodeMirror.fold.auto;
			var range = func && func(cm, pos);
			if (range && Math.abs(range.from.line - range.to.line) > minFoldSize) {
				return markRange(cm, range);
			} else {
				var i = line - 1;
				for (i = line - 1; i >= 0; i--) {
					range = func && func(cm, CodeMirror.Pos(i));
					if (range && Math.abs(range.from.line - range.to.line) > minFoldSize &&
						range.from.line < line && line <= range.to.line) {
						return markRange(cm, range);
					}
				}
			}
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
//                cm.off("fold", onFold);
//                cm.off("unfold", onFold);
            }
            if (val) {
                cm.state.foldGutter = new State(parseOptions(val));
                cm.on("gutterClick", val.onGutterClick);
//                cm.on("fold", onFold);
//                cm.on("unfold", onFold);
            }
        });
		
		return {
			updateViewport: updateInViewport,
			updateRange: updateRange
		};
    };
});
