# Async State Tracking Notes


Feature Flag: new_async_context

* createContextManager = factory method
* AsyncLocalContextManager = State tracking via AsyncLocalStorage
* LegacyContextManager = manual get/set. Async hooks still initialized externally but should eventually roll in here. Potentially kill off old promise style.


## Team TODO

* Schedule introducing legacy context manager
* Initial perf numbers from prototypes... local numbers to inform how we go forward
* Schedule implementing initial asynclocalstorage context management behind a feature-flag.
  * -> find customers to test
    * every customer using our promise feature flags
    * any customers complaining about perf in general
  * Do some proper CPU/Memory/Throughput exploration
* Review/figure out next steps / things to fix to make easier on customers such as exposing Context Manager
* Feature flag flipped to true

## Current State

* All unit tests pass
* All integration tests *except* native promise tests pass (due to not propagating after contextless timer schedules / no longer chaining promise to promise)
* All versioned tests pass
  * Requires code change to koa test to avoid manual contextless timer hop. This is not framework specific so seems fine.
  * Required modifying connect to avoid early transaction creation. This was a test setup issue.
* Verified express does not have state conflation and is showing similar traces in manual test.
* Verified fastify does not have state conflation and is showing similar traces in manual test.
* Nothing sketch in logs thus far.

## Research TODOs / Notes

* Problem with the connect test was that the new style of tracking propagates the test created transaction
  to the handling of the web request. That sees there's an active transaction and uses it. Likely because a transaction was active prior to server creation... so the timers involved with the server had an active transaction to start propagating (prob forever?).
  * **consider**: if customers do the wrong thing they could get stuck in this sort of situation. may need a means of killing go-forward propagation. If we expose context manager api, they could just set null (maybe we provide a helper and/or 'null' context for reuse).

* **How do we confirm we don't have a memory leak / segments are clearing up?**

* This new method will result in propagating state regardless of being done. We somewhat do that already but had some checks in timers to reduce extra work. We are probably fine here but could also consider killing state on transaction end going forward.

**important:** Because AsyncLocalStorage only propagates on init... there's no built-in way to propagate across promise chains regardless of the context in which the continuation was created. https://github.com/nodejs/help/issues/3041
  * Perhaps we just know more manual instrumentation required for context in these scenarios.
  * Unfortunately, could make stuff more brittle instead of less (for promise scenarios) when frameworks introduced we don't support. Maybe we can work around that by eventually making the context management API exposed to end-users. Maybe just a part of getting a shim instance / calling instrument if we introduce a sync version of that. Or maybe just in general? :shrug:.
  * And maybe we leave the fallback for a long-time?

* Fixes koa test by avoiding contextless hop: https://github.com/michaelgoin/node-newrelic-koa/pull/new/promise-context-test-update.
  * That hop isn't really relevant to koa itself (best I can tell)

* Real implementation will want some different native promise tests that test various scenarios without the contextless timer hop.

## TODOs / Unanswered Questions



* Ensure no memory leaks

* Throughput, CPU, and Memory impact?

* Stop manual propagation of current segment on objects...
  storing segment on the function



* Current propagation is allocation heavy



* Consider how we might expose context management to customers. Thinking via getting handle to instrumentation. Right now this is async and gives you a shim on module load. If we have a sync version (which we already want for koa) we can inject shim + context manager. Top of head thought. We will want things to be easy/straightforward so prob dont' want to start here as we figure out clean patterns for setting context simply.

## Implementation Throughts

* Prob use a second pass (not prototype / initial implementation) to clear out segment property setting.

## Limitations / Deprecations / Other Consideration

* Theres `agent.config.logging.diagnostics` that does some weird probing to expensively capture stacks on each segment set (`transaction.traceStacks`, `transaction.probe()`, `segment.probe()`).
  * We don't ever use this with support tickets.
  * Is this Node specific functionality or generic?
  * Either remove (major bump) or solve in a different way cause I don't think we want to do this at the context tracking level.


* `tracer._makeWrapped()` has domain error capture code. Do we still need that? Can we drop supporting domain stuff here?