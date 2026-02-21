import type { OfflineOperation, ShipmentSummary } from "../types/warehouse";

const OFFLINE_QUEUE_KEY = "warehouse_mobile_offline_queue_v1";
const SHIPMENT_CACHE_KEY = "warehouse_mobile_shipment_cache_v1";

export function readOfflineQueue(): OfflineOperation[] {
  return readJson<OfflineOperation[]>(OFFLINE_QUEUE_KEY, []);
}

export function writeOfflineQueue(items: OfflineOperation[]): void {
  writeJson(OFFLINE_QUEUE_KEY, items);
}

export function readShipmentCache(): ShipmentSummary[] {
  return readJson<ShipmentSummary[]>(SHIPMENT_CACHE_KEY, []);
}

export function writeShipmentCache(items: ShipmentSummary[]): void {
  writeJson(SHIPMENT_CACHE_KEY, items);
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}
