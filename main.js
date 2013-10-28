/**
 * 
 * @author Patrick Oladimeji
 * @date 10/24/13 9:35:26 AM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, d3, require, $, brackets, window, MouseEvent, CodeMirror */
define(function (require, exports, module) {
    "use strict";
    var CommandManager          = brackets.getModule("command/CommandManager"),
        DocumentManager         = brackets.getModule("document/DocumentManager"),
        EditorManager           = brackets.getModule("editor/EditorManager"),
        ProjectManager          = brackets.getModule("project/ProjectManager"),
        PreferencesManager      = brackets.getModule("preferences/PreferencesManager"),
        KeyBindingManager       = brackets.getModule("command/KeyBindingManager"),
        ExtensionUtils          = brackets.getModule("utils/ExtensionUtils"),
        _prefs                  = PreferencesManager.getPreferenceStorage(module),
        CODE_FOLD_EXT           = "javascript.code.folding",
        COLLAPSE_ALL            = "codefolding.collapse.all",
        COLLAPSE                = "codefolding.collapse",
        EXPAND                  = "codefolding.expand",
        EXPAND_ALL              = "codefolding.expand.all",
       _lineFolds = {};
    
    ExtensionUtils.loadStyleSheet(module, "main.less");
    ///load cm folding code
    require("foldhelpers/foldcode")();
    require("foldhelpers/foldgutter")();
    var braceFold = require("foldhelpers/brace-fold"),
        commentFold = require("foldhelpers/comment-fold"),
        xmlFold =   require("foldhelpers/xml-fold"),
        indentFold = require("foldhelpers/indent-fold");

    CodeMirror.registerHelper("fold", "brace", braceFold);
    CodeMirror.registerHelper("fold", "comment", commentFold);
    CodeMirror.registerHelper("fold", "xml", xmlFold);
    CodeMirror.registerHelper("fold", "indent", indentFold);
    
     /**
     * Utility function to fold a line if it is not already folded
     */
    function _foldLine(cm, line) {
        if (!cm.isFolded(line)) { cm.foldCode(line); }
    }
    //expands a line if not already expanded
    function _expandLine(cm, line) {
        if (cm.isFolded(line)) { cm.unfoldCode(line); }
    }
    
    function getLineFolds(path) {
        if (!_prefs.getValue(path)) { _prefs.setValue(path, []); }
        return _prefs.getValue(path);
    }
    
    function restoreLineFolds(editor) {
        var cm = editor._codeMirror, rangeFinder, foldFunc;
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
                cm.foldCode(+lineNumber, {range: folds[lineNumber]});
            });
        }
    }
    
    function saveLineFolds(editor) {
        if (!editor) { return; }
        var path = editor.document.file.fullPath;
        var cm = editor._codeMirror;
        if (cm && _lineFolds[path]) {
            _prefs.setValue(path, _lineFolds[path]);
        }
    }
    
    function onGutterClick(cm, line, gutter, event) {
        var opts = cm.state.foldGutter.options;
        if (gutter !== opts.gutter) { return; }
        var editor = EditorManager.getActiveEditor(), range, i;
        if (cm.isFolded(line)) {
            if (event.altKey) {//unfold code including children
                range = _lineFolds[editor.document.file.fullPath][line];
                for (i = range.to.line; i >=  range.from.line; i--) {
                    if (cm.isFolded(i)) { cm.unfoldCode(i + 1); }
                }
            } else {
                cm.unfoldCode(line + 1);
            }
        } else {
            if (event.altKey) {
                range = _lineFolds[editor.document.file.fullPath][line] || opts.rangeFinder(cm, CodeMirror.Pos(line));
                if (range) {
                    for (i = range.to.line; i >=  range.from.line; i--) {
                        cm.foldCode(i, opts);
                    }
                }
            } else {
                cm.foldCode(line, opts);
            }
        }
    }
    
    function collapseCurrent() {
        var editor = EditorManager.getFocusedEditor(), _editorLineFolds = editor && editor.document ? _lineFolds[editor.document.file.fullPath] : undefined;
        if (editor) {
            var cm = editor._codeMirror, opts = cm.state.foldGutter.options;
            var cursor = editor.getCursorPos(), i;
            if (opts.rangeFinder) {
                //move cursor up until a collapsible line is found
                for (i = cursor.line; i >= 0; i--) {
                    opts.range = _editorLineFolds && _editorLineFolds[i] ? _editorLineFolds[i] : opts.rangeFinder(cm, CodeMirror.Pos(i));
                    if (opts.range) {
                        cm.foldCode(i, opts);
                        editor.setCursorPos(i);
                        return;
                    }
                }
            }
        }
    }

    function expandCurrent() {
        var editor = EditorManager.getFocusedEditor();
        if (editor) {
            var cursor = editor.getCursorPos(), cm = editor._codeMirror, opts = cm.state.foldGutter.options;
            cm.unfoldCode(cursor.line + 1, opts);
        }
    }
    
    function collapseAll() {
        var editor = EditorManager.getFocusedEditor();
        if (editor && editor._codeMirror) {
            var i, cm = editor._codeMirror, opts = cm.state.foldGutter.options, range;
            for (i = editor.getFirstVisibleLine(); i < editor.getLastVisibleLine(); i++) {
                if (!cm.isFolded(i)) {
                    range = cm.foldCode(i, opts);
                    if (range) {
                        i = range.to.line;
                    }
                } else {
                    range = _lineFolds[editor.document.file.fullPath][i];
                    i = range.to.line;
                }
               
            }
        }
    }

    function expandAll() {
        var editor = EditorManager.getFocusedEditor();
        if (editor && editor._codeMirror) {
            var i, cm = editor._codeMirror, opts = cm.state.foldGutter.options;
            for (i = editor.getFirstVisibleLine(); i < editor.getLastVisibleLine(); i++) {
                if (cm.isFolded(i)) { cm.unfoldCode(i + 1, opts); }
            }
        }
    }
    
    function onActiveEditorChanged(event, current, previous) {
        if (current && current._codeMirror.getOption("gutters").indexOf("CodeMirror-foldgutter") === -1) {
            var cm = current._codeMirror, path = current.document.file.fullPath;
            _lineFolds[path] = _lineFolds[path] || {};
            cm.setOption("gutters", ["CodeMirror-linenumbers", "CodeMirror-foldgutter"]);
            cm.setOption("foldGutter", {
                rangeFinder: new CodeMirror.fold.combine(CodeMirror.fold.brace, CodeMirror.fold.comment, CodeMirror.fold.xml),
                onGutterClick: onGutterClick
            });
            cm.on("fold", function (cm, from, to) {
                _lineFolds[path][from.line] = {from: from, to: to};
            });
            cm.on("unfold", function (cm, from, to) {
                delete _lineFolds[path][from.line];
            });
            
            restoreLineFolds(current);
        }
        
        if (previous) {
            saveLineFolds(previous);
        }
    }
    
    $(EditorManager).on("activeEditorChange", onActiveEditorChanged);
    
    $(ProjectManager).on("beforeProjectClose", function () {
        saveLineFolds(EditorManager.getCurrentFullEditor());
    });
    $(ProjectManager).on("beforeAppClose", function () {
        saveLineFolds(EditorManager.getCurrentFullEditor());
    });
    
    CommandManager.register("Collapse All", COLLAPSE_ALL, collapseAll);
    CommandManager.register("Expand All", EXPAND_ALL, expandAll);

    CommandManager.register("Collapse Current", COLLAPSE, collapseCurrent);
    CommandManager.register("Expand Current", EXPAND, expandCurrent);

    KeyBindingManager.addBinding(COLLAPSE, "Ctrl-Alt--");
    KeyBindingManager.addBinding(EXPAND, "Ctrl-Alt-=");
    KeyBindingManager.addBinding(EXPAND, "Ctrl-Alt-+");
    KeyBindingManager.addBinding(COLLAPSE_ALL, "Alt-1");
    KeyBindingManager.addBinding(EXPAND_ALL, "Shift-Alt-1");
});