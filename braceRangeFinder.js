/**
 * Brace range finder
 * @author Patrick Oladimeji
 * @date 4/24/13 18:02:50 PM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, d3, require, $, brackets, window, MouseEvent, CodeMirror*/
define(function (require, exports, module) {
    "use strict";
    var pos = CodeMirror.Pos;
    var _rangeOpenTriggers = ["{", "[", "/*"], _rangeCloseTriggers =  ["}", "]", "*/"],
        _matchingPairs = {"{": "}", "[": "]", "/*": "*/", "}": "{", "]": "[", "*/": "/*"};
    var _commentRegex = /^(comment|string)/, _openRegex = /(\{|\[|\/\*)/g, _closeRegex = /(\}|\]|\*\/)/g;
    
    /**
     * Utility function for matching all instances of a regular expression in a string
     * @param regex the regular expression to apply
     * @param string the string to apply the regular expression on
     * returns Array<> an array of matches along with the index of occurence in the string
     */
    function _matchAll(regex, string) {
        var res = [], m = regex.exec(string);
        while (m) {
            res.push({index: m.index + m[1].length, match: m[1]});
            m = regex.exec(string);
        }
        return res;
    }

    function _processLine(cm, line, matchStack, openTag) {
        var addLineProp = (function (l) {
            return function (d) {
                d.line = l;
                return d;
            };
        }(line));
        
        var lineText = cm.getLine(line), openTagMatches = _matchAll(_openRegex, lineText).map(addLineProp),
            closeTagMatches = _matchAll(_closeRegex, lineText).map(addLineProp), closeTag, token, i, tag;
        /**
         * decides whether or not to ignore tags. tags are ignored if they are in the context of a string or comment
         */
        function _ignoreTag(tag) {
            var token = cm.getTokenAt(pos(tag.line, tag.index));
            //ignore brraces in comments and strings
            if (!token.type || (token.type === "comment" && (tag.match === "/*" || tag.match === "*/"))) {
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
            if (_rangeOpenTriggers.indexOf(tag.match) > -1) {
                matchStack.push(tag);
            } else if (_rangeCloseTriggers.indexOf(tag.match) > -1) {
                if (matchStack.length && _matchingPairs[matchStack[matchStack.length - 1].match] === tag.match) {
                    if (matchStack.pop() === openTag) {
                        break;
                    }
                } else if (matchStack.length) {
                    do {
                        matchStack.pop();
                    } while (matchStack.length && matchStack[matchStack.length - 1].match === _matchingPairs[tag.match]);
                    //pop the last one if it is a matching one
                    if (matchStack.length && matchStack[matchStack.length - 1].match === _matchingPairs[tag.match]) {
                        if (matchStack.pop() === openTag) {
                            break;
                        }
                    } else {
                        matchStack = null;
                        break;
                    }
                }
            }
        }
        //set the opentag if not already initialised
        if (matchStack && matchStack.length && !openTag) {
            openTag = matchStack[matchStack.length - 1];
        }
        return {openTag: openTag, stack: matchStack};
    }
    /**
    * Finds foldable ranges within javascript, css, less files
    * contents inside braces and square brackets spanning multiple lines are foldable
    */
    function rangeFinder(cm, start) {
        var line = start.line, lineText = cm.getLine(line), i, ch, token, openIndex,
            closeIndex, lastLine = cm.lineCount(), startLineText = cm.getLine(line);
        var _startLineRes = _processLine(cm, line), stack = _startLineRes.stack, openTag = _startLineRes.openTag;
        
        if (!stack || !stack.length) {
            return;
        } else {
            var lineCount = cm.lineCount();
            
            for (i = start.line + 1; i < lineCount; i++) {
                lineText = cm.getLine(i);
                stack = _processLine(cm, i, stack, openTag).stack;
                //if stack is null then the open tag has no matching close tag if empty we found a match
                if (!stack) {
                    return;
                }
                
                if (!stack.length) {
                    var startIndex = openTag.index,
                        endIndex = lineText.lastIndexOf(_matchingPairs[openTag.match]);
                    return {from: pos(start.line, startIndex + 1), to: pos(i, endIndex)};
                }
            }
            return;
        }
    }
    
    module.exports = {
        rangeFinder: rangeFinder,
        canFold: function (cm, lineNum) {
            var lineData = _processLine(cm, lineNum);
            return lineData.openTag ? true : false;
        }
    };
});