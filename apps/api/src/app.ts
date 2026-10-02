import cors from "cors";
import express, { type Application } from "express";
import type { HealthResponse } from "@eternal-realm/shared-types";

export function createApp(): Application {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" }));
  app.use(express.json());

  app.get("/health", (_request, response) => {
    const body: HealthResponse = {
      status: "ok",
      service: "eternal-realm-api",
      timestamp: new Date().toISOString()
    };

    response.status(200).json(body);
  });

  return app;
}
