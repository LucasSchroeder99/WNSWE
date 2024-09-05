import ast
import asyncio
import enum
import inspect
import js
import json
import keyword
import types
import traceback
import bisect
import sys

class Color(enum.StrEnum):
    Black = "#000000"
    White = "#FFFFFF"
    LightGray = "#BACDD0"
    LightBlue = "#7DBCE8"
    LightCyan = "#7FE3E2"
    LightGreen = "#91DD78"
    LightYellow = "#F2E27F"
    LightOrange = "#FDC48D"
    LightRed = "#FC9C9C"
    LightMagenta = "#F39CF3"
    LightPurple = "#CAACF3"
    LightBrown = "#D9B8A4"
    Gray = "#7B8E95"
    Blue = "#557DC4"
    Cyan = "#2C99B2"
    Green = "#22A56E"
    Yellow = "#E3AC43"
    Orange = "#DD7440"
    Red = "#D35757"
    Magenta = "#BA56D5"
    Purple = "#9472E6"
    Brown = "#B37C67"
    DarkGray = "#485B68"
    DarkBlue = "#3F4481"
    DarkCyan = "#206480"
    DarkGreen = "#166953"
    DarkYellow = "#B26E28"
    DarkOrange = "#9D4424"
    DarkRed = "#922D37"
    DarkMagenta = "#713075"
    DarkPurple = "#6030A1"
    DarkBrown = "#81524B"


class BaseMessage:
    def __init__(self, data):
        self.data = data
        self._sender = None
        self._receiver = None
        self.sent_timestamp = None
        self.color = "white"
        self.speed = 1.0

class Endpoint:
    def __init__(self):
        self._neighbors = []
        self._receive_queue = asyncio.Queue()
        self._uuid = "tbd"
        self._connection_flag = asyncio.Event()
        self._connection_hotstart_suppressed = False

    @property
    def display_name(self):
        return _js_get_node_name(self._uuid)

    @display_name.setter
    def display_name(self, new_name):
        _js_set_node_name(self._uuid, new_name)

    @property
    def color(self):
        return _js_get_node_color(self._uuid)

    @color.setter
    def color(self, new_color):
        _js_set_node_color(self._uuid, new_color)

    def print(self, *objects, sep=" ", end="\n", file=None, flush=False):
        _js_output(self._uuid, sep.join([str(obj) for obj in objects])+end)

    async def send(self, neighbor_uuid, data, message_class=BaseMessage):
        for neighbor in self._neighbors:
            if neighbor._uuid == neighbor_uuid:
                break
        else:
            raise ConnectionError(f"No connected node '{neighbor_uuid}'")
        if isinstance(message_class, BaseMessage):
            message_class = message_class.__class__
        msg_obj = message_class(data)
        color = msg_obj.color
        speed = msg_obj.speed
        msg_data = data
        if isinstance(data, Message):
            color = data.color
            speed = data.speed
            msg_data = data.data
        _send_to_js(self._uuid, neighbor_uuid, json.dumps(msg_data), color, speed, message_class.__name__)

    def get_neighbors(self):
        return [neighbor._uuid for neighbor in self._neighbors]

    async def broadcast(self, data, exclude=None, message_class=BaseMessage):
        if exclude is None:
            exclude = []
        elif isinstance(exclude, type):
            message_class = exclude
            exclude = []
        elif isinstance(exclude, BaseMessage):
            message_class = exclude.__class__
            exclude = []
        sends = []
        for neighbor in self._neighbors:
            if (neighbor._uuid in exclude) or (neighbor in exclude):
                continue
            sends.append(self.send(neighbor._uuid, data, message_class))
        await asyncio.gather(*sends)

    async def receive(self, timeout=-1):
        if timeout < 0:
            result = await self._receive_queue.get()
            _js_decrement_buffer(self._uuid)
            return result
        if timeout == 0:
            try:
                result = self._receive_queue.get_nowait()
                _js_decrement_buffer(self._uuid)
                return result
            except asyncio.QeueeEmpty:
                raise TimeoutError()
        done, pend = await asyncio.wait([asyncio.create_task(self._receive_queue.get()),
                                         asyncio.create_task(sleep(timeout))],
                                         return_when=asyncio.FIRST_COMPLETED
                                        )
        result = done.pop().result()
        for task in pend:
            task.cancel()
        if result is None:
            raise TimeoutError()
        _js_decrement_buffer(self._uuid)
        return result

    def parallel(self, thing):
        if inspect.isawaitable(thing):
            async def parallel_run(self, thing):
                try:
                    await thing
                except:
                    self.print(traceback.format_exc())
            asyncio.create_task(parallel_run(self, thing))
        elif inspect.iscoroutinefunction(thing):
            async def parallel_run(self, thing):
                try:
                    await thing()
                except:
                    self.print(traceback.format_exc())
            asyncio.create_task(parallel_run(self, thing))
        else:
            raise RuntimeError(f"{repr(thing)} is neither awaitable nor coroutine function")

    async def timeout(self, thing, timeout):
        if inspect.isawaitable(thing):
            async def parallel_run(self, thing):
                try:
                    await thing
                except asyncio.exceptions.CancelledError:
                    pass
                except:
                    self.print(traceback.format_exc())
        elif inspect.iscoroutinefunction(thing):
            async def parallel_run(self, thing):
                try:
                    await thing()
                except asyncio.exceptions.CancelledError:
                    pass
                except:
                    self.print(traceback.format_exc())
        else:
            raise RuntimeError(f"{repr(thing)} is neither awaitable nor coroutine function")
        done, pend = await asyncio.wait([asyncio.create_task(parallel_run(self, thing)),
                                         asyncio.create_task(sleep(timeout))],
                                         return_when=asyncio.FIRST_COMPLETED
                                        )
        result = done.pop().result()
        for task in pend:
            task.cancel()
        if result is None:
            raise TimeoutError()
        return result

    def _receive_actual(self, message, sender):
        self._receive_queue.put_nowait((message, sender._uuid))

    def _add_neighbor(self, neighbor):
        if neighbor in self._neighbors:
            return
        self._neighbors.append(neighbor)
        if not self._connection_hotstart_suppressed:
            self._connection_flag.set()

    def _remove_neighbor(self, neighbor):
        if neighbor not in self._neighbors:
            return
        self._neighbors.remove(neighbor)

    async def _run(self):
        pass

    async def _hot_start(self):
        await self._connection_flag.wait()
        await self._run()

    async def _suppress_connection_hotstart(self, value):
        self._connection_hotstart_suppressed = value

class _SimTime:
    def __init__(self):
        self.time = 0.0
        self.timers = []
    async def process(self, delta):
        self.time += delta/1000.0
        while self.timers and self.timers[0][0] < self.time:
            _, callback = self.timers.pop(0)
            await callback()
    def set_timer(self, time, callback):
        bisect.insort(self.timers, (self.time+time, callback), key=lambda x: x[0])

SIM_TIME = _SimTime()

async def _process(delta):
    await SIM_TIME.process(delta)

async def sleep(time):
    temp_queue = asyncio.Queue()
    async def callback():
        await temp_queue.put(1)
    SIM_TIME.set_timer(time, callback)
    await temp_queue.get()

_nodes = {}
_tasks = {}

def _add_node(uuid, class_name):
    _nodes[uuid] = globals().get(class_name, Endpoint)()
    _nodes[uuid]._uuid = uuid

def _delete_node(uuid):
    if uuid not in _nodes:
        return
    del _nodes[uuid]

def _receive(sender_uuid, receiver_uuid, message_color, message_speed, message_sent_timestamp, message_data_json, class_name):
    receiver = _nodes.get(receiver_uuid, None)
    if receiver is None:
        return
    sender = _nodes.get(sender_uuid, None)
    msg_obj = globals().get(class_name, BaseMessage)(json.loads(message_data_json))
    msg_obj.sender = sender
    msg_obj.receiver = receiver
    msg_obj.color = message_color
    msg_obj.speed = message_speed
    msg_obj.sent_timestamp = message_sent_timestamp
    receiver._receive_actual(msg_obj, sender)

RUNNING = False

async def _reset():
    global _nodes, _tasks, RUNNING
    for task in _tasks.values():
        task.cancel()
    RUNNING = False
    _nodes = {}
    _tasks = {}

def _connect(n1_uuid, n2_uuid):
    n1 = _nodes[n1_uuid]
    n2 = _nodes[n2_uuid]
    n1._add_neighbor(n2)
    n2._add_neighbor(n1)

def _disconnect(n1_uuid, n2_uuid):
    if n1_uuid not in _nodes or n2_uuid not in _nodes:
        return
    n1 = _nodes[n1_uuid]
    n2 = _nodes[n2_uuid]
    n1._remove_neighbor(n2)
    n2._remove_neighbor(n1)

async def _start():
    global SIM_TIME, RUNNING
    SIM_TIME = _SimTime()
    RUNNING = True
    for node_uuid, node in _nodes.items():
        _tasks[node_uuid] = asyncio.create_task(node._run())
    for task in _tasks.values():
        await task

def _rename_node(uuid, display_name):
    n = _nodes.get(uuid, None)
    if n is not None:
        n.display_name = display_name

def get_node_name(uuid_or_node):
    if isinstance(uuid_or_node, Endpoint):
        return uuid_or_node.display_name
    n = _nodes.get(uuid_or_node, None)
    if n is None:
        raise KeyError
    return n.display_name

def get_time():
    return _js_get_sim_time()/1000.0

async def run(self):
    pass

async def _add_run_method(node_uuid):
    print(run)
    inner_run = run
    async def inner(self):
        try:
            await inner_run(self)
        except Exception as e:
            exception_full = traceback.format_exc()
            exception_short = traceback.format_exception_only(e)[0]
            _js_output_exception(node_uuid, exception_full, exception_short)
    _nodes[node_uuid]._run = types.MethodType(inner, _nodes[node_uuid])
    if RUNNING:
        print("hot starting!!!")
        _tasks[node_uuid] = asyncio.create_task(_nodes[node_uuid]._hot_start())
        await _tasks[node_uuid]

def _node_suppress_connection_hotstart(node_uuid, value):
    _nodes[node_uuid]._suppress_connection_hotstart(value)

def _node_trigger_connection_hotstart(node_uuid):
    _nodes[node_uuid]._connection_flag.set()

def _class_name_check(name):
    return bool(name.isidentifier() and not keyword.iskeyword(name))

class _RunMethodChecker(ast.NodeVisitor):
    def __init__(self):
        super().__init__()
        self.run_method_found = False
        self.ok = False
        self.comment = ""
    def visit(self, node):
        if isinstance(node, ast.AsyncFunctionDef) and node.name == "run":
            self.run_method_found = True
            self.ok = True
        if isinstance(node, ast.FunctionDef) and not isinstance(node, ast.AsyncFunctionDef) and node.name == "run":
            self.run_method_found = True
            self.ok = False
        return super().visit(node)

class _PrintChecker(ast.NodeVisitor):
    def __init__(self):
        super().__init__()
        self.warnings = []
    @property
    def ok(self):
        return not bool(self.warnings)
    def visit(self, node):
        if not isinstance(node, ast.Call):
            return super().visit(node)
        if isinstance(node.func, ast.Name) and node.func.id == "print":
            self.warnings.append({"line": node.lineno, "col": node.col_offset, "type": "print"})
        return super().visit(node)

def _code_check_actual_generic(code, filename="<exec>"):
    try:
        code_ast = ast.parse(code, filename=filename)
    except SyntaxError as e:
        tb = traceback.TracebackException.from_exception(e)
        return False, f"Line {tb.lineno}, Col {tb.offset}: {tb.exc_type.__name__} - {tb.msg}", "error"
    except RecursionError as e:
        return False, f"RecursionError because of SyntaxError", "error"
    except Exception as e:
        tb = traceback.TracebackException.from_exception(e, limit=5)
        return False, "".join(tb.format(chain=False)), "error"
    return True, code_ast, "success"

def _code_check_actual_method(ast_tree, filename="<exec>"):
    visitor = _RunMethodChecker()
    visitor.visit(ast_tree)
    if not visitor.ok:
        if visitor.run_method_found:
            return False, "The method 'run' must be async", "error"
        return False, "Expecting a method named 'run'", "error"
    visitor = _PrintChecker()
    visitor.visit(ast_tree)
    if not visitor.ok:
        warnings = []
        for warning in visitor.warnings:
            warnings.append(f"Line {warning['line']}, Col {warning['col']}: Use 'self.print()' instead of 'print'")
        return False, "\n".join(warnings), "warning"
    return True, "All good", "success"

def _code_check_actual_endpoint(ast_tree, filename="<exec>"):
    visitor = _PrintChecker()
    visitor.visit(ast_tree)
    if not visitor.ok:
        warnings = []
        for warning in visitor.warnings:
            warnings.append(f"Line {warning['line']}, Col {warning['col']}: Use 'self.print()' instead of 'print'")
        return False, "\n".join(warnings), "warning"
    return True, "All good", "success"

def _code_check_actual_message(ast_tree, filename="<exec>"):
    visitor = _PrintChecker()
    visitor.visit(ast_tree)
    if not visitor.ok:
        warnings = []
        for warning in visitor.warnings:
            warnings.append(f"Line {warning['line']}, Col {warning['col']}: Use 'self.print()' instead of 'print'")
        return False, "\n".join(warnings), "warning"
    return True, "All good", "success"

def _code_check_run(code, filename="<exec>"):
    ok, comment, comment_type = _code_check_actual_generic(code, filename)
    if not ok:
        return {"ok": False, "comment": comment, "type": comment_type}
    ast_tree = comment
    ok, comment, comment_type = _code_check_actual_method(ast_tree, filename)
    if not ok:
        return {"ok": False, "comment": comment, "type": comment_type}
    return {"ok": True, "comment": "All good", "type": "success"}

def _code_check_node(code, filename="<exec>"):
    ok, comment, comment_type = _code_check_actual_generic(code, filename)
    if not ok:
        return {"ok": False, "comment": comment, "type": comment_type}
    ast_tree = comment
    ok, comment, comment_type = _code_check_actual_endpoint(ast_tree, filename)
    if not ok:
        return {"ok": False, "comment": comment, "type": comment_type}
    return {"ok": True, "comment": "All good", "type": "success"}

def _code_check_message(code, filename="<exec>"):
    ok, comment, comment_type = _code_check_actual_generic(code, filename)
    if not ok:
        return {"ok": False, "comment": comment, "type": comment_type}
    ast_tree = comment
    ok, comment, comment_type = _code_check_actual_message(ast_tree, filename)
    if not ok:
        return {"ok": False, "comment": comment, "type": comment_type}
    return {"ok": True, "comment": "All good", "type": "success"}
