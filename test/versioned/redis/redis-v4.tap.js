/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const test = tap.test
const helper = require('../../lib/agent_helper')
const params = require('../../lib/params')
const urltils = require('../../../lib/util/urltils')

// Indicates unique database in Redis. 0-15 supported.
const DB_INDEX = 2

test('Redis instrumentation', { timeout: 20000 }, function (t) {
  t.autoend()

  let METRIC_HOST_NAME = null
  let HOST_ID = null

  let agent
  let client

  t.beforeEach(async function () {
    await new Promise((resolve, reject) => {
      helper.flushRedisDb(DB_INDEX, (error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })

    agent = helper.instrumentMockedAgent()

    const redis = require('redis')
    client = redis.createClient(params.redis_port, params.redis_host)

    await client.connect()
    await client.ping()

    await client.select(DB_INDEX)

    METRIC_HOST_NAME = urltils.isLocalhost(params.redis_host)
      ? agent.config.getHostnameSafe()
      : params.redis_host
    HOST_ID = METRIC_HOST_NAME + '/' + params.redis_port

    // need to capture attributes
    agent.config.attributes.enabled = true

    // Start testing!
    t.notOk(agent.getTransaction(), 'no transaction should be in play')
  })

  t.afterEach(function () {
    client && client.disconnect()
    agent && helper.unloadAgent(agent)
  })

  t.test('should find Redis calls in the transaction trace', function (t) {
    t.plan(17)
    helper.runInTransaction(agent, async function transactionInScope() {
      const transaction = agent.getTransaction()
      t.ok(transaction, 'transaction should be visible')

      const ok = await client.set('testkey', 'arglbargle')
      t.ok(agent.getTransaction(), 'transaction should still be visible')
      t.ok(ok, 'everything should be peachy after setting')

      const value = await client.get('testkey')
      t.ok(agent.getTransaction(), 'transaction should still still be visible')
      t.equal(value, 'arglbargle', 'memcached client should still work')

      const trace = transaction.trace
      t.ok(trace, 'trace should exist')
      t.ok(trace.root, 'root element should exist')
      t.equal(trace.root.children.length, 1, 'there should be only one child of the root')

      const setSegment = trace.root.children[0]
      const setAttributes = setSegment.getAttributes()
      t.ok(setSegment, 'trace segment for set should exist')
      t.equal(setSegment.name, 'Datastore/operation/Redis/set', 'should register the set')
      t.equal(setAttributes.key, '"testkey"', 'should have the set key as a attribute')
      t.equal(setSegment.children.length, 1, 'set should have an only child')

      const getSegment = setSegment.children[0].children[0]
      const getAttributes = getSegment.getAttributes()
      t.ok(getSegment, 'trace segment for get should exist')

      t.equal(getSegment.name, 'Datastore/operation/Redis/get', 'should register the get')

      t.equal(getAttributes.key, '"testkey"', 'should have the get key as a attribute')

      t.ok(getSegment.children.length >= 1, 'get should have a callback segment')

      t.ok(getSegment.timer.hrDuration, 'trace segment should have ended')
    })
  })

  t.test('should create correct metrics', function (t) {
    t.plan(14)
    helper.runInTransaction(agent, async function transactionInScope() {
      const transaction = agent.getTransaction()
      await client.set('testkey', 'arglbargle')
      await client.get('testkey')
      transaction.end()
      const unscoped = transaction.metrics.unscoped
      const expected = {
        'Datastore/all': 2,
        'Datastore/allWeb': 2,
        'Datastore/Redis/all': 2,
        'Datastore/Redis/allWeb': 2,
        'Datastore/operation/Redis/set': 1,
        'Datastore/operation/Redis/get': 1
      }
      expected['Datastore/instance/Redis/' + HOST_ID] = 2
      checkMetrics(t, unscoped, expected)
    })
  })

  t.test('should add `key` attribute to trace segment', function (t) {
    agent.config.attributes.enabled = true

    helper.runInTransaction(agent, async function () {
      await client.set('saveme', 'foobar')

      const segment = agent.tracer.getSegment().parent
      t.equals(segment.getAttributes().key, '"saveme"', 'should have `key` attribute')
      t.end()
    })
  })

  t.test('should not add `key` attribute to trace segment', function (t) {
    agent.config.attributes.enabled = false

    helper.runInTransaction(agent, async function () {
      await client.set('saveme', 'foobar')

      const segment = agent.tracer.getSegment().parent
      t.notOk(segment.getAttributes().key, 'should not have `key` attribute')
      t.end()
    })
  })

  t.test('should add datastore instance attributes to trace segments', function (t) {
    t.plan(4)

    // Enable.
    agent.config.datastore_tracer.instance_reporting.enabled = true
    agent.config.datastore_tracer.database_name_reporting.enabled = true

    helper.runInTransaction(agent, async function transactionInScope() {
      const transaction = agent.getTransaction()
      await client.set('testkey', 'arglbargle')

      const trace = transaction.trace
      const setSegment = trace.root.children[0]
      const attributes = setSegment.getAttributes()
      t.equals(attributes.host, METRIC_HOST_NAME, 'should have host as attribute')
      t.equals(
        attributes.port_path_or_id,
        String(params.redis_port),
        'should have port as attribute'
      )
      t.equals(attributes.database_name, String(DB_INDEX), 'should have database id as attribute')
      t.equals(attributes.product, 'Redis', 'should have product attribute')
    })
  })

  t.test('should not add instance attributes/metrics when disabled', function (t) {
    t.plan(5)

    // disable
    agent.config.datastore_tracer.instance_reporting.enabled = false
    agent.config.datastore_tracer.database_name_reporting.enabled = false

    helper.runInTransaction(agent, async function transactionInScope() {
      const transaction = agent.getTransaction()
      await client.set('testkey', 'arglbargle')

      const setSegment = transaction.trace.root.children[0]
      const attributes = setSegment.getAttributes()
      t.equals(attributes.host, undefined, 'should not have host attribute')
      t.equals(attributes.port_path_or_id, undefined, 'should not have port attribute')
      t.equals(attributes.database_name, undefined, 'should not have db name attribute')

      transaction.end()
      const unscoped = transaction.metrics.unscoped
      t.equals(
        unscoped['Datastore/instance/Redis/' + HOST_ID],
        undefined,
        'should not have instance metric'
      )
    })
  })

  t.test('should follow selected database', function (t) {
    t.plan(12)
    let transaction = null
    const SELECTED_DB = 3
    helper.runInTransaction(agent, async function (tx) {
      transaction = tx
      await client.set('select:test:key', 'foo')
      t.ok(agent.getTransaction(), 'should not lose transaction state')

      await client.select(SELECTED_DB)
      t.ok(agent.getTransaction(), 'should not lose transaction state')

      await client.set('select:test:key:2', 'bar')
      t.ok(agent.getTransaction(), 'should not lose transaction state')
      transaction.end()
      verify(transaction)
    })

    function verify() {
      const setSegment1 = transaction.trace.root.children[0]
      const selectSegment = setSegment1.children[0].children[0]
      const setSegment2 = selectSegment.children[0].children[0]

      t.equals(setSegment1.name, 'Datastore/operation/Redis/set', 'should register the first set')
      t.equals(
        setSegment1.getAttributes().database_name,
        String(DB_INDEX),
        'should have the starting database id as attribute for the first set'
      )
      t.equals(selectSegment.name, 'Datastore/operation/Redis/select', 'should register the select')
      t.equals(
        selectSegment.getAttributes().database_name,
        String(DB_INDEX),
        'should have the starting database id as attribute for the select'
      )
      t.equals(setSegment2.name, 'Datastore/operation/Redis/set', 'should register the second set')
      t.equals(
        setSegment2.getAttributes().database_name,
        String(SELECTED_DB),
        'should have the selected database id as attribute for the second set'
      )
    }
  })
})

function checkMetrics(t, metrics, expected) {
  Object.keys(expected).forEach(function (name) {
    t.ok(metrics[name], 'should have metric ' + name)
    if (metrics[name]) {
      t.equals(
        metrics[name].callCount,
        expected[name],
        'should have ' + expected[name] + ' calls for ' + name
      )
    }
  })
}
