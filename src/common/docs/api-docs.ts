import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { apiReference } from "@scalar/nestjs-api-reference";

export const API_DOCS_PATH = "docs";
export const OPENAPI_JSON_PATH = "openapi.json";

/**
 * Generates the OpenAPI document from controllers/DTOs and serves:
 * - Scalar API reference UI at `/docs`
 * - Raw OpenAPI JSON at `/openapi.json` (for client generation / tooling)
 */
export function setupApiDocs(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle("Seat Lock API")
    .setDescription("Seat Lock backend REST API")
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup("openapi", app, document, {
    ui: false,
    raw: ["json"],
    jsonDocumentUrl: OPENAPI_JSON_PATH,
  });

  app.use(`/${API_DOCS_PATH}`, apiReference({ content: document }));
}
