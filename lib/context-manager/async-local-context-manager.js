/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { AsyncLocalStorage } = require('async_hooks')

// TODO: helper to just get segment?
// TODO: could have a 'transaction context' that auto sets the appropriate fields
// TODO: need an API means of setting the segment so aren't relying on that being perfect in all the code paths.
// TODO: this is only available in certain version of node, need protections

/**
 * NOTE: async-hooks tracking still loaded by globals.js
 */
class AsyncLocalContextManager {
  constructor() {
    this._context = {
      segment: null
    }

    this._asyncLocalStorage = new AsyncLocalStorage()
  }

  getContext() {
    return this._asyncLocalStorage.getStore() || this._context
  }

  setContext(newContext) {
    // TODO: this is considered experimental. Prob avoid having this as a public / non-test API? Or do we need this?
    this._asyncLocalStorage.enterWith(newContext)
  }

  // TODO: currently doesn't play well with `arguments` passed directly in.
  // all current uses just use a callback / don't fully pass through.
  // Maybe just stick with that and don't ever pass in handlerThis and args?
  runWithContext(context, handler, handlerThis, ...args) {
    let func = handler
    if (handlerThis) {
      // AsyncLocalStorage.run() calls Reflect.apply(func, null, args)
      func = handler.bind(handlerThis)
    }

    return this._asyncLocalStorage.run(context, func, ...args)
  }

  enable() {
    // TODO: what else needs to be done here?
  }

  // TODO: disable on agent
  // current async hooks only disable on unload which is only triggered by the agent_helper test helper
  // so this is a bit of a mess.
  disable() {
    // TODO: not sure if this even makes sense to do...
    // calling asyncLocalStorage.run() will auto re-enable. Perhaps wipe it out? Have a means of disposing?
    this._asyncLocalStorage.disable()
    // TODO: disable
  }
}

module.exports = AsyncLocalContextManager
