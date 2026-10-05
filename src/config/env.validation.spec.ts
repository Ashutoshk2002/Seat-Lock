import { validateEnv } from "./env.validation.js";

const DATABASE_URL = "postgres://user:pass@localhost:5432/db";

describe("validateEnv", () => {
  it("applies defaults when optional variables are missing", () => {
    expect(validateEnv({ DATABASE_URL })).toEqual({
      NODE_ENV: "development",
      PORT: 3000,
      DATABASE_URL,
      DB_POOL_MAX: 10,
    });
  });

  it("coerces numeric variables from strings", () => {
    const env = validateEnv({ DATABASE_URL, PORT: "4000", DB_POOL_MAX: "1" });

    expect(env.PORT).toBe(4000);
    expect(env.DB_POOL_MAX).toBe(1);
  });

  it("requires DATABASE_URL", () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it("rejects a non-postgres DATABASE_URL", () => {
    expect(() =>
      validateEnv({ DATABASE_URL: "mysql://user:pass@localhost/db" })
    ).toThrow(/DATABASE_URL/);
  });

  it("throws on invalid values", () => {
    expect(() => validateEnv({ DATABASE_URL, PORT: "abc" })).toThrow(
      /Invalid environment variables/
    );
    expect(() => validateEnv({ DATABASE_URL, NODE_ENV: "prod" })).toThrow(
      /Invalid environment variables/
    );
  });
});
