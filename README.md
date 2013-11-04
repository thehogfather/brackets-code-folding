#Code folding for Brackets
A code folding extension for [Brackets](https://github.com/adobe/brackets/) based on [CodeMirror's folding addon](http://codemirror.net/demo/folding.html).
Peforms code folding based on brace ({}, []) matching and multiline comments for javascript, json, css, php and less files. Also has some support for html and xml files based on tag matching.

Holding down the Alt-key while clicking on code regions collapses or expands all foldable child regions (as found in OSX Finder).

### How to install
Navigate to **Brackets > File > Install Extension** and paste url https://github.com/thehogfather/brackets-code-folding

####Or manually
1. [Download](https://github.com/thehogfather/brackets-code-folding/archive/master.zip)
2. Unzip in **user** folder in **Brackets > Help > Show Extensions Folder**
3. Restart or Reload Brackets
4. Toggle the extension with  **Brackets > View > Enable Code Folding**

### Keyboard shortcuts
    Ctrl-Alt-- Collapse code region at current cursor position
    Ctrl-Alt-+ Expand code region at current cursor position
    Alt-1 Collapse all code regions in current editor
    Shift-Alt-1 Expand all code regions in current editor

### License
MIT-licensed.

### Compatibility
Brackets Sprint 23 or later.
