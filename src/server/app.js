'use strict'

/* ------------------------------ Requirements ------------------------------ */

// Use dotenv for environmental variables if not in production.
// Allows developer to use a different database
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

// Import dependencies such as: express
const express = require('express') // web framework for node.js applications
const path = require('path')
const http = require('http')
const flash = require('express-flash')
const session = require('express-session')

/* ----------------------------- Initial Setup ----------------------------- */

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(flash())
app.use(session({
  secret: process.env.SESSION_ID,
  resave: false,
  saveUninitialized: false
}))
app.use(express.static(path.join(__dirname, '..', 'public')))
const server = http.createServer(app)

const db = require('./database-service')
var cookie = require("cookie")


/* ---------------------------- Set up Routes ------------------------------ */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'views', 'loader.html'))
})

app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'views', 'homepage.html'))
})

app.get('/search', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'views', 'searchPage.html'))
})

app.get('/parkingLot', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'views', 'parkingLot.html'))
})

/* ------------- Save userID/FID as a cookie to be used later -------------- */
app.post('/save-userID-cookie', function (req,res) {
  const userID = req.body.userID
    let cookies = cookie.parse(`userID=${userID}`);
    res.setHeader('Set-Cookie', cookie.serialize('userID', String(userID)))
    res.statusCode = 302;
    res.setHeader('Location', req.headers.referer || '/');
    res.end();
    return;
  })

/* ---------- Set up Websockets to retrieve data from iot devices ---------- */ 
const WebSocket = require('ws');
const EventHubReader = require('./event-hub-reader.js');

const iotHubConnectionString = process.env.IOTHUB_CON_STRING;
if (!iotHubConnectionString) {
  console.error(`Environment variable IotHubConnectionString must be specified.`);
  return;
}
const eventHubConsumerGroup = process.env.EVENTHUB_CONSUMER
if (!eventHubConsumerGroup) {
  console.error(`Environment variable EventHubConsumerGroup must be specified.`);
  return;
}

const wss = new WebSocket.Server({ server });

wss.broadcast = (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(data);
      } catch (e) {
        console.error(e);
      }
    }
  });
};

const eventHubReader = new EventHubReader(iotHubConnectionString, eventHubConsumerGroup);

(async () => {
  await eventHubReader.startReadMessage((message, date, deviceId) => {
    try {
      const payload = {
        IotData: message,
        MessageDate: date || Date.now().toISOString(),
        DeviceId: deviceId,
      };

      wss.broadcast(JSON.stringify(payload));
    } catch (err) {
      console.error('Error broadcasting: [%s] from [%s].', err, message);
    }
  });
})().catch();

/* ------------- Retrieve the parking space linked to a particular iot device ------------------ */
app.get('/retrieve-device-lot-space', function (req,res) {
  // retrieve the message data
  const message = req.query.device
  db.pools
    // Run query
    .then((pool) => {
      return pool.request()
      .input('deviceID', db.sql.Char, message)
        .query(`
        SELECT space_ID, Lot_ID
        FROM devices 
        WHERE device_ID = (@deviceID)   
        `)
    })
    // Send back the result
    .then(result => {
      res.send(result)
    })
    // If there's an error, return that with some description
    .catch(err => {
      res.send({
        Error: err
      })
    })
})

/* ----------------- Record the updated status of a parking space ---------------- */
app.post('/record-availability', function (req,res) {
  // retrieve the message data
  const message = req.body
  const DBN = message.Lot_ID
    // Make a query to the database
    db.pools
    // Run query
    .then((pool) => {
      return pool.request()
        .input('status', db.sql.Char, message.Availability)
        .input('spaceID', db.sql.Char, message.space_ID)
        .query(`
          UPDATE dbo.${DBN}
          SET status = (@status)
          WHERE space_id = (@spaceID);
        `)
    })
    // Send back the result
    .then(result => {
      res.send(result)
    })
    // If there's an error, return that with some description
    .catch(err => {
      res.send({
        Error: err
      })
    })
})

/* -------------------------- Record Reservation --------------------------------- */
app.post('/record-reservation', function (req,res) {
  // Retrieve the message data
  const message = req.body
    // Make a query to the database
    db.pools
    // Run query
    .then((pool) => {
      return pool.request()
        .input('user_ID', db.sql.Char, message.user_ID)
        .input('spaceID', db.sql.Char, message.space_ID)
        .input('time_created', db.sql.DateTimeOffset, message.time_created)
        .input('LotID', db.sql.Char, message.Lot_ID)
        .query(`
        INSERT INTO Reservations (user_ID, time_created, time_updated, Lot_ID, space_ID)
        VALUES ((@user_ID),(@time_created),(@time_created),(@LotID), (@spaceID))
        `
        )
    })
    // Send back the result
    .then(result => {
      res.send(result)
    })
    // If there's an error, return that with some description
    .catch(err => {
      res.send({
        Error: err
      })
    })
})

/* -------------------------- Delete Reservation --------------------------------- */
app.delete('/delete/:userReservationID', (request, response) => {
  const { userReservationID } = request.params
  db.pools
    .then((pool) => {
      return pool.request()
        .input('reservation_id', db.sql.Int, userReservationID)
        .query('DELETE FROM Reservations WHERE Reservations.reservation_ID = @reservation_id')
    })
    .then(result => {
      response.json({ success: result })
    })
})


/* ------------ Retrieve all parking lots (to display) ------------------------ */
app.get('/get-parking-lot-names', function (req, res) {
  // Make a query to the database
  db.pools
  // Run query
    .then((pool) => {
      return pool.request()
      // retrieve all recordsets
        .query(`SELECT *
          FROM [parking-lots]
          `
        )
    })
  // Send back the result
    .then(result => {
      res.send(result)
    })
  // If there's an error, return that with some description
    .catch(err => {
      res.send({
        Error: err
      })
    })
})

/* ------------ Retrieve single lot details using specific lot ID ------------- */
// display the the lot name (and eventually grid details) corresponding to specific ID
app.get('/get-one-lot', function (req, res) {
  // Make a query to the database
  db.pools
  // Run query
    .then((pool) => {
      return pool.request()
      // retrieve all recordsets
        .input('LotID', db.sql.Char, req.query.table)
        .query(`SELECT *
          FROM [parking-lots]
          WHERE Lot_ID = (@LotID);
          `
        )
    })
  // Send back the result
    .then(result => {
      res.send(result)
    })
  // If there's an error, return that with some description
    .catch(err => {
      res.send({
        Error: err
      })
    })
})

/* Retrieve single lot parking space details using specific lot ID as the database name */
app.get('/get-parking-lot-spaces', function (req, res) {
  const DBN = req.query.table
  db.pools
    .then((pool) => {
      return pool.request()
        // .input('tableName', db.sql.Char, req.query.table)
        .query(`SELECT * 
        FROM dbo.${DBN}
        `)
    })
    .then(result => {
      res.send(result)
    })
    .catch(err => {
      res.send({
        Error: err
      })
    })
})

/* -- Retrieves only the valid reservations for the specific parking lot --- */
app.get('/get-parking-lot-reservations', function (req, res) {
  const DBN = req.query.table
  db.pools
    .then((pool) => {
      return pool.request()
        // .input('tableName', db.sql.Char, req.query.table)
        .query(`SELECT * 
        FROM Reservations
        LEFT JOIN dbo.${DBN}
        ON Reservations.space_ID = dbo.${DBN}.space_id
        WHERE Reservations.Lot_ID = '${DBN}'
        AND Reservations.time_created > DATEADD(hour, -1, GETDATE())
        `) 
    })
    .then(result => {
      res.send(result)
    })
    .catch(err => {
      res.send({
        Error: err
      })
    })
})

/* ---- Retrieves only the valid reservations for the specific user ----- */
app.get('/get-user-parking-lot-reservations', function (req, res) {
  db.pools
    .then((pool) => {
      return pool.request()
        .input('userID', db.sql.Char, req.query.userID)
        .query(`SELECT * 
        FROM Reservations
        WHERE Reservations.user_ID = @userID
        AND Reservations.time_created > DATEADD(hour, -1, GETDATE())
        `) 
    })
    .then(result => {
      res.send(result)
    })
    .catch(err => {
      res.send({
        Error: err
      })
    })
})

/* -------------------------------------------------------------------------- */

const PORT = process.env.PORT || 3000
server.listen(PORT, () => console.log(`Server running on port ${PORT}`))
