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
        scrollInterval,
        changeInterval,
        previousEditor;
    
    var _commentOrString = /^(comment|string)/;
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
    
    function _extension(doc) {
        return doc ? doc.file.fullPath.slice(doc.file.fullPath.lastIndexOf(".")).toLowerCase() : "";
    }
    
    function getRangeFinder(doc) {
        //return the appropriate folding function based on the file that was opened
        var ext = _extension(doc);
        if (_braceCollapsibleExtensions.indexOf(ext) > -1) {
            return braceRangeFinder;
        } else if (_tagCollapsibleExtensions.indexOf(ext) > -1) {
            return tagRangeFinder;
        }
    }
    
    function _getCollapsibleLines(cm, rangeFinder, from, to) {
        var lines = [], i, f = function (m) {return m.__isFold; };
        for (i = from; i <= to; i++) {
            //find out if the line is folded so no need to loop through
            var marks, skip = 0, j, foldRange;
            marks = cm.findMarksAt(CodeMirror.Pos(i + 1, 0)).filter(f);
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
            lineMark  = _createExpandedMarker(line + 1);
        }
        if (lineMark) {
            cm.setGutterMarker(line, "code-folding-gutter", lineMark);
        }
    }
    
    function _isFolded(cm, line) {
        var marks = cm.findMarksAt(CodeMirror.Pos(line + 1, 0));
        return marks ? marks.some(function (m) {return m.__isFold; }) : false;
    }
    /**
     * Utility function to fold a line if it is not already folded
     */
    function _foldLine(cm, line, foldFunc) {
        if (!_isFolded(cm, line)) {
            foldFunc(cm, line);
        }
    }
    //expands a line if not already expanded
    function _expandLine(cm, line, foldFunc) {
        if (_isFolded(cm, line)) {
            foldFunc(cm, line);
        }
    }
    
     /**
     * goes through the visible part of the document and decorates the line numbers with icons for
     * colapsing and expanding code sections
     */
    function _decorateGutters(cm, from, to, editor) {
        editor = editor || EditorManager.getCurrentFullEditor();
        var rangeFinder = getRangeFinder(editor.document);
        var i, collapsibleLines = _getCollapsibleLines(cm, rangeFinder, from, to);
        collapsibleLines.forEach(function (line) {
            _renderLineFoldMarkers(cm, line);
        });
        //draw inline fold marks if any        
        var inlineEds = EditorManager.getInlineEditors(editor);
        inlineEds.forEach(function (ed) {
            _decorateGutters(ed._codeMirror, ed.getFirstVisibleLine(), ed.getLastVisibleLine(), ed);
        });
    }
    
    function collapseAll() {
        var editor = EditorManager.getFocusedEditor();
        if (editor && editor._codeMirror) {
            var rangeFinder = getRangeFinder(editor.document);
            var lines = _getCollapsibleLines(editor._codeMirror, rangeFinder, editor.getFirstVisibleLine(), editor.getLastVisibleLine());
            var foldFunc = CodeMirror.newFoldFunction(rangeFinder.rangeFinder, _foldMarker, _renderLineFoldMarkers);
            lines.forEach(function (line) {
                _foldLine(editor._codeMirror, line, foldFunc);
                _renderLineFoldMarkers(editor._codeMirror, line);
            });
        }
    }
    
    function expandAll() {
        var editor = EditorManager.getFocusedEditor();
        if (editor && editor._codeMirror) {
            var rangeFinder = getRangeFinder(editor.document);
            var lines = _getCollapsibleLines(editor._codeMirror, rangeFinder, editor.getFirstVisibleLine(), editor.getLastVisibleLine());
            var foldFunc = CodeMirror.newFoldFunction(rangeFinder.rangeFinder, _foldMarker, _renderLineFoldMarkers);
            lines.forEach(function (line) {
                _expandLine(editor._codeMirror, line, foldFunc);
                _renderLineFoldMarkers(editor._codeMirror, line);
            });
        }
    }
    
    function _handleScroll(event, editor) {
        function doScroll() {
            var cm = editor._codeMirror;
            var vp = cm.getViewport();
            _decorateGutters(cm, vp.from, vp.to);
        }
        
        clearInterval(scrollInterval);
        scrollInterval = setTimeout(function () {
            editor._codeMirror.operation(doScroll);
        }, 250);
    }
    
    function _handleGutterClick(cm, n, gutterId) {
        if (gutterId === "code-folding-gutter" && cm.lineInfo(n).gutterMarkers) {
            var rangeFinder = getRangeFinder(EditorManager.getActiveEditor().document);
            var foldFunc = CodeMirror.newFoldFunction(rangeFinder.rangeFinder, _foldMarker, _renderLineFoldMarkers);
            var range = foldFunc(cm, n);
            if (range) {
                _decorateGutters(cm, range.from.line, range.to.line);
            }
        }
    }
    
    function _handleDocumentChange(event, document, changeList) {
        var editor = EditorManager.getCurrentFullEditor(), cm = editor._codeMirror, i;
        if (cm) {
            clearInterval(changeInterval);
            changeInterval = setTimeout(function () {
                _decorateGutters(cm, changeList.from.line, changeList.to.line);
            }, 250);
        }
    }

    /** remove the code-folding-gutter*/
    function _removeGutter(cm) {
        var gutters = cm.getOption("gutters").splice(0),
            codeFoldingGutterIndex = gutters.indexOf("code-folding-gutter");
        if (codeFoldingGutterIndex > -1) {
            gutters.splice(codeFoldingGutterIndex, 1);
            cm.setOption("gutters", gutters);
        }
    }

    function _deregisterHandlers(editor) {
        var cm = editor._codeMirror;
        $(editor).off("scroll", _handleScroll);
        if (cm) {
            cm.off("gutterClick", _handleGutterClick);
        }
    }
    
    function _registerHandlers(editor) {
        var cm = editor._codeMirror, doc = editor.document;
        if (cm) {
            _deregisterHandlers(editor);
            //add new gutter to cm
            var gutters = cm.getOption("gutters").slice(0);
            if (gutters.indexOf("code-folding-gutter")  < 0) {
                //put fold marker to immediate right of line number
                var lineNumberGutterIndex = gutters.indexOf("CodeMirror-linenumbers");
                gutters.splice(lineNumberGutterIndex + 1, 0, "code-folding-gutter");
                cm.setOption("gutters", gutters);
            }
            //add listeners if a rangeFinder was set
            $(doc).on("change", _handleDocumentChange);
            cm.on("gutterClick", _handleGutterClick);
            $(editor).on("scroll", _handleScroll);
            setTimeout(function () {
                var vp = cm.getViewport();
                _decorateGutters(cm, Math.max(vp.from, editor.getFirstVisibleLine()),
                                 Math.min(vp.to, editor.getLastVisibleLine()), editor);
            }, 250);
            //}
        }
    }
   
    function restoreLineFolds(editor) {
        var cm = editor._codeMirror, rangeFinder, foldFunc;
        _lineFolds = _prefs.getValue(editor.document.file.fullPath);
        if (_lineFolds && _lineFolds.length) {
            if (cm) {
                rangeFinder = getRangeFinder(editor.document);
                foldFunc = CodeMirror.newFoldFunction(rangeFinder.rangeFinder, _foldMarker, _renderLineFoldMarkers);
                _lineFolds.map(function (line, index) {
                    _foldLine(cm, line, foldFunc);
                });
            }
        } else {
            _lineFolds = [];
        }
    }
    
    function _handleActiveEditorChange(event, current, previous) {
        if (_extensionEnabled) {
            if (current) {
                restoreLineFolds(current);
                _registerHandlers(current);
                //update the context menu to only allow foldall and collapseall in css or less files
                Menus.getContextMenu(Menus.ContextMenuIds.EDITOR_MENU).removeMenuItem("code.collapse");
                Menus.getContextMenu(Menus.ContextMenuIds.EDITOR_MENU).removeMenuItem("code.expand");
                var ext = _extension(current.document);
                if ([".css", ".less"].indexOf(ext) > -1) {
                    Menus.getContextMenu(Menus.ContextMenuIds.EDITOR_MENU).addMenuItem("code.collapse");
                    Menus.getContextMenu(Menus.ContextMenuIds.EDITOR_MENU).addMenuItem("code.expand");
                }
            }
        }
    }
        
    function _toggleExtension() {
        var editor = EditorManager.getCurrentFullEditor();
        _extensionEnabled = !_extensionEnabled;
        CommandManager.get(CODE_FOLD_EXT).setChecked(_extensionEnabled);
        if (_extensionEnabled) {
            _registerHandlers(editor);
        } else {
            _deregisterHandlers(editor);
            _removeGutter(editor._codeMirror);
        }
    }
   
    function _saveFolds(event) {
        //save the state of open documents in the editor
        var editor = EditorManager.getCurrentFullEditor();
        if (_extensionEnabled && editor) {
            _prefs.setValue(editor.document.file.fullPath, _lineFolds);
        }
    }
    
    function init() {
        $(DocumentManager).on("currentDocumentChange", function () {
            var current = EditorManager.getCurrentFullEditor();
            if (_extensionEnabled) {
                if (previousEditor) {
                    _deregisterHandlers(previousEditor);
                    _prefs.setValue(previousEditor.document.file.fullPath, _lineFolds);
                }
                previousEditor = current;
            } else {
                //remove gutters if there are any stales
                _removeGutter(current._codeMirror);
            }
        });
        
        $(EditorManager).on("activeEditorChange", _handleActiveEditorChange);
        //save any other folds just before the project closes
        $(ProjectManager).on("beforeProjectClose", _saveFolds);
        $(ProjectManager).on("beforeAppClose", _saveFolds);
        //Load stylesheet
        ExtensionUtils.loadStyleSheet(module, "main.less");
        
        CommandManager.register("Enable Code Folding", CODE_FOLD_EXT, _toggleExtension);
        Menus.getMenu(Menus.AppMenuBar.VIEW_MENU).addMenuItem(CODE_FOLD_EXT);
        CommandManager.get(CODE_FOLD_EXT).setChecked(_extensionEnabled);
        
        CommandManager.register("Collapse all code", "code.collapse", collapseAll);
        CommandManager.register("Expand all code", "code.expand", expandAll);
    }
    
    init();
});
