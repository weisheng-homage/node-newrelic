/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger')

/**
 * Factory function to create context manager implementations used by the
 * ContextManager class.
 *
 * @param {object} config New Relic config instance.
 * @returns {*} The appropriate underlying context manager implementation based on
 * the current configuration.
 */
function createContextManager(config) {
  if (config.logging.diagnostics) {
    logger.info('Using LegacyDiagnosticContextManager')

    const LegacyDiagnosticContextManager = require('./diagnostics/legacy-diagnostic-context-manager')
    return new LegacyDiagnosticContextManager(config)
  }

  logger.info('Using LegacyContextManager')

  const LegacyContextManager = require('./legacy-context-manager')
  return new LegacyContextManager(config)
}

module.exports = createContextManager
