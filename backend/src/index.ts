import { app } from './app';
import { env } from './config/env';
import { info } from './utils/logger';

app.listen(env.BACKEND_PORT, () => {
  info(`Backend running at http://localhost:${env.BACKEND_PORT}`);
});
