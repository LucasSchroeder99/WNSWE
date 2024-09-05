import { EditorState } from '@codemirror/state'
import { highlightSelectionMatches } from '@codemirror/search'
import { history, defaultKeymap, historyKeymap, indentWithTab } from '@codemirror/commands'
import { foldGutter, indentOnInput, indentUnit, bracketMatching, foldKeymap, syntaxHighlighting, defaultHighlightStyle, codeFolding } from '@codemirror/language'
import { closeBrackets, autocompletion, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, highlightActiveLine, keymap, EditorView } from '@codemirror/view'

/// / Theme
// import { oneDark } from "@codemirror/theme-one-dark";

// Language
import { python } from '@codemirror/lang-python'

function createEditorState (initialContents, updateFunc) {
  const extensions = [
    indentUnit.of('    '),
    indentOnInput(),

    EditorState.allowMultipleSelections.of(true),
    autocompletion(),
    closeBrackets(),
    codeFolding(),
    history(),

    drawSelection(),
    highlightActiveLine(),
    highlightSpecialChars(),
    bracketMatching(),
    highlightSelectionMatches(),

    lineNumbers(),
    foldGutter(),
    highlightActiveLineGutter(),

    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...foldKeymap,
      ...completionKeymap,
      indentWithTab
    ]),
    python(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),

    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        updateFunc()
      }
    })
  ]

  return EditorState.create({
    doc: initialContents,
    extensions
  })
}

function createEditorView (state, parent) {
  return new EditorView({ state, parent })
}

export { createEditorState, createEditorView }
