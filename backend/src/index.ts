import { app } from './app';
import { env } from './config/env';

app.listen(env.BACKEND_PORT, () => {
  console.log(`Backend running at http://localhost:${env.BACKEND_PORT}`);
});
