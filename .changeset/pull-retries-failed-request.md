---
"partytracks": patch
---

`pull()` now retries when its bulk `tracks/new` or `renegotiate` request fails. The rejection was unhandled, so the pulled track never errored, never retried and never emitted. Every pull batched with it stayed silent until `trackData$` or `session$` emitted again.
