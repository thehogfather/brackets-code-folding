/**
 * Brace fold helper
 * @author Patrick Oladimeji
 * @date 10/23/13 9:36:36 AM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, brackets, CodeMirror*/
define(function (require, exports, module) {
    "use strict";
    
    var util                = require("../util"),
        addProp             = util.addProp,
        _matchAll           = util.matchAll,
        copy                = util.copy;
    var pos = CodeMirror.Pos,
        _matchingPairs = {"{": "}", "[": "]", "/*": "*/", "}": "{", "]": "[", "*/": "/*"},
        _openRegex = /(\{|\[|\/\*)/g,
        _closeRegex = /(\}|\]|\*\/)/g;
    
    function _processLine(cm, line, matchStack, openTag) {
        var lineText = cm.getLine(line),
            openTagMatches = _matchAll(_openRegex, lineText)
                .map(addProp("line", line))
                .map(addProp("tagType", "open")),
            closeTagMatches = _matchAll(_closeRegex, lineText)
                .map(addProp("line", line))
                .map(addProp("tagType", "close"));
        var stackCopy, i, tag;
        /**
         * decides whether or not to ignore tags. tags are ignored if they are in the context of a string or comment
         */
        function _ignoreTag(tag) {
            var token = cm.getTokenAt(pos(tag.line, tag.index + tag.matches[1].length));
            //ignore brraces in comments and strings
            if (!token.type || (token.type === "comment" && (tag.matches[1] === "/*" || tag.matches[1] === "*/"))) {
                return false;
            }
            return true;
        }
        //concatenate the close/opentag matches we found on the line and sort by their position on the line
        //and filter out any tags that should be ignored
        var allTags = closeTagMatches.concat(openTagMatches).sort(function (a, b) {
            return a.index - b.index;
        }).filter(function (tag) {
            return !_ignoreTag(tag);
        });
        /**
            initialise the stack if undefined. For each of the tags we have found, if it is an open tag, push on stack
            if it is a close tag and it matches the tag at the top of the stack and the top of the stack is the opentag,
            pop the stack and break out of loop otherwise, pop the stack until we find a matching open tag for the current
            closetag -- if we find a match, then the stack will be empty and we break out of the loop otherwise we set
            the stack to null (signalling to callers that we found no match)
        */
        matchStack = matchStack || [];
        for (i = 0; i < allTags.length; i++) {
            tag = allTags[i];
            if (tag.tagType === "open") {
                matchStack.push(tag);
            } else if (tag.tagType === "close") {
                if (matchStack.length && _matchingPairs[matchStack[matchStack.length - 1].matches[1]] === tag.matches[1]) {
                    if (matchStack.pop() === openTag) {
                        break;
                    }
                } else if (matchStack.length) {
                    stackCopy = copy(matchStack);
                    do {
                        matchStack.pop();
                    } while (matchStack.length && matchStack[matchStack.length - 1].matches[1] === _matchingPairs[tag.matches[1]]);
                    //pop the last one if it is a matching one
                    if (matchStack.length && matchStack[matchStack.length - 1].matches[1] === _matchingPairs[tag.matches[1]]) {
                        if (matchStack.pop() === openTag) {
                            break;
                        }
                    } else {
                        matchStack = stackCopy;
                        break;
                    }
                }
            }
        }
        //set the opentag if not already initialised
        if (matchStack && matchStack.length && !openTag) {
            openTag = matchStack[matchStack.length - 1];//should this not be matchStack[0]????
        }
        return {openTag: openTag, stack: matchStack};
    }
    /**
    * Finds foldable ranges within javascript, css, less files
    * contents inside braces and square brackets spanning multiple lines are foldable
    */
    function rangeFinder(cm, start) {
        var line = start.line, lineText = cm.getLine(line), i;
        var _startLineRes = _processLine(cm, line), stack = _startLineRes.stack, openTag = _startLineRes.openTag;
        
        if (!stack || !stack.length) {
            return;
        } else {
            var lineCount = cm.lineCount();
            
            for (i = line + 1; i < lineCount; i++) {
                lineText = cm.getLine(i);
                if (lineText.trim().length > 0) {
                    stack = _processLine(cm, i, stack, openTag).stack;
                    //if stack is null then the open tag has no matching close tag if empty we found a match
                    if (!stack) {
                        return;
                    }
                    
                    if (!stack.length) {
                        var startIndex = openTag.index + openTag.matches[1].length,
                            endIndex = lineText.lastIndexOf(_matchingPairs[openTag.matches[1]]);
                        return {from: pos(line, startIndex + 1), to: pos(i, endIndex)};
                    }
                }
            }
            return;
        }
    }
    
    module.exports = rangeFinder;
});
