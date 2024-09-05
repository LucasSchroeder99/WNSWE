# WNSWE

WNSWE is a purely client-side tool for simulating abstract networks of communicating nodes.

## Installation

WNSWE requires minimal setup. Here's how to test it using Python's built-in web server. Any other web server that can serve static files will also work.

1. Clone the repository
2. Navigate to the repository
3. Run `python3 -m http.server`
4. Open the website in the browser

## How to

Once the simulator has fully loaded, a sample graph will show up. You can interact with the nodes using a mouse, clicking on the nodes to check their configuration. Each node runs its own `run()`-method, which can be edited in the sidebar. For instance, replacing the default `await self.class_run()` with `await self.broadcast("Hello World!")` will make a node send a message to its neighbors, as soon as the simulation starts. Each node also is an instance of a certain class, editable via the button in the sidebar or the 'Classes' button in the header.

To start the simulation, click on 'Start' in the header. Once the simulation is running, clicking on 'Pause'/'Continue' in the header will pause/resume he simulation. It's possible to interact with the messages during the simulation, for instance to inspect their content or deleting them. Changes in the code require restarting the simulation, by clicking on 'Reset' and then on 'Start' again.

Using the 'Import' and 'Export' buttons in the header allows to load or save a scenario, which contains the network graph (nodes and connections) and the Python code. A collection of scenarios created in the context of the publication 'WNSWE: Web-based Network Simulator for Web Engineering Education' are available here: [https://zenodo.org/records/13693453](https://zenodo.org/records/13693453)

## Used libraries

- [Pyodide](https://pyodide.org/)
- [CodeMirror](https://codemirror.net/)
- [JSONEditor](https://github.com/josdejong/jsoneditor)
- [Split.js](https://split.js.org/)
