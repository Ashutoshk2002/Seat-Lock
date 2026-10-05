import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { App } from "supertest/types.js";
import { AppModule } from "@/app.module.js";
import { setupApiDocs } from "@/common/docs/api-docs.js";

describe("API docs (e2e)", () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApiDocs(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("/openapi.json (GET) serves the OpenAPI document", async () => {
    const res = await request(app.getHttpServer())
      .get("/openapi.json")
      .expect(200);

    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.info.title).toBe("Seat Lock API");
  });

  it("/docs (GET) serves the Scalar UI", async () => {
    const res = await request(app.getHttpServer()).get("/docs").expect(200);

    expect(res.headers["content-type"]).toContain("text/html");
  });
});
