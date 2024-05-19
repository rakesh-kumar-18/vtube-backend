import "dotenv/config";
import express, { Express, Request, Response } from "express";
import connectDB from "./db";

const app: Express = express();
const port = process.env.PORT || 8000;

connectDB();

app.get("/", (req: Request, res: Response) => {
    res.send("Hello World!");
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
