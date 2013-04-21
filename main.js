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
 * main file for code folding in brackets based on Code mirror's code folding addon feature
 * @author Patrick Oladimeji
 * @date 4/14/13 17:19:25 PM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, document, require, $, brackets, window, MouseEvent, CodeMirror */

define(function (require, exports, module) {
    "use strict";
    var CommandManager          = brackets.getModule("command/CommandManager"),
        DocumentManager         = brackets.getModule("document/DocumentManager"),
        EditorManager            = brackets.getModule("editor/EditorManager"),
        Menus                   = brackets.getModule("command/Menus"),
        KeyEvent                = brackets.getModule("utils/KeyEvent"),
        ExtensionUtils          = brackets.getModule("utils/ExtensionUtils"),
        AppInit                 = brackets.getModule("utils/AppInit"),
        braceRangeFinder        = require("braceRangeFinder"),
        tagRangeFinder          = require("tagRangeFinder"),
        CODE_FOLD_EXT           = "javascript.code.folding",
        _extensionEnabled       = true,
        _expandedChar           = "\u25bc",
        _collapsedChar          = "\u25b6",
        _foldMarker             = "\u2194",
        _braceCollapsibleExtensions = [".js", ".css", ".less", ".json"],
        _tagCollapsibleExtensions   = [".xml", ".html", ".xhtml", ".htm"];
    
    var _activeRangeFinder, foldFunc, _commentOrString = /^(comment|string)/;
    
    function _createMarker(lineNum, mark, lineNumClassName, markClassName) {
        var marker = document.createElement("div"), iconSpan;
        var lineNumSpan = document.createElement("span");
        lineNumSpan.innerHTML = lineNum;
        marker.appendChild(lineNumSpan);
        if (mark) {
            iconSpan = document.createElement("span");
            iconSpan.className = markClassName;
            iconSpan.innerHTML = mark;
            marker.appendChild(iconSpan);
        }
        marker.className = lineNumClassName;
        return marker;
    }
    
    function _createCollapsedMarker(lineNum) {
        return _createMarker(lineNum, _collapsedChar, "CodeMirror-linenumber cm-thehogfather-codefolding",
                             "cm-thehogfather-codefolding-collapsed");
    }
    
    function _createExpandedMarker(lineNum) {
        return _createMarker(lineNum, _expandedChar, "CodeMirror-linenumber cm-thehogfather-codefolding",
                             "cm-thehogfather-codefolding-expanded");
    }
    
    function _getCollapsibleLines(cm, rangeFinder) {
        var viewport = cm.getViewport(), lines = [], i;
        for (i = viewport.from; i < viewport.to; i++) {
            //find out if the line is folded so no need to loop through
            var marks = cm.findMarksAt(CodeMirror.Pos(i + 1, 0)), skip = 0, j;
            for (j = 0; j < marks.length; j++) {
                if (marks[j].__isFold) {
                    skip = marks[j].lines.length;
                    break;
                }
            }
                
            var canFold = rangeFinder.canFold(cm, i);
            if (canFold) {
                lines.push(i);
                if (skip > 0) {
                    i += (skip - 1);
                }
            }
        }
        return lines;
    }
    
    function _toggleLineMarker(cm, line) {
        var marks = cm.findMarksAt(CodeMirror.Pos(line + 1, 0)), i, lineMark;
        if (marks.length > 0) {
            //if we find any fold marks on this line then create an expand marker
            for (i = 0; i < marks.length; i++) {
                if (marks[i].__isFold) {
                    lineMark =  _createCollapsedMarker(line + 1);
                    break;
                }
            }
        } else {
            //no marks on this line meaning it might not be collapsible or it is expanded
            //so only decorate it if it is already expanded
            var lInfo = cm.lineInfo(line);
            if (lInfo.gutterMarkers) {
                if (lInfo.gutterMarkers["CodeMirror-linenumbers"].textContent.indexOf(_collapsedChar) > -1) {
                    lineMark  = _createExpandedMarker(line + 1);
                }
            } else { //no gutter markers on this line
                lineMark  = _createExpandedMarker(line + 1);
            }
        }
        
        if (lineMark) {
            cm.setGutterMarker(line, "CodeMirror-linenumbers", lineMark);
        }
    }
    
     /**
     * goes through the visible part of the document and decorates the line numbers with icons for
     * colapsing and expanding code sections
     */
    function _decorateGutters(editor) {
        var cm = editor._codeMirror;
        var collapsibleLines = _getCollapsibleLines(cm, _activeRangeFinder);
        collapsibleLines.forEach(function (line) {
            _toggleLineMarker(cm, line);
        });
    }
    
     
    function _handleGutterClick(cm, n) {
        var editor = EditorManager.getCurrentFullEditor();
        foldFunc(cm, n);
        _decorateGutters(editor);
    }
    
    //define new fold function for code mirror
    //  Copyright (C) 2011 by Daniel Glazman <daniel@glazman.org>
    // released under the MIT license (../../LICENSE) like the rest of CodeMirror
    CodeMirror.newFoldFunction = function (rangeFinder, widget) {
        if (!widget) {
            widget = _foldMarker;
        }
        if (typeof widget === "string") {
            var text = document.createTextNode(widget);
            widget = document.createElement("span");
            widget.appendChild(text);
            widget.className = "CodeMirror-foldmarker";
        }
    
        return function (cm, pos) {
            if (typeof pos === "number") {
                pos = CodeMirror.Pos(pos, 0);
            }
            var range = rangeFinder(cm, pos);
            if (!range) {
                return;
            }
    
            var present = cm.findMarksAt(range.from), cleared = 0, i;
            for (i = 0; i < present.length; ++i) {
                if (present[i].__isFold) {
                    ++cleared;
                    present[i].clear();
                }
            }
            if (cleared) {
                return;
            }
            var myWidget = widget.cloneNode(true);
            var myRange = cm.markText(range.from, range.to, {
                replacedWith: myWidget,
                clearOnEnter: true,
                __isFold: true
            });
            CodeMirror.on(widget, "mousedown", function () {
                console.log(myRange);
                myRange.clear();
            });
            CodeMirror.on(myRange, "clear", function () {
                _toggleLineMarker(cm, pos.line);
            });
        };
    };
    
    function _handleScroll(event, editor) {
        _decorateGutters(editor);
    }
    
    function _handleDocumentChange(event, document, changeList) {
        var editor = document._masterEditor;
        if (editor) {
            _decorateGutters(editor);
        }
    }
    
    function _undecorateGutters(cm) {
        cm.clearGutter("CodeMirror-linenumbers");
    }
 
    
    function _registerHandlers(editor, fileType) {
        var cm = editor._codeMirror, doc = editor.document;
        if (cm) {
            //create the appropriate folding function based on the file that was opened
            var ext = doc.file.fullPath.slice(doc.file.fullPath.lastIndexOf(".")).toLowerCase();
            if (_braceCollapsibleExtensions.indexOf(ext) > -1) {
                _activeRangeFinder = braceRangeFinder;
            } else if (_tagCollapsibleExtensions.indexOf(ext) > -1) {
                _activeRangeFinder = tagRangeFinder;
            }
            //add listeners if a rangeFinder was set
            if (_activeRangeFinder) {
                foldFunc = CodeMirror.newFoldFunction(_activeRangeFinder.rangeFinder);
                $(doc).on("change", _handleDocumentChange);
                cm.on("gutterClick", _handleGutterClick);
                $(editor).on("scroll", _handleScroll);
                _decorateGutters(editor);
            }
        }
    }
    
    function _deregisterHandlers(editor) {
        var cm = editor._codeMirror;
        $(editor.document).off("change", _handleDocumentChange);
        if (cm) {
            $(editor).off("scroll", _handleScroll);
            cm.off("gutterClick", _handleGutterClick);
            _undecorateGutters(cm);
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
        }
    }
   
    $(EditorManager).on("activeEditorChange", function (event, current, previous) {
        if (_extensionEnabled) {
            _activeRangeFinder = undefined;
            if (previous) {
                _deregisterHandlers(previous);
            }
            if (current) {
                _registerHandlers(current);
            }
        }
    });
    
    //Load stylesheet
    ExtensionUtils.loadStyleSheet(module, "main.less");
    
    CommandManager.register("Enable Code Folding", CODE_FOLD_EXT, _toggleExtension);
    Menus.getMenu(Menus.AppMenuBar.VIEW_MENU).addMenuItem(CODE_FOLD_EXT);
    CommandManager.get(CODE_FOLD_EXT).setChecked(_extensionEnabled);
    
});