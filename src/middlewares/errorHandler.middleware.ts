import { NextFunction, Request, Response } from "express";
import ApiError from "../utils/ApiError";

const errorHandler = (
    err: ApiError,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    res.status(err.statusCode).json({
        statusCode: err.statusCode,
        message: err.message,
        success: err.success,
        stack: process.env.NODE_ENV === "development" ? err.stack : "",
    });
};

export default errorHandler;
