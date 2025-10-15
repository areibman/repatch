import { webcrypto } from "crypto";

global.crypto = webcrypto as unknown as Crypto;
