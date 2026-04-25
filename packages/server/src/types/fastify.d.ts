export {};

declare module 'fastify' {
  interface FastifyRequest {
    userId: number;
  }
}

declare module '@fastify/session' {
  interface FastifySessionObject {
    userId?: number;
  }
}
