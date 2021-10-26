# Async State Tracking Notes

Migrating to AsyncLocalStorage...

Thinking introduce a context manager.

Primarily using `run()`?

Instead of swapping tracer.segment... have it throw to surface up missed locations.

Feature flag to manage?

## Research TODOs / Notes

* This new method will result in propagating state regardless of being done. We somewhat do that already but had some checks in timers to reduce extra work. We are probably fine here but could also consider killing state on transaction end going forward.

* stop manual propagation of segment on objects?


## TODOs / Unanswered Questions

* Throughput, CPU, and Memory impact?

* Any negative impacts to our own web code?

* Manually test some apps to ensure no transaction state conflation.

## Implementation Throughts

* Prob use a second pass (not prototype / initial implementation) to clear out segment property setting.

## Limitations / Deprecations / Other Consideration

* Theres `agent.config.logging.diagnostics` that does some weird probing to expensively capture stacks on each segment set (`transaction.traceStacks`, `transaction.probe()`, `segment.probe()`).
  * We don't ever use this with support tickets.
  * Is this Node specific functionality or generic?
  * Either remove (major bump) or solve in a different way cause I don't think we want to do this at the context tracking level.


* `tracer._makeWrapped()` has domain error capture code. Do we still need that? Can we drop supporting domain stuff here?