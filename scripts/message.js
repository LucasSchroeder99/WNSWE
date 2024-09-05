import { canvas } from './canvas.js'
import { graph } from './graph.js'
import { controls } from './controls.js'

console.log('Loading message!')

export class Message {
  constructor (sender, receiver, data, len = 10, color = 'white', speed = '1.0', className = 'BaseMessage') {
    this.sender = sender
    this.receiver = receiver
    this.data = data
    this.color = color
    this.className = className
    this.sentTimestamp = graph.getSimTime()

    this.speed = speed > 0.0 ? speed : 1.0
    this.travelLength = len
    this.travelProgress = 0.0

    this.x = this.sender.x
    this.y = this.sender.y

    this.received = false
    this.selected = false
  }

  isVisible (viewport) {
    return true
  }

  process (delta) {
    if (this.received) {
      return
    }
    this.travelProgress += delta / 1000 * this.speed
    const currentProgress = this.travelProgress / this.travelLength
    if (currentProgress >= 1.0) {
      this.received = true
      this.receiver.receive(this)
      controls.deselect(this)
    }
    this.x = this.sender.x + (this.receiver.x - this.sender.x) * currentProgress
    this.y = this.sender.y + (this.receiver.y - this.sender.y) * currentProgress
    canvas.dirty()
  }

  preRender (ctx) {
    ctx.save()
    ctx.translate(this.x, this.y)
    let s = 1
    ctx.fillStyle = 'white'
    if (this.selected) {
      s = 1.5
    }
    ctx.fillRect(-6 - s, -4 - s, 12 + 2 * s, 8 + 2 * s)
    ctx.restore()
  }

  render (ctx) {
    ctx.save()
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.translate(this.x, this.y)
    if (this.selected) {
      ctx.strokeStyle = '#0086d8'
      const s = 1.5
      ctx.lineWidth = 1.5
      ctx.strokeRect(-5.875 - s, -3.875 - s, 12 + 2 * s, 8 + 2 * s)
    }
    ctx.fillStyle = this.color
    ctx.fillRect(-5, -3, 10, 6)
    ctx.translate(0.125, 0.125)
    ctx.beginPath()
    ctx.moveTo(-5, -3)
    ctx.lineTo(5, -3)
    ctx.lineTo(5, 3)
    ctx.lineTo(-5, 3)
    ctx.lineTo(-5, -3)
    ctx.lineTo(0, 0)
    ctx.lineTo(5, -3)
    ctx.lineWidth = 1
    ctx.strokeStyle = 'black'
    ctx.stroke()
    ctx.restore()
  }

  updatedPos () {
    const currentProgress = Math.max(0, Math.min(1, this.travelProgress / this.travelLength))
    this.x = this.sender.x + (this.receiver.x - this.sender.x) * currentProgress
    this.y = this.sender.y + (this.receiver.y - this.sender.y) * currentProgress
    canvas.dirty()
  }
}
