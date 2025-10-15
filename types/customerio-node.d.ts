declare module "customerio-node" {
  export enum Regions {
    US = "us",
    EU = "eu",
  }

  export interface TransactionalSendResponse {
    delivery_id?: string;
    id?: string;
    [key: string]: unknown;
  }

  export class TransactionalClient {
    constructor(apiKey: string);
    sendEmail(payload: {
      to: string;
      transactional_message_id: string;
      message_data: Record<string, unknown>;
      identifiers?: Record<string, unknown>;
    }): Promise<TransactionalSendResponse>;
  }
}
