#Changelog
##0.3.5
* Addresses #134 where the beginning of lines in files are occluded by the fold-gutter.
* Addresses #133 where disabling code-folding for the settings dialog makes the settings inaccessible on reload
##0.3.4
* Updated for upcoming integration of code-folding in brackets master. Extension is no longer compatible with brackets >= 1.4.
##0.3.2
* Addresses #122 Cant open fold after tab or space on folded line
##0.3.1
* Addresses #119 Possible CodeMirror conflict with brackets-git
##0.3.0
* Addresses #114 gaps no longer appear in fold gutter (especially in custom themes)
* Addresses #116 external modification to files no longer corrupt the fold states in the document

##0.2.26
* Addresses #110: marker for folded region now styled using only css.
##0.2.25
* Added max fold levels to the settings dialog. This improves performance when folding all regions in a document by restricting the level of nesting to a specified number.
* Updated Russian translation
* Updated Finnish translation
* Added portuguese (Brasil) translation [rafaelcastrocouto](https://github.com/rafaelcastrocouto)
* Added Dutch translation [BBosman](https://github.com/BBosman)
##0.2.24
* Addresses issue #103 - code folding plugin no longer overwrites other gutter elements
* Added Finish translation [valtlait](https://github.com/valtlait)
##0.2.23
* Added options to fade fold buttons [vadim-kudr](https://github.com/vadim-kudr)
##0.2.22
* Patch for issue #88 - any space character now allowed before a region fold
* Added Japanese translation [lclzd](https://github.com/lclzd)
##0.2.21
* Added menu item for collapsing all custom regions in a document (feature #85)
* Updated Russian translation
##0.2.20
* Improved performance when opening minified files with region folding enabled
* Added French translation [rainje](https://github.com/rainje)
* Added Russian translation [disshishkov](https://github.com/disshishkov)
##0.2.19
* Added Settings dialog for configuring the extension

##0.2.18
* Added Galician translation [ivarcia ](https://github.com/ivarcia)
##0.2.17
* BUGFIX - fixed issue #78 - region fold causes brackets IDE to freeze when opening certain minified javascript files.

##0.2.16
* Added Italian translation [Denisov21](https://github.com/Denisov21)
* Update to Spanish translation [JJBocanegra](https://github.com/JJBocanegra)

##0.2.15
* Refactored and simplified region fold so it works for any language recognised in codeMirror
* Added custom region folding [keleko34](https://github.com/keleko34)
* Added Spanish translation [QuijoteShin](https://github.com/QuijoteShin)

##0.2.14
* BUGFIX - fixed issue #67 regarding nested fold regions. When a region becomes invalid it is now automatically expanded.

##0.2.13
* BUGFIX - fixed issue #66 where tags (in html/xml) wont fold if the tag is selected

##0.2.12
* BUGFIX - addresses issue #64 where extension crashed when loading preferences

##0.2.11
* Updated package.json to reflect correct minimum brackets version required to run extension

##0.2.10
* BUGFIX - fixed issue #61 where fold state was not correctly persisted
* Simplified the datastructure for storing foldstates in preference file

##0.2.9
* BUGFIX - fixed issue #57

##0.2.8
* Load code folding addons directly from brackets codemirror addon

##0.2.7
* BUGFIX - fixed issue #51 where extension was crashing for edgecode

##0.2.6
* BUGFIX - fixed issue #50
* Upgraded preference persistence to the new Brackets API

##0.2.5
* BUGFIX - fixed issue #49 where collapse all did not include first foldable item

##0.2.4
* Updated package.json to include title
* BUGFIX - fixed issue #44 [Mafio](https://github.com/Mafio)

##0.2.3
* Added internationalisation [Mafio](https://github.com/Mafio)
* Updated keyboard shortcuts

##0.2.2
* Several improvements to indent fold addressing issue #40

##0.2.1
* made indent the default fold addon for text files to address issue #39

##0.2.0
* added support for ruby files

##0.1.8
* Improved latex code folding
* BUGFIX - fixed issue #37 where multiline comments no longer had fold markers

##0.1.7
* Added support for folding latex documents

##0.1.6
* Change base key for shortcuts to letters in order to reduce chances of conflicts with international keyboards addresses issues #34, #35 and #36
##0.1.4
* Added menu items for collapsing and expanding code regions under view menu (addresses issue #33)
* Removed keybinding (ctrl-alt-+) for expanding current code region and left (ctrl-alt-=) as per issue #34

##0.1.3
* Added instruction to README to address issue #34 where keyboard shortcuts might conflict with typing non alphabetic characters on some non-English keyboards.

##0.1.2
* Addresses issue #32 where line fold state is not being correctly persisted after modifying document. Consequently restoring line folds results in wrong folded regions.

##0.1.1
* Addresses issue #30 where code folding is broken after using Ctrl-Alt-- to fold current code region.
* Fixed minor issue where code range opened and closed on the same line is still marked as folded when using shortcuts
