/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: helper to just get segment?
// TODO: could have a 'transaction context' that auto sets the appropriate fields
// TODO: need an API means of setting the segment so aren't relying on that being perfect in all the code paths.

/**
 * NOTE: async-hooks tracking still loaded by globals.js
 */
class LegacyContextManager {
  constructor() {
    // this._context = {
    //   segment: null
    // }

    this._context = null
  }

  getContext() {
    return this._context
  }

  setContext(newContext) {
    this._context = newContext
  }

  runWithContext(context, handler, handlerThis, ...args) {
    const oldContext = this._context
    this.setContext(context)

    try {
      return handler.apply(handlerThis, ...args)
    } finally {
      this._context = oldContext
    }
  }

  enable() {
    // TODO: what else needs to be done here?
  }

  // TODO: disable on agent
  disable() {
    // TODO: disable the async hooks
  }
}

module.exports = LegacyContextManager
