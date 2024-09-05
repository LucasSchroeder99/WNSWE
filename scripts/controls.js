/* global FileReader */
import { canvas } from './canvas.js'
import { graph } from './graph.js'
import { sideBar } from './sidebar.js'
import { modal } from './modal.js'
import { contextMenu } from './context_menu.js'
import { Node } from './node.js'
import { Connection } from './connection.js'
import { Message } from './message.js'

console.log('Loading controls!')

// modularization and private scope:
export const controls = (function () {
  const my = {}

  let running = false
  let paused = false
  const selection = []
  let selectionMode = ''

  const playPauseButton = document.getElementById('play_pause_button')
  const resetButton = document.getElementById('reset_button')
  const exportButton = document.getElementById('export_button')
  const importStartButton = document.getElementById('start_import_button')
  const importFileInput = document.getElementById('import_file_input')
  const importFileDropArea = document.getElementById('drop_area')
  const importButton = document.getElementById('import_button')
  const simSpeedInput = document.getElementById('sim_speed_input')
  const simSpeedOutput = document.getElementById('sim_speed_output')
  const classesButton = document.getElementById('classes_button')
  const helpButton = document.getElementById('help_button')
  const aboutButton = document.getElementById('about_button')
  const logButton = document.getElementById('log_button')

  const nodeSidebar = document.getElementById('sidebar_node')
  const messageSidebar = document.getElementById('sidebar_message')
  const connectionSidebar = document.getElementById('sidebar_connection')
  const logSidebar = document.getElementById('sidebar_global_log')
  const noneSidebar = document.getElementById('sidebar_none')

  my.isRunning = function () {
    return running
  }

  async function onPlayPauseButtonClicked () {
    if (!running) {
      running = true
      playPauseButton.innerText = 'Pause'
      paused = false
      graph.setPaused(false)
      await graph.execute()
      resetButton.disabled = false
    } else {
      paused = !paused
      graph.setPaused(paused)
      if (paused) {
        playPauseButton.innerText = 'Continue'
      } else {
        playPauseButton.innerText = 'Pause'
      }
    }
  }

  my.reset = function () {
    if (running) {
      running = false
      graph.setPaused(true)
      playPauseButton.innerText = 'Start'
      graph.reset()
    }
  }

  function onResetButtonClicked () {
    my.reset()
  }

  function onImportButtonClicked () {
    const file = importFileInput.files[0]
    const reader = new FileReader()
    reader.onload = function (e) {
      graph.importScenarioJSON(JSON.parse(e.target.result))
    }
    reader.readAsText(file)
    modal.close()
  }

  function onExportButtonClicked () {
    // based on https://stackoverflow.com/a/30832210
    const file = new Blob([graph.exportScenarioJSON()], { type: 'application/json' })
    if (window.navigator.msSaveOrOpenBlob) { // IE10+
      window.navigator.msSaveOrOpenBlob(file, 'scenario.json')
    } else { // Others
      const a = document.createElement('a')
      const url = URL.createObjectURL(file)
      a.href = url
      a.download = 'scenario.json'
      document.body.appendChild(a)
      a.click()
      setTimeout(function () {
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      }, 0)
    }
  }

  // conversion between linear slider scale and logarithmic speed values
  // https://stackoverflow.com/a/846249
  const minp = 0
  const maxp = 50
  const minv = Math.log(0.1)
  const maxv = Math.log(10.0)
  const scale = (maxv - minv) / (maxp - minp)

  function linToLog (n) {
    return Math.exp(minv + scale * (n - minp))
  }

  function logToLin (n) { /* eslint-disable-line no-unused-vars */
    return (Math.log(n) - minv) / scale + minp
  }

  function onSimSpeedChanged () {
    const speed = parseFloat(linToLog(simSpeedInput.value).toFixed(2))
    simSpeedOutput.innerHTML = speed + '&times;'
    graph.simSpeed = speed
  }

  function onStartImportButtonClicked () {
    modal.importDialog()
  }

  function onDropFile (e) {
    e.preventDefault()
    const files = e.dataTransfer.files
    if (files.length > 1) {
      window.alert('Only the first file will be imported!')
    }
    importFileInput.files = files
  }

  function onKeyDown (e) {
    if (e.isComposing || e.keyCode === 229) {
      return
    }
    if (e.keyCode === 27) {
      if (modal.isOpen() && !(document.getElementById('modal_code_window_class').contains(document.activeElement))) {
        modal.close()
        e.preventDefault()
        return
      }
      if (contextMenu.isOpen()) {
        contextMenu.close()
        e.preventDefault()
        return
      }
      if (canvas.isConnecting()) {
        canvas.abortConnecting()
      }
    }
    if (e.ctrlKey && e.keyCode === 83) {
      e.preventDefault()
    }
    if (contextMenu.isOpen() || modal.isOpen()) {
      return
    } else {
      for (const x of document.querySelectorAll('.header, #sidebar')) {
        if (x.contains(document.activeElement)) {
          return
        }
      }
    }
    if (e.keyCode === 46) {
      let nodes = 0
      let connections = 0
      let messages = 0
      const dels = []
      for (const x of selection) {
        dels.push(x)
        if (x instanceof Node) {
          nodes += 1
        } else if (x instanceof Connection) {
          connections += 1
        } else if (x instanceof Message) {
          messages += 1
        }
      }
      if (nodes + connections + messages === 0) {
        return
      }
      let msg = 'Do you really want to delete '
      if (nodes === 1) {
        msg += 'this node'
      } else if (nodes > 1) {
        msg += 'these ' + nodes + ' nodes'
      } else if (connections === 1) {
        msg += 'this connection'
      } else if (connections > 1) {
        msg += 'these ' + connections + ' connections'
      } else if (messages === 1) {
        msg += 'this message'
      } else if (messages > 1) {
        msg += 'these ' + messages + ' messages'
      }
      msg += '?'
      const ok = window.confirm(msg)
      if (!ok) {
        return
      }
      for (const x of dels) {
        graph.delete(x)
      }
      selection.splice(0, selection.length)
    }
    if (e.keyCode === 67) {
      const nodes = selection.filter((x) => x instanceof Node)
      if (e.shiftKey) {
        graph.fullyConnect(nodes)
      } else {
        canvas.setModeConnect(nodes)
      }
    }
    if (e.keyCode === 76) {
      my.selectLog()
    }
  }

  my.selectNode = function (node, multiSelect = false, singleType = true) {
    if (!multiSelect || (singleType && selectionMode !== 'node')) {
      for (const thing of selection) {
        thing.selected = false
      }
      selection.splice(0, selection.length)
      selectionMode = 'node'
    }
    if (!selection.includes(node)) {
      selection.push(node)
    }
    node.selected = true
    canvas.dirty()
    messageSidebar.style.display = 'none'
    connectionSidebar.style.display = 'none'
    logSidebar.style.display = 'none'
    noneSidebar.style.display = 'none'
    nodeSidebar.style.display = 'block'
    sideBar.selectNode(node)
  }

  my.selectMessage = function (message, multiSelect = false, singleType = true) {
    if (!multiSelect || (singleType && selectionMode !== 'message')) {
      for (const thing of selection) {
        thing.selected = false
      }
      selection.splice(0, selection.length)
      selectionMode = 'message'
    }
    if (!selection.includes(message)) {
      selection.push(message)
    }
    message.selected = true
    canvas.dirty()
    connectionSidebar.style.display = 'none'
    nodeSidebar.style.display = 'none'
    logSidebar.style.display = 'none'
    noneSidebar.style.display = 'none'
    messageSidebar.style.display = 'block'
    sideBar.selectMessage(message)
  }

  my.selectConnection = function (connection, multiSelect = false, singleType = true) {
    if (!multiSelect || (singleType && selectionMode !== 'connection')) {
      for (const thing of selection) {
        thing.selected = false
      }
      selection.splice(0, selection.length)
      selectionMode = 'connection'
    }
    if (!selection.includes(connection)) {
      selection.push(connection)
    }
    connection.selected = true
    canvas.dirty()
    messageSidebar.style.display = 'none'
    nodeSidebar.style.display = 'none'
    logSidebar.style.display = 'none'
    noneSidebar.style.display = 'none'
    connectionSidebar.style.display = 'block'
    sideBar.selectConnection(connection)
  }

  my.selectNothing = function (clearSelection = true) {
    if (clearSelection) {
      for (const thing of selection) {
        thing.selected = false
      }
      selection.splice(0, selection.length)
      selectionMode = ''
      canvas.dirty()
    }
    messageSidebar.style.display = 'none'
    nodeSidebar.style.display = 'none'
    connectionSidebar.style.display = 'none'
    logSidebar.style.display = 'none'
    noneSidebar.style.display = 'block'
    sideBar.selectNothing()
  }

  my.selectLog = function () {
    messageSidebar.style.display = 'none'
    nodeSidebar.style.display = 'none'
    connectionSidebar.style.display = 'none'
    noneSidebar.style.display = 'none'
    logSidebar.style.display = 'block'
  }

  my.getSelection = function () {
    return selection
  }

  my.deselect = function (x) {
    if (!selection.length) {
      return
    }
    if (selection.includes(x)) {
      x.selected = false
      selection.splice(selection.indexOf(x), 1)
      canvas.dirty()
    }
    if (!selection.length) {
      my.selectNothing()
    }
    sideBar.deselect(x)
  }

  function onClassesButtonClicked () {
    modal.classDialog()
    my.selectNothing()
  }

  function onHelpButtonClicked () {
    modal.helpDialog()
  }

  function onAboutButtonClicked () {
    modal.aboutDialog()
  }

  function onLogButtonClicked () {
    my.selectLog()
  }

  my.init = function () {
    simSpeedInput.addEventListener('change', onSimSpeedChanged)
    simSpeedInput.addEventListener('input', onSimSpeedChanged)
    playPauseButton.addEventListener('click', onPlayPauseButtonClicked)
    resetButton.addEventListener('click', onResetButtonClicked)
    importButton.addEventListener('click', onImportButtonClicked)
    exportButton.addEventListener('click', onExportButtonClicked)
    classesButton.addEventListener('click', onClassesButtonClicked)
    helpButton.addEventListener('click', onHelpButtonClicked)
    aboutButton.addEventListener('click', onAboutButtonClicked)
    logButton.addEventListener('click', onLogButtonClicked)
    importStartButton.addEventListener('click', onStartImportButtonClicked)
    importFileDropArea.addEventListener('drop', onDropFile)
    window.addEventListener('dragover', function (e) {
      e = e || event /* eslint-disable-line no-undef */
      e.preventDefault()
    }, false)
    window.addEventListener('drop', function (e) {
      e = e || event /* eslint-disable-line no-undef */
      e.preventDefault()
    }, false)
    document.addEventListener('keydown', onKeyDown)
  }

  return my
})()
