export type HealthServices = {
  database: 'up' | 'down';
  redis: 'up' | 'down' | 'skipped';
  storage: 'up' | 'down';
};

export type HealthResponse = {
  status: 'ok' | 'error';
  timestamp: string;
  services: HealthServices;
};
