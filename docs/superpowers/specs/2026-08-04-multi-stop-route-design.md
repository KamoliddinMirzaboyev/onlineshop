# Multi-stop optimal yetkazish marshruti

Date: 2026-08-04  
Status: implemented

## Maqsad

Kuryer 3–4 ta buyurtmani yig‘ib, «Yo‘lga chiqish» bosganda tizim manzillarni
**eng qisqa yo‘l** tartibida joylashtiradi (TSP). Yoqilg‘i va vaqt tejaladi.

## Oqim

1. Kuryer bir nechta buyurtmani `accepted` qiladi, miqdor tahrirlaydi.
2. «Yo‘lga chiqish» / `POST /courier/route/start` yoki bitta buyurtmada
   `PATCH … status=delivering` → **barcha** accepted lar bir reysda.
3. Server: ombor (restaurant lat/lng yoki zona markazi) → stop’lar TSP.
4. Har bir buyurtma: `delivering`, `route_group_id`, `route_sequence` (1…N),
   `route_leg_km`, kumulativ ETA.
5. UI: `#1`, `#2`… badge + multi-stop Yandex/Google xarita.

## Algoritm

- Haversine masofa.
- ≤8 stop: to‘liq permutatsiya (exact optimum).
- >8: nearest-neighbor (hozir max 8 ta cheklov).
- Koordinatasiz buyurtmalar oxiriga.

## API

- `POST /api/courier/route/start` body: `{ "order_ids": null | [int] }`
- Response: `{ route_group_id, total_distance_km, orders: OrderOut[] }`

## DB (orders)

- `route_group_id VARCHAR(36)`
- `route_sequence INTEGER`
- `route_leg_km DOUBLE PRECISION`

## Cheklovlar (hozir)

- Real yo‘l tarmog‘i / trafik yo‘q (OSRM keyin).
- Yo‘lda yangi buyurtma reysga avto-qo‘shilmaydi.
- Max 8 stop / reys.
