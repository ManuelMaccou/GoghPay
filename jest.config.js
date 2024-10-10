// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom', // Simulate browser environment for DOM tests
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  roots: ['<rootDir>/app'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'], // Setup file for jest-dom
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  collectCoverageFrom: ['<rootDir>/app/**/*.{ts,tsx}'],
  coverageDirectory: '<rootDir>/coverage',
};
