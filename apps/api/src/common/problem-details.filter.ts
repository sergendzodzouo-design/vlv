import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { STATUS_CODES } from "node:http";

function detailOf(exception: HttpException): string {
  const body = exception.getResponse();
  if (typeof body === "string") return body;
  const message = (body as { message?: string | string[] }).message;
  if (Array.isArray(message)) return message.join(" ; ");
  return message ?? exception.message;
}

/** Toutes les erreurs de l'API sortent dans le même format (RFC 9457, application/problem+json). */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Http");

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const requestId = String(response.getHeader("x-request-id") ?? "");

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!isHttp) {
      this.logger.error(
        `Erreur non gérée [${requestId}] : ${exception instanceof Error ? exception.stack : String(exception)}`,
      );
    }

    response
      .status(status)
      .type("application/problem+json")
      .json({
        type: "about:blank",
        title: STATUS_CODES[status] ?? "Error",
        status,
        detail: isHttp ? detailOf(exception) : "Une erreur interne est survenue.",
        instance: request.path,
        requestId,
      });
  }
}
