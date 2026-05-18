---
inclusion: always
---

# Product Overview

`@stackra/ts-realtime` — Platform-agnostic Laravel Echo wrapper with typed
channels, reconnection handling, and React hooks.

## Purpose

Provides real-time WebSocket communication for React applications backed by
Pusher/Reverb through Laravel Echo. Supports multiple named connections,
private/presence channels, automatic reconnection, and transparent integration
with `@stackra/ts-events` (auto-bridge) and `@stackra/ts-http` (X-Socket-Id
header).

## Key Features

- Multiple named realtime connections with a configurable default
- Laravel Echo + Pusher driver (`LaravelEchoConnector`), Redis connector
  scaffolding
- Typed channels, presence channels, and typed event payloads via
  `RealtimeEvents`
- Automatic bridge to `@stackra/ts-events` for `realtime:{channel}.{event}`
  dispatching
- HTTP interceptor that injects `X-Socket-Id` on all requests when
  `@stackra/ts-http` is present
- DI decorators (`@InjectRealtime`, `@InjectRealtimeManager`), facade, and React
  hooks (`useChannel`, `usePresence`, `useRealtime`)

## Package Export

`@stackra/ts-realtime` — main entry point (`./dist/index.js`)
