/**
 * Author: Tarryn Maggs
 * University of the Witwatersrand
 * Student number: 719597
 */

'use strict'

let userID = null
// array of lot IDs
const lotReservations = []
// define variable to determine text and action for the 'view reservations' tab
let alreadyViewed = false

document.addEventListener('DOMContentLoaded', function () {
  // retrieve the userID from the website cookies
  if (document.cookie) {
    userID = document.cookie
      .split('; ')
      .find(row => row.startsWith('userID='))
      .split('=')[1]
  }


  fetch(`/get-user-parking-lot-reservations?userID=${userID}`)
    .then(response => response.json())
    .then(data => {
      createReservationsList(data)
    }
    )
})

const viewRes = document.getElementById('myReservations')
const viewResBut = document.getElementById('view-res-but')

/**
 * Function to populate the lotReservations array
 * @param {*} data dataset JSON object with element: Lot_ID
 */
function createReservationsList (data) {
  if (data.recordset.length === 0) { // || !data.recordset.reservation_ID) {
    viewResBut.innerHTML = 'You have no current Reservations'
    return
  }
  viewResBut.setAttribute('onclick', 'viewReservations()')
  data.recordset.forEach(function ({ Lot_ID }) {
    lotReservations.push(`${Lot_ID.trim()}`)
  })
}

/**
 * Function to load the reservation names from the array of Lot IDs
 */
function viewReservations () {
  removePlace(viewRes)
  if (!alreadyViewed) {
    lotReservations.forEach(function (LotID) {
      fetch(`/get-one-lot?table=${LotID}`)
        .then(response => response.json())
        .then(data => {
          const lotName = data.recordset[0].Name
          const a = document.createElement('a')
          a.setAttribute('class', 'list-group-item list-group-item-action list-group-item-light p-3')

          a.setAttribute('href', `/parkingLot?lot=${LotID}`)
          a.innerHTML = lotName
          viewRes.appendChild(a)
        })
    })
    alreadyViewed = true
    viewResBut.innerHTML = 'Hide my Reservation/s'
  } else {
    alreadyViewed = false
    viewResBut.innerHTML = 'View my reservation/s'
  }
}

/**
 * function to remove the child nodes from an HTML div object
 * @param {*} placeDiv HTML div object
 */
function removePlace (placeDiv) {
  while (placeDiv.hasChildNodes()) {
    placeDiv.removeChild(placeDiv.lastChild)
  }
}
