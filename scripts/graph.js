import { pyodide } from '../main.js'
import { canvas } from './canvas.js'
import { controls } from './controls.js'
import { Node } from './node.js'
import { Connection } from './connection.js'
import { Message } from './message.js'
import { sideBar } from './sidebar.js'
import { modal } from './modal.js'

console.log('Loading graph!')

// modularization and private scope:
export const graph = (function () {
  const my = {}

  const classCode = new Map()
  const classCodeTypes = new Map()
  let overrideUUID = null
  let paused = true
  my.simTime = 0.0
  my.nodes = []
  my.connections = []
  my.simSpeed = 1.0

  let pyReset = null
  let pyAddNode = null
  let pyAddRunMethod = null
  let pyConnect = null
  let pyStart = null
  let pyDeleteNode = null
  let pyDisconnect = null
  // let pyRenameNode = null
  let pyProcess = null
  let pyNodeSuppressConnectionHotstart = null
  let pyTriggerConnectionHotstart = null
  let pyCodeCheckNode = null
  let pyCodeCheckClassMessage = null
  let pyCodeCheckClassNode = null

  my.isReplay = false

  const simTimeOutput = document.getElementById('sim_time_output')

  function genNodeClassStub (className) {
    return `class ${className}(Endpoint):
    def __init__(self):
        super().__init__()
        # initialize the class here

    async def send(self, target, data, message_class=Message):
        # handle data before sending here
        # this also applies to broadcasted messages
        await super().send(target, data, message_class)

    async def broadcast(self, data, exclude=None, message_class=Message):
        # modify data before broadcasting here
        await super().broadcast(data, exclude, message_class)

    async def receive(self, timeout=-1):
        msg, sender = await super().receive(timeout)
        # handle received data here before passing it back
        return msg, sender

    async def class_run(self):
        while True:
            msg, adr = await self.receive()
            self.print(f"received {msg.data} from {adr}")
`
  }

  function genMessageClassStub (className) {
    return `class ${className}(BaseMessage):
    def __init__(self, data):
        super().__init__(data)
        self.color="white"
        self.speed=1.0
`
  }

  my.addNode = function (x, y, name = null, uuid = null, color = 'white') {
    if (!uuid) {
      uuid = getNodeID()
    }
    if (!name) {
      name = 'Node ' + (my.nodes.length + 1)
    }
    const n = new Node(x, y, name, uuid, color)
    my.nodes.push(n)
    if (!my.isReplay) {
      controls.selectNode(n, false)
    }
    canvas.dirty()
    return n
  }

  function addNodeInPython (uuid, className) {
    overrideUUID = uuid
    pyAddNode(uuid, className)
    overrideUUID = null
  }

  my.getSimTime = function () {
    // https://stackoverflow.com/a/6134070
    return (Math.round(my.simTime * 100) / 100000).toFixed(2)
  }

  function getSimTimeExact () {
    return my.simTime
  }

  my.process = async function (delta) {
    if (paused) {
      return
    }
    my.simTime += delta * my.simSpeed
    simTimeOutput.innerText = my.getSimTime() + ' s'
    for (const connection of my.connections) {
      connection.process(delta * my.simSpeed)
    }
    await pyProcess(delta * my.simSpeed)
  }

  my.render = function (ctx, viewport) {
    renderConnections(ctx, viewport)
    postRenderConnections(ctx, viewport)
    preRenderMessages(ctx, viewport)
    renderNodes(ctx, viewport)
    renderMessages(ctx, viewport)
  }

  function postRenderConnections (ctx, viewport) {
    for (const connection of my.connections) {
      if (connection.isVisible()) {
        connection.postRender(ctx, viewport)
      }
    }
  }

  function renderConnections (ctx, viewport) {
    for (const connection of my.connections) {
      if (connection.isVisible()) {
        connection.render(ctx, viewport)
      }
    }
  }

  function preRenderMessages (ctx, viewport) {
    for (const connection of my.connections) {
      connection.preRenderMessages(ctx, viewport)
    }
  }

  function renderMessages (ctx, viewport) {
    for (const connection of my.connections) {
      connection.renderMessages(ctx, viewport)
    }
  }

  function renderNodes (ctx, viewport) {
    for (const node of my.nodes) {
      if (node.isVisible(viewport)) {
        node.render(ctx)
      }
    }
  }

  my.connect = function (n1, n2, length = 10) {
    for (const node of my.nodes) {
      if ((node === n1 && node.isConnectedTo(n2)) || (node === n2 && node.isConnectedTo(n1))) {
        return
      }
    }
    const con = new Connection(n1, n2, length)
    let hotstartN1 = false
    let hotstartN2 = false
    if (controls.isRunning() && n1.connections.length === 0) {
      hotstartN1 = true
    }
    if (controls.isRunning() && n2.connections.length === 0) {
      hotstartN2 = true
    }
    n1.addConnection(con)
    n2.addConnection(con)
    my.connections.push(con)
    if (!my.isReplay) {
      controls.selectConnection(con)
    }
    if (controls.isRunning()) {
      pyConnect(con.nodeA.uuid, con.nodeB.uuid)
    }
    if (hotstartN1) {
      addNodeInPython(n1.uuid, n1.class)
      try {
        pyodide.runPython(n1.code, { filename: n1.displayName })
        pyAddRunMethod(n1.uuid)
      } catch ({ name, message }) {
        controls.selectLog()
        sideBar.globalOutput(message)
        controls.reset()
      }
    }
    if (hotstartN2) {
      addNodeInPython(n2.uuid, n2.class)
      try {
        pyodide.runPython(n2.code, { filename: n2.displayName })
        pyAddRunMethod(n2.uuid)
      } catch ({ name, message }) {
        controls.selectLog()
        sideBar.globalOutput(message)
        controls.reset()
      }
    }
    canvas.dirty()
  }

  my.fullyConnect = function (nodes) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        my.connect(nodes[i], nodes[j])
      }
    }
  }

  my.disconnect = function (n1, n2) {
    let con = null
    for (const connection in my.connections) {
      if (connection.connectsTo(n1) && connection.connectsTo(n2)) {
        con = connection
        break
      }
    }
    if (con) {
      con.prepDelete()
      my.connections.splice(my.connections.indexOf(con), 1)
      if (controls.isRunning()) {
        pyDisconnect(con.nodeA.uuid, con.nodeB.uuid)
      }
    }
  }

  my.getNodeAtPos = function (pos) {
    for (const node of my.nodes) {
      if (Math.abs(node.x - pos.x) < 10 && Math.abs(node.y - pos.y) < 10) {
        return node
      }
    }
    return null
  }

  my.getMessageOrConnectionAtPos = function (pos) {
    for (const connection of my.connections) {
      const x = connection.checkClick(pos)
      if (x != null) {
        return x
      }
    }
    return null
  }

  my.addNewNodeClass = function (className) {
    classCode.set(className, genNodeClassStub(className))
    classCodeTypes.set(className, "Node")
    sideBar.addNewClass(className)
    modal.addNewClass(className)
  }

  my.addNewMessageClass = function (className) {
    classCode.set(className, genMessageClassStub(className))
    classCodeTypes.set(className, "Message")
    modal.addNewClass(className)
  }

  my.deleteClass = function (className) {
    for (const node of my.nodes) {
      if (node.class === className) {
        node.class = 'Default'
      }
    }
    sideBar.deleteClass(className)
  }

  my.getClassCode = function () {
    return classCode
  }

  my.deleteNode = function (node) {
    const delCons = []
    for (const connection of my.connections) {
      if (connection.connectsTo(node)) {
        delCons.push(connection)
      }
    }
    for (const connection of delCons) {
      my.deleteConnection(connection)
    }
    my.nodes.splice(my.nodes.indexOf(node), 1)
    pyDeleteNode(node.uuid)
    canvas.dirty()
    if (!my.isReplay) {
      controls.deselect(node)
    }
  }

  my.deleteConnection = function (connection) {
    connection.prepDelete()
    my.connections.splice(my.connections.indexOf(connection), 1)
    canvas.dirty()
    if (!my.isReplay) {
      controls.deselect(connection)
    }
  }

  my.deleteMessage = function (message) {
    for (const connection of my.connections) {
      connection.deleteMessage(message)
    }
    canvas.dirty()
    if (!my.isReplay) {
      controls.deselect(message)
    }
  }

  my.delete = function (x) {
    if (x instanceof Node) {
      my.deleteNode(x)
    } else if (x instanceof Connection) {
      my.deleteConnection(x)
    } else if (x instanceof Message) {
      my.deleteMessage(x)
    }
  }

  function sendFromPython (senderUUID, receiverUUID, dataJSON, color, speed, messageClassName) {
    if (my.isReplay) {
      return
    }
    let sender = null
    let receiver = null
    for (const node of my.nodes) {
      if (node.uuid === senderUUID) {
        sender = node
      }
      if (node.uuid === receiverUUID) {
        receiver = node
      }
    }
    sender.send(receiver, JSON.parse(dataJSON), color, speed, messageClassName)
  }

  function getNodeByUUID (uuid) {
    if (uuid === "tbd" && overrideUUID !== null) {
      uuid = overrideUUID
    }
    for (const node of my.nodes) {
      if (node.uuid === uuid) {
        return node
      }
    }
    return null
  }

  function nodeNamePython (uuid) {
    const node = getNodeByUUID(uuid)
    if (node) {
      return node.displayName
    }
    return null
  }

  function nodeColorPython (uuid) {
    const node = getNodeByUUID(uuid)
    if (node) {
      return node.color
    }
    return null
  }

  function setNodeNamePython (uuid, newName) {
    if (my.isReplay) {
      return
    }
    const node = getNodeByUUID(uuid)
    if (node) {
      node.setDisplayName(newName, false)
    }
    canvas.dirty()
  }

  function setNodeColorPython (uuid, newColor) {
    if (my.isReplay) {
      return
    }
    const node = getNodeByUUID(uuid)
    if (node) {
      node.color = newColor
    } else {
    }
    canvas.dirty()
  }

  function nodeOutputPython (uuid, text) {
    if (my.isReplay) {
      return
    }
    const node = getNodeByUUID(uuid)
    if (node) {
      node.output(text)
      sideBar.nodeOutput(node, text)
    }
  }

  function nodeOutputExceptionPython (uuid, excFull, excShort) {
    if (my.isReplay) {
      return
    }
    const node = getNodeByUUID(uuid)
    if (node) {
      node.output(excFull)
      sideBar.nodeOutputException(node, excShort)
    }
  }

  function decrementNodeBufferCountPython (uuid) {
    const node = getNodeByUUID(uuid)
    if (node) {
      node.decrementBuffer()
    }
  }

  my.init = function () {
    my.addNewMessageClass('Message')
    my.addNewNodeClass('Default')
  }

  my.loadPythonFuncs = function () {
    pyReset = pyodide.runPython('_reset')
    pyAddNode = pyodide.runPython('_add_node')
    pyDeleteNode = pyodide.runPython('_delete_node')
    pyAddRunMethod = pyodide.runPython('_add_run_method')
    pyConnect = pyodide.runPython('_connect')
    pyDisconnect = pyodide.runPython('_disconnect')
    pyStart = pyodide.runPython('_start')
    pyProcess = pyodide.runPython('_process')
    pyNodeSuppressConnectionHotstart = pyodide.runPython('_node_suppress_connection_hotstart')
    pyTriggerConnectionHotstart = pyodide.runPython('_node_trigger_connection_hotstart')
    pyCodeCheckNode = pyodide.runPython('_code_check_run')
    pyCodeCheckClassMessage = pyodide.runPython('_code_check_message')
    pyCodeCheckClassNode = pyodide.runPython('_code_check_node')
  }

  my.reset = function () {
    for (const connection of my.connections) {
      connection.reset()
    }
    for (const node of my.nodes) {
      node.reset()
    }
    my.simTime = 0.0
    simTimeOutput.innerText = '0.00s'
    sideBar.reset()
    modal.reset()
    canvas.dirty()
  }

  function getNodeID () {
    if (window.isSecureContext) {
      return crypto.randomUUID()
    }
    // fallback for uuid generation in insecure context -> https://stackoverflow.com/a/2117523
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
      (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
    )
  }

  my.execute = async function () {
    sideBar.startExecution()
    modal.startExecution()
    pyodide.globals.set('_send_to_js', sendFromPython)
    pyodide.globals.set('_js_get_node_name', nodeNamePython)
    pyodide.globals.set('_js_set_node_name', setNodeNamePython)
    pyodide.globals.set('_js_get_node_color', nodeColorPython)
    pyodide.globals.set('_js_set_node_color', setNodeColorPython)
    pyodide.globals.set('_js_output', nodeOutputPython)
    pyodide.globals.set('_js_output_exception', nodeOutputExceptionPython)
    pyodide.globals.set('_js_get_sim_time', getSimTimeExact)
    pyodide.globals.set('_js_decrement_buffer', decrementNodeBufferCountPython)
    await pyReset()
    for (const [className, classPyCode] of classCode) {
      try {
        pyodide.runPython(classPyCode, { filename: className })
      } catch ({ name, message }) {
        controls.selectLog()
        sideBar.globalOutput(message)
        controls.reset()
        return
      }
    }
    for (const node of my.nodes) {
      node.outputLog = ''
      addNodeInPython(node.uuid, node.class)
      try {
        pyodide.runPython(node.code, { filename: node.displayName })
        await pyAddRunMethod(node.uuid)
      } catch ({ name, message }) {
        controls.selectLog()
        sideBar.globalOutput(message)
        controls.reset()
        return
      }
    }
    for (const connection of my.connections) {
      pyConnect(connection.nodeA.uuid, connection.nodeB.uuid)
    }
    if (my.isReplay) {
      return
    }
    pyStart()
  }

  my.setPaused = function (value) {
    if (my.isReplay) {
      return
    }
    paused = value
  }

  my.exportScenarioJSON = function () {
    const scenario = Object.create(null)
    scenario.class = []
    scenario.nodes = []
    scenario.connections = []
    for (const [className, classPyCode] of classCode) {
      scenario.class.push({ name: className, code: classPyCode, type: classCodeTypes.get(className)})
    }
    for (const node of my.nodes) {
      scenario.nodes.push({
        x: node.x,
        y: node.y,
        displayName: node.displayName,
        color: node.color,
        uuid: node.uuid,
        class: node.class,
        code: node.code
      })
    }
    for (const connection of my.connections) {
      scenario.connections.push({
        nodeA: connection.nodeA.uuid,
        nodeB: connection.nodeB.uuid,
        length: connection.length
      })
    }
    return JSON.stringify(scenario)
  }

  my.importScenarioJSON = function (scenario) {
    my.reset()
    controls.reset()
    controls.selectNothing()
    my.nodes.splice(0, my.nodes.length)
    my.connections.splice(0, my.connections.length)
    classCode.clear()
    classCodeTypes.clear()
    modal.clearClassSelection()
    sideBar.clearClassSelection()
    for (const classInfo of scenario.class) {
      if (classInfo.classType === "Message") {
        my.addNewMessageClass(classInfo.name)
      } else {
        my.addNewNodeClass(classInfo.name)
      }
      classCode.set(classInfo.name, classInfo.code)
    }
    for (const nodeInfo of scenario.nodes) {
      my.addNode(nodeInfo.x, nodeInfo.y, nodeInfo.displayName, nodeInfo.uuid, nodeInfo.color)
      const n = my.nodes[my.nodes.length - 1]
      n.class = nodeInfo.class
      n.code = nodeInfo.code
    }
    for (const connectionInfo of scenario.connections) {
      my.connect(getNodeByUUID(connectionInfo.nodeA), getNodeByUUID(connectionInfo.nodeB), connectionInfo.length)
    }
    canvas.resetView()
    my.nodesSortByY()
  }

  my.duplicateNode = function (node) {
    if (my.isReplay) {
      return
    }
    my.addNode(node.x + 10, node.y + 10, 'Copy of ' + node.displayName, null, node.color)
    const n = my.nodes[my.nodes.length - 1]
    n.class = node.class
    n.code = node.code.repeat(1)
    return n
  }

  my.nodesSortByY = function () {
    my.nodes.sort((a, b) => { return b.y - a.y })
    canvas.dirty()
  }

  my.reset_node = async function (node) {
    pyDeleteNode(node.uuid)
    addNodeInPython(node.uuid, node.class)
    try {
      pyodide.runPython(node.code, { filename: node.displayName })
      await pyAddRunMethod(node.uuid)
    } catch ({ name, message }) {
      controls.selectLog()
      sideBar.globalOutput(message)
      controls.reset()
      return
    }
    pyNodeSuppressConnectionHotstart(node.uuid, true)
    for (const connection of my.connections) {
      if (node === connection.nodeA || node === connection.nodeB) {
        pyConnect(connection.nodeA.uuid, connection.nodeB.uuid)
      }
    }
    pyNodeSuppressConnectionHotstart(node.uuid, false)
    pyTriggerConnectionHotstart(node.uuid)
  }

  my.checkNodeCode = function (code, fileName = '<exec>') {
    const result = pyCodeCheckNode(code, fileName).toJs({ dict_converter: Object.fromEntries })
    return result
  }

  my.checkClassCode = function (code, fileName) {
    if (classCodeTypes.get(fileName) === "Message") {
      return pyCodeCheckClassMessage(code, fileName).toJs({ dict_converter: Object.fromEntries })
    }
    return pyCodeCheckClassNode(code, fileName).toJs({ dict_converter: Object.fromEntries })
  }

  return my
})()
