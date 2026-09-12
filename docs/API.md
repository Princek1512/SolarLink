# API Specification

Base path: `/api`

## Authentication

`POST /auth/register`

`POST /auth/login`

`GET /auth/me`

## Users/Assets

`GET /users/:id`

`POST /assets`

`GET /assets/:id`

`POST /assets/:id/meter`

## Meter

`GET /meters/:id/latest`

`GET /meters/:id/readings`

`POST /meters/:id/simulate`

## Marketplace

`GET /listings`

`POST /listings`

`PATCH /listings/:id`

`GET /orders`

`POST /orders`

## Trading

`POST /trades/match`

`GET /trades/:id`

`GET /trades/:id/events`

`POST /trades/:id/delivery/verify`

`POST /trades/:id/dispute`

## Pricing

`GET /pricing/quote?zoneId=...&quantity=...`

`GET /pricing/config/:zoneId`

`PATCH /pricing/config/:zoneId`

## Grid

`GET /zones`

`GET /zones/:id/status`

`PATCH /zones/:id`

## Settlement

`POST /settlements/:tradeId`

`GET /wallet`

`GET /wallet/transactions`

## Dashboard

`GET /dashboard/market`

`GET /dashboard/prosumer`

`GET /dashboard/consumer`

`GET /dashboard/regulator`

## API Rules

- Backend is the source of truth.
- Frontend must not calculate final trade price.
- Frontend must not directly modify trade status.
- Role authorization is enforced server-side.
- Every trade state change creates a trade event.
