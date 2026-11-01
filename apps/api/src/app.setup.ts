import type { INestApplication } from "@nestjs/common";
import { requestIdMiddleware } from "./common/request-id.middleware.js";
import { ProblemDetailsFilter } from "./common/problem-details.filter.js";

export function configureApp(app: INestApplication): void {
  app.getHttpAdapter().getInstance().disable("x-powered-by");
  app.setGlobalPrefix("api/v1");
  app.use(requestIdMiddleware);
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableShutdownHooks();
}
