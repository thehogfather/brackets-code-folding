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
 * main file for code folding in brackets
 * @author Patrick Oladimeji
 * @date 4/14/13 17:19:25 PM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, document, require, $, brackets, window, MouseEvent, CodeMirror, requestAnimationFrame, clearInterval, setTimeout*/

define(function (require, exports, module) {
    "use strict";
    var CommandManager          = brackets.getModule("command/CommandManager"),
        DocumentManager         = brackets.getModule("document/DocumentManager"),
        EditorManager           = brackets.getModule("editor/EditorManager"),
        ProjectManager          = brackets.getModule("project/ProjectManager"),
        PreferencesManager      = brackets.getModule("preferences/PreferencesManager"),
        Menus                   = brackets.getModule("command/Menus"),
        KeyEvent                = brackets.getModule("utils/KeyEvent"),
        ExtensionUtils          = brackets.getModule("utils/ExtensionUtils"),
        AppInit                 = brackets.getModule("utils/AppInit"),
        braceRangeFinder        = require("braceRangeFinder"),
        tagRangeFinder          = require("tagRangeFinder"),
        _prefs                  = PreferencesManager.getPreferenceStorage(module),
        CODE_FOLD_EXT           = "javascript.code.folding",
        _extensionEnabled       = true,
        _expandedChar           = "\u25bc",
        _collapsedChar          = "\u25b6",
        _foldMarker             = "\u2194",
        _braceCollapsibleExtensions = [".js", ".css", ".less", ".json", ".php"],
        _tagCollapsibleExtensions   = [".xml", ".html", ".xhtml", ".htm"],
        _lineFolds              = [],
        scrollInterval;
    
    var _activeRangeFinder, foldFunc, _commentOrString = /^(comment|string)/, lastViewportRange;
    CodeMirror.newFoldFunction  = require("cmFoldFunction");

    function _createMarker(mark, className) {
        var marker = document.createElement("div");
        marker.innerHTML = mark;
        marker.className = className;
        return marker;
    }
    
    function _createCollapsedMarker(lineNum) {
        if (_lineFolds.indexOf(lineNum - 1) === -1) {
            _lineFolds.push(lineNum - 1);
        }
        return _createMarker(_collapsedChar, "codefolding-collapsed");
    }
    
    function _removeMarker(cm, lineNum) {
        cm.setGutterMarker(lineNum, "code-folding-gutter", null);
    }
    
    function _createExpandedMarker(lineNum) {
        var index = _lineFolds.indexOf(lineNum - 1);
        if (index > -1) {
            _lineFolds.splice(index, 1);
        }
        return _createMarker(_expandedChar, "codefolding-expanded");
    }
    
    function _getCollapsibleLines(cm, rangeFinder, from, to) {
        var lines = [], i, f = function (m) {return m.__isFold; };
        for (i = from; i <= to; i++) {
            //find out if the line is folded so no need to loop through
            var marks, skip = 0, j, foldRange;
            marks = cm.findMarksAt(CodeMirror.Pos(i + 1, 0)).filter(f);
    
            //check if foldable info is in hash before calling expensive rangeFinder
            foldRange = rangeFinder.canFold(cm, i);
            if (foldRange) {
                lines.push(i);
                if (marks && marks.length > 0) {
                    i += (marks[0].lines.length - 1);
                }
            } else {
                var lI = cm.lineInfo(i);
                if (lI && lI.gutterMarkers) {
                    _removeMarker(cm, i);
                }
            }
        }
        return lines;
    }

    
    function _renderLineFoldMarkers(cm, line) {
        var allMarks = cm.findMarksAt(CodeMirror.Pos(line + 1, 0)), i, lineMark;
        //sort through all gutter marks and find those related to code folding
        var foldMarks = allMarks.filter(function (m) {
            return m.__isFold;
        });
       
        if (foldMarks.length > 0) {
            //if we find any fold marks on this line then create a collapsed marker
            lineMark =  _createCollapsedMarker(line + 1);
        } else {
            //no marks on this line meaning it might not be collapsible or it is expanded
            //so only decorate it if it is already expanded
            var lInfo = cm.lineInfo(line);
            if (lInfo.gutterMarkers) {
                if (lInfo.gutterMarkers["code-folding-gutter"] &&
                        lInfo.gutterMarkers["code-folding-gutter"].textContent.indexOf(_collapsedChar) > -1) {
                    lineMark  = _createExpandedMarker(line + 1);
                }
            } else { //no gutter markers on this line so probably first time decorating document
                lineMark  = _createExpandedMarker(line + 1);
            }
        }
        if (lineMark) {
            cm.setGutterMarker(line, "code-folding-gutter", lineMark);
        }
    }
    /**
     * Utility function to fold a line if it is not already folded
     */
    function _foldLine(cm, line) {
        var marks = cm.findMarksAt(CodeMirror.Pos(line + 1, 0)), i;
        if (marks && marks.some(function (m) { return m.__isFold; })) {
            return;
        } else {
            foldFunc(cm, line);
        }
    }
    
     /**
     * goes through the visible part of the document and decorates the line numbers with icons for
     * colapsing and expanding code sections
     */
    function _decorateGutters(editor, from, to) {
        var cm = editor._codeMirror, i;
        var collapsibleLines = _getCollapsibleLines(cm, _activeRangeFinder, from, to);
        collapsibleLines.forEach(function (line) {
            _renderLineFoldMarkers(cm, line);
        });
    }
     
    function _handleGutterClick(cm, n, gutterId) {
        if (gutterId === "code-folding-gutter" && cm.lineInfo(n).gutterMarkers) {
            var editor = EditorManager.getActiveEditor();
            var range = foldFunc(cm, n);
            var vp = cm.getViewport();
            //_renderLineFoldMarkers(cm, n);
            _decorateGutters(editor, vp.from, vp.to);
        }
    }

    
    function _handleScroll(event, editor) {
        var cm = editor._codeMirror, vp = cm.getViewport(), from, to, collapsibleLines;
        
        function doScroll() {
            if (lastViewportRange) {
                if (vp.from === lastViewportRange.from) {
                    from = Math.min(vp.to, lastViewportRange.to);
                    to = Math.max(vp.to, lastViewportRange.to);
                } else if (vp.from < lastViewportRange.from) {
                    from = vp.from;
                    to = Math.min(lastViewportRange.from, vp.to);
                } else if (vp.from > lastViewportRange.from) {
                    from = Math.max(vp.from, lastViewportRange.to);
                    to = vp.to;
                }
                _decorateGutters(editor, from, to);
            } else {
                _decorateGutters(editor, vp.from, vp.to);
            }
            //_decorateGutters(editor, vp.from, vp.to);
            lastViewportRange = vp;
        }
        //optimize gutter decoration for files with more than 1000 lines of code
        if (cm.lineCount() > 1000) {
            clearInterval(scrollInterval);
            scrollInterval = setTimeout(function () {
                doScroll();
            }, 50);
        } else {
            doScroll();
        }
    }
    
    function _handleDocumentChange(event, document, changeList) {
        var editor = EditorManager.getActiveEditor(), cm = editor._codeMirror, i;
        if (editor) {
            var vp = cm.getViewport();
            _decorateGutters(editor, changeList.from.line, vp.to);
        }
    }
    /** remove the code-folding-gutter*/
    function _removeGutter(cm) {
        cm.clearGutter("code-folding-gutter");
        var gutters = cm.getOption("gutters").splice(0),
            codeFoldingGutterIndex = gutters.indexOf("code-folding-gutter");
        if (codeFoldingGutterIndex > -1) {
            gutters.splice(codeFoldingGutterIndex, 1);
            cm.setOption("gutters", gutters);
        }
    }
    
    function _updateRangeFinder(editor) {
        //create the appropriate folding function based on the file that was opened
        var doc = editor.document,
            ext = doc.file.fullPath.slice(doc.file.fullPath.lastIndexOf(".")).toLowerCase();
        if (_braceCollapsibleExtensions.indexOf(ext) > -1) {
            _activeRangeFinder = braceRangeFinder;
        } else if (_tagCollapsibleExtensions.indexOf(ext) > -1) {
            _activeRangeFinder = tagRangeFinder;
        }
        if (_activeRangeFinder) {
            foldFunc = CodeMirror.newFoldFunction(_activeRangeFinder.rangeFinder, _foldMarker, _renderLineFoldMarkers);
        }
    }
    
    function _registerHandlers(editor, fileType) {
        var cm = editor._codeMirror, doc = editor.document;
        if (cm) {
            //add new gutter to cm
            var gutters = cm.getOption("gutters").slice(0);
            if (gutters.indexOf("code-folding-gutter")  < 0) {
                //put fold marker to immediate right of line number
                var lineNumberGutterIndex = gutters.indexOf("CodeMirror-linenumbers");
                gutters.splice(lineNumberGutterIndex + 1, 0, "code-folding-gutter");
                cm.setOption("gutters", gutters);
            }
            _updateRangeFinder(editor);
            //add listeners if a rangeFinder was set
            if (_activeRangeFinder) {
                var vp = cm.getViewport();
                $(doc).on("change", _handleDocumentChange);
                cm.on("gutterClick", _handleGutterClick);
                $(editor).on("scroll", _handleScroll);
                _decorateGutters(editor, vp.from, vp.to);
            }
        }
    }
   
    function _deregisterHandlers(editor) {
        var cm = editor._codeMirror;
        $(editor.document).off("change", _handleDocumentChange);
        if (cm) {
            $(editor).off("scroll", _handleScroll);
            cm.off("gutterClick", _handleGutterClick);
            _removeGutter(cm);
        }
    }
    
    function _toggleExtension() {
        var editor = EditorManager.getActiveEditor();
        _extensionEnabled = !_extensionEnabled;
        CommandManager.get(CODE_FOLD_EXT).setChecked(_extensionEnabled);
        if (_extensionEnabled) {
            _registerHandlers(editor);
        } else {
            _deregisterHandlers(editor);
        }
    }
   
    function _saveFolds(event) {
        //save the state of open documents in the editor
        var editor = EditorManager.getActiveEditor();
        if (_extensionEnabled && editor) {
            _prefs.setValue(editor.document.file.fullPath, _lineFolds);
        }
    }

    function init() {
        $(EditorManager).on("activeEditorChange", function (event, current, previous) {
            if (_extensionEnabled) {
                lastViewportRange = undefined;
                _activeRangeFinder = undefined;
                if (previous) {
                    _deregisterHandlers(previous);
                    _prefs.setValue(previous.document.file.fullPath, _lineFolds);
                }
                if (current) {
                    _updateRangeFinder(current);
                    _lineFolds = _prefs.getValue(current.document.file.fullPath);
                    if (_lineFolds) {
                        _lineFolds.map(function (line, index) {
                            _foldLine(current._codeMirror, line);
                        });
                    } else {
                        _lineFolds = [];
                    }
                    _registerHandlers(current);
                }
            }
        });
        //save any other folds just before the project closes
        $(ProjectManager).on("beforeProjectClose", _saveFolds);
        $(ProjectManager).on("beforeAppClose", _saveFolds);
        //Load stylesheet
        ExtensionUtils.loadStyleSheet(module, "main.less");
        
        CommandManager.register("Enable Code Folding", CODE_FOLD_EXT, _toggleExtension);
        Menus.getMenu(Menus.AppMenuBar.VIEW_MENU).addMenuItem(CODE_FOLD_EXT);
        CommandManager.get(CODE_FOLD_EXT).setChecked(_extensionEnabled);
    }
    
    init();
});
