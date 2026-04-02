#!/usr/bin/env python3
import subprocess
import os
import json
import configparser
import urllib.request
import websocket
from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder='.')

DISPLAY = os.environ.get('DISPLAY', ':0')
SCREEN_W = 1920
SCREEN_H = 1080
SCROLL_AMOUNT = 5
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INI_FILE = os.path.join(BASE_DIR, 'pitv.ini')
ICONS_DIR = os.path.join(BASE_DIR, 'icons')

def xdo(*args):
    env = os.environ.copy()
    env['DISPLAY'] = DISPLAY
    subprocess.run(['xdotool'] + list(args), env=env)

def load_tiles():
    config = configparser.ConfigParser()
    config.read(INI_FILE)
    tiles = []
    for section in config.sections():
        tiles.append({
            'title': section,
            'url':   config[section].get('url', ''),
            'icon':  config[section].get('icon', '')
        })
    return tiles

@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory(BASE_DIR, filename)

@app.route('/icons/<path:filename>')
def icons(filename):
    return send_from_directory(ICONS_DIR, filename)

@app.route('/tiles')
def tiles():
    return jsonify(load_tiles())

@app.route('/move', methods=['POST'])
def move():
    data = request.get_json() or {}
    dx = int(data.get('dx', 0))
    dy = int(data.get('dy', 0))
    result = subprocess.run(
        ['xdotool', 'getmouselocation'],
        capture_output=True, text=True,
        env={**os.environ, 'DISPLAY': DISPLAY}
    )
    x, y = SCREEN_W // 2, SCREEN_H // 2
    for part in result.stdout.split():
        if part.startswith('x:'):
            x = int(part[2:])
        elif part.startswith('y:'):
            y = int(part[2:])
    x = max(0, min(SCREEN_W - 1, x + dx))
    y = max(0, min(SCREEN_H - 1, y + dy))
    xdo('mousemove', str(x), str(y))
    return jsonify(ok=True)

@app.route('/click', methods=['POST'])
def click():
    data = request.get_json() or {}
    button = data.get('button', 1)
    xdo('click', str(button))
    return jsonify(ok=True)

@app.route('/scroll', methods=['POST'])
def scroll():
    data = request.get_json() or {}
    direction = data.get('direction', 'down')
    button = '5' if direction == 'down' else '4'
    for _ in range(SCROLL_AMOUNT):
        xdo('click', button)
    return jsonify(ok=True)

@app.route('/navigate', methods=['POST'])
def navigate():
    data = request.get_json() or {}
    url = data.get('url', '')
    if not url:
        return jsonify(ok=False, error='no url'), 400
    try:
        with urllib.request.urlopen('http://localhost:9222/json') as r:
            tabs = json.loads(r.read())
        ws_url = tabs[0]['webSocketDebuggerUrl']
        ws = websocket.create_connection(ws_url)
        ws.send(json.dumps({'id': 1, 'method': 'Page.navigate', 'params': {'url': url}}))
        ws.close()
    except Exception as e:
        return jsonify(ok=False, error=str(e)), 500
    return jsonify(ok=True)

@app.route('/key', methods=['POST'])
def key():
    data = request.get_json() or {}
    k = data.get('key', '')
    if k:
        xdo('key', '--clearmodifiers', k)
    return jsonify(ok=True)

@app.route('/type', methods=['POST'])
def typetext():
    data = request.get_json() or {}
    text = data.get('text', '')
    if text:
        xdo('type', '--clearmodifiers', text)
    return jsonify(ok=True)

@app.route('/volume', methods=['POST'])
def volume():
    data = request.get_json() or {}
    direction = data.get('direction', 'up')
    change = '+5%' if direction == 'up' else '-5%'
    subprocess.run(['pactl', 'set-sink-volume', '@DEFAULT_SINK@', change])
    return jsonify(ok=True)

@app.route('/shutdown', methods=['POST'])
def shutdown():
    subprocess.run(['sudo', 'poweroff'])
    return jsonify(ok=True)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
