const { sendCommand } = require('./commandHandler');
const { readResponse } = require('./responseReader');
const { commandTimeout, commandInterval, responseCheckInterval } = require('../config');

function start() {
  setInterval(() => {
    sendCommand('getBalance', commandTimeout);
  }, commandInterval);

  setInterval(readResponse, responseCheckInterval);
}

module.exports = { start };
