/**
 * A range finder based on matching tags using stacks.
 * @author Patrick Oladimeji
 * @date 4/19/13 23:03:05 PM
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, d3, require, $, brackets, window, MouseEvent, CodeMirror */
define(function (require, exports, module) {
    "use strict";
    var startTagRegex = /^\s*<(\w+)/, endTagRegex = /\s*<\/(\w+)>\s*$/;
    
    function _processLine(lineText, tagsStack) {
        var startTagMatches = startTagRegex.exec(lineText), startTag;
        var endTagMatches = endTagRegex.exec(lineText), endTag;
      
        if (startTagMatches && startTagMatches.length > 1) {
            tagsStack = tagsStack || [];
            startTag = startTagMatches[1].toLowerCase();
            tagsStack.push(startTag);
            
        }
        
        //can we find a close tag on the same line?
        if (tagsStack && endTagMatches && endTagMatches.length > 1) {
            endTag = endTagMatches[1].toLowerCase();
            //pop the stack if this close tag matches the most recent open tag ie the head of the stack
            if (tagsStack[tagsStack.length - 1] === endTag) {
                tagsStack.pop();
            } else {
                //this might have been a typo? should we pop it anyway and 
                //prioritise a close tag to match the most recent start tag?
                //for now we just pop the stack until we find a match
                do {
                    tagsStack.pop();
                } while (tagsStack.length > 0 && tagsStack[tagsStack.length - 1] !== endTag);
               
                if (tagsStack[tagsStack.length - 1] === endTag) {
                    tagsStack.pop();
                } else {
                    tagsStack = null;
                }
            }
        }
        return tagsStack;
    }
    
    function rangeFinder(cm, start) {
        var lineText, startLineText = cm.getLine(start.line);
        var stack = _processLine(startLineText);
        
        if (!stack || stack.length === 0) { //no match was found on line or tag was closed on line
            return;
        } else {
            //keep looking to the end of the file until you find it :S
            var lineCount = cm.lineCount(), i;
            
            for (i = start.line + 1; i < lineCount; i++) {
                lineText = cm.getLine(i);
                stack = _processLine(lineText, stack);
                //if stack is null, then tag has no closing tag if it is empty we found a match
                if (!stack) {
                    return;
                }
                if (stack.length === 0) {
                    var startCharIndex = startLineText.lastIndexOf(">"),
                        endCharIndex    = lineText.lastIndexOf("<");
                    return {from: CodeMirror.Pos(start.line, startCharIndex + 1),
                           to: CodeMirror.Pos(i, endCharIndex + 1)};
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