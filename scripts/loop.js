import { canvas } from './canvas.js'
import { graph } from './graph.js'

console.log('Loading loop!')

// modularization and private scope:
export const loop = (function () {
  const my = {}

  let lastTime = 0
  let lastRender = 0
  let lastCamera = 0

  async function process (time) {
    const delta = time - lastTime
    lastTime = time
    await graph.process(delta)
    if (time - lastRender > 16) {
      canvas.render(time - lastRender)
      lastRender = time
    }
    if (time - lastCamera > 100) {
      canvas.saveCamera()
      lastCamera = time
    }
    await new Promise(resolve => { window.requestAnimationFrame(process) })
  }

  my.run = async function () {
    await new Promise(resolve => { window.requestAnimationFrame(process) })
  }

  return my
})()
