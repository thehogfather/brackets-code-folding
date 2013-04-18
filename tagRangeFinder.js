/**
 * 
 * @author Patrick Oladimeji
 * @date 4/18/13 15:01:56 PM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, d3, require, $, brackets, window, MouseEvent, CodeMirror */

// the tagRangeFinder function is
//   Copyright (C) 2011 by Daniel Glazman <daniel@glazman.org>
// released under the MIT license (../../LICENSE) like the rest of CodeMirror
define(function (require, exports, module) {
    "use strict";
    var startTagRegex = /^<\w+>/;
    function rangeFinder(cm, start) {
        var nameStartChar = "A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD";
        var nameChar = nameStartChar + "\-\:\.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040";
        var xmlNAMERegExp = new RegExp("^[" + nameStartChar + "][" + nameChar + "]*");
    
        var lineText = cm.getLine(start.line);
        var found = false;
        var tag = null;
        var pos = start.ch;
        while (!found) {
            pos = lineText.indexOf("<", pos);
            if (-1 === pos) {// no tag on line
                return;
            }
            if (pos + 1 < lineText.length && lineText[pos + 1] === "/") { // closing tag
                pos++;
                continue;
            }
            // ok we seem to have a start tag
            if (!lineText.substr(pos + 1).match(xmlNAMERegExp)) { // not a tag name...
                pos++;
                continue;
            }
            var gtPos = lineText.indexOf(">", pos + 1);
            if (-1 === gtPos) { // end of start tag not in line
                var l = start.line + 1;
                var foundGt = false;
                var lastLine = cm.lineCount();
                while (l < lastLine && !foundGt) {
                    var lt = cm.getLine(l);
                    gtPos = lt.indexOf(">");
                    if (-1 !== gtPos) { // found a >
                        foundGt = true;
                        var slash = lt.lastIndexOf("/", gtPos);
                        if (-1 !== slash && slash < gtPos) {
                            var str = lineText.substr(slash, gtPos - slash + 1);
                            if (!str.match(/\/\s*\>/)) {// yep, that's the end of empty tag
                                return;
                            }
                        }
                    }
                    l++;
                }
                found = true;
            } else {
                var slashPos = lineText.lastIndexOf("/", gtPos);
                if (-1 === slashPos) { // cannot be empty tag
                    found = true;
                    // don't continue
                } else { // empty tag?
                    // check if really empty tag
                    var str = lineText.substr(slashPos, gtPos - slashPos + 1);
                    if (!str.match( /\/\s*\>/ )) { // finally not empty
                        found = true;
                        // don't continue
                    }
                }
            }
            if (found) {
                var subLine = lineText.substr(pos + 1);
                tag = subLine.match(xmlNAMERegExp);
                if (tag) {
                    // we have an element name, wooohooo !
                    tag = tag[0];
                    // do we have the close tag on same line ???
                    if (-1 !== lineText.indexOf("</" + tag + ">", pos)) {// yep
                        found = false;
                    }
                    // we don't, so we have a candidate...
                } else {
                    found = false;
                }
            }
            if (!found) {
                pos++;
            }
        }
    
        if (found) {
            var startTag = "(\\<\\/" + tag + "\\>)|(\\<" + tag + "\\>)|(\\<" + tag + "\\s)|(\\<" + tag + "$)";
            var startTagRegExp = new RegExp(startTag);
            var endTag = "</" + tag + ">";
            var depth = 1;
            var l = start.line + 1;
            var lastLine = cm.lineCount();
            while (l < lastLine) {
                lineText = cm.getLine(l);
                var match = lineText.match(startTagRegExp), i;
                if (match) {
                    for (i = 0; i < match.length; i++) {
                        if (match[i] === endTag) {
                            depth--;
                        } else {
                            depth++;
                        }
                        if (!depth) {
                            return {from: CodeMirror.Pos(start.line, gtPos + 1),
                                      to: CodeMirror.Pos(l, match.index)};
                        }
                    }
                }
                l++;
            }
            return;
        }
    };
    
     module.exports = {
        rangeFinder: rangeFinder,
        canFold: function (line) {
             return startTagRegex.test(line);
        }
     };
});