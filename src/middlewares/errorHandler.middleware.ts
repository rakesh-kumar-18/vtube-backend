import { NextFunction, Request, Response } from "express";
import ApiError from "../utils/ApiError";

const errorHandler = (err: ApiError, req: Request, res: Response, next: NextFunction): void => {
    err.statusCode = err.statusCode || 500;
    res.status(err.statusCode).json({ ...err, message: err.message });
};

export default errorHandler;
