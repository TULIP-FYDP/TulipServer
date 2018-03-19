# About
Backend server for TULIP FYDP

## Installation
```bash
git clone https://github.com/TULIP-FYDP/TulipServer.git
cd TulipServer
npm install
```

## Execution
```bash
node index.js
```

# API
Websocket API located at `ws://<host_address>:8080`. Accepts JSON serialized messages.


## Supported Incoming Messages (Received by Server)

### tagUpdate
For forwarding messages received from TULIP Tags.
```JSON
{
  "type":"tagUpdate",
  "message":string_encoded_message_from_tag,
  "id":tag_id
}

{
  "type":"tagUpdate",
  "message":"00010032e6cc40",
  "id":"tag1"
}
```

### tagInsert
To insert tag points into the map.
```JSON
{
  "type":"tagInsert",
  "id":tag_id,
  "x":tag_x,
  "y":tag_y
}

{
  "type":"tagInsert",
  "id":"test_tag",
  "x":1,
  "y":2
}
```

### reset
To reset the server states.
```JSON
{
  "type":"reset"
}
```

### query
To query the server states without causing changes/
```JSON
{
  "type":"query"
}
```

## Supported Outgoing Messages (Sent by Server)
Upon received a valid message the server responds with the current tag and anchor states encoded into a single JSON response.

```JSON
{
  "anchor_states":{
    "0001":{
      "x":0,
      "y":0,
      "active":false
    },
    "0002":{
      "x":0,
      "y":20,
      "active":true
    },
    "0003":{
      "x":20,
      "y":0,
      "active":true
    },
    "0004":{
      "x":20,
      "y":20,
      "active":true
    }
  },
  "tag_states":{
    "tag1":{
      "ranges":{
        "0001":null,
        "0003":16.763099670410156,
        "0002":15.524200439453125,
        "0004":21.931699752807617
      },
      "x":4.000033630925373,
      "y":5.000051412820085
    }
  }
}
```
