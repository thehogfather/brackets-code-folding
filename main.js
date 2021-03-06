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
/*global define, require, $, brackets*/

require.config({
    paths: {
        "text" : "lib/text",
        "i18n" : "lib/i18n"
    },
    locale: brackets.getLocale()
});

define(function (require, exports, module) {
    "use strict";
    var CodeMirror              = brackets.getModule("thirdparty/CodeMirror2/lib/codemirror"),
        Strings                 = require("strings"),
        AppInit                 = brackets.getModule("utils/AppInit"),
        CommandManager          = brackets.getModule("command/CommandManager"),
        DocumentManager         = brackets.getModule("document/DocumentManager"),
        EditorManager           = brackets.getModule("editor/EditorManager"),
        ProjectManager          = brackets.getModule("project/ProjectManager"),
        KeyBindingManager       = brackets.getModule("command/KeyBindingManager"),
        ExtensionUtils          = brackets.getModule("utils/ExtensionUtils"),
        Menus					= brackets.getModule("command/Menus"),
        prefs                   = require("./Prefs"),
        COLLAPSE_ALL            = "codefolding.collapse.all",
        COLLAPSE                = "codefolding.collapse",
        EXPAND                  = "codefolding.expand",
        EXPAND_ALL              = "codefolding.expand.all",
        GUTTER_NAME             = "CodeMirror-foldgutter",
        COLLAPSE_CUSTOM_REGIONS = "codefolding.collapse.customregions",
        CODE_FOLDING_SETTINGS	= "codefolding.settings",
        SettingsDialog          = require("SettingsDialog"),
        collapseKey             = "Ctrl-Alt-[",
        expandKey               = "Ctrl-Alt-]",
        collapseAllKey          = "Alt-1",
        expandAllKey            = "Shift-Alt-1";


    //load code mirror addons
    brackets.getModule(["thirdparty/CodeMirror2/addon/fold/brace-fold"]);
    brackets.getModule(["thirdparty/CodeMirror2/addon/fold/comment-fold"]);
    brackets.getModule(["thirdparty/CodeMirror2/addon/fold/markdown-fold"]);

    //still using slightly modified versions of the foldcode.js and foldgutter.js since we
    //need to modify the gutter click handler to take care of some collapse and expand features
    //e.g. collapsing all children when 'alt' key is pressed
    var foldGutter              = require("foldhelpers/foldgutter"),
        foldCode                = require("foldhelpers/foldcode");

    var indentFold              = require("foldhelpers/indentFold"),
        regionFold              = require("foldhelpers/region-fold");

    /**
        Restores the linefolds in the editor using values fetched from the preference store
        Checks the document to ensure that changes have not been made (e.g., in a different editor)
        to invalidate the saved line folds.
        @param {Editor} editor  the editor whose saved line folds should be restored
        */
    function restoreLineFolds(editor) {
        var saveFolds = prefs.getSetting("saveFoldStates");
        if (!editor || !saveFolds) {
            return;
        }
        var cm = editor._codeMirror;
        var path = editor.document.file.fullPath;
        var folds = cm._lineFolds || prefs.getFolds(path);
        cm._lineFolds = cm.getValidFolds(folds);
        prefs.setFolds(path, cm._lineFolds);
        Object.keys(cm._lineFolds).forEach(function (line) {
            cm.foldCode(Number(line));
        });
    }

    /**
      * Saves the line folds in the editor using the preference storage
      * @param {Editor} editor the editor whose line folds should be saved
      */
    function saveLineFolds(editor) {
        var saveFolds = prefs.getSetting("saveFoldStates");
        if (!editor || !saveFolds) {
            return;
        }
        var folds = editor._codeMirror._lineFolds || {};
        var path = editor.document.file.fullPath;
        if (Object.keys(folds).length) {
            prefs.setFolds(path, folds);
        } else {
            prefs.setFolds(path, undefined);
        }
    }

    /**
      * Event handler for gutter click. Manages folding and unfolding code regions. If the Alt key
      * is pressed while clicking the fold gutter, child code fragments are also folded/unfolded
      * up to a level defined in the `maxFoldLevel' preference.
      * @param {!CodeMirror} cm the CodeMirror object
      * @param {number} line the line number for the clicked gutter
      * @param {string} gutter the name of the gutter element clicked
      * @param {!KeyboardEvent} event the underlying dom event triggered for the gutter click
      */
    function onGutterClick(cm, line, gutter, event) {
        var opts = cm.state.foldGutter.options, pos = CodeMirror.Pos(line);
        if (gutter !== opts.gutter) { return; }
        var range;
        var _lineFolds = cm._lineFolds;
        if (cm.isFolded(line)) {
            if (event.altKey) { // unfold code including children
                range = _lineFolds[line];
                CodeMirror.commands.unfoldAll(cm, range.from.line, range.to.line);
            } else {
                cm.unfoldCode(line, {range: _lineFolds[line]});
            }
        } else {
            if (event.altKey) {
                range = CodeMirror.fold.auto(cm, pos);
                if (range) {
                    CodeMirror.commands.foldToLevel(cm, range.from.line, range.to.line);
                }
            } else {
                cm.foldCode(line);
            }
        }
    }

    /**
        Collapses all custom regions defined in the current editor
    */
    function collapseCustomRegions() {
        var editor = EditorManager.getFocusedEditor();
        if (editor) {
            var cm = editor._codeMirror, i = cm.firstLine();
            while (i < cm.lastLine()) {
                var range = cm.foldCode(i, {rangeFinder: regionFold});
                if (range) {
                    i = range.to.line;
                } else {
                    i++;
                }
            }
        }
    }

     /**
      * Collapses the code region nearest the current cursor position.
      * Nearest is found by searching from the current line and moving up the document until an
      * opening code-folding region is found.
      */
    function collapseCurrent() {
        var editor = EditorManager.getFocusedEditor();
        if (!editor) {
            return;
        }
        var cm = editor._codeMirror;
        var cursor = editor.getCursorPos(), i;
        // Move cursor up until a collapsible line is found
        for (i = cursor.line; i >= 0; i--) {
            if (cm.foldCode(i)) {
                editor.setCursorPos(i);
                return;
            }
        }
    }

    /**
      * Expands the code region at the current cursor position.
      */
    function expandCurrent() {
        var editor = EditorManager.getFocusedEditor();
        if (editor) {
            var cursor = editor.getCursorPos(), cm = editor._codeMirror;
            cm.unfoldCode(cursor.line);
        }
    }

    /**
        Collapses all foldable regions in the current document. Folding is done up to a level 'n'
        which is defined in the preferences. Levels refer to fold heirarchies e.g., for the following
        code fragment, the function is level 1, the if statement is level 2 and the forEach is level 3

            function sample() {
                if (debug) {
                    logMessages.forEach(function (m) {
                        console.debug(m);
                    });
                }
            }
    */
    function collapseAll() {
        var editor = EditorManager.getFocusedEditor();
        if (editor) {
            var cm = editor._codeMirror;
            CodeMirror.commands.foldToLevel(cm);
        }
    }

    /**
        Expands all folded regions in the current document
    */
    function expandAll() {
        var editor = EditorManager.getFocusedEditor();
        if (editor) {
            var cm = editor._codeMirror;
            CodeMirror.commands.unfoldAll(cm);
        }
    }

    /**
      * Initialises and creates the code-folding gutter.
      * @param {Editor} editor the editor on which to initialise the fold gutter
      */
    function createGutter(editor) {
        var cm = editor._codeMirror;
        var path = editor.document.file.fullPath, _lineFolds = prefs.getFolds(path);
        _lineFolds = _lineFolds || {};
        cm._lineFolds = _lineFolds;
        var gutters = cm.getOption("gutters").slice(0);

        // Reuse any existing fold gutter
        if (gutters.indexOf(GUTTER_NAME) < 0) {
            var lnIndex = gutters.indexOf("CodeMirror-linenumbers");
            $(editor.getRootElement()).addClass("folding-enabled");
            gutters.splice(lnIndex + 1, 0, GUTTER_NAME);
            cm.setOption("gutters",  gutters);
            cm.refresh();  // force recomputing gutter width - .folding-enabled class affects linenumbers gutter which has existing cached width
        }
        cm.setOption("foldGutter", {onGutterClick: onGutterClick});

        $(cm.getGutterElement()).on({
            mouseenter: function () {
                if (prefs.getSetting("hideUntilMouseover")) {
                    foldGutter.updateInViewport(cm);
                } else {
                    $(editor.getRootElement()).addClass("over-gutter");
                }
            },
            mouseleave: function () {
                if (prefs.getSetting("hideUntilMouseover")) {
                    foldGutter.clearGutter(cm);
                } else {
                    $(editor.getRootElement()).removeClass("over-gutter");
                }
            }
        });
    }

    /** Add gutter and restore saved expand/collapse state */
    function enableFoldingInEditor(editor) {
        if (editor._codeMirror.getOption("gutters").indexOf(GUTTER_NAME) === -1) {
            createGutter(editor);
            restoreLineFolds(editor);
        }
    }

     /**
      * When a brand new editor is seen, initialise fold-gutter and restore line folds in it. Save line folds in
      * departing editor in case it's getting closed.
      * @param {object} event the event object
      * @param {Editor} current the current editor
      * @param {Editor} previous the previous editor
      */
    function onActiveEditorChanged(event, current, previous) {
        if (current) {
            enableFoldingInEditor(current);
        }
        if (previous) {
            saveLineFolds(previous);
        }
    }

    /**
      * Saves the line folds in the current full editor before it is closed.
      */
    function saveBeforeClose() {
        // We've already saved all other open editors when they go active->inactive
        saveLineFolds(EditorManager.getActiveEditor());
    }


    function showSettingsDialog() {
        SettingsDialog.show(function () {
            var editor = EditorManager.getCurrentFullEditor();
            if (editor) {
                var cm = editor._codeMirror;
                if (prefs.getSetting("hideUntilMouseover")) {
                    foldGutter.clearGutter(cm);
                } else {
                    foldGutter.updateInViewport(cm);
                }
            }
        });
    }

    /**
        Initialise the extension
    */
    function init() {
        ExtensionUtils.loadStyleSheet(module, "main.less");
        foldCode.init();
        foldGutter.init();
        //register a global fold helper based on indentation folds
        CodeMirror.registerGlobalHelper("fold", "indent", function (mode, cm) {
            return prefs.getSetting("alwaysUseIndentFold");
        }, indentFold);

        CodeMirror.registerGlobalHelper("fold", "region", function (mode, cm) {
            return prefs.getSetting("enableRegionFolding");
        }, regionFold);

        CodeMirror.registerHelper("fold", "django", CodeMirror.helpers.fold.brace);
        CodeMirror.registerHelper("fold", "tornado", CodeMirror.helpers.fold.brace);

        $(EditorManager).on("activeEditorChange.BracketsCodeFolding", onActiveEditorChanged);
        $(DocumentManager).on("documentRefreshed.BracketsCodeFolding", function (event, doc) {
            if (prefs.getSetting("enabled")) {
                restoreLineFolds(doc._masterEditor);
            }
        });

        $(ProjectManager).on("beforeProjectClose.BracketsCodeFolding beforeAppClose.BracketsCodeFolding", saveBeforeClose);

        Menus.getMenu(Menus.AppMenuBar.VIEW_MENU).addMenuDivider();
        Menus.getMenu(Menus.AppMenuBar.VIEW_MENU).addMenuItem(CODE_FOLDING_SETTINGS);
        Menus.getMenu(Menus.AppMenuBar.VIEW_MENU).addMenuItem(COLLAPSE);
        Menus.getMenu(Menus.AppMenuBar.VIEW_MENU).addMenuItem(EXPAND);
        Menus.getMenu(Menus.AppMenuBar.VIEW_MENU).addMenuItem(COLLAPSE_ALL);
        Menus.getMenu(Menus.AppMenuBar.VIEW_MENU).addMenuItem(EXPAND_ALL);
        Menus.getMenu(Menus.AppMenuBar.VIEW_MENU).addMenuItem(COLLAPSE_CUSTOM_REGIONS);

        KeyBindingManager.addBinding(COLLAPSE, collapseKey);
        KeyBindingManager.addBinding(EXPAND, expandKey);
        KeyBindingManager.addBinding(COLLAPSE_ALL, collapseAllKey);
        KeyBindingManager.addBinding(EXPAND_ALL, expandAllKey);

        ///put region fold on top of the globals list so that it has priority over comments folds
        var finder = CodeMirror.fold._global.pop();
        if (finder) {
            CodeMirror.fold._global.unshift(finder);
        }

        var editor = EditorManager.getCurrentFullEditor();
        if (editor) {
            enableFoldingInEditor(editor);
            var cm = editor._codeMirror;
            if (prefs.getSetting("hideUntilMouseover")) {
                foldGutter.clearGutter(cm);
            } else {
                foldGutter.updateInViewport(cm);
            }
        }
    }

    AppInit.htmlReady(function () {
        CommandManager.register(Strings.CODE_FOLDING_SETTINGS + "...", CODE_FOLDING_SETTINGS, showSettingsDialog);
        CommandManager.register(Strings.COLLAPSE_ALL, COLLAPSE_ALL, collapseAll);
        CommandManager.register(Strings.EXPAND_ALL, EXPAND_ALL, expandAll);
        CommandManager.register(Strings.COLLAPSE_CUSTOM_REGIONS, COLLAPSE_CUSTOM_REGIONS, collapseCustomRegions);
        CommandManager.register(Strings.COLLAPSE_CURRENT, COLLAPSE, collapseCurrent);
        CommandManager.register(Strings.EXPAND_CURRENT, EXPAND, expandCurrent);
        if (prefs.getSetting("enabled") && !CodeMirror.fold.combine) {
            init();
        } else if (!prefs.getSetting("enabled")) {
            Menus.getMenu(Menus.AppMenuBar.VIEW_MENU).addMenuDivider();
            Menus.getMenu(Menus.AppMenuBar.VIEW_MENU).addMenuItem(CODE_FOLDING_SETTINGS);
        }
    });
});
