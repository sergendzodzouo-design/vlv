import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { configureApp } from "./app.setup.js";
import { ENV } from "./config/config.module.js";
import type { Env } from "./config/env.js";
import { loadLocalEnvFile } from "./config/load-env-file.js";

loadLocalEnvFile();

const app = await NestFactory.create(AppModule);
configureApp(app);

const env = app.get<Env>(ENV);
await app.listen(env.PORT);
