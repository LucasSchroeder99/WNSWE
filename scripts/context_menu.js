import { canvas } from './canvas.js'
import { controls } from './controls.js'
import { graph } from './graph.js'
import { Node } from './node.js'
import { Message } from './message.js'
import { Connection } from './connection.js'

console.log('Loading context_menu!')

// modularization and private scope:
export const contextMenu = (function () {
  const my = {}
  let open = false
  const contextMenuActual = document.getElementById('context_menu')
  const contextMenuContentNode = document.getElementById('context_menu_node')
  const contextMenuContentNodeMultiple = document.getElementById('context_menu_node_multiple')
  const contextMenuContentMessage = document.getElementById('context_menu_message')
  const contextMenuContentConnection = document.getElementById('context_menu_connection')
  const contextMenuContentNothing = document.getElementById('context_menu_nothing')
  const nodeEditButton = document.getElementById('context_menu_node_edit_button')
  const nodeConnectButton = document.getElementById('context_menu_node_connect_button')
  const nodeDeleteButton = document.getElementById('context_menu_node_delete_button')
  const nodeDuplicateButton = document.getElementById('context_menu_node_duplicate_button')
  const nodeFullyConnectButton = document.getElementById('context_menu_node_fully_connect_button')
  const messageEditButton = document.getElementById('context_menu_message_edit_button')
  const messageDeleteButton = document.getElementById('context_menu_message_delete_button')
  const connectionEditButton = document.getElementById('context_menu_connction_edit_button')
  const connectionInsertNodeButton = document.getElementById('context_menu_connction_insert_node_button')
  const connectionDeleteButton = document.getElementById('context_menu_connction_delete_button')
  const addNodeButton = document.getElementById('context_menu_nothing_add_node_button')
  const addNodeButtonRed = document.getElementById('context_menu_nothing_add_node_button_red')
  const addNodeButtonGreen = document.getElementById('context_menu_nothing_add_node_button_green')
  const addNodeButtonBlue = document.getElementById('context_menu_nothing_add_node_button_blue')
  const addNodeButtonOrange = document.getElementById('context_menu_nothing_add_node_button_orange')
  const resetViewButton = document.getElementById('context_menu_nothing_reset_view_button')
  const contextMenuPosition = { x: 0, y: 0 }
  let selectedElement = null
  let selectedElements = []

  my.isOpen = function () {
    return open
  }

  function onNodeEditButtonClicked () {
    controls.selectNode(selectedElement)
    my.close()
  }

  function onNodeConnectButtonClicked () {
    canvas.setModeConnect(selectedElements.slice())
    my.close()
  }

  function onNodeDeleteButtonClicked () {
    let msg = 'Do you really want to delete '
    if (selectedElements.length === 1) {
      msg += 'this node?'
    } else {
      msg += 'these ' + selectedElements.length + ' nodes?'
    }
    const ok = window.confirm(msg)
    if (!ok) {
      my.close()
      return
    }
    const dels = []
    for (const elem of selectedElements) {
      dels.push(elem)
    }
    for (const elem of dels) {
      graph.deleteNode(elem)
    }
    controls.selectNothing()
    my.close()
  }

  function onNodeDuplicateButtonClicked () {
    for (const elem of selectedElements.slice()) {
      graph.duplicateNode(elem)
    }
    my.close()
  }

  function onNodeFullyConnectButtonClicked () {
    graph.fullyConnect(selectedElements.slice())
    my.close()
  }

  function onMessageEditButtonClicked () {
    controls.selectMessage(selectedElement)
    my.close()
  }

  function onMessageDeleteButtonClicked () {
    let msg = 'Do you really want to delete '
    if (selectedElements.length === 1) {
      msg += 'this message?'
    } else {
      msg += 'these ' + selectedElements.length + ' messages?'
    }
    const ok = window.confirm(msg)
    if (!ok) {
      my.close()
      return
    }
    const dels = []
    for (const elem of selectedElements) {
      dels.push(elem)
    }
    for (const elem of dels) {
      graph.deleteMessage(elem)
    }
    controls.selectNothing()
    my.close()
  }

  function onConnectionEditButtonClicked () {
    controls.selectConnection(selectedElement)
    my.close()
  }

  function onConnectionDeleteButtonClicked () {
    let msg = 'Do you really want to delete '
    if (selectedElements.length === 1) {
      msg += 'this connection?'
    } else {
      msg += 'these ' + selectedElements.length + ' connections?'
    }
    const ok = window.confirm(msg)
    if (!ok) {
      my.close()
      return
    }
    const dels = []
    for (const elem of selectedElements) {
      dels.push(elem)
    }
    for (const elem of dels) {
      graph.deleteConnection(elem)
    }
    controls.selectNothing()
    my.close()
  }

  function onConnectionInsertNodeButtonClicked () {
    const n = graph.addNode(contextMenuPosition.x, contextMenuPosition.y)
    const lenA = Math.sqrt((selectedElement.nodeA.x - contextMenuPosition.x) ** 2 + (selectedElement.nodeA.y - contextMenuPosition.y) ** 2)
    const lenTotal = Math.sqrt((selectedElement.nodeA.x - selectedElement.nodeB.x) ** 2 + (selectedElement.nodeA.y - selectedElement.nodeB.y) ** 2)
    const conLenA = Math.min(Math.max(1, selectedElement.length - 1), Math.max(1, Math.round(selectedElement.length * (lenA / lenTotal))))
    const conLenB = Math.max(1, selectedElement.length - conLenA)
    graph.connect(selectedElement.nodeA, n, conLenA)
    graph.connect(n, selectedElement.nodeB, conLenB)
    graph.deleteConnection(selectedElement)
  }

  function onAddNodeButtonClicked () {
    graph.addNode(contextMenuPosition.x, contextMenuPosition.y)
    my.close()
  }

  function onAddNodeButtonClickedRed () {
    graph.addNode(contextMenuPosition.x, contextMenuPosition.y, null, null, 'red')
    my.close()
  }

  function onAddNodeButtonClickedGreen () {
    graph.addNode(contextMenuPosition.x, contextMenuPosition.y, null, null, 'green')
    my.close()
  }

  function onAddNodeButtonClickedBlue () {
    graph.addNode(contextMenuPosition.x, contextMenuPosition.y, null, null, 'blue')
    my.close()
  }

  function onAddNodeButtonClickedOrange () {
    graph.addNode(contextMenuPosition.x, contextMenuPosition.y, null, null, 'orange')
    my.close()
  }

  function onResetViewButtonClicked () {
    canvas.resetView()
    my.close()
  }

  my.init = function () {
    nodeEditButton.addEventListener('click', onNodeEditButtonClicked)
    nodeConnectButton.addEventListener('click', onNodeConnectButtonClicked)
    nodeDeleteButton.addEventListener('click', onNodeDeleteButtonClicked)
    nodeDuplicateButton.addEventListener('click', onNodeDuplicateButtonClicked)
    nodeFullyConnectButton.addEventListener('click', onNodeFullyConnectButtonClicked)
    messageEditButton.addEventListener('click', onMessageEditButtonClicked)
    messageDeleteButton.addEventListener('click', onMessageDeleteButtonClicked)
    connectionEditButton.addEventListener('click', onConnectionEditButtonClicked)
    connectionInsertNodeButton.addEventListener('click', onConnectionInsertNodeButtonClicked)
    connectionDeleteButton.addEventListener('click', onConnectionDeleteButtonClicked)
    addNodeButton.addEventListener('click', onAddNodeButtonClicked)
    addNodeButtonRed.addEventListener('click', onAddNodeButtonClickedRed)
    addNodeButtonGreen.addEventListener('click', onAddNodeButtonClickedGreen)
    addNodeButtonBlue.addEventListener('click', onAddNodeButtonClickedBlue)
    addNodeButtonOrange.addEventListener('click', onAddNodeButtonClickedOrange)
    resetViewButton.addEventListener('click', onResetViewButtonClicked)
  }

  my.open = function (canvasPos, worldPos, things, x) {
    open = true
    contextMenuActual.style.display = 'block'
    contextMenuPosition.x = worldPos.x
    contextMenuPosition.y = worldPos.y
    contextMenuActual.style.top = canvasPos.y + 'px'
    contextMenuActual.style.left = canvasPos.x + 'px'
    selectedElement = x
    if (things) {
      selectedElements = things
    } else {
      selectedElements = []
    }
    if (x && x instanceof Node) {
      contextMenuContentMessage.style.display = 'none'
      contextMenuContentConnection.style.display = 'none'
      contextMenuContentNothing.style.display = 'none'
      contextMenuContentNode.style.display = 'block'
      if (selectedElements.length > 1) {
        contextMenuContentNodeMultiple.style.display = 'block'
      } else {
        contextMenuContentNodeMultiple.style.display = 'none'
      }
    } else if (x && x instanceof Message) {
      contextMenuContentNode.style.display = 'none'
      contextMenuContentConnection.style.display = 'none'
      contextMenuContentNothing.style.display = 'none'
      contextMenuContentMessage.style.display = 'block'
    } else if (x && x instanceof Connection) {
      contextMenuContentNode.style.display = 'none'
      contextMenuContentMessage.style.display = 'none'
      contextMenuContentNothing.style.display = 'none'
      contextMenuContentConnection.style.display = 'block'
    } else {
      contextMenuContentNode.style.display = 'none'
      contextMenuContentMessage.style.display = 'none'
      contextMenuContentConnection.style.display = 'none'
      contextMenuContentNothing.style.display = 'block'
    }
  }

  my.close = function () {
    contextMenuActual.style.display = 'none'
    open = false
  }

  return my
})()
