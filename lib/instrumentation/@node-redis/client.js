/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = function initialize(agent, redis, moduleName, shim) {
  shim.setDatastore(shim.REDIS)
  const commandsQueue = shim.require('dist/lib/client/commands-queue.js')

  let clientOptions = {}
  shim.wrap(redis, 'createClient', function wrapCreateClient(shim, original) {
    return function wrappedCreateClient() {
      const client = original.apply(this, arguments)
      // save reference of client options to be used in addCommand
      // NOTE: this will not work if you instantiate different clients
      clientOptions = getRedisParams(client.options)
      return client
    }
  })

  shim.recordOperation(
    commandsQueue.default.prototype,
    'addCommand',
    function wrapAddCommand(shim, fn, fnName, args) {
      const [cmdName, ...cmdArgs] = args[0]
      const [key, value] = cmdArgs
      const parameters = Object.assign({}, clientOptions)
      // If selecting a database, subsequent commands
      // will be using said database, update the clientOptions
      // but not the current parameters(feature parity with v3)
      if (cmdName === 'SELECT') {
        clientOptions.database_name = key
      }
      if (agent.config.attributes.enabled) {
        if (key) {
          parameters.key = JSON.stringify(key)
        }
        if (value) {
          parameters.value = JSON.stringify(value)
        }
      }
      return {
        name: (cmdName && cmdName.toLowerCase()) || 'other',
        parameters,
        promise: true
      }
    }
  )

  /**
   * Extracts the datastore parameters from the client options
   *
   * @param {object} opts client.options
   * @returns {object} params
   */
  function getRedisParams(opts) {
    return {
      host: (opts.socket && opts.socket.host) || 'localhost',
      port_path_or_id: (opts.socket && opts.socket.path) || opts.socket.port || '6379',
      database_name: opts.database || 0
    }
  }
}
