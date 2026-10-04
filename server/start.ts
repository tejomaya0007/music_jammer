import { startMockServer } from './mock-server';

const port = Number(process.env.MOCK_PORT ?? 8787);
await startMockServer(port);
console.log(`mock backend (test/dev only) on http://127.0.0.1:${port}/mock-api`);
