/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: A base class / interface

function createContextManager(config) {
  if (config.feature_flag.new_async_context) {
    throw new Error('NotImplemented')
    // return new hotness
  } else {
    const LegacyContextManager = require('./legacy-context-manager')
    return new LegacyContextManager()
  }
}

module.exports = createContextManager
