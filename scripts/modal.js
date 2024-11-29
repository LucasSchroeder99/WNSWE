import { pyodide } from '../main.js'
import { cm6 } from '../dist/cm6.bundle.js'
import { graph } from './graph.js'

console.log('Loading modal!')

export const modal = (function () {
  const my = {}

  const modalContainer = document.getElementById('modal_container')
  const closeButton = document.getElementById('modal_close_button')
  const importContainer = document.getElementById('modal_import')
  const classContainer = document.getElementById('modal_class')
  const helpContainer = document.getElementById('modal_help')
  const aboutContainer = document.getElementById('modal_about')

  const classSelection = document.getElementById('modal_class_selection')
  const codeWindowClass = document.getElementById('modal_code_window_class')
  const editWarning = document.getElementById('modal_class_code_edit_warning')
  const editClassWarning = document.getElementById('modal_class_code_error_warning')
  const editClassWarningText = document.getElementById('modal_class_code_error_warning_text')
  const editClassWarningTitle = document.getElementById('modal_class_code_error_warning_title')
  let editClassWarningType = "warning"
  const classAddNodeButton = document.getElementById('add_node_class_button')
  const classAddMessageButton = document.getElementById('add_message_class_button')
  const classDeleteButton = document.getElementById('delete_class_button')

  const forbiddenClassNames = ["Endpoint", "BaseMessage", "_SimTime", "Color"]

  let editTimer = null

  let selectedClass = ''
  let pyClassNameCheck = null

  const viewClass = cm6.createEditorView(cm6.createEditorState('', textChangedClass), codeWindowClass)

  let open = false

  my.isOpen = function () {
    return open
  }

  my.importDialog = function () {
    modalContainer.style.display = 'block'
    classContainer.style.display = 'none'
    helpContainer.style.display = 'none'
    aboutContainer.style.display = 'none'
    importContainer.style.display = 'block'
    open = true
  }

  my.classDialog = function () {
    modalContainer.style.display = 'block'
    importContainer.style.display = 'none'
    helpContainer.style.display = 'none'
    aboutContainer.style.display = 'none'
    classContainer.style.display = 'block'
    open = true
    my.selectClass(classSelection.value)
  }

  my.helpDialog = function () {
    modalContainer.style.display = 'block'
    classContainer.style.display = 'none'
    importContainer.style.display = 'none'
    aboutContainer.style.display = 'none'
    helpContainer.style.display = 'block'
    open = true
  }

  my.aboutDialog = function () {
    modalContainer.style.display = 'block'
    classContainer.style.display = 'none'
    importContainer.style.display = 'none'
    helpContainer.style.display = 'none'
    aboutContainer.style.display = 'block'
    open = true
  }

  function onOuterClick (e) {
    if (e.target !== modalContainer) {
      return
    }
    my.close()
  }

  my.clearClassSelection = function () {
    classSelection.innerHTML = ''
  }

  my.addNewClass = function (className) {
    const option = document.createElement('option')
    option.innerText = className
    option.setAttribute('value', className)
    classSelection.appendChild(option)
    classSelection.value = className
  }

  my.selectClass = function (className) {
    viewClass.setState(cm6.createEditorState(graph.getClassCode().get(className), textChangedClass))
    selectedClass = className
    applyClassCodeChange(className, graph.getClassCode().get(className))
    classSelection.value = className
  }

  async function applyClassCodeChange (className, code) {
    const info = graph.checkClassCode(code, className)
    if (!info.ok) {
      editClassWarningText.innerText = info.comment
      if (editClassWarningType !== info.type) {
        editClassWarning.classList.remove(editClassWarningType)
        editClassWarningType = info.type
        editClassWarningTitle.innerText = info.type.charAt(0).toUpperCase() + info.type.slice(1, info.type.length)
        console.log(editClassWarningType)
        editClassWarning.classList.add(editClassWarningType)
      }
      editClassWarning.style.display = 'block'
    } else {
      editClassWarning.style.display = 'none'
    }
    graph.getClassCode().set(selectedClass, code)
  }

  async function textChangedClass () {
    const code = viewClass.state.doc.toString()
    if (editTimer != null) {
      window.clearTimeout(editTimer)
      editTimer = null
    }
    editTimer = window.setTimeout(async () => { await applyClassCodeChange(selectedClass, code) }, 1500)
  }

  function onClassSelectionChanged () {
    my.selectClass(classSelection.value)
  }

  function onAddNodeClassButtonClicked () {
    const className = window.prompt('Enter node class name!')
    if (!className) {
      return
    }
    if (!(forbiddenClassNames.includes(className)) && pyClassNameCheck(className) && !graph.getClassCode().has(className)) {
      graph.addNewNodeClass(className)
      my.selectClass(className)
    } else {
      if (graph.getClassCode().has(className) || forbiddenClassNames.includes(className)) {
        window.alert(`Class '${className}' already exists`)
      } else {
        window.alert(`'${className}' is not a valid Python identifier!`)
      }
    }
  }

  function onAddMessageClassButtonClicked () {
    const className = window.prompt('Enter message class name!')
    if (!className) {
      return
    }
    if (!(forbiddenClassNames.includes(className)) && pyClassNameCheck(className) && !graph.getClassCode().has(className)) {
      graph.addNewMessageClass(className)
      my.selectClass(className)
    } else {
      if (graph.getClassCode().has(className) || forbiddenClassNames.includes(className)) {
        window.alert(`Class '${className}' already exists`)
      } else {
        window.alert(`'${className}' is not a valid Python identifier!`)
      }
    }
  }

  function onDeleteClassButtonClicked () {
    const className = classSelection.value
    if (className === 'Default') {
      window.alert("Class 'Default' cannot be deleted!")
      return
    }
    const ok = window.confirm("Do you really want to delete class '" + className + "'?")
    if (!ok) {
      return
    }
    graph.deleteClass(className)
    my.selectClass('Default')
  }

  my.init = function () {
    closeButton.addEventListener('click', my.close)
    modalContainer.addEventListener('click', (e) => { if (!(document.getElementById('modal_code_window_class').contains(document.activeElement))) { onOuterClick(e) } })
    classSelection.addEventListener('change', onClassSelectionChanged)
    classAddNodeButton.addEventListener('click', onAddNodeClassButtonClicked)
    classAddMessageButton.addEventListener('click', onAddMessageClassButtonClicked)
    classDeleteButton.addEventListener('click', onDeleteClassButtonClicked)
  }

  my.close = function () {
    modalContainer.style.display = 'none'
    open = false
  }

  my.startExecution = function () {
    editWarning.style.display = 'block'
  }

  my.reset = function () {
    editWarning.style.display = 'none'
  }

  my.loadPythonFuncs = function () {
    pyClassNameCheck = pyodide.runPython('_class_name_check')
  }

  return my
})()
