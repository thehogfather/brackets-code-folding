/**
 * A range finder based on matching tags using stacks.
 * @author Patrick Oladimeji
 * @date 4/19/13 23:03:05 PM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, regexp:true, maxerr: 50 */
/*global define, d3, require, $, brackets, window, MouseEvent, CodeMirror */
define(function (require, exports, module) {
    "use strict";
    var startTagRegex = /\s*(<(\w+)\s*[^>]*?>)/g, endTagRegex = /\s*(<\/(\w+)>)\s*/g;
    var util                = require("./util"),
        addProp             = util.addProp,
        copy                = util.copy;
        
    function _processLine(lineText, tagsStack, openTag) {
        var startTagMatches = util.matchAll(startTagRegex, lineText)
            .map(addProp("tagType", "open")), startTag;
        var endTagMatches = util.matchAll(endTagRegex, lineText)
            .map(addProp("tagType", "close")), endTag;
        var allTags = startTagMatches.concat(endTagMatches)
            .sort(function (a, b) { return a.index - b.index; });
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
        var lineText, startLineText = cm.getLine(start.line), endTag;
        var lineRes = _processLine(startLineText), stack = lineRes.stack, openTag = lineRes.openTag;
        
        if (!stack || stack.length === 0) { //no match was found on line or tag was closed on line
            return;
        } else {
            //keep looking to the end of the file until you find it :S
            var lineCount = cm.lineCount(), i;
            
            for (i = start.line + 1; i < lineCount; i++) {
                lineText = cm.getLine(i);
                if (lineText.trim().length !== 0) {//skip blanks
                
                    lineRes = _processLine(lineText, stack, openTag);
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