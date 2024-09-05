import { pyodide } from '../main.js'
import { sideBar } from './sidebar.js'
import { controls } from './controls.js'
import { graph } from './graph.js'
import { canvas } from './canvas.js'

console.log('Loading node!')

const outputLogLimit = 200

export class Node {
  constructor (x, y, name, uuid, color = 'white') {
    this.x = x
    this.y = y
    this.displayName = name
    this.color = color
    this.uuid = uuid
    this.connections = []
    this.class = 'Default'
    this.bufferCount = 0
    this.sentCount = 0
    this.receiveCount = 0
    this.code = `async def run(self):
    await self.class_run()`
    this.outputLog = ''
    this.selected = false

    this.pyDisconnect = pyodide.runPython('_disconnect')
    this.pyReceive = pyodide.runPython('_receive')
    this.pyRename = pyodide.runPython('_rename_node')
  }

  reset () {
    this.bufferCount = 0
    this.sentCount = 0
    this.receiveCount = 0
    this.outputLog = ''
  }

  isVisible (viewport) {
    return true
  }

  render (ctx) {
    ctx.save()
    ctx.translate(this.x, this.y)
    ctx.fillStyle = 'white'
    ctx.fillRect(-12, -12, 23.75, 23.75)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.lineWidth = 2.5
    ctx.strokeStyle = 'white'
    ctx.strokeText(this.displayName, 0, 14)
    ctx.fillStyle = 'black'
    ctx.lineWidth = 1
    if (this.selected) {
      ctx.fillStyle = '#0086d8'
    }
    ctx.fillText(this.displayName, 0, 14)
    if (this.bufferCount > 0) {
      ctx.beginPath()
      ctx.fillStyle = 'white'
      ctx.arc(10, -10, 9, 0, 2 * Math.PI, false)
      ctx.fill()
    }
    ctx.fillStyle = 'black'

    ctx.fillStyle = this.color
    ctx.fillRect(-10, -10, 20, 20)
    ctx.fillStyle = 'black'
    ctx.beginPath()
    ctx.moveTo(-10, -10)
    ctx.lineTo(10, -10)
    ctx.lineTo(10, 10)
    ctx.lineTo(-10, 10)
    ctx.lineTo(-10, -10)
    ctx.strokeStyle = 'black'
    if (this.selected) {
      ctx.strokeStyle = '#0086d8'
      ctx.lineWidth = 2
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
    }
    ctx.stroke()
    ctx.lineWidth = 1
    if (this.bufferCount > 0) {
      ctx.beginPath()
      ctx.fillStyle = 'white'
      ctx.arc(10, -10, 7, 0, 2 * Math.PI, false)
      ctx.fill()
      ctx.beginPath()
      ctx.strokeStyle = 'black'
      if (this.selected) {
        ctx.strokeStyle = '#0086d8'
        ctx.lineWidth = 2
      }
      ctx.arc(10, -10, 7, 0, 2 * Math.PI, false)
      ctx.stroke()
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'black'
      if (this.selected) {
        ctx.fillStyle = '#0086d8'
      }
      if (this.bufferCount < 10) {
        ctx.font = '10px sans-serif'
        ctx.fillText(this.bufferCount, 10, -9)
      } else {
        ctx.font = '8px sans-serif'
        ctx.fillText('9+', 10, -9.5)
      }
    }
    ctx.restore()
  }

  addConnection (connection) {
    this.connections.push(connection)
  }

  removeConnection (connection) {
    this.connections.splice(this.connections.indexOf(connection), 1)
    this.pyDisconnect(connection.nodeA.uuid, connection.nodeB.uuid)
  }

  isConnectedTo (node) {
    for (const connection of this.connections) {
      if (connection.connectsTo(node)) {
        return true
      }
    }
    return false
  }

  send (neighbor, data, color = 'white', speed = '1.0', className = 'BaseMessage') {
    this.sentCount += 1
    sideBar.updateNodeDetails(this)
    for (const connection of this.connections) {
      if (connection.connectsTo(neighbor)) {
        connection.send(this, neighbor, data, color, speed, className)
        break
      }
    }
  }

  receive (message) {
    this.bufferCount += 1
    this.receiveCount += 1
    sideBar.updateNodeDetails(this)
    this.pyReceive(message.sender.uuid, message.receiver.uuid, message.color, message.speed, message.sentTimestamp, JSON.stringify(message.data), message.className)
    canvas.dirty()
  }

  decrementBuffer () {
    this.bufferCount -= 1
    sideBar.updateNodeDetails(this)
    canvas.dirty()
  }

  updatedPos () {
    for (const connection of this.connections) {
      connection.updatedPos()
    }
  }

  output (text) {
    this.outputLog += '[' + graph.getSimTime() + '] ' + text
    const lines = this.outputLog.split('\n')
    if (lines.length > outputLogLimit) {
      this.outputLog = lines.splice(lines.length - outputLogLimit, outputLogLimit).join('\n')
    }
  }

  setDisplayName (displayName, propagate = true) {
    this.displayName = displayName
    sideBar.updateNodeName(this, displayName)
    if (propagate && controls.isRunning()) {
      this.pyRename(this.uuid, this.displayName)
    }
  }
}
