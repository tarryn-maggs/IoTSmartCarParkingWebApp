/**
 * Author: Tarryn Maggs
 * University of the Witwatersrand
 * Student number: 719597
 */

'use strict'

document.addEventListener('DOMContentLoaded', function () {
  // retrieve fid from url as: url?fid=placeFIDhere
  const { fid } = Qs.parse(location.search, { ignoreQueryPrefix: true })

  let person = null
  if (!fid) { //! fid |
    if (!document.cookie) {
      while (!person) {
        person = prompt('Please enter your userID:', 'name')
      } if (person) { recordFID(returnJSON(person)) }
    }
  } else { recordFID(returnJSON(fid)) }
  location.replace('/home')
})

/**
 * function to request the server to save the userID/FID as a cookie
 * @param {*} message a JSON object with elements: userID
 */
function recordFID (message) {
  (async () => {
    const res = await fetch('/save-userID-cookie', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    })
  })()
}

/**
 * Function to format the userID/FID into a JSON object
 * @param {string} data string containing the FID or user defined user ID
 * @returns a JSON object with element: userID
 */
function returnJSON (data) {
  return {
    userID: data
  }
}
