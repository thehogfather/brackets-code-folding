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
 * Code folding extension for brackets
 * @author Patrick Oladimeji
 * @date 10/24/13 9:35:26 AM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, d3, require, $, brackets, window, MouseEvent, CodeMirror */

require.config({
    paths: {
        "text" : "lib/text",
        "i18n" : "lib/i18n"
    },
    locale: brackets.getLocale()
});

define(function (require, exports, module) {
    "use strict";
    var CommandManager          = brackets.getModule("command/CommandManager"),
        DocumentManager         = brackets.getModule("document/DocumentManager"),
        EditorManager           = brackets.getModule("editor/EditorManager"),
        ProjectManager          = brackets.getModule("project/ProjectManager"),
        PreferencesManager      = brackets.getModule("preferences/PreferencesManager"),
        KeyBindingManager       = brackets.getModule("command/KeyBindingManager"),
        ExtensionUtils          = brackets.getModule("utils/ExtensionUtils"),
		Menus					= brackets.getModule("command/Menus"),
        _prefs                  = PreferencesManager.getPreferenceStorage(module),
        CODE_FOLD_EXT           = "javascript.code.folding",
        COLLAPSE_ALL            = "codefolding.collapse.all",
        COLLAPSE                = "codefolding.collapse",
        EXPAND                  = "codefolding.expand",
        EXPAND_ALL              = "codefolding.expand.all";

    ExtensionUtils.loadStyleSheet(module, "main.less");

    require("foldhelpers/foldcode")();
    require("foldhelpers/foldgutter")();
    var braceFold               = require("foldhelpers/brace-fold"),
        commentFold             = require("foldhelpers/comment-fold"),
        xmlFold                 = require("foldhelpers/xml-fold"),
        indentFold              = require("foldhelpers/indentFold"),
        latexFold               = require("foldhelpers/latex-fold");

    CodeMirror.registerHelper("fold", "brace", braceFold);
    CodeMirror.registerHelper("fold", "less", braceFold);
    CodeMirror.registerHelper("fold", "comment", commentFold);
    CodeMirror.registerHelper("fold", "xml", xmlFold);
    CodeMirror.registerHelper("fold", "indent", indentFold);
    CodeMirror.registerHelper("fold", "ruby", indentFold);
    CodeMirror.registerHelper("fold", "stex", latexFold);
    
	//gets the linefolds saved for the current document in the preference store
    function getLineFolds(path) {
        if (!_prefs.getValue(path)) { _prefs.setValue(path,  []); }
        return _prefs.getValue(path);
    }
	
    /** gets the folded regions in the editor.
	 * @returns a map containing {linenumber: {from, to}}
	 */
	function getLineFoldsInEditor(editor) {
		var cm = editor._codeMirror, i, folds = {};
		if (cm) {
			var marks = cm.getAllMarks();
			marks.filter(function (m) {return m.__isFold; })
				.forEach(function (mark) {
					var range = mark.find();
					if (range) {
						folds[range.from.line] = range;
					}
				});
		}
		return folds;
	}
	
	/**Restores the linefolds in the editor using values fetched from the preference store*/
    function restoreLineFolds(editor) {
        if (editor) {
            var cm = editor._codeMirror, foldFunc;
            if (!cm) {return; }
            var path = editor.document.file.fullPath, keys;
            var folds = getLineFolds(path), vp = cm.getViewport();
            if (folds && folds.hasOwnProperty("length")) {//Old extension preference store
                folds.forEach(function (line) {
                    cm.foldCode(line);
                });
            } else if (folds && (keys = Object.keys(folds)).length) {
                var i, range;
                keys.forEach(function (lineNumber) {
                    cm.foldCode(+lineNumber, null, "fold");
                });
            }
        }
    }
	
    /**Saves the line folds in the editor using the preference storage**/
    function saveLineFolds(editor) {
        if (!editor) { return; }
		var folds = getLineFoldsInEditor(editor);
		var path = editor.document.file.fullPath;
		if (Object.keys(folds).length) {
			_prefs.setValue(path, folds);
		} else {
			_prefs.remove(path);
		}
    }
    
    function onGutterClick(cm, line, gutter, event) {
        var opts = cm.state.foldGutter.options, pos = CodeMirror.Pos(line);
        if (gutter !== opts.gutter) { return; }
        var editor = EditorManager.getActiveEditor(), range, i;
        var _lineFolds = _prefs.getValue(editor.document.file.fullPath);
        if (cm.isFolded(line)) {
            if (event.altKey) {//unfold code including children
                range = _lineFolds[line];
                for (i = range.to.line; i >=  range.from.line; i--) {
                    if (cm.isFolded(i)) { cm.unfoldCode(i + 1); }
                }
            } else {
                cm.unfoldCode(line + 1);
            }
        } else {
            if (event.altKey) {
                var rf = cm.foldRangeFinder(pos);
                range = rf(cm, pos);
                if (range) {
                    for (i = range.to.line; i >=  range.from.line; i--) {
                        if (!cm.isFolded(i)) { cm.foldCode(i); }
                    }
                }
            } else {
                cm.foldCode(line);
            }
        }
    }
    /**
		Collapses the code region nearest the current cursor position. Nearest is found by searching from the current line and moving up the document until an
		opening code-folding region is found.
	 */
    function collapseCurrent() {
        var editor = EditorManager.getFocusedEditor();
        if (editor) {
            var cm = editor._codeMirror;
            var cursor = editor.getCursorPos(), i;
            //move cursor up until a collapsible line is found
            for (i = cursor.line; i >= 0; i--) {
                if (cm.foldCode(i)) {
                    editor.setCursorPos(i);
                    return;
                }
            }
        }
    }
	/**
		expands the code region at the current cursor position.
	*/
    function expandCurrent() {
        var editor = EditorManager.getFocusedEditor();
        if (editor) {
            var cursor = editor.getCursorPos(), cm = editor._codeMirror;
            cm.unfoldCode(cursor.line + 1);
        }
    }
    
    function collapseAll() {
        var editor = EditorManager.getFocusedEditor();
        if (editor && editor._codeMirror) {
            var i, cm = editor._codeMirror, range;
            var _lineFolds = _prefs.getValue(editor.document.file.fullPath);
            for (i = editor.getFirstVisibleLine(); i < editor.getLastVisibleLine(); i++) {
                if (!cm.isFolded(i)) {
                    range = cm.foldCode(i);
                    if (range) { i = range.to.line; }
                } else {
                    range = _lineFolds[i];
                    i = range.to.line;
                }
            }
        }
    }

    function expandAll() {
        var editor = EditorManager.getFocusedEditor();
        if (editor && editor._codeMirror) {
            var i, cm = editor._codeMirror;
            for (i = editor.getFirstVisibleLine(); i < editor.getLastVisibleLine(); i++) {
                if (cm.isFolded(i)) { cm.unfoldCode(i + 1); }
            }
        }
    }
	
	function registerHandlers(editor) {
		var cm = editor._codeMirror;
		if (cm) {
			var path = editor.document.file.fullPath, _lineFolds = _prefs.getValue(path);
            _lineFolds = _lineFolds || {};
            cm.setOption("gutters", ["CodeMirror-linenumbers", "CodeMirror-foldgutter"]);
            cm.setOption("foldGutter", {onGutterClick: onGutterClick});
            cm.on("fold", function (cm, from, to) {
                _lineFolds[from.line] = {from: from, to: to};
                _prefs.setValue(path, _lineFolds);
            });
            cm.on("unfold", function (cm, from, to) {
                delete _lineFolds[from.line];
                _prefs.setValue(path, _lineFolds);
            });
		}
	}
	
    function onActiveEditorChanged(event, current, previous) {
		if (current && current._codeMirror.getOption("gutters").indexOf("CodeMirror-foldgutter") === -1) {
			registerHandlers(current);
			restoreLineFolds(current);
		}
		if (previous) { saveLineFolds(previous); }
    }
	
    function saveBeforeClose() {
		saveLineFolds(EditorManager.getCurrentFullEditor());
	}
	
    $(EditorManager).on("activeEditorChange", onActiveEditorChanged);
    $(DocumentManager).on("documentRefreshed", function (event, doc) {
        //restore the folds for this document
        restoreLineFolds(doc._masterEditor);
    });
    
    $(ProjectManager).on("beforeProjectClose beforeAppClose", saveBeforeClose);
    
    var Strings = require("strings");
    
    CommandManager.register(Strings.CollapseAll, COLLAPSE_ALL, collapseAll);
    CommandManager.register(Strings.ExpandAll, EXPAND_ALL, expandAll);

    CommandManager.register(Strings.CollapseCurrent, COLLAPSE, collapseCurrent);
    CommandManager.register(Strings.ExpandCurrent, EXPAND, expandCurrent);
    
	Menus.getMenu(Menus.AppMenuBar.VIEW_MENU).addMenuDivider();
	Menus.getMenu(Menus.AppMenuBar.VIEW_MENU).addMenuItem(COLLAPSE);
	Menus.getMenu(Menus.AppMenuBar.VIEW_MENU).addMenuItem(EXPAND);
	Menus.getMenu(Menus.AppMenuBar.VIEW_MENU).addMenuItem(COLLAPSE_ALL);
	Menus.getMenu(Menus.AppMenuBar.VIEW_MENU).addMenuItem(EXPAND_ALL);

    KeyBindingManager.addBinding(COLLAPSE, "Alt-C");
    KeyBindingManager.addBinding(EXPAND, "Alt-E");
});