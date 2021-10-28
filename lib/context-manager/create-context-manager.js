/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: A base class / interface
const logger = require('../logger')

function createContextManager(config) {
  if (config.feature_flag.new_async_context) {
    logger.info('Using AsyncLocalContextManager')
    const AsyncLocalContextManager = require('./async-local-context-manager')
    return new AsyncLocalContextManager()
  }

  logger.info('Using LegacyContextManager')
  const LegacyContextManager = require('./legacy-context-manager')
  return new LegacyContextManager()
}

module.exports = createContextManager
