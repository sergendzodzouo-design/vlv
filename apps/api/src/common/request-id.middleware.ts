import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const VALID_ID = /^[A-Za-z0-9-]{8,64}$/;

/** Donne à chaque requête un identifiant, renvoyé dans l'en-tête x-request-id. */
export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const incoming = request.header("x-request-id");
  const id = incoming && VALID_ID.test(incoming) ? incoming : randomUUID();
  response.setHeader("x-request-id", id);
  next();
}
