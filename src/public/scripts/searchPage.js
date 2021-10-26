/**
 * Author: Tarryn Maggs
 * University of the Witwatersrand
 * Student number: 719597
 */

'use strict'

// create array to store all lot names and id's
let lots = []

// retrieve HTML elements
const searchLot = document.getElementById('lot-search')
const table = document.querySelector('table tbody')

// Initialise functions to start when the web page loads
document.addEventListener('DOMContentLoaded', function () {
  fetch('/get-parking-lot-names')
    .then(response => response.json())
    .then(data => {
      lots = data.recordset
      populateAllGroups(lots)
    })
})

/**
 * Enables the user to search for a particular parking lot using its registered name
 */
function entireLotSearch () {
  const searchTermLot = searchLot.value.toLowerCase()
  if (searchTermLot) {
    const matchingLots = lots.filter(g => g.Name.toLowerCase().includes(searchTermLot))
    populateAllGroups(matchingLots)
  } else { populateAllGroups(lots) }
}

/**
 * Function to populate the list of parking spaces
 * @param {*} data a JSON dataset object containing the elements: Lot_ID; Name
 */
function populateAllGroups (data) {
  if (data.length === 0) {
    table.innerHTML = "<tr><td class='no-data' colspan='1'>No Matching Lots</td></tr>"
    return
  }

  let tableHtml = ''

  data.forEach(function ({ Lot_ID, Name }) {
    Lot_ID = Lot_ID.trim()
    tableHtml += '<tr>'
    tableHtml += `<td id = '${Lot_ID}-Lot-name'><a href='/parkingLot?lot=${Lot_ID}'>${Name}</a></td>`
    tableHtml += '</tr>'
  })
  table.innerHTML = tableHtml
}
