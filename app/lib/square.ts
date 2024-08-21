import { Client, Environment } from 'square';

const squareEnv = process.env.SQUARE_ENV!;
const accessToken = process.env.SQUARE_ACCESS_TOKEN!;

let environment: Environment;

switch (squareEnv) {
  case 'production':
    environment = Environment.Production;
    break;
  case 'sandbox':
    environment = Environment.Sandbox;
    break;
  default:
    throw new Error('Invalid SQUARE_ENV value. Must be either "production" or "sandbox".');
}

const squareClient = new Client({
  accessToken,
  environment
});

export default squareClient;
