/**
 * A range finder based on matching tags using stacks.
 * @author Patrick Oladimeji
 * @date 4/19/13 23:03:05 PM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, regexp:true, maxerr: 50 */
/*global define, brackets*/
define(function (require, exports, module) {
    "use strict";

    var CodeMirror = brackets.getModule("thirdparty/CodeMirror2/lib/codemirror");
    var startTagRegex = /\s*(<((:?\w|[\.\_\-\:])+)\s*[^>]*?>)/g, endTagRegex = /\s*(<\/((:?\w|[\.\_\-\:])+)\s*>)/g;
    var util                = require("./util"),
        addProp             = util.addProp,
        copy                = util.copy;

    function _processLine(cm, line, tagsStack, openTag) {
        var lineText = cm.getLine(line);
        var startTagMatches = util.matchAll(startTagRegex, lineText)
            .map(addProp("tagType", "open"))
            .map(addProp("line", line));
        var endTagMatches = util.matchAll(endTagRegex, lineText)
            .map(addProp("tagType", "close"))
            .map(addProp("line", line));

        function _ignoreTag(tag) {
            var token = cm.getTokenAt(CodeMirror.Pos(tag.line, tag.index + tag.matches[1].length));
            //ignore tags in the context of a comment
            if (token.type && token.type === "comment") {
                return true;
            }
            return false;
        }

        var allTags = startTagMatches.concat(endTagMatches)
            .sort(function (a, b) { return a.index - b.index; })
            .filter(function (tag) { return !_ignoreTag(tag); });
        var i, tag, stackCopy;

        tagsStack = tagsStack || [];
        for (i = 0; i < allTags.length; i++) {
            tag = allTags[i];
            if (tag.tagType === "open") {
                tagsStack.push(tag);
            } else { //close tag
                if (tagsStack.length && tagsStack[tagsStack.length - 1].matches[2] === tag.matches[2]) {
                    //if this is the tag for which we initially started the rangeFind fn break out of loop
                    //else just continue
                    if (tagsStack.pop() === openTag) {
                        break;
                    }
                } else if (tagsStack.length) {
                    stackCopy = copy(tagsStack);
                    do {
                        tagsStack.pop();
                    } while (tagsStack.length && tagsStack[tagsStack.length - 1].matches[2] !== tag.matches[2]);
                    //pop the last tag if it is a matching one
                    if (tagsStack.length && tagsStack[tagsStack.length - 1].matches[2] === tag.matches[2]) {
                        //break out of loop if the popped tag is the open tag
                        if (tagsStack.pop() === openTag) {
                            break;
                        }
                    } else {
                        tagsStack = stackCopy;
                       // tagsStack = null;
                        break;
                    }
                }
            }
        }

        if (!openTag && tagsStack && tagsStack.length) {
            openTag = tagsStack[0];
        }
        return {openTag: openTag, stack: tagsStack, endTag: tag};
    }

    function rangeFinder(cm, start) {
        var lineText, endTag;
        var lineRes = _processLine(cm, start.line), stack = lineRes.stack, openTag = lineRes.openTag;

        if (!stack || stack.length === 0) { //no match was found on line or tag was closed on line
            return;
        } else {
            //keep looking to the end of the file until you find it :S
            var lineCount = cm.lineCount(), i;

            for (i = start.line + 1; i < lineCount; i++) {
                lineText = cm.getLine(i);
                if (lineText.trim().length !== 0) {//skip blanks

                    lineRes = _processLine(cm, i, stack, openTag);
                    stack = lineRes.stack;
                    if (stack && stack.length === 0) {
                        endTag = lineRes.endTag;
                        var startCharIndex = openTag.index + openTag.matches[0].length,
                            endCharIndex = lineRes.endTag ?
                                    (endTag.index  + endTag.matches[0].length - endTag.matches[1].length)
                                    : lineText.lastIndexOf("<");
                        return {from: CodeMirror.Pos(start.line, startCharIndex),
                               to: CodeMirror.Pos(i, endCharIndex)};
                    }
                }
            }

            return;
        }

    }

    module.exports = {
        rangeFinder: rangeFinder,
        canFold: function (cm, lineNum) {
            var range = rangeFinder(cm, CodeMirror.Pos(lineNum, 1));
            return range;
        }
    };

});
