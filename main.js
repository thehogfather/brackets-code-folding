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
 * Custom region code folding extension for brackets
 * @author Patrick Oladimeji
 * @date 10/24/13 9:35:26 AM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, require, brackets*/

require.config({
    paths: {
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
        EditorManager           = brackets.getModule("editor/EditorManager"),
        Menus					= brackets.getModule("command/Menus"),
        COLLAPSE_CUSTOM_REGIONS = "codefolding.collapse.customregions";

    var regionFold              = require("foldhelpers/region-fold");


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
        Initialise the extension
    */
    function init() {
        CodeMirror.registerGlobalHelper("fold", "region", function (mode, cm) {
            return true;
        }, regionFold);
        /**
         * The following is a hack to prioritise region fold over other range finders
         */
        var finder = CodeMirror.fold._global.pop();
        if (finder) {
            CodeMirror.fold._global.unshift(finder);
        }

        CommandManager.register(Strings.COLLAPSE_CUSTOM_REGIONS, COLLAPSE_CUSTOM_REGIONS, collapseCustomRegions);
        Menus.getMenu(Menus.AppMenuBar.VIEW_MENU).addMenuItem(COLLAPSE_CUSTOM_REGIONS);
    }

    AppInit.appReady(init);
});
