---
name: codebase-audit
description: Architecture review and efficiency improvements for future refactoring
---
# Codebase Audit: Offline Mode Market Data Generation

## Bug Analysis

**Root Cause**: All data hooks checked `localStorage.getItem("access_token")` inside `useEffect` with **empty dependency arrays** `[]`, meaning they only ran once on mount. They never re-ran when the user logged in/out, so offline mode was never properly detected after initial mount.

### Hooks Affected and Fixes Applied

| File | Issue | Fix |
|------|-------|-----|
| `useMarketPrices.ts:30-103` | Empty `[]` deps, checked localStorage independently | Added `AuthContext`, dependency `[accessToken]` |
| `usePortfolio.ts:71-170` | Empty `[]` deps, `updatePrice` stable never re-runs | Added `AuthContext`, dependency `[accessToken, updatePrice]` |
| `useOrderBook.ts:21-105` | Only `[symbol]` deps, no token check | Added `AuthContext`, dependency `[symbol, accessToken]` |
| `useWatchlistData.ts:71-80` | `fetchWatchlist` had empty deps | Added `AuthContext`, dependency `[accessToken]` via `fetchWatchlist` |
| `useTrade.ts:24-151` | Only `[symbol, timeframe]` deps | Added `AuthContext`, dependency `[symbol, timeframe, accessToken]` |

## Key Changes

### 1. Centralized Auth Detection
All hooks now get `accessToken` from `AuthContext.useContext()` instead of independently reading `localStorage`. This ensures:
- Consistent mode detection across all components
- Proper reactivity when auth state changes (login/logout)
- Single source of truth for online/offline status

### 2. Removed Duplicate Initialization in Layout.tsx
- Deleted lines 60-65: `useEffect` that called `generateAllMockPrices()` when `isOffline` changed
- Deleted line 73: `generateAllMockPrices()` call inside `accessToken` effect
- Layout now relies entirely on `useMarketPrices` hook for offline initialization
- Removed unused `generateAllMockPrices` import

### 3. Architecture Documentation
Added "Offline Mode Architecture" section to `ARCHITECTURE.md` covering:
- Mode detection via `AuthContext.accessToken`
- Data flow: mock generators → price ticks → candles → charts
- Hook architecture pattern requiring `accessToken` dependency
- Mode switching behavior on login/logout

### 4. Build Cleanup
- Removed unused imports: `retrieveOrderbook`, `Orderbook`, `OrderbookLevel` from `mockPriceGenerator.ts`
- Removed unused `notifyOrderbookChange` function
- Fixed `MOCK_MARKETS` reference in Layout.tsx

## Before/After Flow

**Before**: User loads app (no token) → hooks check stale localStorage → inconsistent mode → no data generation

**After**: User loads app (no token) → `AuthContext.accessToken === null` → all hooks detect offline → `useMarketPrices` initializes mock prices + 1s interval → `generateMockTick()` evolves prices → `generateMockCandles()` generates candlesticks → chart displays live data

## Critical Design Rule (Now Enforced)

> **All hooks MUST derive offline mode from `AuthContext.accessToken`, NOT from independent `localStorage.getItem()` calls. All `useEffect` dependencies MUST include `accessToken` to re-run on auth state changes.**

This ensures the entire application consistently enters/exits offline mode in sync when users log in or out.