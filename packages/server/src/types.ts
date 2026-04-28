import type { FastifyReply } from 'fastify';

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}
export interface ApiError {
  ok: false;
  error: string;
  code: string;
}
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

const NOT_IMPLEMENTED = { ok: false as const, error: 'Not implemented', code: 'not_implemented' };
export function notImplemented(reply: FastifyReply) {
  return reply.status(501).send(NOT_IMPLEMENTED);
}
