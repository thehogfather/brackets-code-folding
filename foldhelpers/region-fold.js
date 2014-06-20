// Function copied from brace-fold.js addon in CodeMirror Library with minor altering.
// CodeMirror 4.1.1, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE

define(function (require, exports, module) {
    "use strict";
    var CodeMirror = brackets.getModule("thirdparty/CodeMirror2/lib/codemirror");

module.exports = function(cm,start)
{
  var line = start.line, lineText = cm.getLine(line);
  var startCh, tokenType;

  console.log(cm);
  console.log(start);
  console.log(line);
  console.log(lineText);
  
  function findOpening(openCh) 
  {
    for (var at = start.ch, pass = 0;;) 
    {
      var found = at <= 0 ? -1 : lineText.lastIndexOf(openCh, at - 1);
      if (found == -1) {
        if (pass == 1) break;
        pass = 1;
        at = lineText.length;
        continue;
      }
      if (pass == 1 && found < start.ch) break;
      tokenType = cm.getTokenTypeAt(CodeMirror.Pos(line, found + 1));
      return found;
    }
  }

  var startToken = "//Region", endToken = "//Endregion", startCh = findOpening("//Region");
  if(startCh == null)
  {
    var startToken = "<!--Region", endToken = "<!--Endregion", startCh = findOpening("<!--Region");
  }
  if (startCh == null) return;
  startCh += (lineText.length+2);
  var count = 1, lastLine = cm.lastLine(), end, endCh;
  outer: for (var i = line; i <= lastLine; ++i) {
    var text = cm.getLine(i), pos = i == line ? startCh : 0;
    for (;;) {
      var nextOpen = text.indexOf(startToken, pos), nextClose = text.indexOf(endToken, pos);
      if (nextOpen < 0) nextOpen = text.length;
      if (nextClose < 0) nextClose = text.length;
      pos = Math.min(nextOpen, nextClose);
      if (pos == text.length) break;
      if (cm.getTokenTypeAt(CodeMirror.Pos(i, pos + 1)) == tokenType) {
        if (pos == nextOpen) ++count;
        else if (!--count) { end = i; endCh = pos; break outer; }
      }
      ++pos;
    }
  }
  if (end == null || line == end && endCh == startCh) return;
  return {from: CodeMirror.Pos(line, startCh),
          to: CodeMirror.Pos(end, endCh)};
}

});
