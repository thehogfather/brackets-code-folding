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
        KeyBindingManager       = brackets.getModule("command/KeyBindingManager"),
        Menus                   = brackets.getModule("command/Menus"),
        KeyEvent                = brackets.getModule("utils/KeyEvent"),
        ExtensionUtils          = brackets.getModule("utils/ExtensionUtils"),
        AppInit                 = brackets.getModule("utils/AppInit"),
        FileUtils               = brackets.getModule("file/FileUtils"),
        braceRangeFinder        = require("braceRangeFinder"),
        tagRangeFinder          = require("tagRangeFinder"),
        _prefs                  = PreferencesManager.getPreferenceStorage(module),
        CODE_FOLD_EXT           = "javascript.code.folding",
        COLLAPSE_ALL            = "codefolding.collapse.all",
        COLLAPSE                = "codefolding.collapse",
        EXPAND                  = "codefolding.expand",
        EXPAND_ALL              = "codefolding.expand.all",
        _extensionEnabled       = true,
        _expandedChar           = "\u25bc",
        _collapsedChar          = "\u25b6",
        _foldMarker             = "\u2194",
        _braceCollapsibleExtensions = [".js", ".css", ".less", ".json", ".php", ".scss"],
        _tagCollapsibleExtensions   = [".xml", ".html", ".xhtml", ".htm", ".tpl", ".tmpl"],
        scrollInterval,
        changeInterval,
        previousEditor,
        _lineFolds = {};

    var _commentOrString = /^(comment|string)/;
    CodeMirror.newFoldFunction  = require("cmFoldFunction");

    /**
     * file extension adapter to retain compatibility with earlier bracket sprints
     */
    function getFileExtension(fullPath) {
        if (FileUtils.getFileExtension) {
            return "." + FileUtils.getFileExtension(fullPath);
        } else {
            return FileUtils.getFilenameExtension(fullPath);
        }
    }

    function _isFolded(cm, line) {
        var marks = cm.findMarksAt(CodeMirror.Pos(line + 1, 0));
        return marks ? marks.some(function (m) {return m.__isFold; }) : false;
    }

    function getLineFolds(path) {
        if (!_prefs.getValue(path)) {
            _prefs.setValue(path, []);
        }
        return _prefs.getValue(path);
    }

    function _createMarker(mark, className) {
        var marker = document.createElement("div");
        marker.innerHTML = mark;
        marker.className = className;
        return marker;
    }

    function _createCollapsedMarker(lineNum) {
        return _createMarker(_collapsedChar, "codefolding-collapsed");
    }

    function _createExpandedMarker(lineNum) {
        return _createMarker(_expandedChar, "codefolding-expanded");
    }

    function getRangeFinder(doc) {
        //return the appropriate folding function based on the file that was opened
        var ext = getFileExtension(doc.file.fullPath);
        if (_braceCollapsibleExtensions.indexOf(ext) > -1) {
            return braceRangeFinder;
        } else if (_tagCollapsibleExtensions.indexOf(ext) > -1) {
            return tagRangeFinder;
        }
    }
    /**
     * Returns an array containing lines which are collapsible in the given range
        @param cm
        @param rangeFinder function for use to check if current line is foldable
        @param from start line
        @param to   end line
        @param searchFolds set to true if folded code regions should be searched for foldable lines
     */
    function _getCollapsibleLines(cm, rangeFinder, from, to, searchFolds) {
        var lines = [], i, f = function (m) {return m.__isFold; }, _focusedEd = EditorManager.getFocusedEditor(),
            _editorLineFolds = _focusedEd ? _lineFolds[_focusedEd.document.file.fullPath] : undefined;
        if (rangeFinder) {
            for (i = from; i <= to; i++) {
                //find out if the line is folded so no need to loop through
                var marks, skip = 0, j, foldRange, _foldSpec;
                //get the foldrange from cache if possible
                foldRange = _editorLineFolds && _editorLineFolds[i] && _editorLineFolds[i].collapsible !== undefined ? _editorLineFolds[i].range
                    : rangeFinder.canFold(cm, i);
                if (foldRange) {
                    _foldSpec = {num: i, collapsible: true, range: foldRange};
                    marks = cm.findMarksAt(CodeMirror.Pos(i + 1, 0)).filter(f);
                    //skip the folded region if we are not searching inside folded code [default] and we are on a folded line
                    if (!searchFolds && marks && marks.length > 0) {
                        i += (marks[0].lines.length - 1);
                    }
                } else {
                    _foldSpec = {num: i, collapsible: false};
                }
                
                lines.push(_foldSpec);
                _editorLineFolds[i] = _foldSpec;
            }
        }
        return lines;
    }

    function _renderLineFoldMarkers(cm, line) {
        var lineMark;
        if (_isFolded(cm, line)) {
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

    /**
     * Utility function to fold a line if it is not already folded
     */
    function _foldLine(cm, line, foldFunc, range) {
        if (!_isFolded(cm, line)) {
            foldFunc(cm, line, range);
        }
    }
    //expands a line if not already expanded
    function _expandLine(cm, line, foldFunc, range) {
        if (_isFolded(cm, line)) {
            foldFunc(cm, line, range);
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
        collapsibleLines.forEach(function (line, i) {
            if (line.collapsible) {
                _renderLineFoldMarkers(cm, line.num);
            } else {
                cm.setGutterMarker(line.num, "code-folding-gutter", document.createElement("div"));
            }
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
            lines.filter(function (line) {return line.collapsible; }).forEach(function (line) {
                _foldLine(editor._codeMirror, line.num, foldFunc, line.range);
                _renderLineFoldMarkers(editor._codeMirror, line.num);
            });
        }
    }

    function expandAll() {
        var editor = EditorManager.getFocusedEditor();
        if (editor && editor._codeMirror) {
            var rangeFinder = getRangeFinder(editor.document);
            var lines = _getCollapsibleLines(editor._codeMirror, rangeFinder, editor.getFirstVisibleLine(), editor.getLastVisibleLine());
            var foldFunc = CodeMirror.newFoldFunction(rangeFinder.rangeFinder, _foldMarker, _renderLineFoldMarkers);
            lines.filter(function (line) { return line.collapsible; }).forEach(function (line) {
                _expandLine(editor._codeMirror, line.num, foldFunc, line.range);
                _renderLineFoldMarkers(editor._codeMirror, line.num);
            });
        }
    }

    function _handleScroll(cm, from, to) {
        function doScroll() {
            _decorateGutters(cm, from, to);
        }

        clearInterval(scrollInterval);
        scrollInterval = setTimeout(function () {
            cm.operation(doScroll);
        }, 250);
    }

    function _handleGutterClick(cm, n, gutterId, event) {
        if (gutterId === "code-folding-gutter" && cm.lineInfo(n).gutterMarkers) {
            var rangeFinder = getRangeFinder(EditorManager.getActiveEditor().document);
            var _editorLineFolds = _lineFolds[EditorManager.getActiveEditor().document.file.fullPath];
            var vp = cm.getViewport();
            var foldFunc = CodeMirror.newFoldFunction(rangeFinder.rangeFinder, _foldMarker, _renderLineFoldMarkers);
            var range = _editorLineFolds && _editorLineFolds[n] ? _editorLineFolds[n].range : rangeFinder.canFold(cm, n);
            if (range) {
                var folded = _isFolded(cm, n);
                //if the alt key was pressed, collapse or expand all children of this range
                if (event.altKey) {
                    var childLines = _getCollapsibleLines(cm, rangeFinder, range.from.line, range.to.line, true);
                    childLines.filter(function (line) {return line.collapsible; })
                        .reverse()
                        .forEach(function (line) {
                            if (folded) {
                                _expandLine(cm, line.num, foldFunc, line.range);
                            } else {
                                _foldLine(cm, line.num, foldFunc, line.range);
                            }
                            _renderLineFoldMarkers(cm, line.num);
                        });
                } else {
                    foldFunc(cm, n, range);
                    _renderLineFoldMarkers(cm, n);
                }
            }
        }
    }

    function _handleDocumentChange(event, document, changeList) {
        var editor = EditorManager.getCurrentFullEditor(), cm = editor._codeMirror, i;
        if (cm) {
            clearInterval(changeInterval);
            changeInterval = setTimeout(function () {
                var vp = cm.getViewport();
                var i = vp.from;//invalidate the cached range in the viewport so that they are recalculated on next decoration
                for (i; i < vp.to; i++) {
                    _lineFolds[EditorManager.getFocusedEditor().document.file.fullPath][i] = {};
                }
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
        cm.off("viewportChange", _handleScroll);
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
            cm.on("viewportChange", _handleScroll);
            //hack to reduce performance bottleneck when decorate gutter is called for the first time on largish documents
            setTimeout(function () {
                var vp = cm.getViewport();
                if (editor.getLastVisibleLine() - editor.getFirstVisibleLine() < 100) {
                    _decorateGutters(cm, Math.max(vp.from, editor.getFirstVisibleLine()),
                        Math.min(vp.to, editor.getLastVisibleLine()), editor);
                }
            }, 250);
        }
    }

    function restoreLineFolds(editor) {
        var cm = editor._codeMirror, rangeFinder, foldFunc;
        var _lineFolds = getLineFolds(editor.document.file.fullPath);
        if (_lineFolds && _lineFolds.length) {
            if (cm) {
                rangeFinder = getRangeFinder(editor.document);
                foldFunc = CodeMirror.newFoldFunction(rangeFinder.rangeFinder, _foldMarker, _renderLineFoldMarkers);
                _lineFolds.map(function (line, index) {
                    _foldLine(cm, line, foldFunc);
                });
            }
        }
    }

    function saveLineFolds(editor) {
        var folds = [], i = 0;//remember to save the fold ranges
        for (i = 0; i < editor.lineCount(); i++) {
            if (_isFolded(editor._codeMirror, i)) {
                folds.push(i);
            }
        }
        _prefs.setValue(editor.document.file.fullPath, folds);
    }

    function _handleActiveEditorChange(event, current, previous) {
        if (_extensionEnabled) {
            if (current) {
                _lineFolds[current.document.file.fullPath] = _lineFolds[current.document.file.fullPath] || {};
                //no need to restore folds for editors that  have already been opened
                if (current._codeMirror && current._codeMirror.getOption("gutters").indexOf("code-folding-gutter") < 0) {
                    restoreLineFolds(current);
                }
              
                _registerHandlers(current);
                //update the context menu to only allow foldall and collapseall in css or less files
                Menus.getContextMenu(Menus.ContextMenuIds.EDITOR_MENU).removeMenuItem(COLLAPSE_ALL);
                Menus.getContextMenu(Menus.ContextMenuIds.EDITOR_MENU).removeMenuItem(EXPAND_ALL);
                var ext = getFileExtension(current.document.file.fullPath);
                if ([".css", ".less", ".scss"].indexOf(ext) > -1) {
                    Menus.getContextMenu(Menus.ContextMenuIds.EDITOR_MENU).addMenuItem(COLLAPSE_ALL);
                    Menus.getContextMenu(Menus.ContextMenuIds.EDITOR_MENU).addMenuItem(EXPAND_ALL);
                }
            }

            if (previous) {
                saveLineFolds(previous);
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

    function collapseCurrent() {
        console.log("collapse current");
        var editor = EditorManager.getFocusedEditor(), _editorLineFolds = editor && editor.document ? _lineFolds[editor.document.file.fullPath] : undefined;
        if (editor) {
            var cursor = editor.getCursorPos(), i, rangeFinder = getRangeFinder(editor.document),
                cm = editor._codeMirror, range;
            var foldFunc = CodeMirror.newFoldFunction(rangeFinder.rangeFinder, _foldMarker, _renderLineFoldMarkers);
            if (rangeFinder) {
                //move cursor up until a collapsible line is found
                for (i = cursor.line; i > 0; i--) {
                    range = _editorLineFolds && _editorLineFolds[i].collapsible !== undefined ? _editorLineFolds[i].range : rangeFinder.canFold(cm, i);
                    if (range) {
                        _foldLine(cm, i, foldFunc, range);
                        _renderLineFoldMarkers(editor._codeMirror, i);
                        editor.setCursorPos(i);
                        return;
                    }
                }
            }

        }
    }

    function expandCurrent() {
        console.log("expand current");
        var editor = EditorManager.getFocusedEditor();
        if (editor) {
            var cursor = editor.getCursorPos(), cm = editor._codeMirror, rangeFinder = getRangeFinder(editor.document);
            var foldFunc = CodeMirror.newFoldFunction(rangeFinder.rangeFinder, _foldMarker, _renderLineFoldMarkers);
            console.log(cursor);
            _expandLine(cm, cursor.line, foldFunc);
        }
    }

    function init() {
        $(DocumentManager).on("currentDocumentChange", function () {
            var current = EditorManager.getCurrentFullEditor();
            if (_extensionEnabled) {
                if (previousEditor) {
                    _deregisterHandlers(previousEditor);
                }
                previousEditor = current;
            } else {
                //remove gutters if there are any stales
                _removeGutter(current._codeMirror);
            }
        });

        function _doSave() {
            var editor = EditorManager.getCurrentFullEditor();
            if (editor) {
                saveLineFolds(editor);
            }
        }

        $(EditorManager).on("activeEditorChange", _handleActiveEditorChange);
        $(ProjectManager).on("beforeProjectClose", _doSave);
        $(ProjectManager).on("beforeAppClose", _doSave);

        //Load stylesheet
        ExtensionUtils.loadStyleSheet(module, "main.less");

        CommandManager.register("Enable Code Folding", CODE_FOLD_EXT, _toggleExtension);
        Menus.getMenu(Menus.AppMenuBar.VIEW_MENU).addMenuItem(CODE_FOLD_EXT);
        CommandManager.get(CODE_FOLD_EXT).setChecked(_extensionEnabled);

        CommandManager.register("Collapse All", COLLAPSE_ALL, collapseAll);
        CommandManager.register("Expand All", EXPAND_ALL, expandAll);

        CommandManager.register("Collapse Current", COLLAPSE, collapseCurrent);
        CommandManager.register("Expand Current", EXPAND, expandCurrent);

        KeyBindingManager.addBinding(COLLAPSE, "Ctrl-Alt--");
        KeyBindingManager.addBinding(EXPAND, "Ctrl-Alt-=");
        KeyBindingManager.addBinding(EXPAND, "Ctrl-Alt-+");
        KeyBindingManager.addBinding(COLLAPSE_ALL, "Alt-1");
        KeyBindingManager.addBinding(EXPAND_ALL, "Shift-Alt-1");
    }

    init();
});
