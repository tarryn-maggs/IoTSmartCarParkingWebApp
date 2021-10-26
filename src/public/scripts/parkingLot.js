/**
 * Author: Tarryn Maggs
 * University of the Witwatersrand
 * Student number: 719597
 */

'use strict'

const { lot } = Qs.parse(location.search, {
  ignoreQueryPrefix: true
})

let userID = null

// Defines how many columns and rows are in the grid format indicating the available
// parking spaces
let tableColumns = null
let tableRows = null

// User reservation Information
let user_reserved = false // default is set to no reservation
let userSpaceID = 0 // default 'reservation' space is set to 0 - which does not exist
let userReservationID = null // default is no reservation, therefore no reservation ID

// variable to hold the number of reserved spaces
let numReserved = 0

// User selection information
let selected = false // default is no selection
let space_selected = 0 // default 'selection' space is set to 0 - which does not exist

// constant to store the reservation button element
const reservationBut = document.getElementById('reservationButton')

// constant to store the 'delete my reservation' button element
const reservationDeleteButton = document.getElementById('reservationDeleteButton')

document.addEventListener('DOMContentLoaded', () => {
  // Get the Lot specific details
  fetch(`/get-one-lot?table=${lot}`)
    .then(response => response.json())
    .then(data => {
      const lotName = data.recordset[0].Name
      document.getElementById('group-name').innerHTML = `${lotName}`
      // retrieve the number of columns in the lot grid
      tableColumns = data.recordset[0].numColumns
      // retrieve the number of rows in the lot grid
      tableRows = data.recordset[0].numRows
      // loads the table indicating the available and reserved parking spaces
      loadTable(tableRows, tableColumns)
    })
  userID = document.cookie
    .split('; ')
    .find(row => row.startsWith('userID='))
    .split('=')[1]

  /* ---------------------------------- Web Socket initialisation ------------------------ */
  /* eslint-disable max-classes-per-file */
  /* eslint-disable no-restricted-globals */
  /* eslint-disable no-undef */

  // Initialise websocket to retrieve data from parking lot iot devices
  // for the websocket protocol - if deployed to a site supporting SSL, then use wss://
  const protocol = document.location.protocol.startsWith('https') ? 'wss://' : 'ws://'
  const webSocket = new WebSocket(protocol + location.host)
  webSocket.onmessage = function onMessage (message) {
    try {
      const messageData = JSON.parse(message.data)
      // when a message is received, the status of the parking space is updated in the
      // database table
      updateStatus(messageData.DeviceId, messageData.IotData.Availability)
    } catch (err) {
      console.error(err)
    }
  }
})

/**
 * Load the Table of available/taken spaces
 * @param {*} numRows The number of rows in the parking lot grid (can be null)
 * @param {*} numColumns The number of columns in the parking lot grid (can be null)
 */
function loadTable (numRows, numColumns) {
  // Retrieve the available/taken status from the specific parking-lot table
  fetch(`/get-parking-lot-spaces?table=${lot}`)
    .then(response => response.json())
    .then(data => {
      const dataStore = data
      // Retrieve the reservations from the reservation table
      fetch(`/get-parking-lot-reservations?table=${lot}`)
        .then(response => response.json())
        .then(data => {
          // if there is no data for the number of rows or columns in the parking-lots
          // database, then populate as a list
          if (!numRows || !numColumns) {
            // first load the list then load the reservations
            loadHTMLTable(dataStore)
              .then(() =>
                rewriteHTMLwithRes(data)
              )
          } else {
            // first load the table then load the reservations
            loadGridTable(dataStore, numRows, numColumns)
              .then(() =>
                rewriteGridwithRes(data)
              )
          }
        })
      LoadLotInfo(data)
    })
}

/**
 * Function to load the number of available/taken spaces and the number of reservations
 * @param {*} spaces a dataset JSON object with elements: status
 */
function LoadLotInfo (spaces) {
  const table = document.getElementById('availability-table')
  // a parking space is available if its status is set to '0'
  let availableNumber = 0
  let takenNumber = 0

  spaces.recordset.forEach(function ({ status }) {
    if (status == 0) {
      availableNumber++
    } else if (status == 1) {
      takenNumber++
    }
  })
  // numReserved is not being updated before this is loaded
  const trueAvailable = availableNumber - numReserved

  let tableHtml = ''
  // Available
  tableHtml += '<tr class = "table-success">'
  tableHtml += `<td data-cy='spaces-available' id='available-spaces'
                >Available Lots: ${trueAvailable}</td>`
  tableHtml += '</tr>'
  // Taken
  tableHtml += '<tr class = "table-danger">'
  tableHtml += `<td data-cy='spaces-taken' id='taken-spaces'
                >Taken Lots: ${takenNumber}</td>`
  tableHtml += '</tr>'
  // Reserved
  tableHtml += '<tr class = "table-warning">'
  tableHtml += `<td data-cy='spaces-reserved' id='reserved-spaces'
                >Reserved Lots: ${numReserved}</td>`
  tableHtml += '</tr>'
  // Selected
  tableHtml += '<tr class = "table-info">' // or "table-light" or "table-primary" or "table-default"
  tableHtml += '<td data-cy=\'space-selected\' id=\'space-selected\'>Selected Lot</td>'
  tableHtml += '</tr>'
  table.innerHTML = tableHtml
}

/**
 * Function to load the list of available/taken spaces
 * @param {*} data a dataset JSON object with elements: space_id; status
 */
function loadHTMLTable (data) {
  const table = document.getElementById('table-spaces-body')
  if (data.recordset.length === 0) {
    table.innerHTML = "<tr><td class='no-data' colspan='2'>No meetings</td></tr>"
    return
  }

  let headings = ''
  headings += '<thead>'
  headings += '<th>Space ID</th>'
  headings += '<th>Availability</th>'
  headings += '</thead>'

  let tableHtml = ''
  tableHtml += headings
  let statusVariable = ''

  data.recordset.forEach(function ({ space_id, status }) {
    if (status == 0) {
      statusVariable = 'Available'
      tableHtml += '<tr class = "table-success">'
    } else if (status == 1) {
      statusVariable = 'Taken'
      tableHtml += '<tr class="table-danger">'
    }
    tableHtml += `<td data-cy='space-id-${space_id}' id='${space_id}-space-id' 
                  onclick='selectSpaceList(${space_id}, ${status})'>${space_id}</td>`

    tableHtml += `<td data-cy='space-status-${space_id}' id='${space_id}-space-status' 
                  onclick='selectSpaceList(${space_id}, ${status})'>${statusVariable}</td>`
    tableHtml += '</tr>'
  })
  table.innerHTML = tableHtml

  return new Promise(resolve => setTimeout(resolve, 250))
}

/**
 * Function used when clicking on (selecting) a list element
 * @param {*} spaceID integer indicating the parking space ID
 * @param {*} status bit value (boolean) indicating whether the parking space is taken
 * or not, '0'-Available, '1'-Taken
 */
function selectSpaceList (spaceID, status) {
  // If the user already has a valid reservation then stop
  if (user_reserved) {
    window.alert('you already have a reservation')
    return
  }
  // If the space is available
  if (status == 0) {
    const space = document.getElementById(`${spaceID}-space-id`)
    const spaceStatus = document.getElementById(`${spaceID}-space-status`)
    // If there is no current selection
    if (!selected) {
      // check if the space is already reserved
      if (spaceStatus.innerHTML == 'Reserved' || space.innerHTML == 'My Reservation') {
        window.alert('This Parking space is already Reserved')
      } else {
        space_selected = spaceID
        space.setAttribute('class', 'table-info')
        spaceStatus.setAttribute('class', 'table-info')
        selected = true
        reservationBut.style.visibility = 'visible'
        reservationBut.setAttribute('onclick', `reserveSpace(${spaceID})`)
      }
    } else if (selected) {
      // unselect
      if (space_selected == spaceID) {
        space.setAttribute('class', 'table-success')
        spaceStatus.setAttribute('class', 'table-success')
        selected = false
        reservationBut.style.visibility = 'hidden'
      } else {
 window.alert(`Please click on the previous parking space to unselect it 
                              before making a new selection`) 
}
    }
  } else {
    window.alert('Please select an available parking space')
    // do nothing
  }
}

/**
 * Function to update the list of parking spaces with the reservation data
 * @param {*} data a dataset JSON object with elements: space_ID; status; reservation_ID;
 * user_ID
 */
function rewriteHTMLwithRes (data) {
  numReserved = 0
  // if there are one or less reservations returned in the dataset then exit the function
  if (data.recordset.length === 0) {
    // if there is no space ID data returned whatsoever then exit
    if (!data.recordset.space_ID) {
      return
    }
    // To display a single reservation:
    // if the status of the single reservation is now taken then exit the function
    //    so that reservations are not displayed for 'taken' spaces
    if (data.recordset.status) {
      return
    }
    const space_ID = data.recordset.space_ID
    const reservedSpace = document.getElementById(`${space_ID}-space-id`)
    // check if the reservation was made by the current user
    if (data.recordset.user_ID === userID) {
      // update user reservation variables
      // the user HAS a reservation in the parking lot
      user_reserved = true
      // save the reservation ID to be used in delete reservation function
      userReservationID = data.recordset.reservation_ID
      // save the user's reserved space ID
      userSpaceID = data.recordset.space_ID
      // change the colour of the cell
      reservedSpace.setAttribute('class', 'bg-warning')
      // change the text of the cell
      reservedSpace.innerHTML = 'My Reservation'
      // increase variable to display the number of reserved spaces
      numReserved++
      return
    }
    reservedSpace.setAttribute('class', 'table-warning')
    reservedSpace.innerHTML = 'Reserved'
    numReserved++
    return
  }

  data.recordset.forEach(function ({ space_ID, status, user_ID, reservation_ID }) {
    if (status) {
      return
    }

    document.getElementById(`${space_ID}-space-id`).setAttribute('class', 'table-warning')
    const reservedSpace = document.getElementById(`${space_ID}-space-status`)
    reservedSpace.setAttribute('class', 'table-warning')
    reservedSpace.innerHTML = 'Reserved'
    numReserved++
    if (user_ID === userID) {
      user_reserved = true
      userSpaceID = space_ID
      userReservationID = reservation_ID
      reservedSpace.setAttribute('class', 'bg-warning')
      reservedSpace.innerHTML = 'My Reservation'
      setDeleteResButton()
    }
  })
  document.getElementById('reserved-spaces').innerHTML = `Reserved Lots: ${numReserved}`
}

/**
 * Function to retrieve the space and lot id of a particular device and call the
 * record status function
 * @param {string} device string indicating the specific IoT device ID
 * @param {*} available bit value (boolean) indicating whether the parking space is
 *  taken or not, '0'-Available, '1'-Taken
 */
function updateStatus (device, available) {
  fetch(`/retrieve-device-lot-space?device=${device}`)
    .then(response => response.json())
    .then(data => {
      const message = formatMessage(data.recordset, available)

      recordStatus(message)
      if (message.Availability === 1 && message.space_ID === userSpaceID && message.Lot_ID.trim() === lot.trim()) {
        removeReservation()
        window.alert(`Your reserved parking space has been occupied, if this wasn't 
        you please make a new reservation.`)
      }
    })
}

/**
 * Function to format the record status message
 * @param {*} dataset a dataset JSON object with elements: space_ID; Lot_ID
 * @param {*} available bit value (boolean) indicating whether the parking space is
 * taken or not, '0'-Available, '1'-Taken
 * @returns a JSON object with elements: space_ID; Availability; Lot_ID
 */
function formatMessage (dataset, available) {
  return {
    space_ID: dataset[0].space_ID,
    Availability: available,
    Lot_ID: dataset[0].Lot_ID
  }
}

/**
 * Function to record (update) the status of a particular parking space and reload the table
 * @param {JSON} message a JSON object containing the elements: space_ID; Availability; Lot_ID
 */
function recordStatus (message) {
  (async () => {
    const res = await fetch('/record-availability', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    })
    loadTable(tableRows, tableColumns)
  })()
}

/**
 * Function to set the attributes of the delete reservation button
 */
function setDeleteResButton () {
  reservationDeleteButton.style.visibility = 'visible'
  reservationDeleteButton.setAttribute('onclick', 'removeReservation()')
}

/**
 * Function to delete the reservation corresponding to the user's current reservation ID
 */
function removeReservation () {
  fetch('/delete/' + userReservationID, {
    method: 'DELETE'
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        location.reload()
      }
    })
}

/**
 * function to load the format of the parking grid and call the function to update the
 * status of the parking spaces
 * @param {*} data a JSON dataset object containing the elements: space_id; status;
 * rowNum; colNum
 * @param {*} numRows The number of rows in the parking lot grid (can be null)
 * @param {*} numColumns The number of columns in the parking lot grid (can be null)
 * @returns promise after a timeout (to ensure correct order)
 */
function loadGridTable (data, numRows, numColumns) {
  const table = document.getElementById('table-spaces-body')

  let tableHtml = ''
  let i = 0
  let j = 0
  for (i = 0; i < numRows; i++) {
    tableHtml += '<tr>'
    for (j = 0; j < numColumns; j++) {
      tableHtml += `<td style="height:100.0px;width:50.0px" id='space-position-${i}-${j}'>
                    </td>`
    }
    tableHtml += '</tr>'
  }
  table.innerHTML = tableHtml
  updateSpaces(data)
  return new Promise(resolve => setTimeout(resolve, 250))
}

/**
 * Function to update the status of the individual parking spaces in the parking grid
 * @param {*} data a JSON dataset object containing the elements: space_id; status; rowNum;
 * colNum
 */
function updateSpaces (data) {
  data.recordset.forEach(function ({ space_id, status, rowNum, colNum }) {
    const space = document.getElementById(`space-position-${rowNum}-${colNum}`)

    if (status == 0) {
      space.setAttribute('class', 'table-success')
    } else if (status == 1) {
      space.setAttribute('class', 'table-danger')
    }
    space.innerText = `${space_id}`
    space.setAttribute('onclick', `selectSpace(${space_id}, ${rowNum}, ${colNum}, 
        ${status})`)
  })
}

/**
 * Function to populate the parking grid with the valid reservations
 * @param {*} data a JSON dataset object containing the elements:  status; rowNum; colNum;
 * user_ID; space_ID; reservation_ID. The query will only return reservations that were made
 * in the last hour
 */
function rewriteGridwithRes (data) {
  numReserved = 0
  if (data.recordset.length === 0) {
    const rowNum = data.recordset.rowNum
    const colNum = data.recordset.colNum
    // if no data (no reservations)
    if (!rowNum) { return }
    // if there is only one reservation
    if (data.recordset.status) {
      return
    }
    const reservedSpace = document.getElementById(`space-position-${rowNum}-${colNum}`)
    if (data.recordset.user_ID === userID) {
      user_reserved = true
      userReservationID = data.recordset.reservation_ID
      userSpaceID = data.recordset.space_ID
      reservedSpace.setAttribute('class', 'bg-warning')
      reservedSpace.innerHTML = 'My Reservation'
      setDeleteResButton()
      numReserved++
      return
    }
    reservedSpace.setAttribute('class', 'table-warning')
    reservedSpace.innerHTML = 'Reserved'
    numReserved++
    return
  }

  // if there are many reservations
  data.recordset.forEach(function ({ status, rowNum, colNum, user_ID, space_ID, reservation_ID }) {
    // rewrite only available spaces with reservation data
    if (!status) {
      const reservedSpace = document.getElementById(`space-position-${rowNum}-${colNum}`)
      reservedSpace.setAttribute('class', 'table-warning')
      reservedSpace.innerHTML = 'Reserved'
      numReserved++
      if (user_ID === userID) {
        user_reserved = true
        userReservationID = reservation_ID
        userSpaceID = space_ID
        reservedSpace.setAttribute('class', 'bg-warning')
        reservedSpace.innerHTML = 'My Reservation'
        setDeleteResButton()
      }
    }
  })
  document.getElementById('reserved-spaces').innerHTML = `Reserved Lots: ${numReserved}`
}

/**
 * function used when clicking on (selecting) a grid element
 * @param {*} spaceID the space ID of the element being selected
 * @param {*} rowNum  the row number that the element exists in
 * @param {*} colNum the column number that the element exists in
 * @param {*} status bit value (boolean) indicating whether the parking space is taken
 *  or not, '0'-Available, '1'-Taken
 */
function selectSpace (spaceID, rowNum, colNum, status) {
  // If the user already has a valid reservation then stop
  if (user_reserved) {
    window.alert('you already have a reservation')
    return
  }
  // If the space is available
  if (status == 0) {
    const space = document.getElementById(`space-position-${rowNum}-${colNum}`)
    // If there is no current selection
    if (!selected) {
      // check if the space is already reserved
      if (space.innerHTML == 'Reserved' || space.innerHTML == 'My Reservation') {
        window.alert('This Parking space is already Reserved')
      } else {
        space_selected = spaceID
        space.setAttribute('class', 'table-info')
        selected = true
        reservationBut.style.visibility = 'visible'
        reservationBut.setAttribute('onclick', `reserveSpace(${spaceID})`)
      }
    } else if (selected) {
      // unselect
      if (space_selected == spaceID) {
        space.setAttribute('class', 'table-success')
        selected = false
        reservationBut.style.visibility = 'hidden'
      } else {
        window.alert(`Please click on the previous parking space to unselect 
                it before making a new selection`)
      }
    }
  } else {
    window.alert('Please select an available parking space')
    // do nothing
  }
}

/**
 * Function to send the formatted reservation message to the post function to record the message
 * @param {*} spaceID the space ID of the selected parking space
 */
function reserveSpace (spaceID) {
  const time_created = moment().format() // moment(new Date()).format('ddd, DD MMM YYYY HH:mm')
  // if the userID is undefined
  if (!userID) {
    if (window.confirm(`You cannot make a reservation without a userID, would you like to go 
                        back to make one?`)) {
      location.replace('/')
    } else {
      //
      return
    }
  }
  const message = formatReservationMessage(userID, spaceID, time_created)
  recordReserve(message)
  reservationBut.style.visibility = 'hidden'
}

/**
 * Function to format the reservation message into a JSON object
 * @param {*} user_ID user ID of the current user
 * @param {*} spaceID parking space ID of the requested reservation
 * @param {*} time_created the time the reservation was requested
 * @returns JSON object
 */
function formatReservationMessage (user_ID, spaceID, time_created) {
  return {
    user_ID: user_ID,
    space_ID: spaceID,
    Lot_ID: lot,
    time_created: time_created
  }
}

/**
 * Function to post (record) the reservation message in the database
 * @param {*} message a JSON object containing the elements:  user_ID; space_ID; Lot_ID;
 * time_created
 */
function recordReserve (message) {
  (async () => {
    const res = await fetch('/record-reservation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    })
    loadTable(tableRows, tableColumns)
  })()
}
