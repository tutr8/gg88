import serverless from "serverless-http";
import { createServer } from "../server/index";

const app = createServer();
const handler = serverless(app);

export default function (req: any, res: any) {
  return handler(req, res);
}
