import assert from "node:assert/strict"

export function expect(actual: any) {
  const checks = {
    toBe(expected: any) {
      assert.strictEqual(actual, expected)
    },
    toBeNull() {
      assert.strictEqual(actual, null)
    },
    toBeTruthy() {
      assert.ok(actual)
    },
    toContain(expected: any) {
      assert.ok(actual.includes(expected), `${JSON.stringify(actual)} does not contain ${JSON.stringify(expected)}`)
    },
    toHaveLength(expected: number) {
      assert.strictEqual(actual.length, expected)
    },
    toMatch(expected: RegExp) {
      assert.match(actual, expected)
    },
    toBeInstanceOf(expected: any) {
      assert.ok(actual instanceof expected)
    },
  }

  return Object.assign(checks, {
    not: {
      toBe(expected: any) {
        assert.notStrictEqual(actual, expected)
      },
    },
    rejects: {
      async toThrow(expected: RegExp | Function) {
        await assert.rejects(actual, expected as any)
      },
    },
  })
}
