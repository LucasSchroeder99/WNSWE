import { canvas } from './scripts/canvas.js'
import { graph } from './scripts/graph.js'
import { controls } from './scripts/controls.js'
import { contextMenu } from './scripts/context_menu.js'
import { loop } from './scripts/loop.js'
import { sideBar } from './scripts/sidebar.js'
import { modal } from './scripts/modal.js'
import { Split } from './dist/split.es.js'

Split(['#canvas_container', '#sidebar'], {
  sizes: [75, 25],
  minSize: 320
})

let mainScript = ''
export let pyodide = null;

(async function (files, init) {
  let fileCount = files.length
  for (let i = 0; i < fileCount; i++) {
    if (files[i].startsWith('http') || files[i].startsWith('.')) {
      const script = document.createElement('script')
      script.type = 'text/javascript'
      script.src = files[i]
      document.getElementsByTagName('head')[0].appendChild(script)
      script.addEventListener('load', function () {
        fileCount -= 1
        if (fileCount <= 0) {
          init()
        }
      })
    } else if (files[i].endsWith('.py')) {
      const xmlhttp = new XMLHttpRequest()
      xmlhttp.onreadystatechange = function () {
        if (xmlhttp.readyState === XMLHttpRequest.DONE) { // XMLHttpRequest.DONE == 4
          if (xmlhttp.status === 200) {
            mainScript += xmlhttp.responseText
            fileCount -= 1
            if (fileCount <= 0) {
              init()
            }
          }
        }
      }
      xmlhttp.open('GET', 'python/' + files[i], true)
      xmlhttp.send()
      continue
    }
  }
})(
  [
    'main.py',
    'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js'
  ], async function () {
    pyodide = await loadPyodide()
    console.log('loaded pyodide')
    canvas.init()
    graph.init()
    sideBar.init()
    controls.init()
    contextMenu.init()
    modal.init()

    pyodide.runPython(mainScript)
    modal.loadPythonFuncs()
    graph.loadPythonFuncs()
    loop.run()

    const urlParams = new URLSearchParams(window.location.search);
    const scenario_url = urlParams.get('scenario_url', null)
    if (scenario_url !== null) {
      const request = await fetch(scenario_url)
      let scenario_json = await request.json()
      graph.importScenarioJSON(scenario_json)
    } else {
      const n1 = graph.addNode(50, 100, 'Node 1')
      const n2 = graph.addNode(250, 100, 'Node 2')
      const n3 = graph.addNode(500, 100, 'Node 3')
      const n4 = graph.addNode(500, 250, 'Node 4')
      graph.connect(n1, n2, 5)
      graph.connect(n2, n3, 6)
      graph.connect(n3, n4, 7)
      graph.connect(n2, n4, 5)
      canvas.resetView()
    }
    controls.selectNothing()
  })
