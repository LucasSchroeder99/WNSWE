import { canvas } from './canvas.js'
import { Message } from './message.js'

console.log('Loading connection!')

// https://stackoverflow.com/a/1501725
function sqr (x) { return x * x }
function dist2 (v, w) { return sqr(v.x - w.x) + sqr(v.y - w.y) }
function distToSegmentSquared (p, v, w) {
  const l2 = dist2(v, w)
  if (l2 === 0) return dist2(p, v)
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2
  t = Math.max(0, Math.min(1, t))
  return dist2(p, {
    x: v.x + t * (w.x - v.x),
    y: v.y + t * (w.y - v.y)
  })
}

export class Connection {
  constructor (nodeA, nodeB, length = 10) {
    this.nodeA = nodeA
    this.nodeB = nodeB
    this.length = length
    this.messages = []
    this.selected = false
  }

  isVisible (viewport) {
    return true
  }

  send (sender, receiver, data, color = 'white', speed = '1.0', className = 'BaseMessage') {
    this.messages.push(new Message(sender, receiver, data, this.length, color, speed, className))
  }

  connectsTo (node) {
    return (node === this.nodeA || node === this.nodeB)
  }

  process (delta) {
    let receiving = false
    for (const message of this.messages) {
      message.process(delta)
      if (message.received) {
        receiving = true
      }
    }
    if (receiving) {
      this.messages = this.messages.filter((message) => !message.received)
    }
  }

  render (ctx) {
    ctx.beginPath()
    ctx.moveTo(this.nodeA.x, this.nodeA.y)
    ctx.lineTo(this.nodeB.x, this.nodeB.y)
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 3
    if (this.selected) {
      ctx.lineWidth = 4
    }
    ctx.stroke()
    ctx.lineWidth = 1
    ctx.strokeStyle = 'black'
    if (this.selected) {
      ctx.lineWidth = 2
      ctx.strokeStyle = '#0086d8'
    }
    ctx.stroke()
    ctx.lineWidth = 1
  }

  postRender (ctx) {
    const centerX = this.nodeA.x + (this.nodeB.x - this.nodeA.x) / 2
    const centerY = this.nodeA.y + (this.nodeB.y - this.nodeA.y) / 2
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.fillStyle = 'black'
    if (this.selected) {
      ctx.fillStyle = '#0086d8'
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    let x = this.nodeA.y - this.nodeB.y
    let y = this.nodeB.x - this.nodeA.x
    const l = Math.sqrt(x ** 2 + y ** 2)
    x = x / l * 6
    y = y / l * 6
    if (y > 0) {
      x = -x
      y = -y
    }
    ctx.lineWidth = 2.5
    ctx.strokeStyle = 'white'
    ctx.strokeText(this.length, x, y)
    ctx.fillText(this.length, x, y)
    ctx.lineWidth = 1
    ctx.restore()
  }

  reset () {
    this.messages = []
  }

  renderMessages (ctx, viewport) {
    for (const message of this.messages) {
      message.render(ctx)
    }
  }

  preRenderMessages (ctx, viewport) {
    for (const message of this.messages) {
      message.preRender(ctx)
    }
  }

  updatedPos () {
    for (const message of this.messages) {
      message.updatedPos()
    }
  }

  checkClick (pos) {
    if (pos.x < Math.min(this.nodeA.x, this.nodeB.x) - 10 || pos.x > Math.max(this.nodeA.x, this.nodeB.x) + 10 ||
        pos.y < Math.min(this.nodeA.y, this.nodeB.y) - 10 || pos.y > Math.max(this.nodeA.y, this.nodeB.y) + 10) {
      return
    }
    for (const message of this.messages) {
      if (Math.abs(message.x - pos.x) < 8 && Math.abs(message.y - pos.y) < 8) {
        return message
      }
    }
    const d = distToSegmentSquared(pos, this.nodeA, this.nodeB)
    if (d < 100) {
      return this
    }
  }

  setLength (newLength) {
    this.length = newLength
    for (const message of this.messages) {
      message.travelLength = this.length
      message.updatedPos()
    }
    canvas.dirty()
  }

  prepDelete () {
    this.nodeA.removeConnection(this)
    this.nodeB.removeConnection(this)
  }

  deleteMessage (message) {
    let found = false
    for (const myMessage of this.messages) {
      if (myMessage === message) {
        found = true
        break
      }
    }
    if (found) {
      this.messages.splice(this.messages.indexOf(message), 1)
    }
  }
}
