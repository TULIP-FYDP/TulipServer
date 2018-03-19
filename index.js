// Library Imports
const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const math = require('mathjs')
const url = require('url');

// initialize anchor states
// anchor at (0,0) is OPTIONAL
anchor_states = {
  '0001': {'x':  0, 'y': 0, 'active':false},
  '0002': {'x':  0, 'y':20, 'active':false},
  '0003': {'x': 20, 'y': 0, 'active':false},
  '0004': {'x': 20, 'y':20, 'active':false}
}

tag_states = {}


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
      tag_states[tagID]['ranges'][anchor_id] = range
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
  update_tag_location(tagID)
}


// update tag X, Y position
function update_tag_location(tagID) {

  let origin_distance = NaN
  let origin_x = NaN
  let origin_y = NaN

  let H = []
  let b = []

  for (anchor in anchor_states) {
    let current_distance = tag_states[tagID]['ranges'][anchor]

    if (isNaN(current_distance)) {
      console.log('skipping ' + anchor)
      continue
    }

    if (isNaN(origin_distance)) {
      console.log('Assigning Origin Anchor: ' + anchor)
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

// initialize networking
const app = express();
app.get('/', (req, res) => res.send('Relay Server Running'))
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(data) {

    // print timestamped message on receive
    console.log(Date() + ' --- ' + data)

    try {
      results = JSON.parse(data)
      if ('type' in results) {
        if (results['type'] = 'tagUpdate') {
          onTagUpdateMessage(
            results['id'],
            results['message']
          )

          console.log(anchor_states)
          console.log(tag_states)

          wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                'anchor_states': anchor_states,
                'tag_states': tag_states
              }))
            }
          })

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
