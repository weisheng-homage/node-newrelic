# Async State Tracking Notes

Migrating to AsyncLocalStorage...

Thinking introduce a context manager.

Primarily using `run()`?

Instead of swapping tracer.segment... have it throw to surface up missed locations.

Feature flag to manage?

## Research TODOs / Notes

Current state: all versioned tests that normally pass are passing.

**Next step:**: manual testing state conflation (requests to self) and other such things.

DONT FORGET TO TO LOAD NODE 16 BACK AND CLEAR OUT CACHED MODULES, RELINK, ETC. (KOA TESTS, WATNOT)


* Test making web requests back to self and ensuring don't have state conflation!!!
  * Problem with the connect test was that the new style of tracking propagates the test created transaction
    to the handling of the web request. That sees there's an active transaction and uses it.
  * This is awkward test setup but raises this question/concern.

* How do we confirm we don't have a memory leak / segments are clearing up?

* This new method will result in propagating state regardless of being done. We somewhat do that already but had some checks in timers to reduce extra work. We are probably fine here but could also consider killing state on transaction end going forward.

* stop manual propagation of segment on objects...


**important:** Because AsyncLocalStorage only propagates on init... there's no built-in way to propagate across promise chains regardless of the context in which the continuation was created.
  * Perhaps we just know more manual instrumentation required for context in these scenarios.
  * Unfortunately, could make stuff more brittle instead of less (for promise scenarios) when frameworks introduced we don't support. Maybe we can work around that by eventually making the context management API exposed to end-users. Maybe just a part of getting a shim instance / calling instrument if we introduce a sync version of that. Or maybe just in general? :shrug:.
  * And maybe we leave the fallback for a long-time?

* Fixes koa test by avoiding contextless hop: https://github.com/michaelgoin/node-newrelic-koa/pull/new/promise-context-test-update.
  * That hop isn't really relevant to koa itself (best I can tell)


## TODOs / Unanswered Questions

* Manually test some apps to ensure no transaction state conflation.

* Throughput, CPU, and Memory impact?

* Any negative impacts to our own web code?

## Implementation Throughts

* Prob use a second pass (not prototype / initial implementation) to clear out segment property setting.

## Limitations / Deprecations / Other Consideration

* Theres `agent.config.logging.diagnostics` that does some weird probing to expensively capture stacks on each segment set (`transaction.traceStacks`, `transaction.probe()`, `segment.probe()`).
  * We don't ever use this with support tickets.
  * Is this Node specific functionality or generic?
  * Either remove (major bump) or solve in a different way cause I don't think we want to do this at the context tracking level.


* `tracer._makeWrapped()` has domain error capture code. Do we still need that? Can we drop supporting domain stuff here?