declare global {
    var _mongoClientPromise: Promise<MongoClient> | undefined;
    namespace Cypress {
      interface Chainable {
        mockPrivyLogin(): Chainable<void>;
      }
  }
  }
  
  
  export {};