// Library Imports
const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const math = require('mathjs')
const url = require('url');

// load configuration JSON file
config = require('./config.json')
initial_anchor_states = config['initial_anchor_states']
initial_tag_states = config['initial_tag_states']

// initialize anchor states
anchor_states = Object.assign({}, initial_anchor_states)
tag_states = Object.assign({}, initial_tag_states)

// initialize networking
const app = express();
app.get('/', (req, res) => res.send('Relay Server Running'))
app.get('/state', (req, res) => res.json({
  'anchor_states':anchor_states,
  'tag_states':tag_states
}))
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });


// update tag state if tag message received
function onTagUpdateMessage(tagID, message) {
  if (!(tagID in tag_states)) {
    tag_states[tagID] = {
      'ranges':{},
      'x': NaN,
      'y': NaN
    }
  }

  let anchor_id = message.substring(0, 4)
  if (!(anchor_id in tag_states[tagID])) {
    tag_states[tagID]['ranges'][anchor_id] = NaN
  }


  let message_type = message.substring(4, 6)

  switch(message_type) {
    case '00':

      // extract range float value
      let range_hex = (
        message.substring(12,14)
        + message.substring(10,12)
        + message.substring(8,10)
        + message.substring(6,8)
      )

      let buf = new Buffer(range_hex, "hex")
      let range = buf.readFloatBE(0)

      anchor_states[anchor_id]['active'] = true
      anchor_height = anchor_states[anchor_id]['h']

      if (anchor_height >= range) {
        tag_states[tagID]['ranges'][anchor_id] = 0
      } else {
        tag_states[tagID]['ranges'][anchor_id] = Math.sqrt(
          Math.pow(range, 2)
          - Math.pow(anchor_height, 2)
        )
      }

      break

    case '01':
      console.log('Anchor Added: ' + anchor)
      anchor_states[anchor_id]['active'] = true
      break

    case '02':
      anchor_states[anchor_id]['active'] = false
      tag_states[tagID]['ranges'][anchor_id] = NaN
      console.log('Anchor Dropped: ' + anchor_id)
      break

  }

  // trigger X, Y update
  _update_tag_location(tagID)
}


// update tag X, Y position
function _update_tag_location(tagID) {

  let origin_distance = NaN
  let origin_x = NaN
  let origin_y = NaN

  let H = []
  let b = []

  for (anchor in anchor_states) {
    let current_distance = tag_states[tagID]['ranges'][anchor]

    if (isNaN(current_distance)) {
      continue
    }

    if (isNaN(origin_distance)) {
      origin_distance = current_distance
      origin_x = anchor_states[anchor]['x']
      origin_y = anchor_states[anchor]['y']
      continue
    } else {
      // distances between current anchor and origin anchor
      let x_diff = anchor_states[anchor]['x'] - origin_x
      let y_diff = anchor_states[anchor]['y'] - origin_y

      H.push([
        x_diff,
        y_diff
      ])
      b.push([0.5 * (Math.pow(x_diff, 2)
        + Math.pow(y_diff, 2)
        - Math.pow(current_distance, 2)
        + Math.pow(origin_distance, 2))
      ])

    }
  }

  // if we have 3 anchors (origin point + 2 more)
  // then triangulate
  if (math.size(H)[0] >= 2) {
    result = math.multiply(
      math.multiply(
        math.inv(
          math.multiply(
            math.transpose(H),
            H
          )
        ),
        math.transpose(H)
      ),
      b
    )

    tag_states[tagID]['x'] = result[0][0] + origin_x;
    tag_states[tagID]['y'] = result[1][0] + origin_y;
  }
}

function onTagInsertMessage(tagID, x, y) {
  tag_states[tagID] = {
    'ranges': {},
    'x': x,
    'y': y
  }
}


function _broadcastState() {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        'anchor_states': anchor_states,
        'tag_states': tag_states
      }))
    }
  })
}


wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(data) {

    // print timestamped message on receive
    console.log(Date() + ' --- ' + data)

    try {
      results = JSON.parse(data)
      if ('type' in results) {

        if (results['type'] == 'tagUpdate') {
          onTagUpdateMessage(
            results['id'],
            results['message']
          )
          _broadcastState()
        }

        if (results['type'] == 'tagInsert') {
          onTagInsertMessage(
            results['id'],
            results['x'],
            results['y']
          )
          _broadcastState()
        }

        if (results['type'] == 'reset') {
          console.log('Resetting...')
          anchor_states = Object.assign({}, initial_anchor_states)
          tag_states = Object.assign({}, initial_tag_states)
          _broadcastState()
        }

        if (results['type'] == 'query') {
          _broadcastState()
        }

      }
    } catch(err) {
      console.log('ERROR: ' + err)
    }

  })
})

server.listen(8080, function listening() {
  console.log('Listening on %d', server.address().port);
})
