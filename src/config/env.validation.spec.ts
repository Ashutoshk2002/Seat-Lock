import { validateEnv } from './env.validation.js';

describe('validateEnv', () => {
  it('applies defaults when variables are missing', () => {
    expect(validateEnv({})).toEqual({ NODE_ENV: 'development', PORT: 3000 });
  });

  it('coerces PORT from string to number', () => {
    expect(validateEnv({ PORT: '4000' }).PORT).toBe(4000);
  });

  it('throws on invalid values', () => {
    expect(() => validateEnv({ PORT: 'abc' })).toThrow(
      /Invalid environment variables/,
    );
    expect(() => validateEnv({ NODE_ENV: 'prod' })).toThrow(
      /Invalid environment variables/,
    );
  });
});
