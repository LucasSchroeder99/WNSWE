import { graph } from './graph.js'
import { canvas } from './canvas.js'
import { controls } from './controls.js'
import { modal } from './modal.js'
import { JSONEditor, toJSONContent } from 'https://cdn.jsdelivr.net/npm/vanilla-jsoneditor/standalone.js'
import { cm6 } from '../dist/cm6.bundle.js'

console.log('Loading sidebar!')

export const sideBar = (function () {
  const my = {}

  const classSelection = document.getElementById('class_selection')
  const classEditButton = document.getElementById('edit_class_button')
  const codeWindowNode = document.getElementById('code_window_node')
  const codeWindowMessage = document.getElementById('code_window_message')
  const inputConnectionLength = document.getElementById('input_connection_length')
  const simRunningWarning = document.getElementById('node_edit_warning')
  const editWarningNodeError = document.getElementById('node_code_error_warning')
  const editWarningNodeErrorText = document.getElementById('node_code_error_warning_text')
  const editWarningNodeErrorTitle = document.getElementById('node_code_error_warning_title') // eslint-disable-line no-unused-vars
  let editWarningNodeErrorType = "warning"
  const nodeNameInput = document.getElementById('node_name_input')
  const nodeDetailsUUID = document.getElementById('node_details_uuid')
  const nodeDetailsSent = document.getElementById('node_details_sent')
  const nodeDetailsReceived = document.getElementById('node_details_received')
  const nodeDetailsBuffered = document.getElementById('node_details_buffered')
  const outputLog = document.getElementById('output_log')
  const globalLog = document.getElementById('global_log')
  const globalLogLimit = 200
  const connectionTitle = document.getElementById('connection_title')
  const messageTitle = document.getElementById('message_title')
  const messageDetailsSender = document.getElementById('message_details_sender')
  const messageDetailsReceiver = document.getElementById('message_details_receiver')
  const messageDetailsTimestamp = document.getElementById('message_details_timestamp')

  let editTimer = null

  const messageJSONEditor = new JSONEditor({
    target: codeWindowMessage,
    props: {
      content: { text: '' },
      mode: 'text',
      askToFormat: false,
      onChange: textChangedMessage
    }
  })

  const viewNode = cm6.createEditorView(cm6.createEditorState('', textChangedNode), codeWindowNode)

  let globalLogText = ''

  my.selectedNode = null
  my.selectedConnection = null
  my.selectedMessage = null

  my.selectNode = function (node) {
    saveCode()
    my.selectedMessage = null
    my.selectedConnection = null
    my.selectedNode = node
    nodeNameInput.value = node.displayName
    my.updateNodeDetails(node)
    viewNode.setState(cm6.createEditorState(node.code, textChangedNode))
    applyNodeCodeChange(node, node.code)
    classSelection.value = node.class
    outputLog.innerText = node.outputLog
  }

  my.deselect = function (x) {
    if (x === my.selectedConnection || x === my.selectedNode || x === my.selectedMessage) {
      my.selectNothing()
    }
  }

  function saveCode () {
    if (editTimer !== null) {
      window.clearTimeout(editTimer)
      editTimer = null
      my.selectedNode.code = viewNode.state.doc.toString()
    }
  }

  my.selectMessage = function (message) {
    saveCode()
    my.selectedConnection = null
    my.selectedNode = null
    my.selectedMessage = message
    messageTitle.innerText = 'Message from ' + message.sender.displayName + ' to ' + message.receiver.displayName
    messageDetailsSender.innerText = message.sender.uuid
    messageDetailsReceiver.innerText = message.receiver.uuid
    messageDetailsTimestamp.innerText = message.sentTimestamp
    messageJSONEditor.set({ json: message.data })
  }

  my.selectConnection = function (connection) {
    saveCode()
    my.selectedNode = null
    my.selectedMessage = null
    my.selectedConnection = connection
    connectionTitle.innerText = 'Connection between ' + connection.nodeA.displayName + ' and ' + connection.nodeB.displayName
    inputConnectionLength.value = connection.length
  }

  my.selectNothing = function () {
    saveCode()
    my.selectedNode = null
    my.selectedMessage = null
    my.selectedConnection = null
  }

  async function applyNodeCodeChange (node, code) {
    const info = graph.checkNodeCode(code, node.displayName)
    if (!info.ok) {
      editWarningNodeErrorText.innerText = info.comment
      if (editWarningNodeErrorType !== info.type) {
        editWarningNodeError.classList.remove(editWarningNodeErrorType)
        editWarningNodeErrorType = info.type
        editWarningNodeErrorTitle.innerText = info.type.charAt(0).toUpperCase() + info.type.slice(1, info.type.length)
        editWarningNodeError.classList.add(editWarningNodeErrorType)
      }
      editWarningNodeError.style.display = 'block'
    } else {
      editWarningNodeError.style.display = 'none'
    }
    node.code = code
    if (info.ok && controls.isRunning() && node.connections.length === 0) {
      await graph.reset_node(node)
    }
  }

  async function textChangedNode () {
    if (my.selectedNode) {
      const code = viewNode.state.doc.toString()
      if (editTimer != null) {
        window.clearTimeout(editTimer)
        editTimer = null
      }
      editTimer = window.setTimeout(async () => { await applyNodeCodeChange(my.selectedNode, code) }, 1500)
    }
  }

  my.addNewClass = function (className) {
    const option = document.createElement('option')
    option.innerText = className
    option.setAttribute('value', className)
    classSelection.appendChild(option)
    classSelection.value = className
  }

  my.deleteClass = function (className) {
    classSelection.value = 'Default'
    let optToRemove = null
    for (const option of classSelection.children) {
      if (option.value === className) {
        optToRemove = option
        break
      }
    }
    if (optToRemove) {
      classSelection.removeChild(optToRemove)
    }
  }

  my.clearClassSelection = function () {
    classSelection.innerHTML = ''
  }

  function textChangedMessage () {
    if (my.selectedMessage) {
      try {
        const data = toJSONContent(messageJSONEditor.get()).json
        my.selectedMessage.data = data
      } catch (err) {
        console.log(err)
      }
    }
  }

  function valueChangedConLength () {
    if (my.selectedConnection) {
      my.selectedConnection.setLength(inputConnectionLength.value)
    }
  }

  function onEditClassButtonClicked () {
    console.log('asking modal to select class ' + my.selectedNode.class)
    modal.selectClass(my.selectedNode.class)
    modal.classDialog()
  }

  async function onClassSelectionChanged () {
    const className = classSelection.value
    my.selectedNode.class = className
    if (controls.isRunning() && my.selectedNode.connections.length === 0) {
      await graph.reset_node(my.selectedNode)
    }
  }

  function onNodeNameChange () {
    my.selectedNode.setDisplayName(nodeNameInput.value)
    canvas.dirty()
  }

  my.updateNodeName = function (node, displayName) {
    if (my.selectedNode === node) {
      nodeNameInput.value = displayName
    }
  }

  my.updateNodeDetails = function (node) {
    if (my.selectedNode === node) {
      nodeDetailsUUID.innerText = node.uuid
      nodeDetailsSent.innerText = node.sentCount
      nodeDetailsReceived.innerText = node.receiveCount
      nodeDetailsBuffered.innerText = node.bufferCount
    }
  }

  my.nodeOutput = function (node, text) {
    globalLogText += '[' + graph.getSimTime() + '|' + node.displayName + '] ' + text
    const lines = globalLogText.split('\n')
    if (lines.length > globalLogLimit) {
      globalLogText = lines.splice(lines.length - globalLogLimit, globalLogLimit).join('\n')
    }
    globalLog.innerText = globalLogText
    if (node === my.selectedNode) {
      outputLog.innerText = node.outputLog
    }
  }

  my.nodeOutputException = function (node, excShort) {
    globalLogText += '[' + graph.getSimTime() + '|' + node.displayName + '] ' + excShort
    globalLog.innerText = globalLogText
    if (node === my.selectedNode) {
      outputLog.innerText = node.outputLog
    }
  }

  my.globalOutput = function (text) {
    globalLogText += text
    globalLog.innerText = globalLogText
  }

  my.init = function () {
    messageJSONEditor.onChange = textChangedMessage
    inputConnectionLength.addEventListener('input', valueChangedConLength)
    classEditButton.addEventListener('click', onEditClassButtonClicked)
    classSelection.addEventListener('change', onClassSelectionChanged)
    nodeNameInput.addEventListener('input', onNodeNameChange)
  }

  my.reset = function () {
    my.selectedNode = null
    simRunningWarning.style.display = 'none'
  }

  my.startExecution = function () {
    globalLogText = '[0.00|Global] Start of simulation\n'
    globalLog.innerText = globalLogText
    outputLog.innerText = ''
    simRunningWarning.style.display = 'block'
  }

  return my
})()
