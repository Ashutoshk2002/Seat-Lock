import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module.js";
import type { Env } from "./config/env.validation.js";
import { API_DOCS_PATH, setupApiDocs } from "./common/docs/api-docs.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  const config = app.get(ConfigService<Env, true>);
  const port = config.get("PORT", { infer: true });
  const docsEnabled = config.get("NODE_ENV", { infer: true }) !== "production";

  if (docsEnabled) {
    setupApiDocs(app);
  }

  await app.listen(port);

  if (docsEnabled) {
    Logger.log(
      `API docs available at http://localhost:${port}/${API_DOCS_PATH}`,
      "Bootstrap"
    );
  }
}
await bootstrap();
