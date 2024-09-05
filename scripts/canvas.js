import { graph } from './graph.js'
import { controls } from './controls.js'
import { contextMenu } from './context_menu.js'
import { Message } from './message.js'
import { Connection } from './connection.js'
import { Node } from './node.js'

console.log('Loading canvas!')

// modularization and private scope:
export const canvas = (function () {
  const my = {}

  let canvas = document.getElementById('netsim_view')
  let ctx = canvas.getContext('2d')
  const ZOOM_MIN = 0.125
  const ZOOM_MAX = 4

  let dirty = true
  const camera = { x: 0.0, y: 0.0, zoom: 2.0 }
  let cameraDrag = false
  let nodeDrag = []
  let mouseLastPos = { x: 0.0, y: 0.0 }
  let mouseStartPos = { x: 0.0, y: 0.0 }
  let mouseMovedSignificantly = false
  let connectNode = []
  let tempConnection = []
  const replayMouse = { x: 0.0, y: 0.0 }

  // handle resizing of canvas with ResizeObserver
  const resizeObserver = new ResizeObserver((entries) => { // eslint-disable-line no-undef
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
    my.dirty()
  })
  resizeObserver.observe(canvas)

  my.setCamera = function (newCamera) {
    camera.x = newCamera.x
    camera.y = newCamera.y
    camera.zoom = newCamera.zoom
    my.dirty()
  }

  my.setReplayMouse = function (newPos) {
    replayMouse.x = newPos.x
    replayMouse.y = newPos.y
    my.dirty()
  }

  my.setCanvas = function (newCanvas) {
    canvas = newCanvas
    ctx = newCanvas.getContext('2d')
    console.log(ctx)
  }

  my.saveCamera = function () {
    if (cameraDrag) {
    }
  }

  function getCanvasMousePos (e) {
    const rect = canvas.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  function convertCanvasToWorldCoords (pos) {
    return {
      x: (pos.x - canvas.width / 2) / camera.zoom + camera.x,
      y: (pos.y - canvas.height / 2) / camera.zoom + camera.y
    }
  }

  function getWorldMousePos (e) {
    return convertCanvasToWorldCoords(getCanvasMousePos(e))
  }

  function mouseStart (e) {
    if (contextMenu.isOpen() && (e.buttons & 1) === 1) {
      contextMenu.close()
      return
    }
    if ((e.buttons & 1) === 1) {
      const pos = getWorldMousePos(e)
      mouseLastPos = getCanvasMousePos(e)
      mouseStartPos = getCanvasMousePos(e)
      mouseMovedSignificantly = false
      const n = graph.getNodeAtPos(pos)
      if (n && controls.getSelection().includes(n)) {
        nodeDrag = controls.getSelection()
      }
      if (!nodeDrag.length) {
        cameraDrag = true
      }
    }
  }

  function mouseLeave (e) {
    cameraDrag = false
    nodeDrag = []
  }

  function mouseRelease (e) {
    if (e.button === 2) {
      return
    }
    cameraDrag = false
    if (nodeDrag.length) {
      graph.nodesSortByY()
    }
    nodeDrag = []
    const pos = getWorldMousePos(e)
    const n = graph.getNodeAtPos(pos)
    const x = graph.getMessageOrConnectionAtPos(pos)
    if (!mouseMovedSignificantly) {
      if (connectNode.length) {
        if (n) {
          let tempList = connectNode
          if (connectNode.includes(n)) {
            tempList = connectNode.filter((node) => !(node === n || node.isConnectedTo(n)))
          }
          if (tempList.length === 0) {
            return
          }
          for (const node of connectNode) {
            graph.connect(node, n)
          }
          connectNode = []
          tempConnection = []
          my.dirty()
        }
        return
      }
      if (x && x instanceof Message) {
        controls.selectMessage(x, e.ctrlKey)
      } else if (n) {
        if (!controls.getSelection().includes(n)) {
          controls.selectNode(n, e.ctrlKey)
        } else {
          if (e.ctrlKey) {
            controls.deselect(n)
          } else {
            controls.selectNode(n, false)
          }
        }
      } else if (x && x instanceof Connection) {
        controls.selectConnection(x, e.ctrlKey)
      } else {
        if (!e.ctrlKey) {
          controls.selectNothing()
        }
      }
    }
  }

  function mouseMove (e) {
    const mousePos = getCanvasMousePos(e)
    if (cameraDrag) {
      const canvasMouseDeltaX = mouseLastPos.x - mousePos.x
      const canvasMouseDeltaY = mouseLastPos.y - mousePos.y

      camera.x += canvasMouseDeltaX / camera.zoom
      camera.y += canvasMouseDeltaY / camera.zoom
      mouseLastPos = mousePos
      dirty = true
    }
    if (nodeDrag.length) {
      for (const node of nodeDrag) {
        node.x -= (mouseLastPos.x - mousePos.x) / camera.zoom
        node.y -= (mouseLastPos.y - mousePos.y) / camera.zoom
        node.updatedPos()
      }
      mouseLastPos = mousePos
      dirty = true
    }
    if (!mouseMovedSignificantly && (cameraDrag || nodeDrag) && (mousePos.x - mouseStartPos.x) ** 2 + (mousePos.y - mouseStartPos.y) ** 2 > 25) {
      mouseMovedSignificantly = true
    }
    if (connectNode.length) {
      const mousePos = getWorldMousePos(e)
      for (const con of tempConnection) {
        con.to = mousePos
      }
      dirty = true
    }
  }

  function mouseWheel (e) {
    const oldZoom = camera.zoom
    const mousePos1 = getWorldMousePos(e)
    camera.zoom += e.deltaY * -0.003
    camera.zoom = Math.min(Math.max(ZOOM_MIN, camera.zoom), ZOOM_MAX)
    const mousePos2 = getWorldMousePos(e)
    const mouseDiff = { x: mousePos2.x - mousePos1.x, y: mousePos2.y - mousePos1.y }
    camera.x -= mouseDiff.x
    camera.y -= mouseDiff.y
    const diff = oldZoom - camera.zoom
    if (Math.abs(diff) >= Number.EPSILON) {
      dirty = true
    }
    e.preventDefault()
  }

  function rightClick (e) {
    if (contextMenu.isOpen()) {
      contextMenu.close()
      e.preventDefault()
      return
    }
    if (tempConnection.length) {
      tempConnection = []
      connectNode = []
      e.preventDefault()
      dirty = true
      return
    }
    const pos = getWorldMousePos(e)
    const n = graph.getNodeAtPos(pos)
    const x = graph.getMessageOrConnectionAtPos(pos)
    if (x && x instanceof Message) {
      let things = [x]
      let keepSelection = false
      if (controls.getSelection().includes(x)) {
        things = controls.getSelection()
        keepSelection = true
      }
      controls.selectMessage(x, keepSelection)
      contextMenu.open({ x: e.clientX, y: e.clientY }, pos, things, x)
    } else if (n) {
      let things = [n]
      let keepSelection = false
      if (controls.getSelection().includes(n)) {
        things = controls.getSelection()
        keepSelection = true
      }
      controls.selectNode(n, keepSelection)
      contextMenu.open({ x: e.clientX, y: e.clientY }, pos, things, n)
    } else if (x && x instanceof Connection) {
      let things = [x]
      let keepSelection = false
      if (controls.getSelection().includes(x)) {
        things = controls.getSelection()
        keepSelection = true
      }
      controls.selectConnection(x, keepSelection)
      contextMenu.open({ x: e.clientX, y: e.clientY }, pos, things, x)
    } else {
      contextMenu.open({ x: e.clientX, y: e.clientY }, pos, [], null)
    }
    e.preventDefault()
  }

  my.init = function () {
    canvas.addEventListener('pointerdown', mouseStart)
    canvas.addEventListener('pointerup', mouseRelease)
    canvas.addEventListener('pointerleave', mouseLeave)
    canvas.addEventListener('pointermove', mouseMove)
    canvas.addEventListener('wheel', mouseWheel)
    canvas.addEventListener('contextmenu', rightClick)
  }

  my.dirty = function () {
    dirty = true
  }

  // main rendering function
  my.render = function (delta) {
    if (!dirty) {
      return
    }
    const { width, height } = canvas

    ctx.clearRect(0, 0, width, height)
    ctx.resetTransform()
    ctx.save()

    ctx.scale(camera.zoom, camera.zoom)
    ctx.translate(width / 2 / camera.zoom, height / 2 / camera.zoom)
    ctx.translate(-camera.x, -camera.y)
    if (tempConnection.length) {
      for (const con of tempConnection) {
        drawConnectionLine(con, ctx)
      }
    }
    graph.render(ctx, null)
    if (graph.isReplay) {
      ctx.save()
      ctx.translate(replayMouse.x, replayMouse.y)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(12, 12)
      ctx.lineTo(7, 12)
      ctx.lineTo(9, 18)
      ctx.lineTo(7, 19)
      ctx.lineTo(4, 14)
      ctx.lineTo(0, 18)
      ctx.closePath()
      ctx.fillStyle = 'white'
      ctx.fill()
      ctx.strokeStyle = 'black'
      ctx.stroke()
      ctx.restore()
    }
    ctx.restore()
    dirty = false
  }

  function drawConnectionLine (con, ctx) {
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(con.from.x, con.from.y)
    ctx.lineTo(con.to.x, con.to.y)
    ctx.strokeStyle = '#0086d8'
    ctx.setLineDash([5, 3])
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }

  my.isConnecting = function () {
    return (tempConnection.length > 0)
  }

  my.abortConnecting = function () {
    tempConnection = []
    connectNode = []
    my.dirty()
  }

  my.setModeConnect = function (nodes) {
    if (nodes instanceof Node) {
      nodes = [nodes]
    }
    connectNode = nodes
    tempConnection = []
    for (const node of connectNode) {
      tempConnection.push({ from: node, to: { x: node.x, y: node.y } })
    }
  }

  my.resetView = function () {
    my.dirty()
    if (graph.nodes.length === 0) {
      camera.x = 0
      camera.y = 0
      camera.zoom = 1.0
      return
    }
    const nodeExtends = { x: { min: null, max: null }, y: { min: null, max: null } }
    for (const node of graph.nodes) {
      if (!nodeExtends.x.min) {
        nodeExtends.x.min = node.x - 10
        nodeExtends.x.max = node.x + 10
        nodeExtends.y.min = node.y - 10
        nodeExtends.y.max = node.y + 10
        continue
      }
      nodeExtends.x.min = Math.min(nodeExtends.x.min, node.x - 10)
      nodeExtends.x.max = Math.max(nodeExtends.x.max, node.x + 10)
      nodeExtends.y.min = Math.min(nodeExtends.y.min, node.y - 10)
      nodeExtends.y.max = Math.max(nodeExtends.y.max, node.y + 10)
    }
    camera.x = nodeExtends.x.min + (nodeExtends.x.max - nodeExtends.x.min) / 2
    camera.y = nodeExtends.y.min + (nodeExtends.y.max - nodeExtends.y.min) / 2
    const zoomX = canvas.width * 0.45 / ((nodeExtends.x.max - nodeExtends.x.min) / 2)
    const zoomY = canvas.height * 0.45 / ((nodeExtends.y.max - nodeExtends.y.min) / 2)
    camera.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(zoomX, zoomY)))
  }

  return my
})()
