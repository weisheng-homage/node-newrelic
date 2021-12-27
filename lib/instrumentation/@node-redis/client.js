/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = function initialize(agent, redis, moduleName, shim) {
  shim.setDatastore(shim.REDIS)
  const commandsQueue = shim.require('dist/lib/client/commands-queue.js')
  const createClient = redis.createClient
  redis.createClient = shim.bindSegment(function wrappedCreateClient(port, host) {
    shim.captureInstanceAttributes(host, port, `${host}:${port}`)
    return createClient.call(redis, port, host)
  })
  shim.recordOperation(
    commandsQueue.default.prototype,
    'addCommand',
    function wrapCommand(shim, fn, fnName, args) {
      const [cmdName, ...cmdArgs] = args[0]
      const [key, value] = cmdArgs
      const parameters = {}
      if (agent.config.attributes.enabled) {
        if (key) {
          parameters.key = JSON.stringify(key)
        }
        if (value) {
          parameters.value = JSON.stringify(value)
        }
      }
      return {
        name: cmdName.toLowerCase() || 'other',
        parameters,
        promise: true
      }
    }
  )
}
