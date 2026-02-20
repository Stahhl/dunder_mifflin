import type { FullConfig } from "@playwright/test";

export default async function globalSetup(_config: FullConfig): Promise<void> {
  // PR2 keeps setup intentionally minimal; services are started via Docker Compose profiles.
}
