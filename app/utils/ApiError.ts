export class ApiError extends Error {
  public status: number;
  public responseBody: any;

  constructor(message: string, status: number, responseBody: any) {
    super(message); // Call the base class constructor
    this.status = status;
    this.responseBody = responseBody;
  }
}